import os
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, List

import cloudinary
import cloudinary.uploader
from fastapi import (
    FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query,
    UploadFile, File, Form,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from database import engine, Base, get_db
import models, schemas
from auth import hash_password, verify_password, create_access_token, get_current_user, SECRET_KEY, ALGORITHM

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Project 6 - Chat App API")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "null"],  # "null" = local file:// testing; remove once we deploy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RESET_TOKEN_EXPIRE_MINUTES = 30


# ---------- Auth ----------

@app.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        (models.User.email == user.email) | (models.User.username == user.username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account with that email")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

    db.add(models.PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()

    return {"reset_token": token, "expires_at": expires_at}


@app.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_entry = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == payload.token
    ).first()

    if not reset_entry or reset_entry.used or reset_entry.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(models.User).filter(models.User.id == reset_entry.user_id).first()
    user.hashed_password = hash_password(payload.new_password)
    reset_entry.used = True
    db.commit()

    return {"message": "Password updated successfully"}


@app.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


# ---------- Conversations & Messages ----------

def get_conversation_or_404(conversation_id: int, db: Session, current_user: models.User):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    is_participant = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation_id,
        models.ConversationParticipant.user_id == current_user.id,
    ).first()
    if not is_participant:
        raise HTTPException(status_code=403, detail="You are not part of this conversation")

    return conversation


def serialize_conversation(conversation: models.Conversation, db: Session) -> schemas.ConversationOut:
    participants = (
        db.query(models.User)
        .join(models.ConversationParticipant, models.ConversationParticipant.user_id == models.User.id)
        .filter(models.ConversationParticipant.conversation_id == conversation.id)
        .all()
    )
    return schemas.ConversationOut(
        id=conversation.id,
        is_group=conversation.is_group,
        name=conversation.name,
        created_at=conversation.created_at,
        participants=[schemas.ParticipantOut(id=u.id, username=u.username) for u in participants],
    )


@app.post("/conversations", response_model=schemas.ConversationOut)
def create_conversation(
    payload: schemas.ConversationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    other_users = db.query(models.User).filter(models.User.username.in_(payload.participant_usernames)).all()
    found = {u.username for u in other_users}
    missing = set(payload.participant_usernames) - found
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown usernames: {', '.join(missing)}")

    if not payload.is_group and len(other_users) != 1:
        raise HTTPException(status_code=400, detail="A 1:1 conversation needs exactly one other participant")

    if not payload.is_group:
        other_user_id = other_users[0].id
        existing = (
            db.query(models.Conversation)
            .join(models.ConversationParticipant, models.ConversationParticipant.conversation_id == models.Conversation.id)
            .filter(
                models.Conversation.is_group == False,
                models.ConversationParticipant.user_id.in_([current_user.id, other_user_id]),
            )
            .group_by(models.Conversation.id)
            .having(func.count(models.ConversationParticipant.user_id.distinct()) == 2)
            .first()
        )
        if existing:
            return serialize_conversation(existing, db)

    conversation = models.Conversation(is_group=payload.is_group, name=payload.name)
    db.add(conversation)
    db.flush()  # assigns conversation.id before we commit

    for uid in {current_user.id} | {u.id for u in other_users}:
        db.add(models.ConversationParticipant(conversation_id=conversation.id, user_id=uid))

    db.commit()
    db.refresh(conversation)
    return serialize_conversation(conversation, db)


@app.get("/conversations", response_model=list[schemas.ConversationOut])
def list_conversations(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    conversation_ids = [
        cp.conversation_id
        for cp in db.query(models.ConversationParticipant).filter(models.ConversationParticipant.user_id == current_user.id).all()
    ]
    conversations = db.query(models.Conversation).filter(models.Conversation.id.in_(conversation_ids)).all()
    return [serialize_conversation(c, db) for c in conversations]


@app.post("/conversations/{conversation_id}/messages", response_model=schemas.MessageOut)
def send_message(
    conversation_id: int,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)

    message = models.Message(conversation_id=conversation_id, sender_id=current_user.id, content=payload.content)
    db.add(message)
    db.commit()
    db.refresh(message)

    return schemas.MessageOut(
        id=message.id, conversation_id=message.conversation_id, sender_id=message.sender_id,
        sender_username=current_user.username, content=message.content,
        attachment_url=None, attachment_type=None, created_at=message.created_at,
    )


@app.get("/conversations/{conversation_id}/messages", response_model=list[schemas.MessageOut])
def list_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)

    rows = (
        db.query(models.Message, models.User.username)
        .join(models.User, models.Message.sender_id == models.User.id)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )
    return [
        schemas.MessageOut(
            id=m.id, conversation_id=m.conversation_id, sender_id=m.sender_id,
            sender_username=uname, content=m.content,
            attachment_url=m.attachment_url, attachment_type=m.attachment_type,
            created_at=m.created_at,
        )
        for m, uname in rows
    ]


@app.post("/conversations/{conversation_id}/messages/upload", response_model=schemas.MessageOut)
async def upload_message_attachment(
    conversation_id: int,
    file: UploadFile = File(...),
    caption: str = Form(""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)

    is_image = (file.content_type or "").startswith("image/")
    upload_result = cloudinary.uploader.upload(
        file.file,
        resource_type="image" if is_image else "raw",
        folder=f"project6-chat/conversation_{conversation_id}",
    )

    message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=caption,
        attachment_url=upload_result["secure_url"],
        attachment_type="image" if is_image else "file",
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    out_dict = {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "sender_username": current_user.username,
        "content": message.content,
        "attachment_url": message.attachment_url,
        "attachment_type": message.attachment_type,
        "created_at": message.created_at.isoformat(),
    }
    await manager.broadcast(conversation_id, out_dict)

    return schemas.MessageOut(**out_dict)


# ---------- WebSocket: live messaging ----------

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    def connect(self, conversation_id: int, websocket: WebSocket):
        self.active_connections.setdefault(conversation_id, []).append(websocket)

    def disconnect(self, conversation_id: int, websocket: WebSocket):
        connections = self.active_connections.get(conversation_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.active_connections.pop(conversation_id, None)

    async def broadcast(self, conversation_id: int, message: dict):
        for connection in self.active_connections.get(conversation_id, []):
            await connection.send_json(message)


manager = ConnectionManager()


def get_user_from_token(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.query(models.User).filter(models.User.id == int(user_id)).first()


@app.websocket("/ws/conversations/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    await websocket.accept()  # accept FIRST, so any close() after this carries a real reason code

    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(code=4001)  # invalid/missing token
        return

    is_participant = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation_id,
        models.ConversationParticipant.user_id == user.id,
    ).first()
    if not is_participant:
        await websocket.close(code=4003)  # not a member of this conversation
        return

    manager.connect(conversation_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            content = (payload.get("content") or "").strip()
            if not content:
                continue

            message = models.Message(conversation_id=conversation_id, sender_id=user.id, content=content)
            db.add(message)
            db.commit()
            db.refresh(message)

            out = {
                "id": message.id,
                "conversation_id": message.conversation_id,
                "sender_id": message.sender_id,
                "sender_username": user.username,
                "content": message.content,
                "attachment_url": None,
                "attachment_type": None,
                "created_at": message.created_at.isoformat(),
            }
            await manager.broadcast(conversation_id, out)
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)


# ---------- WebSocket: presence ----------

class PresenceManager:
    def __init__(self):
        self.online_users: Dict[int, List[WebSocket]] = {}

    def add(self, user_id: int, websocket: WebSocket):
        self.online_users.setdefault(user_id, []).append(websocket)

    def remove(self, user_id: int, websocket: WebSocket):
        connections = self.online_users.get(user_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.online_users.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return bool(self.online_users.get(user_id))

    async def broadcast_to_contacts(self, db: Session, user_id: int, event: dict):
        contact_conversation_ids = db.query(models.ConversationParticipant.conversation_id).filter(
            models.ConversationParticipant.user_id == user_id
        )
        contact_ids = {
            cp.user_id
            for cp in db.query(models.ConversationParticipant).filter(
                models.ConversationParticipant.conversation_id.in_(contact_conversation_ids)
            ).all()
            if cp.user_id != user_id
        }
        for contact_id in contact_ids:
            for connection in self.online_users.get(contact_id, []):
                await connection.send_json(event)


presence_manager = PresenceManager()


@app.websocket("/ws/presence")
async def presence_endpoint(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    await websocket.accept()

    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(code=4001)
        return

    presence_manager.add(user.id, websocket)
    await presence_manager.broadcast_to_contacts(
        db, user.id, {"type": "presence", "user_id": user.id, "username": user.username, "online": True}
    )

    try:
        while True:
            await websocket.receive_text()  # this socket only pushes events out; ignore anything sent in
    except WebSocketDisconnect:
        presence_manager.remove(user.id, websocket)
        if not presence_manager.is_online(user.id):
            user.last_seen = datetime.utcnow()
            db.commit()
            await presence_manager.broadcast_to_contacts(
                db, user.id,
                {"type": "presence", "user_id": user.id, "username": user.username,
                 "online": False, "last_seen": user.last_seen.isoformat()},
            )


@app.get("/conversations/{conversation_id}/presence")
def get_conversation_presence(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)

    participants = (
        db.query(models.User)
        .join(models.ConversationParticipant, models.ConversationParticipant.user_id == models.User.id)
        .filter(models.ConversationParticipant.conversation_id == conversation_id)
        .all()
    )
    return [
        {
            "id": u.id,
            "username": u.username,
            "online": presence_manager.is_online(u.id),
            "last_seen": u.last_seen.isoformat() if u.last_seen else None,
        }
        for u in participants
    ]
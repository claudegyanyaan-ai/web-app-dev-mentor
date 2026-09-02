import os
import secrets
from datetime import datetime, timedelta
from typing import Dict, List

import cloudinary
import cloudinary.uploader

from fastapi import (
    FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect,
    Query, UploadFile, File, Form,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from database import engine, SessionLocal, get_db, Base
import models
import schemas
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, SECRET_KEY, ALGORITHM,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Project 6 - Chat App")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "null"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Auth ----------------

@app.post("/signup", response_model=schemas.UserOut)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = models.User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account with that email")

    token = secrets.token_urlsafe(32)
    reset_token = models.PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(minutes=30),
    )
    db.add(reset_token)
    db.commit()

    return {"reset_token": token, "message": "Use this token with /reset-password within 30 minutes"}


@app.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == payload.token,
        models.PasswordResetToken.used == False,
    ).first()
    if not reset_token or reset_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(models.User).filter(models.User.id == reset_token.user_id).first()
    user.hashed_password = hash_password(payload.new_password)
    reset_token.used = True
    db.commit()

    return {"message": "Password reset successful"}


@app.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


# ---------------- Conversation helpers ----------------

def get_conversation_or_404(conversation_id: int, db: Session, current_user: models.User):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    participant = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation_id,
        models.ConversationParticipant.user_id == current_user.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    return conversation


def serialize_conversation(conversation: models.Conversation, db: Session):
    participants = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation.id
    ).all()
    return {
        "id": conversation.id,
        "is_group": conversation.is_group,
        "name": conversation.name,
        "created_at": conversation.created_at,
        "participants": [{"id": p.user.id, "username": p.user.username} for p in participants],
    }


# ---------------- Conversations ----------------

@app.post("/conversations", response_model=schemas.ConversationOut)
def create_conversation(
    payload: schemas.ConversationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    usernames = set(payload.participant_usernames)
    usernames.add(current_user.username)

    users = db.query(models.User).filter(models.User.username.in_(usernames)).all()
    if len(users) != len(usernames):
        raise HTTPException(status_code=404, detail="One or more usernames not found")

    user_ids = [u.id for u in users]

    if not payload.is_group and len(user_ids) == 2:
        existing = (
            db.query(models.Conversation)
            .join(models.ConversationParticipant)
            .filter(
                models.Conversation.is_group == False,
                models.ConversationParticipant.user_id.in_(user_ids),
            )
            .group_by(models.Conversation.id)
            .having(func.count(func.distinct(models.ConversationParticipant.user_id)) == 2)
            .first()
        )
        if existing:
            existing_ids = {
                p.user_id for p in db.query(models.ConversationParticipant).filter(
                    models.ConversationParticipant.conversation_id == existing.id
                ).all()
            }
            if existing_ids == set(user_ids):
                return serialize_conversation(existing, db)

    conversation = models.Conversation(is_group=payload.is_group, name=payload.name)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    for uid in user_ids:
        db.add(models.ConversationParticipant(conversation_id=conversation.id, user_id=uid))
    db.commit()

    return serialize_conversation(conversation, db)


@app.get("/conversations", response_model=list[schemas.ConversationOut])
def list_conversations(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    my_participations = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.user_id == current_user.id
    ).all()
    visible_ids = []
    for cp in my_participations:
        if cp.deleted_at is None:
            visible_ids.append(cp.conversation_id)
        else:
            has_newer_message = db.query(models.Message).filter(
                models.Message.conversation_id == cp.conversation_id,
                models.Message.created_at > cp.deleted_at,
            ).first()
            if has_newer_message:
                visible_ids.append(cp.conversation_id)
    conversations = db.query(models.Conversation).filter(models.Conversation.id.in_(visible_ids)).all()
    return [serialize_conversation(c, db) for c in conversations]


@app.delete("/conversations/{conversation_id}/me")
def delete_conversation_for_me(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    participant = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation_id,
        models.ConversationParticipant.user_id == current_user.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Conversation not found")
    participant.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Conversation deleted for you"}


@app.delete("/conversations/{conversation_id}")
def delete_conversation_for_everyone(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    conversation = get_conversation_or_404(conversation_id, db, current_user)
    attachments = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id,
        models.Message.attachment_public_id.isnot(None),
    ).all()
    for msg in attachments:
        try:
            cloudinary.uploader.destroy(
                msg.attachment_public_id,
                resource_type="image" if msg.attachment_type == "image" else "raw",
            )
        except Exception:
            pass
    db.delete(conversation)
    db.commit()
    return {"message": "Conversation deleted for everyone"}


# ---------------- Messages (REST) ----------------

@app.post("/conversations/{conversation_id}/messages", response_model=schemas.MessageOut)
def send_message(
    conversation_id: int,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)
    message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=payload.content,
        attachment_url=None,
        attachment_type=None,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "sender_username": current_user.username,
        "content": message.content,
        "attachment_url": None,
        "attachment_type": None,
        "created_at": message.created_at,
    }


@app.get("/conversations/{conversation_id}/messages", response_model=list[schemas.MessageOut])
def list_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)
    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender_id": m.sender_id,
            "sender_username": m.sender.username,
            "content": m.content,
            "attachment_url": m.attachment_url,
            "attachment_type": m.attachment_type,
            "created_at": m.created_at,
        }
        for m in messages
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
        attachment_public_id=upload_result["public_id"],
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    out_dict = {
        "id": message.id, "conversation_id": message.conversation_id, "sender_id": message.sender_id,
        "sender_username": current_user.username, "content": message.content,
        "attachment_url": message.attachment_url, "attachment_type": message.attachment_type,
        "created_at": message.created_at.isoformat(),
    }
    await manager.broadcast(conversation_id, out_dict)
    return schemas.MessageOut(**out_dict)


# ---------------- WebSocket: live messaging ----------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, conversation_id: int, websocket: WebSocket):
        self.active_connections.setdefault(conversation_id, []).append(websocket)

    def disconnect(self, conversation_id: int, websocket: WebSocket):
        if conversation_id in self.active_connections:
            if websocket in self.active_connections[conversation_id]:
                self.active_connections[conversation_id].remove(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

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
async def websocket_endpoint(websocket: WebSocket, conversation_id: int, token: str = Query(...)):
    await websocket.accept()
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        participant = db.query(models.ConversationParticipant).filter(
            models.ConversationParticipant.conversation_id == conversation_id,
            models.ConversationParticipant.user_id == user.id,
        ).first()
        if not participant:
            await websocket.close(code=4003)
            return

        await manager.connect(conversation_id, websocket)

        try:
            while True:
                data = await websocket.receive_json()
                content = data.get("content", "")

                message = models.Message(
                    conversation_id=conversation_id,
                    sender_id=user.id,
                    content=content,
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                out = {
                    "id": message.id,
                    "conversation_id": conversation_id,
                    "sender_id": user.id,
                    "sender_username": user.username,
                    "content": message.content,
                    "attachment_url": None,
                    "attachment_type": None,
                    "created_at": message.created_at.isoformat(),
                }
                await manager.broadcast(conversation_id, out)
        except WebSocketDisconnect:
            manager.disconnect(conversation_id, websocket)
    finally:
        db.close()


# ---------------- WebSocket: presence ----------------

class PresenceManager:
    def __init__(self):
        self.active_users: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        self.active_users[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_users:
            del self.active_users[user_id]

    def get_contacts(self, user_id: int, db: Session) -> List[int]:
        conversation_ids = db.query(models.ConversationParticipant.conversation_id).filter(
            models.ConversationParticipant.user_id == user_id
        ).subquery()
        contact_ids = db.query(models.ConversationParticipant.user_id).filter(
            models.ConversationParticipant.conversation_id.in_(conversation_ids),
            models.ConversationParticipant.user_id != user_id,
        ).distinct().all()
        return [c[0] for c in contact_ids]

    async def broadcast_status(self, user_id: int, status: str, db: Session, last_seen=None):
        contacts = self.get_contacts(user_id, db)
        payload = {
            "type": "presence",
            "user_id": user_id,
            "status": status,
            "last_seen": last_seen.isoformat() if last_seen else None,
        }
        for contact_id in contacts:
            ws = self.active_users.get(contact_id)
            if ws:
                await ws.send_json(payload)


presence_manager = PresenceManager()


@app.websocket("/ws/presence")
async def presence_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        await presence_manager.connect(user.id, websocket)
        await presence_manager.broadcast_status(user.id, "online", db)

        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            presence_manager.disconnect(user.id)
            user.last_seen = datetime.utcnow()
            db.commit()
            await presence_manager.broadcast_status(user.id, "offline", db, last_seen=user.last_seen)
    finally:
        db.close()


@app.get("/conversations/{conversation_id}/presence")
def get_conversation_presence(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_conversation_or_404(conversation_id, db, current_user)
    participants = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation_id,
    ).all()
    result = []
    for p in participants:
        if p.user_id == current_user.id:
            continue
        result.append({
            "user_id": p.user_id,
            "username": p.user.username,
            "online": p.user_id in presence_manager.active_users,
            "last_seen": p.user.last_seen.isoformat() if p.user.last_seen else None,
        })
    return result

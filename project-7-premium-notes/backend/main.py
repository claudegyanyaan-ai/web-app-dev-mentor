from typing import List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models
import schemas
import auth
from fastapi import FastAPI, Depends, HTTPException, Request
import os
import time
import hmac
import hashlib
import base64
import requests

Base.metadata.create_all(bind=engine)

app = FastAPI()
CASHFREE_API_BASE = os.getenv("CASHFREE_API_BASE", "https://sandbox.cashfree.com/pg")
CASHFREE_API_VERSION = "2025-01-01"

def cashfree_headers():
    return {
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": os.getenv("CASHFREE_CLIENT_ID"),
        "x-client-secret": os.getenv("CASHFREE_CLIENT_SECRET"),
        "Content-Type": "application/json",
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://web-app-dev-mentor-p5.vercel.app",
        "https://web-app-dev-mentor-p5-70a95v4i7-gyanyaan.vercel.app",
        "https://web-app-dev-mentor-uwgt.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
FREE_TIER_LIMIT = 5

def check_item_limit(db: Session, current_user: models.User):
    if current_user.plan == "premium":
        return
    task_count = db.query(models.Task).filter(models.Task.user_id == current_user.id).count()
    note_count = db.query(models.Note).filter(models.Note.user_id == current_user.id).count()
    if task_count + note_count >= FREE_TIER_LIMIT:
        raise HTTPException(
            status_code=403,
            detail=f"Free plan limit reached ({FREE_TIER_LIMIT} items). Upgrade to Premium for unlimited notes and tasks.",
        )


@app.get("/")
def read_root():
    return {"message": "Backend is alive"}


# ---- Auth ----

@app.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = models.User(
        email=user.email,
        hashed_password=auth.hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


# ---- Tasks (protected, per-user) ----

@app.get("/tasks", response_model=List[schemas.TaskOut])
def get_tasks(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Task).filter(models.Task.user_id == current_user.id).all()


@app.post("/tasks", response_model=schemas.TaskOut)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    check_item_limit(db, current_user)
    new_task = models.Task(text=task.text, due_date=task.due_date, done=False, user_id=current_user.id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@app.put("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.text is not None:
        db_task.text = task.text
    if task.done is not None:
        db_task.done = task.done
    if task.due_date is not None:
        db_task.due_date = task.due_date
    db.commit()
    db.refresh(db_task)
    return db_task


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"message": "Task deleted"}

# ---- Notes (protected, per-user) ----

@app.get("/notes", response_model=List[schemas.NoteOut])
def get_notes(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Note).filter(models.Note.user_id == current_user.id).all()


@app.post("/notes", response_model=schemas.NoteOut)
def create_note(note: schemas.NoteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    check_item_limit(db, current_user)
    new_note = models.Note(
        type=note.type,
        title=note.title,
        content=note.content,
        items=note.items,
        color=note.color,
        user_id=current_user.id,
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note


@app.put("/notes/{note_id}", response_model=schemas.NoteOut)
def update_note(note_id: int, note: schemas.NoteUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == current_user.id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.title is not None:
        db_note.title = note.title
    if note.content is not None:
        db_note.content = note.content
    if note.items is not None:
        db_note.items = note.items
    if note.color is not None:
        db_note.color = note.color
    if note.pinned is not None:
        db_note.pinned = note.pinned
    if note.archived is not None:
        db_note.archived = note.archived
    db.commit()
    db.refresh(db_note)
    return db_note


@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == current_user.id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted"}

@app.post("/billing/create-subscription", response_model=schemas.SubscriptionCreateOut)
def create_subscription(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.plan == "premium":
        raise HTTPException(status_code=400, detail="Already on Premium plan.")

    subscription_id = f"sub_{current_user.id}_{int(time.time())}"

    payload = {
        "subscription_id": subscription_id,
        "customer_details": {
            "customer_name": current_user.email.split("@")[0],
            "customer_email": current_user.email,
            "customer_phone": "9999999999",
        },
        "plan_details": {
            "plan_id": os.getenv("CASHFREE_PLAN_ID"),
        },
        "subscription_meta": {
            "return_url": os.getenv("CASHFREE_RETURN_URL", "http://localhost:3000/?upgraded=true"),
        },
    }

    resp = requests.post(f"{CASHFREE_API_BASE}/subscriptions", json=payload, headers=cashfree_headers())
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Cashfree error: {resp.text}")
    data = resp.json()

    current_user.razorpay_subscription_id = subscription_id  # reused column — now stores the Cashfree subscription_id
    current_user.subscription_status = data.get("subscription_status")
    db.commit()

    return {"subscription_session_id": data.get("subscription_session_id")}


@app.post("/billing/webhook")
async def cashfree_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    timestamp = request.headers.get("x-webhook-timestamp", "")
    signature = request.headers.get("x-webhook-signature", "")
    client_secret = os.getenv("CASHFREE_CLIENT_SECRET", "")

    signed_payload = (timestamp + body.decode("utf-8")).encode()
    expected_signature = base64.b64encode(
        hmac.new(client_secret.encode(), signed_payload, hashlib.sha256).digest()
    ).decode()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = await request.json()
    event_type = (payload.get("type") or "").upper()
    data = payload.get("data", {})
    # Cashfree nests the real subscription fields under "subscription_details";
    # a few event types (e.g. SUBSCRIPTION_AUTH_STATUS) also duplicate
    # subscription_id one level up, so check both.
    subscription_details = data.get("subscription_details", {})
    subscription_id = subscription_details.get("subscription_id") or data.get("subscription_id")
    subscription_status = (subscription_details.get("subscription_status") or data.get("subscription_status") or "").upper()

    if subscription_id:
        user = db.query(models.User).filter(models.User.razorpay_subscription_id == subscription_id).first()
        if user:
            if subscription_status == "ACTIVE":
                user.plan = "premium"
            elif subscription_status in ("CANCELLED", "AUTH_FAILED", "ON_HOLD", "COMPLETED", "EXPIRED"):
                user.plan = "free"
            user.subscription_status = subscription_status or event_type
            db.commit()

    return {"status": "ok"}

@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
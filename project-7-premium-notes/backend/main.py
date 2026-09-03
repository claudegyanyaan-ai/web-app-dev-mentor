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
import hmac
import hashlib
import razorpay

Base.metadata.create_all(bind=engine)

app = FastAPI()
razorpay_client = razorpay.Client(auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")))

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

    subscription = razorpay_client.subscription.create({
        "plan_id": os.getenv("RAZORPAY_PLAN_ID"),
        "customer_notify": 1,
        "total_count": 120,  # bills monthly for up to 10 years — Razorpay requires a cap, this approximates "indefinite"
        "notes": {"user_id": str(current_user.id)},
    })

    current_user.razorpay_subscription_id = subscription["id"]
    current_user.subscription_status = subscription["status"]
    db.commit()

    return {"subscription_id": subscription["id"], "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID")}


@app.post("/billing/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    expected_signature = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event")
    subscription_entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = subscription_entity.get("id")

    if subscription_id:
        user = db.query(models.User).filter(models.User.razorpay_subscription_id == subscription_id).first()
        if user:
            if event in ("subscription.activated", "subscription.charged"):
                user.plan = "premium"
                user.subscription_status = "active"
            elif event in ("subscription.cancelled", "subscription.halted", "subscription.completed"):
                user.plan = "free"
                user.subscription_status = event.split(".")[1]
            db.commit()

    return {"status": "ok"}

@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
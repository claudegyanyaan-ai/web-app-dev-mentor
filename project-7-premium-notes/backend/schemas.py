from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List, Any


# ---- User / Auth ----

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime
    plan: str
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str


# ---- Tasks ----

class TaskCreate(BaseModel):
    text: str
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    text: Optional[str] = None
    done: Optional[bool] = None
    due_date: Optional[datetime] = None

class TaskOut(BaseModel):
    id: int
    text: str
    done: bool
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    class Config:
        from_attributes = True


# ---- Notes ----

class NoteCreate(BaseModel):
    type: str = "text"
    title: Optional[str] = None
    content: Optional[str] = None
    items: Optional[List[Any]] = None
    color: str = "default"

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    items: Optional[List[Any]] = None
    color: Optional[str] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None

class NoteOut(BaseModel):
    id: int
    type: str
    title: Optional[str]
    content: Optional[str]
    items: Optional[List[Any]]
    color: str
    pinned: bool
    archived: bool
    created_at: datetime
    updated_at: Optional[datetime]
    class Config:
        from_attributes = True
        
# ---- Billing ----

class SubscriptionCreateOut(BaseModel):
    subscription_id: str
    razorpay_key_id: str
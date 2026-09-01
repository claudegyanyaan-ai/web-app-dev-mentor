from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    reset_token: str
    expires_at: datetime


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ParticipantOut(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    participant_usernames: List[str]  # the OTHER user(s) — you're added automatically
    is_group: bool = False
    name: Optional[str] = None


class ConversationOut(BaseModel):
    id: int
    is_group: bool
    name: Optional[str]
    created_at: datetime
    participants: List[ParticipantOut]

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_username: str
    content: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
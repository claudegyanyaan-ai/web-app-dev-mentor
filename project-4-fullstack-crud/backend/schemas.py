from pydantic import BaseModel

class TaskCreate(BaseModel):
    text: str

class TaskUpdate(BaseModel):
    text: str | None = None
    done: bool | None = None

class TaskOut(BaseModel):
    id: int
    text: str
    done: bool

    class Config:
        from_attributes = True
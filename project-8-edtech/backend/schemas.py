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
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LessonCreate(BaseModel):
    title: str
    content: str
    video_url: Optional[str] = None
    position: int = 0


class LessonOut(BaseModel):
    id: int
    title: str
    content: str
    video_url: Optional[str]
    position: int

    class Config:
        from_attributes = True


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None


class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QuizSummaryOut(BaseModel):
    id: int
    title: str

    class Config:
        from_attributes = True


class CourseDetailOut(CourseOut):
    lessons: List[LessonOut] = []
    quizzes: List[QuizSummaryOut] = []


class QuizOptionCreate(BaseModel):
    option_text: str
    is_correct: bool = False


class QuizQuestionCreate(BaseModel):
    question_text: str
    position: int = 0
    options: List[QuizOptionCreate]


class QuizCreate(BaseModel):
    title: str
    questions: List[QuizQuestionCreate]


# --- student-facing: never exposes is_correct ---

class QuizOptionOut(BaseModel):
    id: int
    option_text: str

    class Config:
        from_attributes = True


class QuizQuestionOut(BaseModel):
    id: int
    question_text: str
    position: int
    options: List[QuizOptionOut]

    class Config:
        from_attributes = True


class QuizOut(BaseModel):
    id: int
    title: str
    course_id: int
    questions: List[QuizQuestionOut]

    class Config:
        from_attributes = True


# --- admin-facing: includes is_correct ---

class QuizOptionAdminOut(BaseModel):
    id: int
    option_text: str
    is_correct: bool

    class Config:
        from_attributes = True


class QuizQuestionAdminOut(BaseModel):
    id: int
    question_text: str
    position: int
    options: List[QuizOptionAdminOut]

    class Config:
        from_attributes = True


class QuizAdminOut(BaseModel):
    id: int
    title: str
    course_id: int
    questions: List[QuizQuestionAdminOut]

    class Config:
        from_attributes = True


# --- taking a quiz ---

class QuizSubmitAnswer(BaseModel):
    question_id: int
    selected_option_id: int


class QuizSubmitPayload(BaseModel):
    answers: List[QuizSubmitAnswer]


class QuizAttemptOut(BaseModel):
    id: int
    quiz_id: int
    score: int
    total_questions: int
    attempted_at: datetime

    class Config:
        from_attributes = True


class EnrollmentOut(BaseModel):
    id: int
    course_id: int
    enrolled_at: datetime

    class Config:
        from_attributes = True


class LessonCompletionOut(BaseModel):
    id: int
    lesson_id: int
    completed_at: datetime

    class Config:
        from_attributes = True


class CourseProgressOut(BaseModel):
    course_id: int
    total_lessons: int
    completed_lessons: int
    percent_complete: float
    completed_lesson_ids: List[int] = []
    quiz_attempts: List[QuizAttemptOut] = []

    class Config:
        from_attributes = True

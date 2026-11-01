from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import engine, SessionLocal, get_db, Base
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user, require_admin

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Project 8 - Mini EdTech Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "null"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ---------------- Courses (admin) ----------------

@app.post("/admin/courses", response_model=schemas.CourseOut)
def create_course(payload: schemas.CourseCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    course = models.Course(title=payload.title, description=payload.description, created_by=admin.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@app.put("/admin/courses/{course_id}", response_model=schemas.CourseOut)
def update_course(course_id: int, payload: schemas.CourseCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.title = payload.title
    course.description = payload.description
    db.commit()
    db.refresh(course)
    return course


@app.delete("/admin/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}


# ---------------- Lessons (admin) ----------------

@app.post("/admin/courses/{course_id}/lessons", response_model=schemas.LessonOut)
def create_lesson(course_id: int, payload: schemas.LessonCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    lesson = models.Lesson(course_id=course_id, **payload.dict())
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@app.put("/admin/lessons/{lesson_id}", response_model=schemas.LessonOut)
def update_lesson(lesson_id: int, payload: schemas.LessonCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    for key, value in payload.dict().items():
        setattr(lesson, key, value)
    db.commit()
    db.refresh(lesson)
    return lesson


@app.delete("/admin/lessons/{lesson_id}")
def delete_lesson(lesson_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    db.delete(lesson)
    db.commit()
    return {"message": "Lesson deleted"}


# ---------------- Courses (student / public browsing) ----------------

@app.get("/courses", response_model=list[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Course).order_by(models.Course.created_at.desc()).all()


@app.get("/courses/{course_id}", response_model=schemas.CourseDetailOut)
def get_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


# ---------------- Quizzes (admin) ----------------

@app.post("/admin/courses/{course_id}/quizzes", response_model=schemas.QuizAdminOut)
def create_quiz(course_id: int, payload: schemas.QuizCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    quiz = models.Quiz(course_id=course_id, title=payload.title)
    db.add(quiz)
    db.flush()  # get quiz.id before adding questions
    for q in payload.questions:
        question = models.QuizQuestion(quiz_id=quiz.id, question_text=q.question_text, position=q.position)
        db.add(question)
        db.flush()
        for opt in q.options:
            db.add(models.QuizOption(question_id=question.id, option_text=opt.option_text, is_correct=opt.is_correct))
    db.commit()
    db.refresh(quiz)
    return quiz


@app.put("/admin/quizzes/{quiz_id}", response_model=schemas.QuizAdminOut)
def update_quiz(quiz_id: int, payload: schemas.QuizCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    quiz.title = payload.title
    # simplest correct approach: replace the whole question/option set rather than diffing it
    for question in list(quiz.questions):
        db.delete(question)
    db.flush()
    for q in payload.questions:
        question = models.QuizQuestion(quiz_id=quiz.id, question_text=q.question_text, position=q.position)
        db.add(question)
        db.flush()
        for opt in q.options:
            db.add(models.QuizOption(question_id=question.id, option_text=opt.option_text, is_correct=opt.is_correct))
    db.commit()
    db.refresh(quiz)
    return quiz


@app.get("/admin/quizzes/{quiz_id}", response_model=schemas.QuizAdminOut)
def get_quiz_admin(quiz_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@app.delete("/admin/quizzes/{quiz_id}")
def delete_quiz(quiz_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted"}


# ---------------- Quizzes (student) ----------------

@app.get("/quizzes/{quiz_id}", response_model=schemas.QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@app.post("/quizzes/{quiz_id}/submit", response_model=schemas.QuizAttemptOut)
def submit_quiz(quiz_id: int, payload: schemas.QuizSubmitPayload, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    score = 0
    for answer in payload.answers:
        option = db.query(models.QuizOption).filter(
            models.QuizOption.id == answer.selected_option_id,
            models.QuizOption.question_id == answer.question_id,
        ).first()
        if option and option.is_correct:
            score += 1

    attempt = models.QuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz_id,
        score=score,
        total_questions=len(quiz.questions),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@app.get("/quizzes/{quiz_id}/attempts", response_model=list[schemas.QuizAttemptOut])
def get_quiz_attempts(quiz_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.quiz_id == quiz_id, models.QuizAttempt.user_id == current_user.id)
        .order_by(models.QuizAttempt.attempted_at.desc())
        .all()
    )


@app.post("/courses/{course_id}/enroll", response_model=schemas.EnrollmentOut)
def enroll_in_course(course_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == current_user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled")

    enrollment = models.Enrollment(user_id=current_user.id, course_id=course_id)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@app.get("/me/enrollments", response_model=list[schemas.EnrollmentOut])
def my_enrollments(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Enrollment).filter(models.Enrollment.user_id == current_user.id).all()


@app.post("/lessons/{lesson_id}/complete", response_model=schemas.LessonCompletionOut)
def complete_lesson(lesson_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == current_user.id,
        models.Enrollment.course_id == lesson.course_id
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="Enroll in this course first")

    existing = db.query(models.LessonCompletion).filter(
        models.LessonCompletion.user_id == current_user.id,
        models.LessonCompletion.lesson_id == lesson_id
    ).first()
    if existing:
        return existing

    completion = models.LessonCompletion(user_id=current_user.id, lesson_id=lesson_id)
    db.add(completion)
    db.commit()
    db.refresh(completion)
    return completion


@app.get("/courses/{course_id}/progress", response_model=schemas.CourseProgressOut)
def course_progress(course_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    total_lessons = db.query(models.Lesson).filter(models.Lesson.course_id == course_id).count()

    completed_lessons = db.query(models.LessonCompletion).join(models.Lesson).filter(
        models.Lesson.course_id == course_id,
        models.LessonCompletion.user_id == current_user.id
    ).count()

    percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0.0

    completed_lesson_ids = [
        row[0] for row in db.query(models.LessonCompletion.lesson_id)
        .join(models.Lesson)
        .filter(
            models.Lesson.course_id == course_id,
            models.LessonCompletion.user_id == current_user.id
        ).all()
    ]

    quiz_attempts = db.query(models.QuizAttempt).join(models.Quiz).filter(
        models.Quiz.course_id == course_id,
        models.QuizAttempt.user_id == current_user.id
    ).all()

    return schemas.CourseProgressOut(
        course_id=course_id,
        total_lessons=total_lessons,
        completed_lessons=completed_lessons,
        percent_complete=round(percent, 1),
        completed_lesson_ids=completed_lesson_ids,
        quiz_attempts=quiz_attempts
    )

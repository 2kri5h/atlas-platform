import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.0")})

import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional
from ..core.database import get_db
from ..core.config import settings
from ..models import Student
from pydantic import BaseModel, Field, field_validator, EmailStr

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def verify_password(plain_password, hashed_password):
    try:
        clean_pw = plain_password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        return pwd_context.verify(clean_pw, hashed_password)
    except Exception:
        return False


def get_password_hash(password):
    clean_pw = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(clean_pw)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


class Token(BaseModel):
    access_token: str
    token_type: str


class StudentCreate(BaseModel):
    roll_number: str
    name: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    branch: str = ""
    year: int = 1
    domains: str = ""
    goals: str = ""
    weak_subjects: str = ""
    cpi: float = 0
    sleep_hours: float = 0
    screen_time_hours: float = 0
    study_hours_per_week: float = 0.0

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain a letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a number")
        return v


class StudentResponse(BaseModel):
    id: int
    roll_number: str
    name: str
    email: EmailStr
    branch: str
    year: int
    domains: str
    goals: str
    weak_subjects: str
    cpi: float = 0
    sleep_hours: float = 0
    screen_time_hours: float = 0
    study_hours_per_week: float = 0.0

    class Config:
        from_attributes = True


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    domains: Optional[str] = None
    goals: Optional[str] = None
    weak_subjects: Optional[str] = None
    cpi: Optional[float] = None
    sleep_hours: Optional[float] = None
    screen_time_hours: Optional[float] = None
    study_hours_per_week: Optional[float] = None


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        roll_number: str = payload.get("sub")
        if roll_number is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(Student).filter(Student.roll_number == roll_number).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=StudentResponse)
def register(student: StudentCreate, db: Session = Depends(get_db)):
    clean_roll = student.roll_number.strip()
    clean_email = student.email.strip().lower()
    existing = db.query(Student).filter(func.lower(Student.roll_number) == clean_roll.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Roll number already registered")
    existing_email = db.query(Student).filter(func.lower(Student.email) == clean_email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pw = get_password_hash(student.password)
    db_student = Student(
        roll_number=clean_roll,
        name=student.name.strip(),
        email=clean_email,
        password_hash=hashed_pw,
        branch=student.branch,
        year=student.year,
        domains=student.domains,
        goals=student.goals,
        weak_subjects=student.weak_subjects,
        cpi=student.cpi,
        sleep_hours=student.sleep_hours,
        screen_time_hours=student.screen_time_hours,
        study_hours_per_week=student.study_hours_per_week,
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    username = form_data.username.strip()
    user = db.query(Student).filter(
        (func.lower(Student.roll_number) == username.lower()) |
        (func.lower(Student.email) == username.lower())
    ).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect roll number/email or password")
    access_token = create_access_token(data={"sub": user.roll_number})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=StudentResponse)
def get_me(current_user: Student = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=StudentResponse)
def update_me(
    updates: StudentUpdate,
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for key, value in updates.model_dump(exclude_none=True).items():
        if hasattr(current_user, key):
            setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user

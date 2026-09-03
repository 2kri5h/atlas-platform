from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from ..models import Student
from .auth import get_current_user
from ..core.database import get_db
from ..services.students import register_student, get_student_by_platform_id
from ..services.email_sync import run_sync
from ..services.db_writer import get_emails_for_student
from ..services.llm_router import get_user_llm
from ..services.daily_digest import compute_daily_digests, apply_retention_policy

router = APIRouter()


class RegisterEmailRequest(BaseModel):
    imap_email: str
    imap_token: str


@router.post("/register")
def register_email_account(
    payload: RegisterEmailRequest,
    current_user: Student = Depends(get_current_user)
):
    student_id = register_student(
        imap_email=payload.imap_email,
        imap_token=payload.imap_token,
        platform_user_id=str(current_user.id)
    )

    if student_id is None:
        raise HTTPException(status_code=400, detail="Could not register email account.")

    return {"student_id": student_id}


@router.post("/fetch")
def fetch_emails(
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student_id = get_student_by_platform_id(str(current_user.id))

    if student_id is None:
        raise HTTPException(
            status_code=404,
            detail="Email service not set up yet. Register your IITB Webmail first."
        )

    user_llm = get_user_llm(current_user.id, db)
    run_sync(student_id, user_llm=user_llm)

    return {
        "status": "ok",
        "ai_processing": bool(user_llm),
        "model": getattr(user_llm, "model", None),
    }


@router.get("/")
def list_emails(current_user: Student = Depends(get_current_user)):
    student_id = get_student_by_platform_id(str(current_user.id))

    if student_id is None:
        raise HTTPException(status_code=404, detail="Email service not set up yet.")

    emails = get_emails_for_student(student_id)
    return apply_retention_policy(emails, retention_days=7)


@router.get("/daily-digest")
def get_daily_digest(
    max_days: int = 3,
    current_user: Student = Depends(get_current_user)
):
    """
    Returns 3-day daily digests with daily priority scores, action items,
    deadlines, and key links for the authenticated student.
    """
    student_id = get_student_by_platform_id(str(current_user.id))

    if student_id is None:
        return {"digests": [], "count": 0, "message": "IITB Webmail not connected"}

    emails = get_emails_for_student(student_id)
    digests = compute_daily_digests(emails, max_days=max_days)

    return {
        "digests": digests,
        "count": len(digests),
        "retention_policy": "3-day daily digest rollup, 7-day structured email cache",
    }
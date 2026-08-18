from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..models import Student
from .auth import get_current_user
from ..services.students import register_student, get_student_by_platform_id
from ..services.email_sync import run_sync
from ..services.db_writer import get_emails_for_student

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
def fetch_emails(current_user: Student = Depends(get_current_user)):
    student_id = get_student_by_platform_id(str(current_user.id))

    if student_id is None:
        raise HTTPException(
            status_code=404,
            detail="Email service not set up yet. Register first."
        )

    run_sync(student_id)

    return {"status": "ok"}
@router.get("/")
def list_emails(current_user: Student = Depends(get_current_user)):
    student_id = get_student_by_platform_id(str(current_user.id))

    if student_id is None:
        raise HTTPException(status_code=404, detail="Email service not set up yet.")

    return get_emails_for_student(student_id)
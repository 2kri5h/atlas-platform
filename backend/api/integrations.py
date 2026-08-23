"""Google Workspace & External Integrations API Router."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import GoogleAccount, PlannerEvent, Resource, Student
from ..services.google import (
    disconnect_google_account,
    exchange_code_for_tokens,
    export_resource_to_google_drive,
    fetch_recent_gmail_messages,
    get_google_account,
    get_google_auth_url,
    get_google_user_info,
    get_valid_access_token,
    is_google_oauth_configured,
    save_or_update_google_account,
    sync_deadlines_to_google_calendar,
    sync_timetable_to_google_calendar,
)
from ..services.llm_router import get_user_llm
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class GoogleAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None


class GoogleDriveExportRequest(BaseModel):
    resource_id: Optional[int] = None
    title: str
    url: str
    course_code: str
    year: Optional[int] = 2026
    description: Optional[str] = None


class GoogleStatusResponse(BaseModel):
    is_connected: bool
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    scopes: List[str] = []
    is_sandbox: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/google/auth-url")
def get_auth_url(
    redirect_uri: Optional[str] = None,
    current_user: Student = Depends(get_current_user),
):
    """Generate Google OAuth 2.0 consent URL for the authenticated student."""
    url = get_google_auth_url(student_id=current_user.id, redirect_uri=redirect_uri)
    return {
        "auth_url": url,
        "is_configured": is_google_oauth_configured(),
    }


@router.post("/google/callback")
def handle_oauth_callback(
    payload: GoogleAuthCallbackRequest,
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exchange authorization code for tokens and securely store credentials."""
    try:
        token_data = exchange_code_for_tokens(payload.code, payload.redirect_uri)
        access_token = token_data.get("access_token", "")
        user_info = get_google_user_info(access_token)

        account = save_or_update_google_account(
            db=db,
            student_id=current_user.id,
            token_data=token_data,
            user_info=user_info,
        )

        return {
            "status": "success",
            "message": f"Successfully connected Google account: {account.email}",
            "email": account.email,
            "name": account.name,
            "picture": account.picture,
        }
    except Exception as e:
        logger.error(f"[Google Callback Error] {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Google account: {str(e)}")


@router.get("/google/status", response_model=GoogleStatusResponse)
def get_connection_status(
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the student has connected their personal Google account."""
    account = get_google_account(db, current_user.id)
    if not account:
        return GoogleStatusResponse(is_connected=False)

    token = get_valid_access_token(db, current_user.id)
    is_sandbox = bool(token and token.startswith("sandbox_access_token_"))

    scope_list = [s.strip() for s in (account.scopes or "").split(" ") if s.strip()]

    return GoogleStatusResponse(
        is_connected=True,
        email=account.email,
        name=account.name,
        picture=account.picture,
        scopes=scope_list,
        is_sandbox=is_sandbox,
    )


@router.post("/google/disconnect")
def disconnect_account(
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect and revoke Google Account credentials."""
    success = disconnect_google_account(db, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="No Google account connected.")
    return {"status": "success", "message": "Google account disconnected."}


# ─────────────────────────────────────────────────────────────────────────────
# Personal Gmail Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/google/gmail/messages")
def get_personal_gmail_messages(
    max_results: int = Query(default=20, le=50),
    query: Optional[str] = None,
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch personal Gmail messages enriched with AI event extraction."""
    token = get_valid_access_token(db, current_user.id)
    if not token:
        raise HTTPException(
            status_code=404,
            detail="Google account not connected. Please connect your Google account first.",
        )

    user_llm = get_user_llm(current_user.id, db)
    messages = fetch_recent_gmail_messages(
        access_token=token,
        max_results=max_results,
        query=query,
        user_llm=user_llm,
    )

    return {
        "status": "ok",
        "messages": messages,
        "count": len(messages),
        "ai_enriched": bool(user_llm),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Google Drive Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/google/drive/export")
def export_to_drive(
    payload: GoogleDriveExportRequest,
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export an academic resource into the student's Google Drive course directory."""
    token = get_valid_access_token(db, current_user.id)
    if not token:
        raise HTTPException(
            status_code=404,
            detail="Google account not connected. Please connect your Google account to save files to Drive.",
        )

    try:
        result = export_resource_to_google_drive(
            access_token=token,
            resource_title=payload.title,
            resource_url=payload.url,
            course_code=payload.course_code,
            year=payload.year or 2026,
            description=payload.description,
        )
        return result
    except Exception as e:
        logger.error(f"[Google Drive Export Error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export to Google Drive: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Google Calendar Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/google/calendar/sync-timetable")
def sync_timetable(
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Push weekly recurring timetable classes into Google Calendar."""
    token = get_valid_access_token(db, current_user.id)
    if not token:
        raise HTTPException(
            status_code=404,
            detail="Google account not connected. Please connect your Google account first.",
        )

    # Fetch user's recurring timetable events
    events = (
        db.query(PlannerEvent)
        .filter(
            PlannerEvent.userId == current_user.id,
            PlannerEvent.isRecurring == True,
            PlannerEvent.deletedAt == None,
        )
        .all()
    )

    if not events:
        return {
            "status": "ok",
            "synced_count": 0,
            "message": "No recurring timetable classes found to sync.",
        }

    serialized_events = [
        {
            "id": e.id,
            "title": e.title,
            "startTime": e.startTime,
            "endTime": e.endTime,
            "recurrenceDay": e.recurrenceDay,
            "location": e.location,
            "description": e.description,
        }
        for e in events
    ]

    try:
        result = sync_timetable_to_google_calendar(token, serialized_events)
        return result
    except Exception as e:
        logger.error(f"[Google Calendar Timetable Error] {e}")
        raise HTTPException(status_code=500, detail=f"Calendar sync failed: {str(e)}")


@router.post("/google/calendar/sync-deadlines")
def sync_deadlines(
    current_user: Student = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Push assignment deadlines into Google Calendar with reminder notifications."""
    token = get_valid_access_token(db, current_user.id)
    if not token:
        raise HTTPException(
            status_code=404,
            detail="Google account not connected. Please connect your Google account first.",
        )

    # Fetch user's upcoming active deadlines
    deadlines = (
        db.query(PlannerEvent)
        .filter(
            PlannerEvent.userId == current_user.id,
            PlannerEvent.deadline_date != None,
            PlannerEvent.isCompleted == False,
            PlannerEvent.deletedAt == None,
        )
        .all()
    )

    if not deadlines:
        return {
            "status": "ok",
            "synced_count": 0,
            "message": "No active deadlines found to sync.",
        }

    serialized_deadlines = [
        {
            "id": d.id,
            "title": d.title,
            "deadline_label": d.deadline_label,
            "deadline_date": d.deadline_date.isoformat() if d.deadline_date else None,
            "tag": d.tag,
        }
        for d in deadlines
    ]

    try:
        result = sync_deadlines_to_google_calendar(token, serialized_deadlines)
        return result
    except Exception as e:
        logger.error(f"[Google Calendar Deadlines Error] {e}")
        raise HTTPException(status_code=500, detail=f"Deadlines sync failed: {str(e)}")

"""Lecture recording → transcript → structured notes endpoints.

Audio is uploaded (or recorded in-browser via MediaRecorder and uploaded)
as multipart/form-data. The student's BYOK-configured LLM provider handles
both transcription and note structuring; results are returned as JSON and
can be saved to the resource library as a private note.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from .auth import get_current_user
from ..models import Resource
from ..services.lecture_service import (
    LectureNotes,
    LectureServiceError,
    process_lecture_audio,
    validate_audio_upload,
)
from ..services.llm_router import get_user_llm

logger = logging.getLogger(__name__)
router = APIRouter()


class SaveNotesRequest(BaseModel):
    title: str
    markdown: str
    transcript: str
    course: Optional[str] = None


class NotesResponse(BaseModel):
    title: str
    overview: str
    key_topics: list[str]
    definitions: list[dict]
    action_items: list[str]
    exam_topics: list[str]
    transcript: str
    transcript_chars: int


def _safe_error(e: Exception) -> HTTPException:
    """Map service-layer errors to 400s; anything else stays a logged 500."""
    if isinstance(e, LectureServiceError):
        return HTTPException(status_code=400, detail=str(e))
    logger.exception("[Lecture] Unexpected error")
    return HTTPException(status_code=500, detail="Lecture processing failed.")


@router.post("/transcribe", response_model=NotesResponse)
async def transcribe_lecture(
    file: UploadFile = File(...),
    course: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload lecture audio; get back a transcript plus structured notes."""
    audio_bytes = await file.read()
    try:
        validate_audio_upload(file.filename or "audio", len(audio_bytes))
    except LectureServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    llm = get_user_llm(current_user.id, db)
    try:
        transcript, notes = process_lecture_audio(audio_bytes, file.filename or "audio", llm)
    except LectureServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise _safe_error(RuntimeError("unexpected"))

    logger.info(
        "[Lecture] Student %s transcribed %d chars of audio from '%s'",
        current_user.id, len(transcript), course or "unspecified",
    )
    return NotesResponse(
        title=notes.title,
        overview=notes.overview,
        key_topics=notes.key_topics,
        definitions=notes.definitions,
        action_items=notes.action_items,
        exam_topics=notes.exam_topics,
        transcript=transcript[:20_000],  # keep response bounded; full text saved on save
        transcript_chars=len(transcript),
    )


@router.post("/save")
def save_lecture_notes(
    request: SaveNotesRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persist generated notes into the resource library as a private note."""
    if not request.markdown.strip():
        raise HTTPException(status_code=400, detail="Nothing to save.")
    resource = Resource(
        title=request.title.strip()[:200] or "Untitled Lecture Notes",
        description=(request.markdown[:500]),
        content=f"{request.markdown}\n\n---\n\n## Full Transcript\n\n{request.transcript}",
        domain="Academics",
        course=(request.course or "").strip()[:100] or None,
        resource_type="lecture-notes",
        uploader_id=current_user.id,
        is_private=True,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return {"id": resource.id, "title": resource.title}

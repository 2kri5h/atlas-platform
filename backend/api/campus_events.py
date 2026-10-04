from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated, Optional, List
from datetime import datetime
from ..core.database import get_db
from ..models import Event
from .auth import get_current_user
from ..utils.rate_limit import SlidingWindowLimiter, rate_limit

router = APIRouter()
campus_event_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=300)


def validate_http_url(v: Optional[str]) -> Optional[str]:
    if not v:
        return ""
    clean = v.strip()
    if clean:
        lower = clean.lower()
        if lower.startswith("javascript:") or lower.startswith("data:") or lower.startswith("vbscript:"):
            raise ValueError("Dangerous URL scheme not allowed.")
        if not (lower.startswith("http://") or lower.startswith("https://") or lower.startswith("/")):
            raise ValueError("URL must start with http://, https://, or /")
    return clean


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=5000)
    event_date: Optional[datetime] = None
    location: Optional[str] = Field(default="", max_length=200)
    domain: Optional[str] = Field(default="", max_length=50)
    organizer: Optional[str] = Field(default="", max_length=100)


class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    event_date: Optional[datetime]
    location: str
    domain: str
    organizer: str
    is_archived: bool
    slides_link: Optional[str] = None
    recording_link: Optional[str] = None
    created_by_id: Optional[int] = None
    can_manage: bool = False

    class Config:
        from_attributes = True


def event_response(event: Event, user=None) -> EventResponse:
    response = EventResponse.model_validate(event)
    response.can_manage = bool(user and (getattr(user, "role", "student") == "admin" or event.created_by_id == user.id))
    return response


@router.get("/", response_model=List[EventResponse])
def list_events(
    domain: Optional[str] = None,
    archived: bool = False,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Event).filter(Event.is_archived == archived)
    if domain:
        query = query.filter(Event.domain == domain)
    return [event_response(item, current_user) for item in query.order_by(Event.event_date.desc()).offset(skip).limit(limit).all()]


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event_response(event, current_user)


@router.post("/", response_model=EventResponse)
def create_event(
    event: EventCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(campus_event_limiter, "campus_event")),
):
    db_event = Event(**event.model_dump(), created_by_id=current_user.id)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return event_response(db_event, current_user)


@router.put("/{event_id}/archive", response_model=EventResponse)
def archive_event(
    event_id: int,
    slides_link: Optional[str] = None,
    recording_link: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if getattr(current_user, "role", "student") != "admin" and event.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot manage this event")
    event.is_archived = True
    if slides_link:
        event.slides_link = validate_http_url(slides_link)
    if recording_link:
        event.recording_link = validate_http_url(recording_link)
    db.commit()
    db.refresh(event)
    return event_response(event, current_user)

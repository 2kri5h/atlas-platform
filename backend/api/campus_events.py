from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..core.database import get_db
from ..models import Event
from .auth import get_current_user

router = APIRouter()


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    event_date: Optional[datetime] = None
    location: Optional[str] = ""
    domain: Optional[str] = ""
    organizer: Optional[str] = ""


class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    event_date: Optional[datetime]
    location: str
    domain: str
    organizer: str
    is_archived: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[EventResponse])
def list_events(domain: Optional[str] = None, archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(Event).filter(Event.is_archived == archived)
    if domain:
        query = query.filter(Event.domain == domain)
    return query.order_by(Event.event_date.desc()).all()


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    db_event = Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.put("/{event_id}/archive", response_model=EventResponse)
def archive_event(event_id: int, slides_link: Optional[str] = None, recording_link: Optional[str] = None, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.is_archived = True
    if slides_link:
        event.slides_link = slides_link
    if recording_link:
        event.recording_link = recording_link
    db.commit()
    db.refresh(event)
    return event

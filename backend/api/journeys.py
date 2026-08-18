from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from ..core.database import get_db
from ..models import SeniorJourney
from .auth import get_current_user

router = APIRouter()


class JourneyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    domain: str = Field(min_length=1, max_length=50)
    content: str = Field(min_length=1, max_length=10000)
    year_completed: Optional[int] = None
    tags: Optional[str] = Field(default="", max_length=200)


class JourneyResponse(BaseModel):
    id: int
    title: str
    domain: str
    content: str
    year_completed: Optional[int] = None
    tags: Optional[str] = ""
    upvotes: int
    is_verified: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[JourneyResponse])
def list_journeys(domain: Optional[str] = None, db: Session = Depends(get_db), skip: int = 0, limit: int = Query(default=50, le=100)):
    query = db.query(SeniorJourney)
    if domain:
        query = query.filter(SeniorJourney.domain == domain)
    return query.order_by(SeniorJourney.upvotes.desc()).offset(skip).limit(limit).all()


@router.get("/{journey_id}", response_model=JourneyResponse)
def get_journey(journey_id: int, db: Session = Depends(get_db)):
    journey = db.query(SeniorJourney).filter(SeniorJourney.id == journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    return journey


@router.post("/", response_model=JourneyResponse)
def create_journey(
    journey: JourneyCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_journey = SeniorJourney(**journey.model_dump(), author_id=current_user.id)
    db.add(db_journey)
    db.commit()
    db.refresh(db_journey)
    return db_journey


@router.post("/{journey_id}/upvote")
def upvote_journey(journey_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    journey = db.query(SeniorJourney).filter(SeniorJourney.id == journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    journey.upvotes += 1
    db.commit()
    return {"upvotes": journey.upvotes}
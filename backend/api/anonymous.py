from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from ..core.database import get_db
from ..models import AnonymousPost, PostReply
from .auth import get_current_user

router = APIRouter()

MENTAL_HEALTH_KEYWORDS = ["depressed", "suicide", "anxious", "stress", "burnout", "hopeless", "failure", "worthless"]


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    domain: Optional[str] = Field(default="", max_length=50)
    is_mental_health: bool = False


class ReplyCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class PostResponse(BaseModel):
    id: int
    content: str
    domain: Optional[str] = ""
    is_mental_health: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReplyResponse(BaseModel):
    id: int
    content: str
    is_senior_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[PostResponse])
def list_posts(domain: Optional[str] = None, db: Session = Depends(get_db), skip: int = 0, limit: int = Query(default=50, le=100)):
    query = db.query(AnonymousPost).filter(AnonymousPost.is_flagged == False)
    if domain:
        query = query.filter(AnonymousPost.domain == domain)
    return query.order_by(AnonymousPost.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(AnonymousPost).filter(AnonymousPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/", response_model=PostResponse)
def create_post(post: PostCreate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    is_mental_health = post.is_mental_health or any(kw in post.content.lower() for kw in MENTAL_HEALTH_KEYWORDS)
    db_post = AnonymousPost(
        content=post.content,
        domain=post.domain or "",
        is_mental_health=is_mental_health
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


@router.get("/{post_id}/replies", response_model=List[ReplyResponse])
def list_replies(post_id: int, db: Session = Depends(get_db)):
    return db.query(PostReply).filter(PostReply.post_id == post_id).order_by(PostReply.created_at.asc()).all()


@router.post("/{post_id}/replies", response_model=ReplyResponse)
def create_reply(post_id: int, reply: ReplyCreate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(AnonymousPost).filter(AnonymousPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db_reply = PostReply(post_id=post_id, content=reply.content)
    db.add(db_reply)
    db.commit()
    db.refresh(db_reply)
    return db_reply
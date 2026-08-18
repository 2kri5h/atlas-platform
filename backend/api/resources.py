from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..core.database import get_db
from ..models import Resource, ResourceUpvote, ResourceBookmark
from ..services.recommender import get_recommended_resources
from .auth import get_current_user

router = APIRouter()


class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    url: Optional[str] = ""
    content: Optional[str] = ""
    domain: str
    course: Optional[str] = ""
    resource_type: Optional[str] = ""
    is_private: bool = False


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None
    domain: Optional[str] = None
    course: Optional[str] = None
    resource_type: Optional[str] = None
    is_private: Optional[bool] = None


class ResourceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    url: Optional[str] = ""
    domain: str
    course: Optional[str] = ""
    resource_type: Optional[str] = ""
    upvotes: int
    is_private: bool = False
    is_curated: bool = False
    uploader_id: Optional[int] = None
    user_upvoted: bool = False
    user_bookmarked: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecommendedResourceResponse(ResourceResponse):
    match_score: float = 0.0
    match_reasons: List[str] = []


def _add_user_status(resources, user_id: int, db: Session):
    """Add user_upvoted and user_bookmarked fields to each resource."""
    if not resources:
        return []

    resource_list = resources if isinstance(resources, list) else [resources]
    resource_ids = [r.id for r in resource_list]

    # Get all upvotes by this user
    user_upvotes = db.query(ResourceUpvote.resource_id).filter(
        ResourceUpvote.student_id == user_id,
        ResourceUpvote.resource_id.in_(resource_ids)
    ).all()
    upvoted_ids = {u.resource_id for u in user_upvotes}

    # Get all bookmarks by this user
    user_bookmarks = db.query(ResourceBookmark.resource_id).filter(
        ResourceBookmark.student_id == user_id,
        ResourceBookmark.resource_id.in_(resource_ids)
    ).all()
    bookmarked_ids = {b.resource_id for b in user_bookmarks}

    result = []
    for r in resource_list:
        resp = ResourceResponse.model_validate(r)
        resp.user_upvoted = r.id in upvoted_ids
        resp.user_bookmarked = r.id in bookmarked_ids
        result.append(resp)
    return result


# --- Search and Recommend endpoints (must be BEFORE /{resource_id}) ---

@router.get("/search", response_model=List[ResourceResponse])
def search_resources(
    q: str,
    domain: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search resources by title, description, or course."""
    query = db.query(Resource).filter(
        or_(
            Resource.is_curated == True,
            Resource.is_private == False,
            Resource.uploader_id == current_user.id
        )
    ).filter(
        or_(
            Resource.title.ilike(f"%{q}%"),
            Resource.description.ilike(f"%{q}%"),
            Resource.course.ilike(f"%{q}%")
        )
    )
    if domain:
        query = query.filter(Resource.domain == domain)
    resources = query.order_by(Resource.upvotes.desc()).all()
    return _add_user_status(resources, current_user.id, db)


@router.get("/recommended")
def get_recommendations(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized resource recommendations based on user profile."""
    results = get_recommended_resources(current_user, db, limit=10)

    recommended = []
    for r in results:
        res = r["resource"]
        resp = RecommendedResourceResponse.model_validate(res)
        resp.match_score = r["score"]
        resp.match_reasons = r["reasons"]
        recommended.append(resp)
    return recommended


@router.get("/bookmarks", response_model=List[ResourceResponse])
def get_bookmarks(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all bookmarked resources for the current user."""
    bookmarked_ids = db.query(ResourceBookmark.resource_id).filter(
        ResourceBookmark.student_id == current_user.id
    ).subquery()
    resources = db.query(Resource).filter(Resource.id.in_(bookmarked_ids)).all()
    return _add_user_status(resources, current_user.id, db)


# --- Standard CRUD endpoints ---

@router.get("/", response_model=List[ResourceResponse])
def list_resources(
    domain: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Show: all curated + all community (public) + user's own private resources
    query = db.query(Resource).filter(
        or_(
            Resource.is_curated == True,
            Resource.is_private == False,
            Resource.uploader_id == current_user.id
        )
    )
    if domain:
        query = query.filter(Resource.domain == domain)
    resources = query.order_by(Resource.upvotes.desc()).all()
    return _add_user_status(resources, current_user.id, db)


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.post("/", response_model=ResourceResponse)
def create_resource(
    resource: ResourceCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_resource = Resource(
        **resource.model_dump(),
        uploader_id=current_user.id,
        is_curated=False
    )
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    updates: ResourceUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Only the uploader or admin (roll_number starting with 'admin') can edit
    is_owner = resource.uploader_id == current_user.id
    is_admin = current_user.roll_number.startswith("admin")
    is_curated = resource.is_curated and resource.uploader_id is None

    if not (is_owner or is_admin or is_curated):
        raise HTTPException(status_code=403, detail="You can only edit your own resources")

    for key, value in updates.model_dump(exclude_none=True).items():
        setattr(resource, key, value)

    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/{resource_id}")
def delete_resource(
    resource_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    is_owner = resource.uploader_id == current_user.id
    is_admin = current_user.roll_number.startswith("admin")

    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="You can only delete your own resources")

    # Delete associated upvotes and bookmarks first
    db.query(ResourceUpvote).filter(ResourceUpvote.resource_id == resource_id).delete()
    db.query(ResourceBookmark).filter(ResourceBookmark.resource_id == resource_id).delete()
    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted"}


@router.post("/{resource_id}/upvote")
def toggle_upvote(
    resource_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    existing = db.query(ResourceUpvote).filter(
        ResourceUpvote.student_id == current_user.id,
        ResourceUpvote.resource_id == resource_id
    ).first()

    if existing:
        db.delete(existing)
        resource.upvotes = max(resource.upvotes - 1, 0)
        db.commit()
        return {"upvotes": resource.upvotes, "user_upvoted": False}

    upvote = ResourceUpvote(student_id=current_user.id, resource_id=resource_id)
    db.add(upvote)
    resource.upvotes += 1
    db.commit()
    return {"upvotes": resource.upvotes, "user_upvoted": True}


@router.post("/{resource_id}/bookmark")
def toggle_bookmark(
    resource_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    existing = db.query(ResourceBookmark).filter(
        ResourceBookmark.student_id == current_user.id,
        ResourceBookmark.resource_id == resource_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"bookmarked": False}

    bookmark = ResourceBookmark(student_id=current_user.id, resource_id=resource_id)
    db.add(bookmark)
    db.commit()
    return {"bookmarked": True}


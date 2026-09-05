from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..core.database import get_db
from ..models import Resource, ResourceUpvote, ResourceBookmark, TaskLog, PlannerEvent
from ..services.recommender import get_recommended_resources
from .auth import get_current_user, require_admin

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


class LibraryResourceResponse(ResourceResponse):
    is_owner: bool = False
    origin: str = "bookmark"  # 'bookmark' | 'upload' | 'note'


class TaskFromResourceRequest(BaseModel):
    resource_id: Optional[int] = None
    title: str
    url: Optional[str] = None
    course_code: Optional[str] = None
    due_date: Optional[datetime] = None
    end_time: Optional[str] = "23:59"
    priority: Optional[int] = 2
    tag: Optional[str] = "IMPORTANT"  # CRITICAL, IMPORTANT, OPTIONAL
    custom_tag: Optional[str] = None  # e.g., "Weightage: 20%", "Endsem Exam Prep", handwritten tag
    notes: Optional[str] = None
    create_planner_deadline: Optional[bool] = True



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


@router.get("/bookmarks/my", response_model=List[ResourceResponse])
def get_my_bookmarks(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for /bookmarks for frontend compatibility."""
    return get_bookmarks(current_user=current_user, db=db)


@router.get("/library", response_model=List[LibraryResourceResponse])
def get_user_library(
    course: Optional[str] = None,
    type: Optional[str] = None,
    q: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get combined personal library items for the authenticated user:
    - All bookmarked resources
    - All resources uploaded/created by the user (both private notes and public uploads)
    """
    bookmarked_ids = [
        b.resource_id for b in db.query(ResourceBookmark.resource_id).filter(
            ResourceBookmark.student_id == current_user.id
        ).all()
    ]

    query = db.query(Resource).filter(
        or_(
            Resource.id.in_(bookmarked_ids),
            Resource.uploader_id == current_user.id
        )
    )

    if course:
        query = query.filter(Resource.course.ilike(f"%{course}%"))
    if type and type.lower() != "all":
        if type.lower() == "notes":
            query = query.filter(
                or_(
                    Resource.resource_type.ilike("%note%"),
                    Resource.is_private == True
                )
            )
        else:
            query = query.filter(Resource.resource_type.ilike(f"%{type}%"))
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Resource.title.ilike(like),
                Resource.description.ilike(like),
                Resource.course.ilike(like),
            )
        )

    resources = query.order_by(Resource.created_at.desc()).all()
    status_list = _add_user_status(resources, current_user.id, db)

    result = []
    bookmarked_set = set(bookmarked_ids)
    for item in status_list:
        lib_item = LibraryResourceResponse.model_validate(item)
        lib_item.is_owner = item.uploader_id == current_user.id
        if item.uploader_id == current_user.id and item.is_private:
            lib_item.origin = "note"
        elif item.id in bookmarked_set:
            lib_item.origin = "bookmark"
        else:
            lib_item.origin = "upload"
        result.append(lib_item)
    return result


@router.post("/tasks-from-resource")
def create_task_from_resource(
    payload: TaskFromResourceRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Seamlessly creates a TaskLog and optional PlannerEvent deadline linked to a resource/drive file.
    """
    desc_parts = []
    if payload.notes:
        desc_parts.append(payload.notes)
    if payload.custom_tag:
        desc_parts.append(f"Tag: {payload.custom_tag}")
    if payload.course_code:
        desc_parts.append(f"Course: {payload.course_code}")
    if payload.url:
        desc_parts.append(f"Link: {payload.url}")

    full_description = "\n".join(desc_parts)

    task = TaskLog(
        student_id=current_user.id,
        title=payload.title,
        description=full_description,
        domain=payload.course_code or "academics",
        priority=payload.priority or 2,
        due_date=payload.due_date,
    )
    db.add(task)
    db.flush()

    planner_event_id = None
    if payload.create_planner_deadline and payload.due_date:
        event = PlannerEvent(
            userId=current_user.id,
            title=payload.title,
            deadline_date=payload.due_date,
            deadline_label=payload.custom_tag or payload.title,
            tag=payload.tag or "IMPORTANT",
            category="EXAM" if "exam" in (payload.custom_tag or "").lower() else "OTHER",
            startTime="09:00",
            endTime=payload.end_time or "23:59",
            description=payload.notes or "",
            userComment=f"{payload.custom_tag or ''}".strip(),
            link=payload.url or "",
            isCompleted=False,
        )
        db.add(event)
        db.flush()
        planner_event_id = event.id

    db.commit()
    return {
        "status": "success",
        "task_id": task.id,
        "planner_event_id": planner_event_id,
        "message": f"Successfully added '{payload.title}' to your Tasks & Deadlines",
    }



# --- Standard CRUD endpoints ---

@router.get("/", response_model=List[ResourceResponse])
def list_resources(
    domain: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Show: all curated + all community (public) + user's own private resources."""
    query = db.query(Resource).filter(
        or_(
            Resource.is_curated == True,
            Resource.is_private == False,
            Resource.uploader_id == current_user.id
        )
    )
    if domain:
        query = query.filter(Resource.domain == domain)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Resource.title.ilike(like),
                Resource.description.ilike(like),
                Resource.course.ilike(like),
            )
        )
    resources = (
        query.order_by(Resource.upvotes.desc())
        .offset(max(skip, 0))
        .limit(min(limit, 200))
        .all()
    )
    return _add_user_status(resources, current_user.id, db)


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    # Private resources are only visible to their uploader (curated ones are public).
    if resource.is_private and not resource.is_curated and resource.uploader_id != current_user.id:
        raise HTTPException(status_code=404, detail="Resource not found")
    result = _add_user_status([resource], current_user.id, db)
    return result[0]


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

    # Only the uploader or an admin (role column) can edit.
    is_owner = resource.uploader_id == current_user.id
    is_admin = getattr(current_user, "role", "student") == "admin"

    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="You can only edit your own resources")

    ALLOWED_RESOURCE_UPDATE_FIELDS = {"title", "description", "url", "content", "domain", "course", "resource_type", "is_private"}
    for key, value in updates.model_dump(exclude_none=True).items():
        if key in ALLOWED_RESOURCE_UPDATE_FIELDS:
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
    is_admin = getattr(current_user, "role", "student") == "admin"

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
    if resource.is_private and not resource.is_curated and resource.uploader_id != current_user.id:
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
    if resource.is_private and not resource.is_curated and resource.uploader_id != current_user.id:
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


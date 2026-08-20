from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime, timedelta, date
import re
from ..core.database import get_db
from ..models import PlannerEvent, Event, UserAPIKey
from .auth import get_current_user
from ..core.config import settings
from ..services.ai_gateway import GeminiGatewayDriver
from ..services.crypto import decrypt_secret

router = APIRouter()


def normalize_time(time_str: str) -> str:
    """Helper to convert H:MM to HH:MM format."""
    parts = time_str.split(":")
    if len(parts) == 2:
        return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    return time_str


class EventBase(BaseModel):
    title: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    date: Optional[str] = None  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    tag: str  # CRITICAL / IMPORTANT / OPTIONAL
    category: str  # CLASS / EXAM / PERSONAL / SLEEP / RECREATION / OTHER
    is_working_hour: bool = False
    link: Optional[str] = None
    is_recurring: bool = False
    recurrence_day: Optional[int] = None  # 0=Sun, 1=Mon, ..., 6=Sat
    is_completed: bool = False
    user_comment: Optional[str] = ""
    deadline_date: Optional[str] = None   # YYYY-MM-DD or YYYY-MM-DDTHH:MM
    deadline_label: Optional[str] = None  # e.g. "Assignment 2", "Lab Report"


class EventCreate(EventBase):
    @model_validator(mode="after")
    def validate_event_data(self):
        try:
            self.start_time = normalize_time(self.start_time)
            self.end_time = normalize_time(self.end_time)
        except ValueError as e:
            raise ValueError(str(e))

        # Check start_time < end_time
        sh, sm = map(int, self.start_time.split(":"))
        eh, em = map(int, self.end_time.split(":"))
        if (sh > eh) or (sh == eh and sm >= em):
            raise ValueError("start_time must be strictly before end_time")

        # Validate tag and category values
        if self.tag not in ("CRITICAL", "IMPORTANT", "OPTIONAL"):
            raise ValueError("tag must be CRITICAL, IMPORTANT, or OPTIONAL")
        if self.category not in ("CLASS", "EXAM", "PERSONAL", "SLEEP", "RECREATION", "OTHER"):
            raise ValueError("category must be CLASS, EXAM, PERSONAL, SLEEP, RECREATION, or OTHER")

        # Validate recurrence / date presence
        if self.is_recurring:
            if self.recurrence_day is None or not (0 <= self.recurrence_day <= 6):
                raise ValueError("recurrence_day (0-6) is required for recurring events")
        else:
            if not self.date:
                raise ValueError("date (YYYY-MM-DD) is required for non-recurring events")
            try:
                datetime.strptime(self.date, "%Y-%m-%d")
            except ValueError:
                raise ValueError("date must be in YYYY-MM-DD format")
        return self


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    tag: Optional[str] = None
    category: Optional[str] = None
    is_working_hour: Optional[bool] = None
    link: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_day: Optional[int] = None
    is_completed: Optional[bool] = None
    user_comment: Optional[str] = None
    edit_scope: Optional[str] = None
    instance_date: Optional[str] = None
    deadline_date: Optional[str] = None   # YYYY-MM-DD or YYYY-MM-DDTHH:MM, set to "" to clear
    deadline_label: Optional[str] = None

    @model_validator(mode="after")
    def validate_updates(self):
        if self.start_time:
            try:
                self.start_time = normalize_time(self.start_time)
            except ValueError as e:
                raise ValueError(str(e))
        if self.end_time:
            try:
                self.end_time = normalize_time(self.end_time)
            except ValueError as e:
                raise ValueError(str(e))

        if self.tag and self.tag not in ("CRITICAL", "IMPORTANT", "OPTIONAL"):
            raise ValueError("tag must be CRITICAL, IMPORTANT, or OPTIONAL")
        if self.category and self.category not in ("CLASS", "EXAM", "PERSONAL", "SLEEP", "RECREATION", "OTHER"):
            raise ValueError("category must be CLASS, EXAM, PERSONAL, SLEEP, RECREATION, or OTHER")
        if self.recurrence_day is not None and not (0 <= self.recurrence_day <= 6):
            raise ValueError("recurrence_day must be between 0 and 6")
        return self


class CampusEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=5000)
    event_date: Optional[datetime] = None
    location: Optional[str] = Field(default="", max_length=200)
    domain: Optional[str] = Field(default="", max_length=50)
    organizer: Optional[str] = Field(default="", max_length=200)


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    tag: Optional[str] = None
    category: Optional[str] = None
    is_working_hour: Optional[bool] = None
    link: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_day: Optional[int] = None
    is_completed: Optional[bool] = None
    user_comment: Optional[str] = None
    deadline_date: Optional[str] = None
    deadline_label: Optional[str] = None
    event_date: Optional[datetime] = None
    domain: Optional[str] = None
    organizer: Optional[str] = None
    is_archived: Optional[bool] = False

    class Config:
        from_attributes = True


class CapacityDay(BaseModel):
    date: str
    loadPct: int
    status: str


class TimetableEntrySchema(BaseModel):
    day: int = Field(..., ge=0, le=6)
    startTime: str
    endTime: str
    subject: str


class TimetableImportRequest(BaseModel):
    timetable: List[TimetableEntrySchema]



# Helper to convert times to hours float
def get_duration(start_time: str, end_time: str) -> float:
    sh, sm = map(int, start_time.split(":"))
    eh, em = map(int, end_time.split(":"))
    return (eh - sh) + (em - sm) / 60.0


def normalize_time(t: str) -> str:
    if not t:
        raise ValueError("Time string cannot be empty")
    t = t.strip()
    match = re.match(r"^(\d{1,2}):(\d{2})$", t)
    if not match:
        raise ValueError(f"Time '{t}' must be in H:MM or HH:MM format")
    h, m = match.groups()
    ih = int(h)
    im = int(m)
    if not (0 <= ih <= 23 and 0 <= im <= 59):
        raise ValueError(f"Time '{t}' has invalid hours/minutes values")
    return f"{ih:02d}:{im:02d}"


# Helper to map python weekday to standard (0=Sun, 1=Mon, ..., 6=Sat)
def get_standard_day(dt: date) -> int:
    return (dt.weekday() + 1) % 7


@router.get("/", response_model=List[EventResponse])
def get_events(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        start_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Non-recurring events within range
    non_recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.isRecurring == False,
        PlannerEvent.date >= datetime.combine(start_dt, datetime.min.time()),
        PlannerEvent.date <= datetime.combine(end_dt, datetime.max.time())
    ).all()

    # Recurring events
    recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.isRecurring == True
    ).all()

    expanded = []
    # Add non-recurring
    for e in non_recurring:
        expanded.append(EventResponse(
            id=e.id,
            title=e.title,
            description=e.description,
            location=e.location,
            date=e.date.strftime("%Y-%m-%d") if e.date else None,
            start_time=e.startTime,
            end_time=e.endTime,
            tag=e.tag,
            category=e.category,
            is_working_hour=e.isWorkingHour,
            link=e.link,
            is_recurring=e.isRecurring,
            recurrence_day=e.recurrenceDay,
            is_completed=e.isCompleted,
            user_comment=e.userComment,
            deadline_date=e.deadline_date.strftime("%Y-%m-%d") if e.deadline_date else None,
            deadline_label=e.deadline_label
        ))

    # Expand recurring events day by day
    curr = start_dt
    while curr <= end_dt:
        std_day = get_standard_day(curr)
        curr_str = curr.strftime("%Y-%m-%d")
        for re_event in recurring:
            if re_event.recurrenceDay == std_day:
                if re_event.exdates:
                    excluded_dates = [d.strip() for d in re_event.exdates.split(",") if d.strip()]
                    if curr_str in excluded_dates:
                        continue
                expanded.append(EventResponse(
                    id=re_event.id,
                    title=re_event.title,
                    description=re_event.description,
                    location=re_event.location,
                    date=curr_str,
                    start_time=re_event.startTime,
                    end_time=re_event.endTime,
                    tag=re_event.tag,
                    category=re_event.category,
                    is_working_hour=re_event.isWorkingHour,
                    link=re_event.link,
                    is_recurring=re_event.isRecurring,
                    recurrence_day=re_event.recurrenceDay,
                    is_completed=re_event.isCompleted,
                    user_comment=re_event.userComment,
                    deadline_date=re_event.deadline_date.strftime("%Y-%m-%d") if re_event.deadline_date else None,
                    deadline_label=re_event.deadline_label
                ))
        curr += timedelta(days=1)

    # Sort expanded list by date, then start_time
    expanded.sort(key=lambda x: (x.date or "", x.start_time))
    return expanded


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_payload: EventCreate,
    force: bool = Query(False, description="If true, skip the idempotency duplicate check (used for 'this instance only' overrides)"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event_dict = event_payload.model_dump()
    dt_val = None
    if event_dict["date"]:
        dt_val = datetime.strptime(event_dict["date"], "%Y-%m-%d")

    # ── Idempotency guard ─────────────────────────────────────────────────────
    # Reject if an active (deletedAt IS NULL) event already exists with the
    # same user + time slot + date/recurrenceDay combination.
    # The `force=True` flag bypasses this check for the "This Instance Only"
    # edit flow, which intentionally creates a one-off override on an occupied slot.
    if not force:
        if event_dict["is_recurring"]:
            duplicate = db.query(PlannerEvent).filter(
                PlannerEvent.userId == current_user.id,
                PlannerEvent.isRecurring == True,
                PlannerEvent.recurrenceDay == event_dict["recurrence_day"],
                PlannerEvent.startTime == event_dict["start_time"],
                PlannerEvent.endTime == event_dict["end_time"],
            ).first()
        else:
            duplicate = db.query(PlannerEvent).filter(
                PlannerEvent.userId == current_user.id,
                PlannerEvent.isRecurring == False,
                PlannerEvent.date == dt_val,
                PlannerEvent.startTime == event_dict["start_time"],
                PlannerEvent.endTime == event_dict["end_time"],
            ).first()

        if duplicate:
            duplicate.title = event_dict["title"]
            duplicate.description = event_dict["description"]
            duplicate.location = event_dict["location"]
            duplicate.tag = event_dict["tag"]
            duplicate.category = event_dict["category"]
            duplicate.isWorkingHour = event_dict["is_working_hour"]
            duplicate.link = event_dict["link"]
            duplicate.userComment = event_dict["user_comment"]
            duplicate.isCompleted = event_dict["is_completed"]
            db.commit()
            db.refresh(duplicate)
            return EventResponse(
                id=duplicate.id,
                title=duplicate.title,
                description=duplicate.description,
                location=duplicate.location,
                date=duplicate.date.strftime("%Y-%m-%d") if duplicate.date else None,
                start_time=duplicate.startTime,
                end_time=duplicate.endTime,
                tag=duplicate.tag,
                category=duplicate.category,
                is_working_hour=duplicate.isWorkingHour,
                link=duplicate.link,
                is_recurring=duplicate.isRecurring,
                recurrence_day=duplicate.recurrenceDay,
                is_completed=duplicate.isCompleted,
                user_comment=duplicate.userComment
            )
    # ─────────────────────────────────────────────────────────────────────────

    # Parse deadline_date if provided
    deadline_dt_val = None
    raw_dl = event_dict.get("deadline_date")
    if raw_dl:
        try:
            deadline_dt_val = datetime.strptime(raw_dl, "%Y-%m-%d")
        except ValueError:
            try:
                deadline_dt_val = datetime.fromisoformat(raw_dl)
            except ValueError:
                pass

    db_event = PlannerEvent(
        userId=current_user.id,
        title=event_dict["title"],
        description=event_dict["description"],
        location=event_dict["location"],
        date=dt_val,
        startTime=event_dict["start_time"],
        endTime=event_dict["end_time"],
        tag=event_dict["tag"],
        category=event_dict["category"],
        isWorkingHour=event_dict["is_working_hour"],
        link=event_dict["link"],
        isRecurring=event_dict["is_recurring"],
        recurrenceDay=event_dict["recurrence_day"],
        isCompleted=event_dict["is_completed"],
        userComment=event_dict["user_comment"],
        deadline_date=deadline_dt_val,
        deadline_label=event_dict.get("deadline_label")
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    return EventResponse(
        id=db_event.id,
        title=db_event.title,
        description=db_event.description,
        location=db_event.location,
        date=db_event.date.strftime("%Y-%m-%d") if db_event.date else None,
        start_time=db_event.startTime,
        end_time=db_event.endTime,
        tag=db_event.tag,
        category=db_event.category,
        is_working_hour=db_event.isWorkingHour,
        link=db_event.link,
        is_recurring=db_event.isRecurring,
        recurrence_day=db_event.recurrenceDay,
        is_completed=db_event.isCompleted,
        user_comment=db_event.userComment,
        deadline_date=db_event.deadline_date.strftime("%Y-%m-%d") if db_event.deadline_date else None,
        deadline_label=db_event.deadline_label
    )


@router.patch("/{event_id}", response_model=EventResponse)
def patch_event(event_id: int, updates: EventUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    db_event = db.query(PlannerEvent).filter(
        PlannerEvent.id == event_id,
        PlannerEvent.userId == current_user.id
    ).first()

    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    if updates.edit_scope == "instance":
        if not updates.instance_date:
            raise HTTPException(status_code=400, detail="instance_date is required for 'instance' edit scope")
        try:
            inst_date = datetime.strptime(updates.instance_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="instance_date must be in YYYY-MM-DD format")
        
        exdates_list = []
        if db_event.exdates:
            exdates_list = [d.strip() for d in db_event.exdates.split(",") if d.strip()]
        
        if updates.instance_date not in exdates_list:
            exdates_list.append(updates.instance_date)
            db_event.exdates = ",".join(exdates_list)
        
        new_title = updates.title if updates.title is not None else db_event.title
        new_description = updates.description if updates.description is not None else db_event.description
        new_location = updates.location if updates.location is not None else db_event.location
        new_start_time = updates.start_time if updates.start_time is not None else db_event.startTime
        new_end_time = updates.end_time if updates.end_time is not None else db_event.endTime
        new_tag = updates.tag if updates.tag is not None else db_event.tag
        new_category = updates.category if updates.category is not None else db_event.category
        new_is_working_hour = updates.is_working_hour if updates.is_working_hour is not None else db_event.isWorkingHour
        new_link = updates.link if updates.link is not None else db_event.link
        new_user_comment = updates.user_comment if updates.user_comment is not None else db_event.userComment
        new_is_completed = updates.is_completed if updates.is_completed is not None else db_event.isCompleted
        
        sh, sm = map(int, new_start_time.split(":"))
        eh, em = map(int, new_end_time.split(":"))
        if (sh > eh) or (sh == eh and sm >= em):
            raise HTTPException(status_code=400, detail="start_time must be before end_time")
            
        # Carry deadline fields into the one-off instance override
        raw_dl_inst = updates.deadline_date if updates.deadline_date is not None else (
            db_event.deadline_date.strftime("%Y-%m-%d") if db_event.deadline_date else None
        )
        inst_deadline_dt = None
        if raw_dl_inst:
            try:
                inst_deadline_dt = datetime.strptime(raw_dl_inst, "%Y-%m-%d")
            except ValueError:
                try:
                    inst_deadline_dt = datetime.fromisoformat(raw_dl_inst)
                except ValueError:
                    pass
        inst_deadline_label = updates.deadline_label if updates.deadline_label is not None else db_event.deadline_label

        db_new_event = PlannerEvent(
            userId=current_user.id,
            title=new_title,
            description=new_description,
            location=new_location,
            date=datetime.combine(inst_date, datetime.min.time()),
            startTime=new_start_time,
            endTime=new_end_time,
            tag=new_tag,
            category=new_category,
            isWorkingHour=new_is_working_hour,
            link=new_link,
            isRecurring=False,
            recurrenceDay=None,
            isCompleted=new_is_completed,
            userComment=new_user_comment,
            deadline_date=inst_deadline_dt,
            deadline_label=inst_deadline_label
        )
        db.add(db_new_event)
        db.commit()
        db.refresh(db_new_event)
        
        return EventResponse(
            id=db_new_event.id,
            title=db_new_event.title,
            description=db_new_event.description,
            location=db_new_event.location,
            date=db_new_event.date.strftime("%Y-%m-%d") if db_new_event.date else None,
            start_time=db_new_event.startTime,
            end_time=db_new_event.endTime,
            tag=db_new_event.tag,
            category=db_new_event.category,
            is_working_hour=db_new_event.isWorkingHour,
            link=db_new_event.link,
            is_recurring=db_new_event.isRecurring,
            recurrence_day=db_new_event.recurrenceDay,
            is_completed=db_new_event.isCompleted,
            user_comment=db_new_event.userComment,
            deadline_date=db_new_event.deadline_date.strftime("%Y-%m-%d") if db_new_event.deadline_date else None,
            deadline_label=db_new_event.deadline_label
        )

    update_data = updates.model_dump(exclude_unset=True)

    # If start_time or end_time are updated, check logic
    new_start = update_data.get("start_time", db_event.startTime)
    new_end = update_data.get("end_time", db_event.endTime)

    sh, sm = map(int, new_start.split(":"))
    eh, em = map(int, new_end.split(":"))
    if (sh > eh) or (sh == eh and sm >= em):
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    # Validate tag and category values if updated
    new_tag = update_data.get("tag", db_event.tag)
    if new_tag not in ("CRITICAL", "IMPORTANT", "OPTIONAL"):
        raise HTTPException(status_code=400, detail="tag must be CRITICAL, IMPORTANT, or OPTIONAL")
        
    new_category = update_data.get("category", db_event.category)
    if new_category not in ("CLASS", "EXAM", "PERSONAL", "SLEEP", "RECREATION", "OTHER"):
        raise HTTPException(status_code=400, detail="category must be CLASS, EXAM, PERSONAL, SLEEP, RECREATION, or OTHER")

    # Validate recurrence / date presence for the combined state
    final_is_recurring = update_data.get("is_recurring", db_event.isRecurring)
    final_recurrence_day = update_data.get("recurrence_day", db_event.recurrenceDay)
    final_date_str = update_data.get("date", None)

    if final_is_recurring:
        if final_recurrence_day is None or not (0 <= final_recurrence_day <= 6):
            raise HTTPException(status_code=400, detail="recurrence_day (0-6) is required for recurring events")
    else:
        # If transitioning to non-recurring or maintaining non-recurring, must have a date
        if final_date_str is None and db_event.date is None:
            raise HTTPException(status_code=400, detail="date is required for non-recurring events")

    for key, value in update_data.items():
        if key == "date":
            setattr(db_event, "date", datetime.strptime(value, "%Y-%m-%d") if value else None)
        elif key == "start_time":
            setattr(db_event, "startTime", value)
        elif key == "end_time":
            setattr(db_event, "endTime", value)
        elif key == "is_working_hour":
            setattr(db_event, "isWorkingHour", value)
        elif key == "is_recurring":
            setattr(db_event, "isRecurring", value)
        elif key == "recurrence_day":
            setattr(db_event, "recurrenceDay", value)
        elif key == "is_completed":
            setattr(db_event, "isCompleted", value)
        elif key == "user_comment":
            setattr(db_event, "userComment", value)
        elif key == "deadline_date":
            if value:
                try:
                    db_event.deadline_date = datetime.strptime(value, "%Y-%m-%d")
                except ValueError:
                    try:
                        db_event.deadline_date = datetime.fromisoformat(value)
                    except ValueError:
                        db_event.deadline_date = None
            else:
                db_event.deadline_date = None
        elif key == "deadline_label":
            setattr(db_event, "deadline_label", value)
        elif key not in ("edit_scope", "instance_date"):
            setattr(db_event, key, value)

    db.commit()
    db.refresh(db_event)

    return EventResponse(
        id=db_event.id,
        title=db_event.title,
        description=db_event.description,
        location=db_event.location,
        date=db_event.date.strftime("%Y-%m-%d") if db_event.date else None,
        start_time=db_event.startTime,
        end_time=db_event.endTime,
        tag=db_event.tag,
        category=db_event.category,
        is_working_hour=db_event.isWorkingHour,
        link=db_event.link,
        is_recurring=db_event.isRecurring,
        recurrence_day=db_event.recurrenceDay,
        is_completed=db_event.isCompleted,
        user_comment=db_event.userComment,
        deadline_date=db_event.deadline_date.strftime("%Y-%m-%d") if db_event.deadline_date else None,
        deadline_label=db_event.deadline_label
    )


@router.delete("/clear-timetable")
def clear_timetable(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    deleted_events = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.category == "CLASS",
        PlannerEvent.description.like("Imported timetable%")
    ).all()
    count = len(deleted_events)
    for ev in deleted_events:
        db.delete(ev)
    db.commit()
    return {"message": f"Cleared {count} imported timetable classes."}


@router.delete("/{event_id}")
def delete_event(event_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    db_event = db.query(PlannerEvent).filter(
        PlannerEvent.id == event_id,
        PlannerEvent.userId == current_user.id
    ).first()

    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    db_event.deletedAt = datetime.utcnow()
    db.commit()
    return {"message": "Event deleted successfully (soft-delete)"}


@router.post("/{event_id}/undelete")
def undelete_event(event_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Bypass compile-time soft-delete filter
    db_event = db.query(PlannerEvent).execution_options(include_deleted=True).filter(
        PlannerEvent.id == event_id,
        PlannerEvent.userId == current_user.id
    ).first()

    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    db_event.deletedAt = None
    db.commit()
    db.refresh(db_event)

    return {"message": "Event restored successfully", "id": db_event.id}


@router.get("/load", response_model=List[CapacityDay])
def get_load(month: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate month format (accepts YYYY-MM-DD or YYYY-MM)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", month):
        year, mon, _ = map(int, month.split("-"))
    elif re.match(r"^\d{4}-\d{2}$", month):
        year, mon = map(int, month.split("-"))
    else:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM-DD or YYYY-MM")

    start_dt = date(year, mon, 1)
    if mon == 12:
        end_dt = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_dt = date(year, mon + 1, 1) - timedelta(days=1)

    # We reuse the logic of fetching all active events (non-recurring in range, and all recurring)
    non_recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.isRecurring == False,
        PlannerEvent.date >= datetime.combine(start_dt, datetime.min.time()),
        PlannerEvent.date <= datetime.combine(end_dt, datetime.max.time())
    ).all()

    recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.isRecurring == True
    ).all()

    # Track working hours per date
    daily_hours = {}
    curr = start_dt
    while curr <= end_dt:
        daily_hours[curr.strftime("%Y-%m-%d")] = 0.0
        curr += timedelta(days=1)

    # Process non-recurring events
    for e in non_recurring:
        if e.isWorkingHour:
            d_str = e.date.strftime("%Y-%m-%d")
            if d_str in daily_hours:
                daily_hours[d_str] += get_duration(e.startTime, e.endTime)

    # Process recurring events
    curr = start_dt
    while curr <= end_dt:
        std_day = get_standard_day(curr)
        d_str = curr.strftime("%Y-%m-%d")
        for re_event in recurring:
            if re_event.isWorkingHour and re_event.recurrenceDay == std_day:
                if re_event.exdates:
                    excluded_dates = [d.strip() for d in re_event.exdates.split(",") if d.strip()]
                    if d_str in excluded_dates:
                        continue
                daily_hours[d_str] += get_duration(re_event.startTime, re_event.endTime)
        curr += timedelta(days=1)

    # Map daily hours to loadPct and status
    capacity_list = []
    waking_hours = getattr(current_user, 'wakingHoursPerDay', 16) or 16
    if waking_hours <= 0:
        waking_hours = 16

    for d_str, hours in daily_hours.items():
        load_pct = int(round((hours / waking_hours) * 100))
        if load_pct <= 30:
            status_val = "low"
        elif load_pct <= 60:
            status_val = "medium"
        elif load_pct <= 90:
            status_val = "high"
        else:
            status_val = "max"

        capacity_list.append(CapacityDay(
            date=d_str,
            loadPct=load_pct,
            status=status_val
        ))

    capacity_list.sort(key=lambda x: x.date)
    return capacity_list


@router.get("/deadlines", response_model=List[EventResponse])
def get_deadlines(
    days: int = Query(30, description="Number of days ahead to look for deadlines"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return all user events that have a deadline_date set within the next `days` days,
    sorted ascending by deadline_date."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today + timedelta(days=days)

    events_with_deadlines = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.deadline_date != None,  # noqa: E711
        PlannerEvent.deadline_date >= today,
        PlannerEvent.deadline_date <= cutoff
    ).order_by(PlannerEvent.deadline_date.asc()).all()

    return [
        EventResponse(
            id=e.id,
            title=e.title,
            description=e.description,
            location=e.location,
            date=e.date.strftime("%Y-%m-%d") if e.date else None,
            start_time=e.startTime,
            end_time=e.endTime,
            tag=e.tag,
            category=e.category,
            is_working_hour=e.isWorkingHour,
            link=e.link,
            is_recurring=e.isRecurring,
            recurrence_day=e.recurrenceDay,
            is_completed=e.isCompleted,
            user_comment=e.userComment,
            deadline_date=e.deadline_date.strftime("%Y-%m-%d") if e.deadline_date else None,
            deadline_label=e.deadline_label
        )
        for e in events_with_deadlines
    ]


@router.post("/import-timetable")
def import_timetable(payload: TimetableImportRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    imported_count = 0
    updated_count = 0

    for entry in payload.timetable:
        recur_day = entry.day
        if not (0 <= recur_day <= 6):
            raise HTTPException(status_code=400, detail=f"Invalid day index: {entry.day}")

        # Validate and normalize time formats
        try:
            entry.startTime = normalize_time(entry.startTime)
            entry.endTime = normalize_time(entry.endTime)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        sh, sm = map(int, entry.startTime.split(":"))
        eh, em = map(int, entry.endTime.split(":"))
        if (sh > eh) or (sh == eh and sm >= em):
            raise HTTPException(status_code=400, detail="startTime must be before endTime")

        # ── Upsert logic ──────────────────────────────────────────────────────
        # Match on slot identity only: userId + recurrenceDay + startTime + endTime.
        # Title is NOT part of the key — if the AI parsed a course name slightly
        # differently on a re-import, we still want to update the same row rather
        # than stack a duplicate on the same grid slot.
        existing = db.query(PlannerEvent).filter(
            PlannerEvent.userId == current_user.id,
            PlannerEvent.isRecurring == True,
            PlannerEvent.recurrenceDay == recur_day,
            PlannerEvent.startTime == entry.startTime,
            PlannerEvent.endTime == entry.endTime,
        ).first()

        if existing:
            # Update all fields on the existing row — including title, so a
            # corrected course name from a re-import propagates cleanly.
            existing.title = entry.subject
            existing.description = f"Imported timetable class for {entry.subject}"
            existing.tag = "IMPORTANT"
            existing.category = "CLASS"
            existing.isWorkingHour = True
            existing.isRecurring = True
            updated_count += 1
        else:
            db_event = PlannerEvent(
                userId=current_user.id,
                title=entry.subject,
                description=f"Imported timetable class for {entry.subject}",
                date=None,
                startTime=entry.startTime,
                endTime=entry.endTime,
                tag="IMPORTANT",
                category="CLASS",
                isWorkingHour=True,
                isRecurring=True,
                recurrenceDay=recur_day
            )
            db.add(db_event)
            imported_count += 1
        # ─────────────────────────────────────────────────────────────────────

    db.commit()
    return {
        "message": f"Timetable processed: {imported_count} created, {updated_count} updated."
    }


@router.post("/scan-timetable")
def scan_timetable(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Read the uploaded file contents
    contents = file.file.read()
    mime_type = file.content_type or "image/png"
    
    # 1. Check if user configured their own Gemini key
    user_key_record = db.query(UserAPIKey).filter(
        UserAPIKey.student_id == current_user.id,
        UserAPIKey.provider == "gemini",
        UserAPIKey.is_active == True
    ).first()

    if user_key_record:
        try:
            api_key = decrypt_secret(user_key_record.encrypted_key)
        except Exception:
            api_key = settings.GEMINI_API_KEY
    else:
        # 2. Fall back to platform team key (permitted for onboarding OCR)
        api_key = settings.GEMINI_API_KEY

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No Gemini API key available. Please add your Gemini key in Settings or contact admin."
        )
    
    try:
        driver = GeminiGatewayDriver(api_key=api_key)
        result = driver.parse_timetable_image(contents, mime_type)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Timetable scan failed: {str(e)}"
        )



@router.get("/", response_model=List[EventResponse])
def list_events(domain: Optional[str] = None, archived: bool = False, db: Session = Depends(get_db), skip: int = 0, limit: int = Query(default=20, le=100)):
    query = db.query(Event).filter(Event.is_archived == archived)
    if domain:
        query = query.filter(Event.domain == domain)
    return query.order_by(Event.event_date.desc()).offset(skip).limit(limit).all()


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/", response_model=EventResponse)
def create_event(
    event: EventCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_event = Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.put("/{event_id}/archive", response_model=EventResponse)
def archive_event(
    event_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.is_archived = True

    db.commit()
    db.refresh(event)

    return event

"""Unified Today Dashboard aggregation.

Single endpoint backing the consolidated student home surface. Pulls from
existing tables only — no new state is created here:

- Today's timetable blocks (recurring via services.recurrence, minus exdates)
- Deadlines due within a horizon window (default 48h) + overdue
- Open task backlog summary
- Latest cached burnout score (read-only; scoring itself stays in ai.py)
- Today's scheduled working hours as capacity load

All datetime handling uses naive UTC-local datetimes to match the rest of
the codebase (planner/events store naive datetimes).
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..models import BurnoutScore, PlannerEvent, TaskLog
from .recurrence import occurrence_dates, parse_exdates

DEFAULT_DEADLINE_HORIZON_HOURS = 48


@dataclass
class TimetableBlock:
    id: int
    title: str
    start_time: str
    end_time: str
    location: str = ""
    category: str = "OTHER"
    tag: str = "OPTIONAL"
    is_recurring: bool = False
    link: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "location": self.location,
            "category": self.category,
            "tag": self.tag,
            "is_recurring": self.is_recurring,
            "link": self.link,
        }


def _hhmm_to_minutes(hhmm: str) -> int:
    """Parse 'HH:MM' into minutes past midnight; malformed values sort last."""
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return 24 * 60


def _event_occurs_on(event: PlannerEvent, day: date) -> bool:
    """Whether a planner event lands on `day`, honoring recurrence/exdates."""
    if event.isRecurring:
        if event.recurrenceDay is None:
            return False
        excluded = parse_exdates(event.exdates)
        return day in occurrence_dates(day, day, event.recurrenceDay, excluded)
    return event.date is not None and event.date.date() == day


def _to_block(event: PlannerEvent, is_recurring: bool) -> TimetableBlock:
    return TimetableBlock(
        id=event.id,
        title=event.title,
        start_time=event.startTime,
        end_time=event.endTime,
        location=event.location or "",
        category=event.category,
        tag=event.tag,
        is_recurring=is_recurring,
        link=event.link or "",
    )


def todays_timetable(db: Session, student_id: int, day: date) -> List[Dict[str, Any]]:
    """Today's class/event blocks sorted by start time."""
    day_start = datetime.combine(day, time.min)
    events = (
        db.query(PlannerEvent)
        .filter(
            PlannerEvent.userId == student_id,
            PlannerEvent.deletedAt.is_(None),
            # Cheap pre-filter: recurring rows have no date, one-offs must match.
            (PlannerEvent.isRecurring.is_(True)) | (PlannerEvent.date == day_start),
        )
        .all()
    )
    blocks = [
        _to_block(e, is_recurring=e.isRecurring)
        for e in events
        if _event_occurs_on(e, day)
    ]
    blocks.sort(key=lambda b: (_hhmm_to_minutes(b.start_time), _hhmm_to_minutes(b.end_time)))
    return [b.to_dict() for b in blocks]


def upcoming_deadlines(
    db: Session,
    student_id: int,
    now: datetime,
    horizon_hours: int = DEFAULT_DEADLINE_HORIZON_HOURS,
) -> Dict[str, List[Dict[str, Any]]]:
    """Deadlines split into overdue / due-soon within the horizon window."""
    horizon_end = now + timedelta(hours=horizon_hours)
    rows = (
        db.query(PlannerEvent)
        .filter(
            PlannerEvent.userId == student_id,
            PlannerEvent.deletedAt.is_(None),
            PlannerEvent.deadline_date.isnot(None),
            PlannerEvent.deadline_date <= horizon_end,
        )
        .order_by(PlannerEvent.deadline_date.asc())
        .all()
    )
    overdue, due_soon = [], []
    for e in rows:
        item = {
            "id": e.id,
            "title": e.title,
            "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
            "deadline_label": e.deadline_label or "",
            "overdue": bool(e.deadline_date and e.deadline_date < now),
        }
        (overdue if item["overdue"] else due_soon).append(item)
    return {"overdue": overdue, "due_soon": due_soon}


def task_summary(db: Session, student_id: int, now: datetime, limit: int = 5) -> Dict[str, Any]:
    """Open-task backlog: counts plus the next few by due date."""
    open_tasks = (
        db.query(TaskLog)
        .filter(TaskLog.student_id == student_id, TaskLog.completed.is_(False))
        .order_by(TaskLog.due_date.asc().nullslast())
        .all()
    )
    overdue_count = sum(1 for t in open_tasks if t.due_date and t.due_date < now)
    return {
        "open_count": len(open_tasks),
        "overdue_count": overdue_count,
        "next_tasks": [
            {
                "id": t.id,
                "title": t.title,
                "priority": t.priority,
                "estimated_hours": t.estimated_hours,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "overdue": bool(t.due_date and t.due_date < now),
            }
            for t in open_tasks[:limit]
        ],
    }


def working_hours_today(db: Session, student_id: int, day: date) -> float:
    """Scheduled working hours for the day (classes/blocks flagged isWorkingHour)."""
    total = 0.0
    for block in todays_timetable(db, student_id, day):
        minutes = _hhmm_to_minutes(block["end_time"]) - _hhmm_to_minutes(block["start_time"])
        if minutes > 0:
            total += minutes / 60.0
    return round(total, 2)


def latest_burnout(db: Session, student_id: int) -> Dict[str, Any]:
    """Most recent cached burnout score, read-only."""
    row = (
        db.query(BurnoutScore)
        .filter(BurnoutScore.student_id == student_id)
        .order_by(BurnoutScore.created_at.desc())
        .first()
    )
    if not row:
        return {"exists": False}
    return {
        "exists": True,
        "score": row.score,
        "risk_level": row.risk_level,
        "ml_score": row.ml_score,
        "telemetry_score": row.telemetry_score,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@dataclass
class TodayDashboard:
    date: str
    timetable: List[Dict[str, Any]] = field(default_factory=list)
    deadlines: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    tasks: Dict[str, Any] = field(default_factory=dict)
    burnout: Dict[str, Any] = field(default_factory=dict)
    working_hours_today: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date,
            "timetable": self.timetable,
            "deadlines": self.deadlines,
            "tasks": self.tasks,
            "burnout": self.burnout,
            "working_hours_today": self.working_hours_today,
        }


def build_today_dashboard(
    db: Session,
    student_id: int,
    now: datetime,
    horizon_hours: int = DEFAULT_DEADLINE_HORIZON_HOURS,
) -> TodayDashboard:
    """Aggregate everything the home surface needs in one pass."""
    day = now.date()
    return TodayDashboard(
        date=day.isoformat(),
        timetable=todays_timetable(db, student_id, day),
        deadlines=upcoming_deadlines(db, student_id, now, horizon_hours),
        tasks=task_summary(db, student_id, now),
        burnout=latest_burnout(db, student_id),
        working_hours_today=working_hours_today(db, student_id, day),
    )

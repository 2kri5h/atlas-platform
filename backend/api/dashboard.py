"""Unified Today Dashboard endpoint.

Aggregates timetable, deadlines, tasks and burnout for the consolidated
home surface. Read-only — no state is created or mutated here.
"""

import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import PlannerEvent
from .auth import get_current_user
from .ai import get_burnout_history, get_conflict_radar, get_latest_burnout_score, get_working_hours
from ..services.dashboard_service import (
    DEFAULT_DEADLINE_HORIZON_HOURS,
    build_today_dashboard,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/today")
def today_dashboard(
    horizon_hours: int = Query(
        DEFAULT_DEADLINE_HORIZON_HOURS, ge=1, le=24 * 14,
        description="Deadline lookahead window in hours.",
    ),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Everything the student home surface needs in a single request."""
    dashboard = build_today_dashboard(
        db, current_user.id, now=datetime.utcnow(), horizon_hours=horizon_hours
    )
    return dashboard.to_dict()


@router.get("/overview")
def dashboard_overview(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Single authenticated payload for the initial home-screen render."""
    now = datetime.utcnow()
    today = build_today_dashboard(db, current_user.id, now=now).to_dict()
    next_deadline = (
        db.query(PlannerEvent)
        .filter(
            PlannerEvent.userId == current_user.id,
            PlannerEvent.deletedAt.is_(None),
            PlannerEvent.isCompleted.is_(False),
            PlannerEvent.deadline_date.isnot(None),
            PlannerEvent.deadline_date >= now,
        )
        .order_by(PlannerEvent.deadline_date.asc())
        .first()
    )
    waking_hours = max(float(current_user.wakingHoursPerDay or 16), 1.0)
    load_pct = min(round(today["working_hours_today"] / waking_hours * 100), 100)
    return {
        "student": {
            "id": current_user.id,
            "roll_number": current_user.roll_number,
            "name": current_user.name,
            "email": current_user.email,
            "branch": current_user.branch or "",
            "year": current_user.year,
            "domains": current_user.domains or "",
            "study_hours_per_week": current_user.study_hours_per_week or 0,
        },
        "today": today,
        "tasks": today["tasks"]["next_tasks"],
        "working_hours": get_working_hours(current_user=current_user, db=db),
        "next_deadline": ({
            "id": next_deadline.id,
            "title": next_deadline.title,
            "deadline_date": next_deadline.deadline_date.date().isoformat(),
            "deadline_label": next_deadline.deadline_label or "",
        } if next_deadline else None),
        "capacity_today": {
            "date": today["date"],
            "loadPct": load_pct,
            "status": "max" if load_pct >= 90 else "high" if load_pct >= 70 else "medium" if load_pct >= 40 else "low",
        },
        "conflicts": get_conflict_radar(current_user=current_user, db=db).get("warnings", []),
        "burnout": get_latest_burnout_score(current_user=current_user, db=db),
        "burnout_history": get_burnout_history(days=14, current_user=current_user, db=db).get("history", []),
        "degraded_sections": [],
    }

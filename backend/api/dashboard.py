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
from .auth import get_current_user
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

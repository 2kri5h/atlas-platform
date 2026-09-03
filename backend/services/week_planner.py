"""Deterministic weekly study-block scheduler ("Plan my week").

For each pending task with a due date in the next 7 days, finds free gaps in
the student's planner (busy intervals from non-recurring events on that date
plus weekly recurring classes) and creates focused study blocks, respecting:
  - priority order (1 = highest)
  - earliest deadline first within a priority tier
  - a daily cap so no single day is overloaded
  - existing busy time (classes, exams, sleep, personal events)

No AI involved - this is pure interval arithmetic over data the app already has.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from ..models import PlannerEvent, Student, TaskLog

logger = logging.getLogger(__name__)

DAY_START_MIN = 7 * 60    # 07:00
DAY_END_MIN = 23 * 60     # 23:00
MIN_BLOCK_MIN = 45        # smallest useful focus block
MAX_BLOCK_MIN = 120       # split long tasks into <= 2h blocks
DAILY_CAP_MIN = 4 * 60    # max auto-scheduled study per day


def _to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _from_minutes(total: int) -> str:
    return f"{total // 60:02d}:{total % 60:02d}"


def _free_gaps(busy: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    """Gaps between DAY_START and DAY_END not covered by sorted busy intervals."""
    gaps = []
    cursor = DAY_START_MIN
    for start, end in sorted(busy):
        if end <= cursor:
            continue
        if start > cursor:
            gaps.append((cursor, min(start, DAY_END_MIN)))
        cursor = max(cursor, end)
    if cursor < DAY_END_MIN:
        gaps.append((cursor, DAY_END_MIN))
    return [(s, e) for s, e in gaps if e - s >= MIN_BLOCK_MIN]


def plan_week(db: Session, student: Student) -> Dict:
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    horizon_end = today + timedelta(days=7)

    # Pending tasks due within the horizon (or overdue - schedule them first).
    tasks = db.query(TaskLog).filter(
        TaskLog.student_id == student.id,
        TaskLog.completed == False,
        TaskLog.due_date != None,  # noqa: E711
        TaskLog.due_date < horizon_end,
    ).order_by(TaskLog.priority.asc(), TaskLog.due_date.asc()).all()

    # Busy intervals per date for the next 7 days.
    busy_by_date: Dict[str, List[Tuple[int, int]]] = {}
    scheduled_min_by_date: Dict[str, int] = {d.isoformat(): 0 for d in
                                             [today + timedelta(days=i) for i in range(7)]}

    non_recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student.id,
        PlannerEvent.isRecurring == False,
        PlannerEvent.deletedAt == None,
        PlannerEvent.date >= today,
        PlannerEvent.date < horizon_end,
    ).all()
    for ev in non_recurring:
        key = ev.date.date().isoformat() if ev.date else None
        if key:
            busy_by_date.setdefault(key, []).append(
                (_to_minutes(ev.startTime), _to_minutes(ev.endTime))
            )

    recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student.id,
        PlannerEvent.isRecurring == True,
        PlannerEvent.deletedAt == None,
    ).all()
    exdates_map = {}
    for ev in recurring:
        raw = (ev.exdates or "").strip()
        exdates_map[ev.id] = set(p.strip() for p in raw.split(",") if p.strip()) if raw else set()

    for i in range(7):
        day = today + timedelta(days=i)
        std_day = (day.weekday() + 1) % 7  # 0=Sun convention
        iso = day.isoformat()
        for ev in recurring:
            if ev.recurrenceDay != std_day or iso in exdates_map.get(ev.id, set()):
                continue
            busy_by_date.setdefault(iso, []).append(
                (_to_minutes(ev.startTime), _to_minutes(ev.endTime))
            )

    created_blocks = []
    skipped = []

    for task in tasks:
        remaining = int((task.estimated_hours or 1) * 60)
        due_day = task.due_date.date()
        # Days available: today..min(due_day, horizon)
        last_day = min(due_day, horizon_end - timedelta(days=1))

        placed_any = False
        for offset in range(7):
            if remaining <= 0:
                break
            day = today + timedelta(days=offset)
            if day > last_day:
                break
            iso = day.isoformat()
            if scheduled_min_by_date.get(iso, 0) >= DAILY_CAP_MIN:
                continue

            gaps = _free_gaps(busy_by_date.get(iso, []))
            for gap_start, gap_end in gaps:
                if remaining <= 0:
                    break
                avail = scheduled_min_by_date.get(iso, 0)
                room = DAILY_CAP_MIN - avail
                block_len = min(gap_end - gap_start, MAX_BLOCK_MIN, remaining, room)
                if block_len < MIN_BLOCK_MIN:
                    continue

                start_min = gap_start
                end_min = gap_start + block_len
                # Reserve this slot immediately.
                busy_by_date.setdefault(iso, []).append((start_min, end_min))
                scheduled_min_by_date[iso] = avail + block_len

                block = PlannerEvent(
                    userId=student.id,
                    title=f"Study: {task.title[:80]}",
                    description=f"Auto-scheduled focus block for '{task.title}' "
                                f"(priority {task.priority}, due {due_day.isoformat()})",
                    date=datetime.combine(day, datetime.min.time()),
                    startTime=_from_minutes(start_min),
                    endTime=_from_minutes(end_min),
                    tag="IMPORTANT",
                    category="OTHER",
                    isWorkingHour=True,
                    isRecurring=False,
                )
                db.add(block)
                created_blocks.append({
                    "task_id": task.id,
                    "task_title": task.title,
                    "date": iso,
                    "start_time": _from_minutes(start_min),
                    "end_time": _from_minutes(end_min),
                })
                remaining -= block_len
                placed_any = True

        if remaining > 0:
            skipped.append({"task_id": task.id, "task_title": task.title,
                            "unscheduled_minutes": remaining})

    db.commit()

    total_minutes = sum(
        (datetime.strptime(b["end_time"], "%H:%M") - datetime.strptime(b["start_time"], "%H:%M")).seconds // 60
        for b in created_blocks
    )
    return {
        "blocks_created": len(created_blocks),
        "total_study_minutes": total_minutes,
        "blocks": created_blocks,
        "could_not_fully_schedule": skipped,
    }

"""Shared recurrence helpers for planner events.

Single source of truth for the recurrence-day convention used across the app:
    0 = Sunday, 1 = Monday, ..., 6 = Saturday
(matches the frontend DAY_LABELS = ['Sun', 'Mon', ...] and events.py).

Also centralizes exdate parsing. Historically events.py wrote `exdates` as a
comma-separated string while ai.py tried to parse it as JSON — this module ends
that divergence.
"""

import json
from datetime import date, datetime, timedelta
from typing import Iterable, Set


def standard_day(d: date) -> int:
    """Map a python date to the app convention: 0=Sun .. 6=Sat."""
    return (d.weekday() + 1) % 7


def parse_exdates(raw) -> Set[str]:
    """Parse an event's `exdates` field into a set of YYYY-MM-DD strings.

    Tolerates both the comma-separated format written by events.py and a JSON
    array format that may exist from older data.
    """
    if not raw:
        return set()
    raw = raw.strip()
    if not raw:
        return set()
    if raw.startswith("["):
        try:
            data = json.loads(raw)
            return {str(item).strip() for item in data if str(item).strip()}
        except Exception:
            return set()
    return {part.strip() for part in raw.split(",") if part.strip()}


def occurrence_dates(
    start: date,
    end: date,
    recurrence_day: int,
    exdates: Iterable[str] = (),
) -> list:
    """All dates in [start, end] matching recurrence_day, minus exdates."""
    excluded = set(exdates)
    out = []
    curr = start
    while curr <= end:
        if standard_day(curr) == recurrence_day:
            iso = curr.isoformat()
            if iso not in excluded:
                out.append(curr)
        curr += timedelta(days=1)
    return out


def last_n_days_endpoints(now: datetime, days: int = 7):
    """(start_date, end_date) covering the last `days` days inclusive of today."""
    end = now.date()
    start = end - timedelta(days=days - 1)
    return start, end
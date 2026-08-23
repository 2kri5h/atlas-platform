"""Google Calendar 2-Way Sync Engine."""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"

DAYS_OF_WEEK_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]


def get_or_create_atlas_calendar(access_token: str) -> str:
    """Find existing 'ATLAS Timetable & Deadlines' calendar or create one."""
    if access_token.startswith("sandbox_access_token_"):
        return "sandbox_atlas_calendar_id"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # List user's calendars
    resp = requests.get(f"{CALENDAR_API_BASE}/users/me/calendarList", headers=headers, timeout=10)
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for cal in items:
            if cal.get("summary") == "ATLAS Timetable & Deadlines":
                return cal["id"]

    # Create new dedicated calendar
    create_body = {
        "summary": "ATLAS Timetable & Deadlines",
        "description": "Auto-synced course classes, exam slots, and assignment deadlines from ATLAS Platform",
        "timeZone": "Asia/Kolkata",
    }
    create_resp = requests.post(f"{CALENDAR_API_BASE}/calendars", headers=headers, json=create_body, timeout=10)
    if create_resp.status_code in (200, 201):
        return create_resp.json()["id"]

    logger.warning("[Google Calendar] Fallback to primary calendar.")
    return "primary"


def sync_timetable_to_google_calendar(
    access_token: str,
    planner_events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Push weekly recurring timetable classes into student's Google Calendar.
    """
    if access_token.startswith("sandbox_access_token_"):
        return {
            "status": "success",
            "calendar_id": "sandbox_calendar_id",
            "synced_count": len(planner_events),
            "message": f"Successfully synced {len(planner_events)} timetable courses to Google Calendar",
        }

    calendar_id = get_or_create_atlas_calendar(access_token)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    synced_count = 0
    now = datetime.now()

    for ev in planner_events:
        day_of_week = ev.get("recurrenceDay", 1)  # 0=Sun, 1=Mon, ..., 6=Sat
        start_time_str = ev.get("startTime", "09:00")
        end_time_str = ev.get("endTime", "10:00")
        title = ev.get("title", "Course Class")
        location = ev.get("location", "IIT Bombay Campus")
        description = ev.get("description", "Synced from ATLAS Platform")

        # Calculate next date for this day of week
        current_dow = (now.weekday() + 1) % 7  # Convert Python Mon=0 to Sun=0
        days_ahead = (day_of_week - current_dow) % 7
        if days_ahead == 0 and now.strftime("%H:%M") > start_time_str:
            days_ahead = 7
        target_date = now + timedelta(days=days_ahead)

        start_dt_str = f"{target_date.strftime('%Y-%m-%d')}T{start_time_str}:00"
        end_dt_str = f"{target_date.strftime('%Y-%m-%d')}T{end_time_str}:00"

        rrule_day = DAYS_OF_WEEK_RRULE[day_of_week % 7]

        event_body = {
            "summary": f"[ATLAS] {title}",
            "location": location,
            "description": f"{description}\n\nSynced via ATLAS Platform",
            "start": {
                "dateTime": f"{start_dt_str}+05:30",
                "timeZone": "Asia/Kolkata",
            },
            "end": {
                "dateTime": f"{end_dt_str}+05:30",
                "timeZone": "Asia/Kolkata",
            },
            "recurrence": [
                f"RRULE:FREQ=WEEKLY;BYDAY={rrule_day}"
            ],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 10},
                ],
            },
        }

        try:
            r = requests.post(f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events", headers=headers, json=event_body, timeout=10)
            if r.status_code in (200, 201):
                synced_count += 1
        except Exception as e:
            logger.error(f"[Google Calendar] Error syncing event '{title}': {e}")

    return {
        "status": "success",
        "calendar_id": calendar_id,
        "synced_count": synced_count,
        "message": f"Successfully synced {synced_count} classes to Google Calendar",
    }


def sync_deadlines_to_google_calendar(
    access_token: str,
    deadlines: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Push upcoming assignment deadlines with notifications into Google Calendar.
    """
    if access_token.startswith("sandbox_access_token_"):
        return {
            "status": "success",
            "calendar_id": "sandbox_calendar_id",
            "synced_count": len(deadlines),
            "message": f"Successfully synced {len(deadlines)} deadlines to Google Calendar",
        }

    calendar_id = get_or_create_atlas_calendar(access_token)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    synced_count = 0

    for d in deadlines:
        title = d.get("title") or d.get("deadline_label") or "Assignment Due"
        due_date_str = d.get("deadline_date") or d.get("date")
        if not due_date_str:
            continue

        try:
            if isinstance(due_date_str, datetime):
                dt = due_date_str
            else:
                clean_str = str(due_date_str).replace("Z", "").split("+")[0]
                dt = datetime.fromisoformat(clean_str)
        except Exception:
            continue

        start_dt_str = dt.strftime("%Y-%m-%dT%H:%M:%S")
        end_dt = dt + timedelta(minutes=30)
        end_dt_str = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        event_body = {
            "summary": f"⏰ [DEADLINE] {title}",
            "description": f"Assignment Deadline\nPriority: {d.get('tag', 'IMPORTANT')}\n\nSynced via ATLAS Platform",
            "start": {
                "dateTime": f"{start_dt_str}+05:30",
                "timeZone": "Asia/Kolkata",
            },
            "end": {
                "dateTime": f"{end_dt_str}+05:30",
                "timeZone": "Asia/Kolkata",
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 1440},  # 24 hours before
                    {"method": "popup", "minutes": 180},   # 3 hours before
                    {"method": "popup", "minutes": 30},    # 30 mins before
                ],
            },
            "colorId": "11",  # Red / Tomato in Google Calendar
        }

        try:
            r = requests.post(f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events", headers=headers, json=event_body, timeout=10)
            if r.status_code in (200, 201):
                synced_count += 1
        except Exception as e:
            logger.error(f"[Google Calendar] Error syncing deadline '{title}': {e}")

    return {
        "status": "success",
        "calendar_id": calendar_id,
        "synced_count": synced_count,
        "message": f"Successfully synced {synced_count} deadlines to Google Calendar",
    }

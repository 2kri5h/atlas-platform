"""Daily Digest Computation and Email Retention Engine."""

from datetime import datetime, date, timedelta
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional
import re


def _parse_email_date(raw_date: Any) -> Optional[datetime]:
    """Parse various email date formats into a timezone-naive UTC datetime."""
    if not raw_date:
        return None
    if isinstance(raw_date, datetime):
        return raw_date.replace(tzinfo=None) if raw_date.tzinfo else raw_date
    if isinstance(raw_date, (int, float)):
        try:
            return datetime.utcfromtimestamp(raw_date)
        except Exception:
            return None

    str_val = str(raw_date).strip()
    # Try RFC 2822
    try:
        dt = parsedate_to_datetime(str_val)
        return dt.replace(tzinfo=None) if dt.tzinfo else dt
    except Exception:
        pass

    # Try ISO formats
    for fmt in [
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]:
        try:
            return datetime.strptime(str_val.split("+")[0].split("Z")[0].strip(), fmt)
        except Exception:
            continue

    return None


def apply_retention_policy(emails: List[Dict[str, Any]], retention_days: int = 7) -> List[Dict[str, Any]]:
    """Filter emails to retain only those within the specified retention window (default 7 days)."""
    if not emails:
        return []

    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    filtered = []

    for em in emails:
        raw_date = em.get("email_date") or em.get("created_at") or em.get("date")
        parsed_dt = _parse_email_date(raw_date)
        if parsed_dt is None or parsed_dt >= cutoff:
            filtered.append(em)

    return filtered


def compute_daily_digests(emails: List[Dict[str, Any]], max_days: int = 3) -> List[Dict[str, Any]]:
    """
    Rolls up emails into daily digests grouped by calendar day.
    Returns up to max_days digests, newest first.
    """
    if not emails:
        return []

    today = date.today()
    grouped: Dict[date, List[Dict[str, Any]]] = {}

    for em in emails:
        raw_date = em.get("email_date") or em.get("created_at") or em.get("date")
        parsed_dt = _parse_email_date(raw_date)
        email_date_obj = parsed_dt.date() if parsed_dt else today

        if email_date_obj not in grouped:
            grouped[email_date_obj] = []
        grouped[email_date_obj].append(em)

    # Sort descending by date
    sorted_dates = sorted(grouped.keys(), reverse=True)[:max_days]

    digests: List[Dict[str, Any]] = []

    for d in sorted_dates:
        day_emails = grouped[d]
        diff = (today - d).days

        if diff == 0:
            relative_tag = "Today"
            display_date = f"Today, {d.strftime('%b %d')}"
        elif diff == 1:
            relative_tag = "Yesterday"
            display_date = f"Yesterday, {d.strftime('%b %d')}"
        else:
            relative_tag = f"{diff} days ago"
            display_date = d.strftime("%A, %b %d")

        full_date = d.strftime("%B %d, %Y")

        summary_bullets = []
        all_deadlines = []
        all_actions = []
        all_links = []
        has_high_urgency = False

        for em in day_emails:
            subj = em.get("clean_subject") or em.get("subject") or "Untitled Email"
            sender = em.get("sender") or em.get("sender_name") or "Unknown"
            cat = em.get("category") or "general"
            importance = em.get("importance") or "medium"
            text_summary = em.get("summary") or em.get("structured_summary") or subj

            if importance.lower() == "high":
                has_high_urgency = True

            # Extract deadlines / events
            events = em.get("events") or []
            if isinstance(events, list):
                for ev in events:
                    if isinstance(ev, dict):
                        ev_copy = dict(ev)
                        ev_copy["email_subject"] = subj
                        all_deadlines.append(ev_copy)

            # Extract action items
            actions = em.get("action_items") or []
            if isinstance(actions, list):
                for act in actions:
                    if isinstance(act, dict):
                        act_copy = dict(act)
                        act_copy["email_subject"] = subj
                        all_actions.append(act_copy)
                    elif isinstance(act, str) and act.strip():
                        all_actions.append({
                            "task": act.strip(),
                            "priority": importance,
                            "email_subject": subj,
                        })

            # Extract links
            links = em.get("links") or []
            if isinstance(links, list):
                for link in links:
                    if isinstance(link, dict):
                        all_links.append(link)
                    elif isinstance(link, str) and link.startswith("http"):
                        all_links.append({"title": subj, "url": link})

            summary_bullets.append({
                "category": cat,
                "importance": importance,
                "subject": subj,
                "text": text_summary[:250],
                "sender": sender,
                "has_action": len(actions) > 0,
                "has_deadline": len(events) > 0,
            })

        # Priority calculation
        if has_high_urgency or len(all_deadlines) > 0 or len(all_actions) >= 3:
            priority_score = "HIGH"
            priority_label = "Urgent attention recommended"
        elif len(all_actions) > 0 or len(day_emails) >= 3:
            priority_score = "MEDIUM"
            priority_label = "Moderate action required"
        else:
            priority_score = "LOW"
            priority_label = "Informational updates"

        digests.append({
            "date": d.isoformat(),
            "display_date": display_date,
            "relative_tag": relative_tag,
            "full_date": full_date,
            "diff_days": diff,
            "priority_score": priority_score,
            "priority_label": priority_label,
            "email_count": len(day_emails),
            "deadlines_count": len(all_deadlines),
            "action_items_count": len(all_actions),
            "links_count": len(all_links),
            "summary_bullets": summary_bullets,
            "deadlines": all_deadlines,
            "action_items": all_actions,
            "key_links": all_links,
        })

    return digests

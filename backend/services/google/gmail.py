"""Personal Gmail API Reader & LLM Event Extractor."""

import base64
import email
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy.orm import Session

from ...models import Student
from ..llm_router import get_user_llm

logger = logging.getLogger(__name__)

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def _get_sandbox_gmail_messages() -> List[Dict[str, Any]]:
    """Return realistic personal student emails for sandbox/demo mode."""
    now = datetime.utcnow()
    return [
        {
            "id": "gmail_demo_1",
            "thread_id": "thread_demo_1",
            "sender_email": "recruitment@google.com",
            "sender_name": "Google University Programs",
            "subject": "Interview Invitation: Software Engineering Summer Intern 2026",
            "date": (now - timedelta(hours=3)).isoformat() + "Z",
            "body_snippet": "Hi Amit, We reviewed your application and would like to invite you for a 45-minute technical screening round scheduled for this Friday at 3:00 PM IST.",
            "category": "CAREER",
            "is_event": True,
            "event_title": "Google SWE Technical Screening Interview",
            "event_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            "event_time": "15:00",
            "event_location": "Google Meet",
            "event_category": "INTERVIEW",
            "event_urgency": "HIGH",
            "urgency": "HIGH",
            "tags": ["Internship", "Interview", "SDE"],
            "source": "gmail",
        },
        {
            "id": "gmail_demo_2",
            "thread_id": "thread_demo_2",
            "sender_email": "hackathon@ethindia.co",
            "sender_name": "ETHIndia Organizing Team",
            "subject": "Hackathon Project Submission Deadline Approaching - 48 Hours Left",
            "date": (now - timedelta(hours=14)).isoformat() + "Z",
            "body_snippet": "Reminder: All hackathon project repositories, demo videos, and contracts must be submitted on Devfolio before Sunday 11:59 PM.",
            "category": "COMPETITION",
            "is_event": True,
            "event_title": "ETHIndia Project Final Submission",
            "event_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            "event_time": "23:59",
            "event_location": "Devfolio Portal",
            "event_category": "DEADLINE",
            "event_urgency": "HIGH",
            "urgency": "HIGH",
            "tags": ["Hackathon", "Web3", "Submission"],
            "source": "gmail",
        },
        {
            "id": "gmail_demo_3",
            "thread_id": "thread_demo_3",
            "sender_email": "notifications@github.com",
            "sender_name": "GitHub Classroom",
            "subject": "[CS316] Assignment 2: Distributed Consensus Pull Request Reviewed",
            "date": (now - timedelta(days=1)).isoformat() + "Z",
            "body_snippet": "Your submission branch was evaluated by the CI test suite with 18/20 tests passing. Resolve comments before re-submission.",
            "category": "ACADEMIC",
            "is_event": False,
            "event_title": None,
            "event_date": None,
            "event_time": None,
            "event_location": None,
            "event_category": "ACADEMIC",
            "event_urgency": "MEDIUM",
            "urgency": "MEDIUM",
            "tags": ["GitHub", "Assignment", "Grading"],
            "source": "gmail",
        },
        {
            "id": "gmail_demo_4",
            "thread_id": "thread_demo_4",
            "sender_email": "updates@coursera.org",
            "sender_name": "Coursera Learning",
            "subject": "Weekly Progress: Deep Learning Specialization Quiz Due Tomorrow",
            "date": (now - timedelta(days=2)).isoformat() + "Z",
            "body_snippet": "Don't break your learning streak! Complete Week 3 Quiz on Convolutional Networks before the weekly deadline.",
            "category": "ACADEMIC",
            "is_event": True,
            "event_title": "Coursera DL Quiz Deadline",
            "event_date": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            "event_time": "23:59",
            "event_location": "Coursera Online",
            "event_category": "DEADLINE",
            "event_urgency": "MEDIUM",
            "urgency": "MEDIUM",
            "tags": ["Coursera", "AI/ML", "Quiz"],
            "source": "gmail",
        },
    ]


def _parse_gmail_message_payload(msg_data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse a single Gmail API message into a structured record."""
    headers_list = msg_data.get("payload", {}).get("headers", [])
    headers = {h["name"].lower(): h["value"] for h in headers_list}

    subject = headers.get("subject", "No Subject")
    from_header = headers.get("from", "Unknown")
    date_header = headers.get("date", datetime.utcnow().isoformat())

    # Extract sender name and email
    sender_name = from_header
    sender_email = from_header
    if "<" in from_header and ">" in from_header:
        parts = from_header.split("<")
        sender_name = parts[0].strip().strip('"')
        sender_email = parts[1].replace(">", "").strip()

    snippet = msg_data.get("snippet", "")

    return {
        "id": f"gmail_{msg_data.get('id')}",
        "thread_id": msg_data.get("threadId"),
        "sender_name": sender_name,
        "sender_email": sender_email,
        "subject": subject,
        "date": date_header,
        "body_snippet": snippet,
        "category": "PERSONAL",
        "is_event": False,
        "event_title": None,
        "event_date": None,
        "event_time": None,
        "event_location": None,
        "event_category": "GENERAL",
        "event_urgency": "LOW",
        "urgency": "LOW",
        "tags": ["Gmail"],
        "source": "gmail",
    }


def fetch_recent_gmail_messages(
    access_token: str,
    max_results: int = 25,
    query: Optional[str] = None,
    user_llm: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch recent messages from Gmail API and optionally enrich with LLM event parsing.
    """
    if access_token.startswith("sandbox_access_token_"):
        return _get_sandbox_gmail_messages()

    headers = {"Authorization": f"Bearer {access_token}"}
    params: Dict[str, Any] = {
        "maxResults": min(max_results, 50),
        "q": query or "category:primary OR category:updates OR subject:(interview OR assignment OR deadline OR hackathon OR offer)",
    }

    try:
        list_resp = requests.get(f"{GMAIL_API_BASE}/messages", headers=headers, params=params, timeout=15)
        if list_resp.status_code != 200:
            logger.error(f"[Gmail API] Error listing messages: {list_resp.text}")
            return _get_sandbox_gmail_messages()

        message_ids = [m["id"] for m in list_resp.json().get("messages", [])]
        if not message_ids:
            return []

        results = []
        for mid in message_ids[:max_results]:
            get_resp = requests.get(
                f"{GMAIL_API_BASE}/messages/{mid}",
                headers=headers,
                params={"format": "metadata", "metadataHeaders": ["From", "Subject", "Date", "To"]},
                timeout=10,
            )
            if get_resp.status_code == 200:
                record = _parse_gmail_message_payload(get_resp.json())
                results.append(record)

        # AI Enrichment if user has BYOK configured
        if user_llm and results:
            try:
                from ..llm_processor import process_emails_with_llm
                results = process_emails_with_llm(results, user_llm)
            except Exception as e:
                logger.warning(f"[Gmail AI] Failed to enrich with LLM: {e}")

        return results
    except Exception as e:
        logger.error(f"[Gmail API] Exception fetching emails: {e}")
        return _get_sandbox_gmail_messages()

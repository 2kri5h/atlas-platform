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
from ..llm_processor import extract_links_heuristic, extract_action_items_heuristic

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
            "sender": "Google University Programs <recruitment@google.com>",
            "subject": "Interview Invitation: Software Engineering Summer Intern 2026",
            "date": (now - timedelta(hours=3)).isoformat() + "Z",
            "email_date": (now - timedelta(hours=3)).isoformat() + "Z",
            "summary": "Technical screening interview invitation for Summer 2026 SWE Internship.",
            "structured_summary": "• 45-minute technical screening round on Data Structures & Algorithms.\n• Scheduled for this Friday at 3:00 PM IST on Google Meet.\n• Prepare a quiet environment with camera and microphone enabled.",
            "body_snippet": "Hi Amit, We reviewed your application and would like to invite you for a 45-minute technical screening round scheduled for this Friday at 3:00 PM IST.",
            "body": "Hi Amit,\n\nWe reviewed your application and would like to invite you for a 45-minute technical screening round scheduled for this Friday at 3:00 PM IST.\n\nPlease join via Google Meet link: https://meet.google.com/abc-defg-hij and confirm your availability on our portal: https://careers.google.com/students/interviews/12345.",
            "category": "PLACEMENT",
            "importance": "HIGH",
            "urgency": "HIGH",
            "links": [
                {
                    "title": "Join Google Meet Interview",
                    "url": "https://meet.google.com/abc-defg-hij",
                    "type": "meeting",
                },
                {
                    "title": "Confirm Slot on Google Careers",
                    "url": "https://careers.google.com/students/interviews/12345",
                    "type": "portal",
                },
            ],
            "action_items": [
                {
                    "task": "Confirm interview availability on Google Careers portal",
                    "deadline": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "urgency": "HIGH",
                    "completed": False,
                },
                {
                    "task": "Review binary trees and graph traversal algorithms",
                    "deadline": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
                    "urgency": "MEDIUM",
                    "completed": False,
                },
            ],
            "is_event": True,
            "event_title": "Google SWE Technical Screening Interview",
            "event_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            "event_time": "15:00",
            "event_location": "Google Meet",
            "event_category": "INTERVIEW",
            "event_urgency": "HIGH",
            "tags": ["Internship", "Interview", "SDE"],
            "source": "gmail",
            "events": [
                {
                    "id": "gmail_demo_1_ev",
                    "title": "Google SWE Technical Screening Interview",
                    "event_type": "interview",
                    "event_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
                    "event_time": "15:00",
                    "location": "Google Meet",
                    "confidence": "high",
                    "urgency": "HIGH",
                    "category": "PLACEMENT",
                }
            ],
        },
        {
            "id": "gmail_demo_2",
            "thread_id": "thread_demo_2",
            "sender_email": "hackathon@ethindia.co",
            "sender_name": "ETHIndia Organizing Team",
            "sender": "ETHIndia Organizing Team <hackathon@ethindia.co>",
            "subject": "Hackathon Project Submission Deadline Approaching - 48 Hours Left",
            "date": (now - timedelta(hours=14)).isoformat() + "Z",
            "email_date": (now - timedelta(hours=14)).isoformat() + "Z",
            "summary": "Final project submission deadline on Devfolio within 48 hours.",
            "structured_summary": "• All GitHub repositories and smart contract deployments must be submitted.\n• 2-minute demo video link must be hosted on YouTube or Loom.\n• Submissions close strictly on Sunday 11:59 PM IST.",
            "body_snippet": "Reminder: All hackathon project repositories, demo videos, and contracts must be submitted on Devfolio before Sunday 11:59 PM.",
            "body": "Reminder: All hackathon project repositories, demo videos, and contracts must be submitted on Devfolio: https://devfolio.co/submissions/ethindia-2026 before Sunday 11:59 PM.\n\nGuide: https://ethindia.co/docs/submission-guidelines.pdf",
            "category": "EVENT",
            "importance": "HIGH",
            "urgency": "HIGH",
            "links": [
                {
                    "title": "Submit Project on Devfolio",
                    "url": "https://devfolio.co/submissions/ethindia-2026",
                    "type": "submission",
                },
                {
                    "title": "Submission Guidelines PDF",
                    "url": "https://ethindia.co/docs/submission-guidelines.pdf",
                    "type": "doc",
                },
            ],
            "action_items": [
                {
                    "task": "Upload 2-minute demo video and push final commit",
                    "deadline": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
                    "urgency": "HIGH",
                    "completed": False,
                },
                {
                    "task": "Submit project contract on Devfolio portal",
                    "deadline": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
                    "urgency": "HIGH",
                    "completed": False,
                },
            ],
            "is_event": True,
            "event_title": "ETHIndia Project Final Submission",
            "event_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            "event_time": "23:59",
            "event_location": "Devfolio Portal",
            "event_category": "DEADLINE",
            "event_urgency": "HIGH",
            "tags": ["Hackathon", "Web3", "Submission"],
            "source": "gmail",
            "events": [
                {
                    "id": "gmail_demo_2_ev",
                    "title": "ETHIndia Project Final Submission",
                    "event_type": "deadline",
                    "event_date": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
                    "event_time": "23:59",
                    "location": "Devfolio Portal",
                    "confidence": "high",
                    "urgency": "HIGH",
                    "category": "EVENT",
                }
            ],
        },
        {
            "id": "gmail_demo_3",
            "thread_id": "thread_demo_3",
            "sender_email": "notifications@github.com",
            "sender_name": "GitHub Classroom",
            "sender": "GitHub Classroom <notifications@github.com>",
            "subject": "[CS316] Assignment 2: Distributed Consensus Pull Request Reviewed",
            "date": (now - timedelta(days=1)).isoformat() + "Z",
            "email_date": (now - timedelta(days=1)).isoformat() + "Z",
            "summary": "Automated autograder results for CS316 Assignment 2 (18/20 passed).",
            "structured_summary": "• Autograder passed 18/20 test cases on branch main.\n• Failed tests relate to Raft leader election partition handling.\n• Review pull request comments to resolve remaining issues.",
            "body_snippet": "Your submission branch was evaluated by the CI test suite with 18/20 tests passing. Resolve comments before re-submission.",
            "body": "Your submission branch was evaluated by the CI test suite with 18/20 tests passing. View detailed logs at https://github.com/iitb-cs316-2026/assignment-2-sub/pull/42.",
            "category": "ACADEMIC",
            "importance": "MEDIUM",
            "urgency": "MEDIUM",
            "links": [
                {
                    "title": "View GitHub PR & Test Logs",
                    "url": "https://github.com/iitb-cs316-2026/assignment-2-sub/pull/42",
                    "type": "submission",
                }
            ],
            "action_items": [
                {
                    "task": "Fix Raft partition leader election test failure",
                    "deadline": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
                    "urgency": "MEDIUM",
                    "completed": False,
                }
            ],
            "is_event": False,
            "event_title": None,
            "event_date": None,
            "event_time": None,
            "event_location": None,
            "event_category": "ACADEMIC",
            "event_urgency": "MEDIUM",
            "tags": ["GitHub", "Assignment", "Grading"],
            "source": "gmail",
            "events": [],
        },
        {
            "id": "gmail_demo_4",
            "thread_id": "thread_demo_4",
            "sender_email": "updates@coursera.org",
            "sender_name": "Coursera Learning",
            "sender": "Coursera Learning <updates@coursera.org>",
            "subject": "Weekly Progress: Deep Learning Specialization Quiz Due Tomorrow",
            "date": (now - timedelta(days=2)).isoformat() + "Z",
            "email_date": (now - timedelta(days=2)).isoformat() + "Z",
            "summary": "Coursera Week 3 Convolutional Networks Quiz due tomorrow.",
            "structured_summary": "• 15 question graded assessment covering Conv2D, ResNets, and Pooling.\n• 80% passing threshold required for certificate progress.\n• Access the quiz directly from your enrolled course dashboard.",
            "body_snippet": "Don't break your learning streak! Complete Week 3 Quiz on Convolutional Networks before the weekly deadline.",
            "body": "Don't break your learning streak! Complete Week 3 Quiz on Convolutional Networks before the weekly deadline: https://www.coursera.org/learn/deep-neural-network/exam/week-3.",
            "category": "ACADEMIC",
            "importance": "MEDIUM",
            "urgency": "MEDIUM",
            "links": [
                {
                    "title": "Open Coursera Week 3 Quiz",
                    "url": "https://www.coursera.org/learn/deep-neural-network/exam/week-3",
                    "type": "submission",
                }
            ],
            "action_items": [
                {
                    "task": "Complete Coursera ConvNet Quiz",
                    "deadline": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "urgency": "MEDIUM",
                    "completed": False,
                }
            ],
            "is_event": True,
            "event_title": "Coursera DL Quiz Deadline",
            "event_date": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            "event_time": "23:59",
            "event_location": "Coursera Online",
            "event_category": "DEADLINE",
            "event_urgency": "MEDIUM",
            "tags": ["Coursera", "AI/ML", "Quiz"],
            "source": "gmail",
            "events": [
                {
                    "id": "gmail_demo_4_ev",
                    "title": "Coursera DL Quiz Deadline",
                    "event_type": "deadline",
                    "event_date": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "event_time": "23:59",
                    "location": "Coursera Online",
                    "confidence": "high",
                    "urgency": "MEDIUM",
                    "category": "ACADEMIC",
                }
            ],
        },
    ]


def _parse_gmail_message_payload(msg_data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse a single Gmail API message into a structured record with links and actions."""
    headers_list = msg_data.get("payload", {}).get("headers", [])
    headers = {h["name"].lower(): h["value"] for h in headers_list}

    subject = headers.get("subject", "No Subject")
    from_header = headers.get("from", "Unknown")
    date_header = headers.get("date", datetime.utcnow().isoformat())

    sender_name = from_header
    sender_email = from_header
    if "<" in from_header and ">" in from_header:
        parts = from_header.split("<")
        sender_name = parts[0].strip().strip('"')
        sender_email = parts[1].replace(">", "").strip()

    snippet = msg_data.get("snippet", "")

    # Extract links and action items heuristically
    links = extract_links_heuristic(snippet)
    action_items = extract_action_items_heuristic(snippet, subject)

    return {
        "id": f"gmail_{msg_data.get('id')}",
        "thread_id": msg_data.get("threadId"),
        "sender_name": sender_name,
        "sender_email": sender_email,
        "sender": from_header,
        "subject": subject,
        "date": date_header,
        "email_date": date_header,
        "body_snippet": snippet,
        "body": snippet,
        "summary": snippet,
        "structured_summary": f"• {subject}\n• From: {sender_name}\n• Date: {date_header}",
        "links": links,
        "action_items": action_items,
        "category": "PERSONAL",
        "importance": "MEDIUM",
        "urgency": "MEDIUM",
        "is_event": False,
        "event_title": None,
        "event_date": None,
        "event_time": None,
        "event_location": None,
        "event_category": "GENERAL",
        "event_urgency": "LOW",
        "tags": ["Gmail"],
        "source": "gmail",
        "events": [],
    }


def fetch_recent_gmail_messages(
    access_token: str,
    max_results: int = 25,
    query: Optional[str] = None,
    user_llm: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch recent messages from Gmail API and optionally enrich with LLM event/link parsing.
    """
    if access_token.startswith("sandbox_access_token_"):
        return _get_sandbox_gmail_messages()

    headers = {"Authorization": f"Bearer {access_token}"}
    params: Dict[str, Any] = {
        "maxResults": min(max_results, 50),
        "q": query or "category:primary OR category:updates OR subject:(interview OR assignment OR deadline OR hackathon OR offer OR quiz)",
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
                from ..llm_processor import process_emails
                results = process_emails(results, user_llm=user_llm)
            except Exception as e:
                logger.warning(f"[Gmail AI] Failed to enrich with LLM: {e}")

        return results
    except Exception as e:
        logger.error(f"[Gmail API] Exception fetching emails: {e}")
        return _get_sandbox_gmail_messages()

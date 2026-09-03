"""Deadline reminder engine.

Aggregates each user's deadlines due within the next 48 hours plus overdue
tasks, and emails a daily digest. Designed to be triggered once per day by an
external scheduler (Render Cron Job / GitHub Action) hitting:

    POST /api/internal/cron/reminders
    Header: X-Cron-Secret: <CRON_SECRET>

Email delivery uses plain SMTP configured via environment variables. When SMTP
is not configured the run is a no-op that still reports what *would* have been
sent - useful in development and for testing aggregation logic.
"""

import logging
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models import PlannerEvent, Student, TaskLog

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_PORT)


def collect_user_reminders(db: Session, student: Student) -> Dict:
    """Aggregate upcoming deadlines + overdue tasks for one student."""
    now = datetime.utcnow()
    window_end = now + timedelta(hours=48)

    upcoming_deadlines = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student.id,
        PlannerEvent.deadline_date != None,  # noqa: E711
        PlannerEvent.isCompleted == False,
        PlannerEvent.deletedAt == None,
        PlannerEvent.deadline_date >= now,
        PlannerEvent.deadline_date <= window_end,
    ).order_by(PlannerEvent.deadline_date.asc()).all()

    overdue_tasks = db.query(TaskLog).filter(
        TaskLog.student_id == student.id,
        TaskLog.completed == False,
        TaskLog.due_date != None,  # noqa: E711
        TaskLog.due_date < now,
    ).order_by(TaskLog.due_date.asc()).limit(10).all()

    return {
        "deadlines": [
            {
                "title": d.title,
                "label": d.deadline_label or d.title,
                "due": d.deadline_date.strftime("%a %d %b, %H:%M") if d.deadline_date else "",
            }
            for d in upcoming_deadlines
        ],
        "overdue_tasks": [{"title": t.title} for t in overdue_tasks],
    }


def _render_html(student_name: str, reminders: Dict) -> str:
    deadline_rows = "".join(
        "<li><strong>" + item["label"] + "</strong> - " + item["title"] + " (due " + item["due"] + ")</li>"
        for item in reminders["deadlines"]
    ) or "<li>No deadlines in the next 48 hours.</li>"
    task_rows = "".join("<li>" + t["title"] + "</li>" for t in reminders["overdue_tasks"]) \
        or "<li>No overdue tasks.</li>"
    return (
        '<html><body style="font-family: Segoe UI, sans-serif; color:#1e293b;">'
        "<h2>Your ATLAS digest, " + student_name.split(" ")[0] + "</h2>"
        "<h3>Deadlines (next 48h)</h3><ul>" + deadline_rows + "</ul>"
        "<h3>Overdue tasks</h3><ul>" + task_rows + "</ul>"
        '<p style="color:#64748b;font-size:12px;">Sent by ATLAS - IIT Bombay Student Productivity</p>'
        "</body></html>"
    )


def _send_email(to_email: str, subject: str, html: str) -> bool:
    """Send via SMTP. Returns False when SMTP is not configured or send fails."""
    if not _smtp_configured():
        logger.info("[Reminders] SMTP not configured; skipping actual send to %s", to_email)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.REMINDER_FROM or settings.SMTP_USER or "atlas@localhost"
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("[Reminders] Failed to send reminder email to %s", to_email)
        return False


def run_reminder_sweep(db: Session) -> Dict:
    """Email every user with at least one upcoming deadline or overdue task."""
    students: List[Student] = db.query(Student).all()
    sent = 0
    skipped_no_smtp = 0
    failed = 0
    no_reminders = 0

    for student in students:
        reminders = collect_user_reminders(db, student)
        if not reminders["deadlines"] and not reminders["overdue_tasks"]:
            no_reminders += 1
            continue

        html = _render_html(student.name, reminders)
        subject = (
            "ATLAS: " + str(len(reminders["deadlines"])) + " deadline(s) coming up"
            if reminders["deadlines"]
            else "ATLAS: You have overdue tasks"
        )
        if not _smtp_configured():
            skipped_no_smtp += 1
            logger.info(
                "[Reminders] Would email %s (%s): %d deadlines, %d overdue tasks",
                student.email, subject, len(reminders["deadlines"]), len(reminders["overdue_tasks"]),
            )
            continue

        if _send_email(student.email, subject, html):
            sent += 1
        else:
            failed += 1

    return {
        "students_checked": len(students),
        "emails_sent": sent,
        "emails_failed": failed,
        "skipped_no_smtp": skipped_no_smtp,
        "users_with_no_reminders": no_reminders,
        "smtp_configured": _smtp_configured(),
    }

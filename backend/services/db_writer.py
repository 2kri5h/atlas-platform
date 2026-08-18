from .database_connect import get_client
from email.utils import parsedate_to_datetime

client=get_client()

def get_existing_message_ids(message_ids):
    """
    Given a list of message_ids, return the subset that already
    exist in the emails table.
    """
    if not message_ids:
        return set()

    try:
        response = (
            client
            .table("emails")
            .select("message_id")
            .in_("message_id", message_ids)
            .execute()
        )
        return {row["message_id"] for row in response.data}

    except Exception as e:
        print(f"[DB ERROR] Could not check existing message_ids: {e}")
        return set()

def get_emails_for_student(student_id, limit=50):
    """
    Fetch processed emails + their events for a student, newest first.
    """
    try:
        response = (
            client
            .table("emails")
            .select("*, events(*)")
            .eq("student_id", student_id)
            .order("email_date", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []

    except Exception as e:
        print(f"[DB ERROR] Could not fetch emails for student {student_id}: {e}")
        return []

def filter_new_emails(cleaned_emails):
    """
    Drop emails that have already been processed and stored,
    based on message_id.
    """
    all_ids = [
        e.get("message_id", "").strip()
        for e in cleaned_emails
        if e.get("message_id", "").strip()
    ]

    existing_ids = get_existing_message_ids(all_ids)

    new_emails = [
        e for e in cleaned_emails
        if e.get("message_id", "").strip() not in existing_ids
    ]

    skipped = len(cleaned_emails) - len(new_emails)
    print(f"[DEDUP] {skipped} already-processed emails skipped, {len(new_emails)} new.")

    return new_emails


def get_last_synced_at(student_id="test_student"):
    """
    Return the last successful sync timestamp (as a datetime) for this
    student, or None if no sync has happened yet.
    """
    try:
        response = (
            client
            .table("sync_state")
            .select("last_synced_at")
            .eq("student_id", student_id)
            .execute()
        )

        if not response.data:
            return None

        from datetime import datetime as _dt
        return _dt.fromisoformat(response.data[0]["last_synced_at"])

    except Exception as e:
        print(f"[DB ERROR] Could not read sync_state: {e}")
        return None


def update_last_synced_at(student_id="test_student", synced_at=None):
    """
    Upsert the last successful sync timestamp for this student.
    Defaults to "now" if synced_at isn't given.
    """
    from datetime import datetime as _dt

    if synced_at is None:
        synced_at = _dt.now()

    try:
        client.table("sync_state").upsert(
            {
                "student_id": student_id,
                "last_synced_at": synced_at.isoformat()
            },
            on_conflict="student_id"
        ).execute()

    except Exception as e:
        print(f"[DB ERROR] Could not update sync_state: {e}")


def parse_email_date(date_str):
    """
    Convert an RFC2822 email Date header into ISO-8601.
     Example: "Wed, 8 Jul 2026 12:03:19 +0530" becomes "2026-07-08T12:03:19+05:30"
    """

    if not date_str:
        return None

    try:
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()

    except (TypeError, ValueError) as e:
        print(f"[DATE WARNING] {e}")
        return None
def insert_email(email_data, student_id="test_student"):
    """
    Insert (or update) a processed email.

    Returns the UUID of the inserted email row.
    """

    message_id = email_data.get("message_id", "").strip()

    if not message_id:
        print("[SKIP] Email has no Message-ID.")
        return None

    payload = {
        "student_id": student_id,
        "message_id": message_id,
        "subject": email_data.get("subject", ""),
        "sender": email_data.get("sender", ""),
        "email_date": parse_email_date(email_data.get("date")),
        "category": email_data.get("category", "other"),
        "importance": email_data.get("importance", "medium"),
        "summary": email_data.get("summary", "")
    }

    try:

        response = (
            client
            .table("emails")
            .upsert(
                payload,
                on_conflict="message_id"
            )
            .execute()
        )

        if not response.data:
            return None
        email_id = response.data[0]["id"]

        insert_events(
            email_id,
            email_data.get("events", [])
        )

        return email_id

    except Exception as e:
        print(f"[DB ERROR] {e}")
        return None
def insert_events(email_id, events):
    """
    Insert all events belonging to one email.
    """

    if not email_id:
        return

    for event in events:

        payload = {
            "email_id": email_id,
            "title": event.get("title", ""),
            "event_type": event.get("event_type", "other"),
            "event_date": event.get("date"),
            "event_time": event.get("time"),
            "end_date": event.get("end_date"),
            "end_time": event.get("end_time"),
            "location": event.get("location"),
            "confidence": event.get("confidence", "low")
        }

        try:

            client.table("events").upsert(
                payload,
                on_conflict="email_id,title,event_date"
            ).execute()

        except Exception as e:
            print(f"[EVENT ERROR] {e}")

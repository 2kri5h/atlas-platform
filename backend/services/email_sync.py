from datetime import datetime
from .students import get_student

from .client import connect_imap
from .email_cleaner import clean_email_dataset
from .llm_processor import process_emails
from .db_writer import (
    insert_email,
    filter_new_emails,
    get_last_synced_at,
    update_last_synced_at,
)


def run_sync(student_id="test_student"):
    student = get_student(student_id)

    if student is None:
        print(f"[ABORT] No student found for id {student_id}.")
        return
    run_started_at = datetime.now()

    last_synced_at = get_last_synced_at(student_id)

    if last_synced_at:
        print(f"[SYNC] Last synced at {last_synced_at}. Fetching new mail since then.")
    else:
        print("[SYNC] No previous sync found. Falling back to 2-day window.")

    emails = connect_imap(
    email_user=student["imap_email"],
    token_key=student["imap_token"],
    since_date=last_synced_at,
    )
    cleaned = clean_email_dataset(emails)
    cleaned = filter_new_emails(cleaned)
    results = process_emails(cleaned)

    print(f"\nProcessed {len(results)} emails.\n")

    saved = 0
    failed = 0

    for email in results:
        email_id = insert_email(email, student_id=student_id)

        if email_id:
            saved += 1
            print(f"[SAVED] {email['subject']}")
        else:
            failed += 1
            print(f"[FAILED] {email['subject']}")

    print("\n" + "=" * 80)
    print("DATABASE SUMMARY")
    print("=" * 80)
    print(f"Saved : {saved}")
    print(f"Failed: {failed}")

    # Advance the sync watermark to when this run started (not when it
    # finished), so any mail that arrived mid-run isn't skipped next time.
    update_last_synced_at(student_id, synced_at=run_started_at)
    print(f"\n[SYNC] Updated last_synced_at to {run_started_at}.")


if __name__ == "__main__":
    test_student_id = input("Enter student id to sync: ").strip()
    run_sync(test_student_id)
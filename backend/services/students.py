from .database_connect import get_client
from .crypto import encrypt_token, decrypt_token

client = get_client()


def register_student(imap_email, imap_token, platform_user_id=None):
    """
    Register a new student for the email.
    Encrypts the IMAP token before storing it.

    Returns the new student's id (uuid), or None on failure.
    """
    imap_email = imap_email.strip().lower()

    if not imap_email or not imap_token:
        print("[SKIP] imap_email and imap_token are required.")
        return None

    payload = {
        "imap_email": imap_email,
        "imap_token_encrypted": encrypt_token(imap_token),
        "platform_user_id": platform_user_id,
    }

    try:
        response = (
            client
            .table("students")
            .upsert(payload, on_conflict="imap_email")
            .execute()
        )

        if not response.data:
            return None

        return response.data[0]["id"]

    except Exception as e:
        print(f"[DB ERROR] Could not register student: {e}")
        return None


def get_student(student_id):
    """
    Fetch a single student's decrypted credentials by id.

    Returns a dict: {id, imap_email, imap_token, platform_user_id}
    or None if not found / decryption fails.
    """
    try:
        response = (
            client
            .table("students")
            .select("*")
            .eq("id", student_id)
            .execute()
        )

        if not response.data:
            print(f"[NOT FOUND] No student with id {student_id}.")
            return None

        row = response.data[0]

        return {
            "id": row["id"],
            "imap_email": row["imap_email"],
            "imap_token": decrypt_token(row["imap_token_encrypted"]),
            "platform_user_id": row.get("platform_user_id"),
        }

    except Exception as e:
        print(f"[DB ERROR] Could not fetch student {student_id}: {e}")
        return None

def get_student_by_platform_id(platform_user_id):
    """
    Look up a student's row using their platform login id.
    Used to check if they've already set up the email service,
    and to resolve which student_id to sync when they hit 'Fetch Emails'.
    """
    try:
        response = (
            client
            .table("students")
            .select("id")
            .eq("platform_user_id", platform_user_id)
            .execute()
        )

        if not response.data:
            return None

        return response.data[0]["id"]

    except Exception as e:
        print(f"[DB ERROR] Could not look up student by platform id: {e}")
        return None


def get_all_students():
    """
    Fetch all registered students with decrypted credentials.
    Useful for admin/debug purposes
    """
    try:
        response = client.table("students").select("*").execute()

        students = []
        for row in response.data:
            try:
                students.append({
                    "id": row["id"],
                    "imap_email": row["imap_email"],
                    "imap_token": decrypt_token(row["imap_token_encrypted"]),
                    "platform_user_id": row.get("platform_user_id"),
                })
            except Exception as e:
                print(f"[SKIP] Could not decrypt token for {row.get('imap_email')}: {e}")

        return students

    except Exception as e:
        print(f"[DB ERROR] Could not fetch students: {e}")
        return []
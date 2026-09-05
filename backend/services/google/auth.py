"""Google OAuth 2.0 Token Lifecycle & Storage Engine."""

import hashlib
import hmac
import json
import logging
import urllib.parse
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import requests
from sqlalchemy.orm import Session

from ...core.config import settings
from ...models import GoogleAccount, Student
from ..crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/calendar.events",
]


def is_google_oauth_configured() -> bool:
    """Return True if real Google Client ID & Secret are set."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def _sign_state(payload: dict) -> str:
    """HMAC-sign the OAuth state payload so it cannot be forged (CSRF protection)."""
    body = json.dumps(payload, sort_keys=True)
    sig = hmac.new(
        settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256
    ).hexdigest()
    return urllib.parse.quote(json.dumps({"p": payload, "s": sig}))


def verify_state(state: Optional[str]) -> Optional[dict]:
    """Validate a signed state string. Returns the payload or None if invalid."""
    if not state:
        return None
    try:
        data = json.loads(urllib.parse.unquote(state))
        payload = data.get("p")
        sig = data.get("s", "")
        body = json.dumps(payload, sort_keys=True)
        expected = hmac.new(
            settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        ts = datetime.fromisoformat(payload.get("ts"))
        # State older than 10 minutes is rejected (replay window).
        if (datetime.utcnow() - ts).total_seconds() > 600:
            return None
        return payload
    except Exception:
        return None


def get_google_auth_url(student_id: int, redirect_uri: Optional[str] = None) -> str:
    """Generate the Google OAuth 2.0 consent URL."""
    r_uri = (redirect_uri or settings.GOOGLE_REDIRECT_URI).strip()

    state_data = {
        "student_id": student_id,
        "ts": datetime.utcnow().isoformat(),
    }
    state = _sign_state(state_data)

    client_id = settings.GOOGLE_CLIENT_ID or "demo-client-id"
    if "GOOGLE_CLIENT_ID=" in client_id:
        client_id = client_id.split("GOOGLE_CLIENT_ID=")[-1].strip()

    params = {
        "client_id": client_id,
        "redirect_uri": r_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code_for_tokens(code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
    """Exchange authorization code for access & refresh tokens."""
    r_uri = (redirect_uri or settings.GOOGLE_REDIRECT_URI).strip()

    if not is_google_oauth_configured():
        # Sandbox / Dev mode fallback when credentials are not configured in .env
        logger.info("[Google OAuth] Sandbox mode: generating mock tokens.")
        return {
            "access_token": f"sandbox_access_token_{code[:8]}",
            "refresh_token": f"sandbox_refresh_token_{code[:8]}",
            "expires_in": 3600,
            "scope": " ".join(GOOGLE_SCOPES),
            "token_type": "Bearer",
        }

    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": r_uri,
        "grant_type": "authorization_code",
    }

    resp = requests.post(GOOGLE_TOKEN_URL, data=data, timeout=15)
    if resp.status_code != 200:
        logger.error(f"[Google OAuth] Token exchange failed ({resp.status_code}): {resp.text}")
        raise RuntimeError(f"Google OAuth token exchange failed: {resp.text}")

    return resp.json()


def get_google_user_info(access_token: str) -> Dict[str, Any]:
    """Fetch user's Google profile (email, name, picture)."""
    if access_token.startswith("sandbox_access_token_"):
        return {
            "email": "student.personal@gmail.com",
            "name": "IITB Student (Personal)",
            "picture": "https://lh3.googleusercontent.com/a/default-user",
        }

    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to fetch Google profile: {resp.text}")

    return resp.json()


def save_or_update_google_account(
    db: Session,
    student_id: int,
    token_data: Dict[str, Any],
    user_info: Dict[str, Any],
) -> GoogleAccount:
    """Encrypt and store Google credentials in the database."""
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    scopes = token_data.get("scope", " ".join(GOOGLE_SCOPES))

    token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)

    account = db.query(GoogleAccount).filter(GoogleAccount.student_id == student_id).first()

    if account:
        account.email = user_info.get("email", account.email)
        account.name = user_info.get("name", account.name)
        account.picture = user_info.get("picture", account.picture)
        account.encrypted_access_token = encrypt_secret(access_token)
        if refresh_token:
            account.encrypted_refresh_token = encrypt_secret(refresh_token)
        account.token_expiry = token_expiry
        account.scopes = scopes
        account.is_active = True
        account.updated_at = datetime.utcnow()
    else:
        account = GoogleAccount(
            student_id=student_id,
            email=user_info.get("email", "student@gmail.com"),
            name=user_info.get("name"),
            picture=user_info.get("picture"),
            encrypted_access_token=encrypt_secret(access_token),
            encrypted_refresh_token=encrypt_secret(refresh_token) if refresh_token else None,
            token_expiry=token_expiry,
            scopes=scopes,
            is_active=True,
        )
        db.add(account)

    db.commit()
    db.refresh(account)
    return account


def get_google_account(db: Session, student_id: int) -> Optional[GoogleAccount]:
    """Retrieve Google account record for a student."""
    return db.query(GoogleAccount).filter(
        GoogleAccount.student_id == student_id,
        GoogleAccount.is_active == True,
    ).first()


def get_valid_access_token(db: Session, student_id: int) -> Optional[str]:
    """
    Get decrypted access token. Refreshes token if expired or near expiry (within 5 mins).
    """
    account = get_google_account(db, student_id)
    if not account:
        return None

    try:
        raw_access_token = decrypt_secret(account.encrypted_access_token)
    except Exception as e:
        logger.error(f"[Google Auth] Decryption failed for student {student_id}: {e}")
        return None

    if raw_access_token.startswith("sandbox_access_token_"):
        return raw_access_token

    # Check expiration
    if account.token_expiry and account.token_expiry > (datetime.utcnow() + timedelta(minutes=5)):
        return raw_access_token

    # Refresh expired token
    if not account.encrypted_refresh_token:
        logger.warning(f"[Google Auth] No refresh token available for student {student_id}")
        return raw_access_token

    try:
        raw_refresh_token = decrypt_secret(account.encrypted_refresh_token)
    except Exception as e:
        logger.error(f"[Google Auth] Failed to decrypt refresh token: {e}")
        return raw_access_token

    if not is_google_oauth_configured():
        return raw_access_token

    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": raw_refresh_token,
        "grant_type": "refresh_token",
    }

    try:
        resp = requests.post(GOOGLE_TOKEN_URL, data=data, timeout=15)
        if resp.status_code == 200:
            token_res = resp.json()
            new_access_token = token_res["access_token"]
            expires_in = token_res.get("expires_in", 3600)
            account.encrypted_access_token = encrypt_secret(new_access_token)
            account.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
            account.updated_at = datetime.utcnow()
            db.commit()
            return new_access_token
        else:
            logger.error(f"[Google Auth] Refresh failed: {resp.text}")
            return raw_access_token
    except Exception as e:
        logger.error(f"[Google Auth] Refresh exception: {e}")
        return raw_access_token


def disconnect_google_account(db: Session, student_id: int) -> bool:
    """Disconnect and deactivate Google Account integration."""
    account = db.query(GoogleAccount).filter(GoogleAccount.student_id == student_id).first()
    if not account:
        return False

    db.delete(account)
    db.commit()
    return True

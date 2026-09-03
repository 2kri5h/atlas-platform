"""Secret encryption/decryption for stored API keys and OAuth tokens.

The Fernet key comes from the TOKEN_ENCRYPTION_KEY environment variable.
In development, if the variable is missing, an ephemeral key is generated so the
app still runs — but any secrets encrypted with it become undecryptable after a
restart, so a warning is logged. In production (ENVIRONMENT=production or a
non-sqlite DATABASE_URL) a missing key is a hard startup error.
"""

import logging
import os

from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load both repo-root .env and backend/core/.env (the project's canonical env file).
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "core", ".env"))

logger = logging.getLogger(__name__)


def _is_production() -> bool:
    env = (os.environ.get("ENVIRONMENT") or "").lower()
    db_url = os.environ.get("DATABASE_URL") or ""
    return env == "production" or (bool(db_url) and not db_url.startswith("sqlite"))


def _load_fernet_key() -> bytes:
    key = os.environ.get("TOKEN_ENCRYPTION_KEY")
    if key:
        return key.encode() if isinstance(key, str) else key

    if _is_production():
        raise RuntimeError(
            "[Security] TOKEN_ENCRYPTION_KEY must be set in production. Without it, "
            "stored API keys and OAuth tokens cannot be encrypted/decrypted securely."
        )

    logger.warning(
        "[Security] TOKEN_ENCRYPTION_KEY not set. Generating an EPHEMERAL key for this "
        "session (dev only). Any secrets encrypted now will be undecryptable after restart."
    )
    return Fernet.generate_key()


_fernet = Fernet(_load_fernet_key())


def encrypt_secret(plain_text: str) -> str:
    """
    Encrypt a plaintext secret (API key, token, password) for secure storage.
    Returns a string safe to store in the DB.
    """
    if not plain_text:
        raise ValueError("Cannot encrypt an empty secret.")
    return _fernet.encrypt(plain_text.encode()).decode()


def decrypt_secret(encrypted_text: str) -> str:
    """
    Decrypt a secret pulled from the DB back into its plaintext form.
    """
    if not encrypted_text:
        raise ValueError("Cannot decrypt an empty secret.")
    return _fernet.decrypt(encrypted_text.encode()).decode()


def encrypt_token(plain_token):
    """
    Encrypt a plaintext IMAP token for storage.
    Returns a string safe to store in the DB.
    """
    return encrypt_secret(plain_token)


def decrypt_token(encrypted_token):
    """
    Decrypt a token pulled from the DB back into its plaintext form,
    ready to use for IMAP login.
    """
    return decrypt_secret(encrypted_token)
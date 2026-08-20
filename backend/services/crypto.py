from dotenv import load_dotenv
load_dotenv()

import os
from cryptography.fernet import Fernet

_key = os.environ.get("TOKEN_ENCRYPTION_KEY")
if not _key:
    _key = Fernet.generate_key().decode()
_fernet = Fernet(_key.encode() if isinstance(_key, str) else _key)


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
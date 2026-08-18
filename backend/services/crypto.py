from dotenv import load_dotenv
load_dotenv()

import os
from cryptography.fernet import Fernet

_key = os.environ.get("TOKEN_ENCRYPTION_KEY")
if not _key:
    _key = Fernet.generate_key().decode()
_fernet = Fernet(_key.encode() if isinstance(_key, str) else _key)


def encrypt_token(plain_token):
    """
    Encrypt a plaintext IMAP token for storage.
    Returns a string safe to store in the DB.
    """
    if not plain_token:
        raise ValueError("Cannot encrypt an empty token.")

    return _fernet.encrypt(plain_token.encode()).decode()


def decrypt_token(encrypted_token):
    """
    Decrypt a token pulled from the DB back into its plaintext form,
    ready to use for IMAP login.
    """
    if not encrypted_token:
        raise ValueError("Cannot decrypt an empty token.")

    return _fernet.decrypt(encrypted_token.encode()).decode()
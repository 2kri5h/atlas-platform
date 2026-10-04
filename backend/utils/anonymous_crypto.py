import os
import hmac
import hashlib
import secrets
import re
from datetime import datetime
from typing import Optional, Tuple
from ..core.config import settings

# ── 1. Ephemeral Per-Thread Handles ──────────────────────────────────────────
# 64 Adjectives & 64 Animals -> 4,096 unique combinations per thread.
ADJECTIVES = [
    "Quiet", "Amber", "Slow", "Grey", "Pale", "Bright", "Still", "Gentle",
    "Calm", "Brave", "Clever", "Curious", "Dusty", "Early", "Fuzzy", "Golden",
    "Hidden", "Humble", "Jolly", "Kind", "Lucky", "Mellow", "Misty", "Nimble",
    "Patient", "Plucky", "Proud", "Rapid", "Rosy", "Rustic", "Shy", "Silver",
    "Sleepy", "Snowy", "Soft", "Steady", "Sunny", "Swift", "Tidy", "Tiny",
    "Velvet", "Warm", "Wild", "Wise", "Witty", "Young", "Zesty", "Cosy",
    "Breezy", "Crisp", "Dapper", "Eager", "Fancy", "Frosty", "Glad", "Hazy",
    "Lively", "Merry", "Noble", "Polite", "Quick", "Sturdy", "Honest", "Loyal",
]

ANIMALS = [
    "Heron", "Finch", "Otter", "Wren", "Moth", "Kite", "Carp", "Owl",
    "Sparrow", "Myna", "Parrot", "Peacock", "Kingfisher", "Hornbill", "Egret", "Crane",
    "Robin", "Bulbul", "Koel", "Pigeon", "Crow", "Squirrel", "Mongoose", "Tortoise",
    "Turtle", "Gecko", "Frog", "Toad", "Rabbit", "Hare", "Deer", "Fox",
    "Wolf", "Bear", "Panda", "Tiger", "Lion", "Leopard", "Lynx", "Badger",
    "Beaver", "Hedgehog", "Mole", "Bat", "Dolphin", "Whale", "Seal", "Crab",
    "Snail", "Bee", "Ant", "Beetle", "Butterfly", "Dragonfly", "Firefly", "Ladybird",
    "Lizard", "Koala", "Llama", "Yak", "Camel", "Goat", "Buffalo", "Elephant",
]


def generate_thread_handle(account_or_seed: str, post_id: int) -> str:
    """Generate deterministic ephemeral handle: Adjective + Animal for a specific post."""
    key = settings.SECRET_KEY.encode() if settings.SECRET_KEY else b"atlas-secret-seed-key"
    msg = f"{account_or_seed}:{post_id}".encode()
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    adj_idx = digest[0] % len(ADJECTIVES)
    animal_idx = digest[1] % len(ANIMALS)
    return f"{ADJECTIVES[adj_idx]} {ANIMALS[animal_idx]}"


# ── 2. Crockford Base32 Recovery Keys ────────────────────────────────────────
CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def generate_recovery_key() -> str:
    """Generate a 120-bit recovery key formatted as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX."""
    raw_bytes = secrets.token_bytes(15)  # 120 bits
    # Convert bytes to base32
    num = int.from_bytes(raw_bytes, byteorder="big")
    chars = []
    for _ in range(24):
        chars.append(CROCKFORD_ALPHABET[num & 31])
        num >>= 5
    chars.reverse()
    s = "".join(chars)
    return f"{s[0:4]}-{s[4:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:24]}"


def normalize_recovery_key(key: str) -> Optional[str]:
    """Normalize user input: uppercase, strip spaces/hyphens, map O->0, I/L->1."""
    if not key:
        return None
    cleaned = (
        key.upper()
        .replace("-", "")
        .replace(" ", "")
        .replace("O", "0")
        .replace("I", "1")
        .replace("L", "1")
    )
    if len(cleaned) != 24 or not all(c in CROCKFORD_ALPHABET for c in cleaned):
        return None
    return cleaned


def hash_recovery_key(normalized_key: str) -> bytes:
    """SHA-256 hash of recovery key for database storage."""
    return hashlib.sha256(normalized_key.encode("utf-8")).digest()


# ── 3. Semester Key & Voucher Management ─────────────────────────────────────
def get_current_semester() -> str:
    """Return academic semester string, e.g., '2026-autumn' or '2027-spring'."""
    now = datetime.utcnow()
    year = now.year
    # Autumn semester: July - December; Spring semester: January - June
    term = "autumn" if now.month >= 7 else "spring"
    return f"{year}-{term}"


def get_semester_key() -> bytes:
    """Derive semester-specific key from SECRET_KEY and semester ID."""
    master = settings.SECRET_KEY.encode() if settings.SECRET_KEY else b"atlas-fallback-secret"
    sem = get_current_semester().encode()
    return hmac.new(master, sem, hashlib.sha256).digest()


def hash_student_semester(student_id: int) -> bytes:
    """Oneway keyed hash for checking voucher claim without storing student ID."""
    sem_key = get_semester_key()
    return hmac.new(sem_key, str(student_id).encode(), hashlib.sha256).digest()


def issue_voucher_token(student_id: int) -> Tuple[str, str]:
    """Issue a cryptographic voucher token to be redeemed unlinked."""
    sem = get_current_semester()
    sem_key = get_semester_key()
    nonce = secrets.token_hex(16)
    sig = hmac.new(sem_key, f"voucher:{nonce}:{sem}".encode(), hashlib.sha256).hexdigest()
    voucher = f"{nonce}.{sig}"
    return voucher, sem


def verify_voucher_token(voucher: str, sem: str) -> bool:
    """Verify voucher signature against current semester key."""
    parts = voucher.split(".")
    if len(parts) != 2:
        return False
    nonce, given_sig = parts
    sem_key = get_semester_key()
    expected_sig = hmac.new(sem_key, f"voucher:{nonce}:{sem}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(given_sig, expected_sig)


# ── 4. High-Intent Crisis & Distress Detection ───────────────────────────────
DISTRESS_PATTERNS = [
    re.compile(r"\b(kill|hurt|harm)(ing)?\s+my\s*self\b", re.IGNORECASE),
    re.compile(r"\bself[-\s]?harm\b", re.IGNORECASE),
    re.compile(r"\bsuicid", re.IGNORECASE),
    re.compile(r"\bwant(ed)?\s+to\s+die\b", re.IGNORECASE),
    re.compile(r"\b(don'?t|do not)\s+want\s+to\s+(live|wake up|be alive|exist)\b", re.IGNORECASE),
    re.compile(r"\bno\s+(point|reason)\s+(in\s+)?(living|going on|to live)\b", re.IGNORECASE),
    re.compile(r"\bcan'?t\s+(go on|do this anymore|take (it|this) anymore)\b", re.IGNORECASE),
    re.compile(r"\bend(ing)?\s+(it\s+all|my\s+life)\b", re.IGNORECASE),
    re.compile(r"\bbetter\s+off\s+(dead|without me)\b", re.IGNORECASE),
]


def detect_crisis_distress(text: str) -> bool:
    """Detect high-specificity crisis phrases requiring immediate support contacts."""
    if not text:
        return False
    return any(p.search(text) for p in DISTRESS_PATTERNS)

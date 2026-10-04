"""Shared sliding-window rate limiting with a development memory fallback."""

import ipaddress
import threading
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException, Request
from ..core.config import settings

try:
    import redis
except ImportError:  # pragma: no cover - development install without optional service
    redis = None


_REDIS_SCRIPT = """
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return 1
"""


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()
        self._redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True) if redis and settings.REDIS_URL else None

    def check(self, key: str) -> bool:
        """Return True if the request is allowed, False if rate-limited."""
        if self._redis is not None:
            now = time.time()
            try:
                return bool(self._redis.eval(
                    _REDIS_SCRIPT,
                    1,
                    f"atlas:rate:{key}",
                    now - self.window_seconds,
                    now,
                    self.max_requests,
                    f"{now}:{uuid.uuid4().hex}",
                    self.window_seconds + 1,
                ))
            except Exception:
                if settings.ENVIRONMENT.lower() == "production":
                    # Fail closed for security-sensitive production routes.
                    return False

        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            cutoff = now - self.window_seconds
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True

    def reset(self, key=None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    direct = request.client.host if request.client else "unknown"
    if fwd and _is_trusted_proxy(direct):
        return fwd.split(",")[0].strip()
    return direct


def _is_trusted_proxy(host: str) -> bool:
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    for configured in settings.trusted_proxies_list:
        try:
            if "/" in configured and address in ipaddress.ip_network(configured, strict=False):
                return True
            if address == ipaddress.ip_address(configured):
                return True
        except ValueError:
            continue
    return False


def rate_limit(limiter: SlidingWindowLimiter, key_prefix: str):
    """FastAPI dependency factory: rate-limit by client IP under `key_prefix`."""

    def dependency(request: Request) -> None:
        if not limiter.check(f"{key_prefix}:{client_ip(request)}"):
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down and try again shortly.",
            )

    return dependency

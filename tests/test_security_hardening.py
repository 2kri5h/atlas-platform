"""Unit tests verifying security hardening across the codebase."""

import ipaddress
from types import SimpleNamespace
import pytest
from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.api.anonymous import report_post
from backend.api.auth import get_password_hash, login as auth_login
from backend.api.campus_events import EventCreate, archive_event, create_event
from backend.utils.ssrf import UnsafeOutboundURLError, request_with_safe_redirects, validate_safe_url
from backend.api.resources import validate_http_url
from backend.core.config import Settings, settings
from backend.core.database import Base
from backend.models import AnonymousPost, AnonymousPostReport, Event, Student
from backend.services.reminders import _render_html


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _student(index: int, role: str = "student") -> Student:
    return Student(
        roll_number=f"2200{index:04d}",
        name=f"Student {index}",
        email=f"student{index}@example.test",
        password_hash="not-used",
        role=role,
    )


def test_ssrf_ipv4_mapped_ipv6_unpacking():
    """Verify that IPv4-mapped IPv6 addresses unpack to underlying IPv4 properly."""
    mapped_ip = ipaddress.ip_address("::ffff:169.254.169.254")
    assert isinstance(mapped_ip, ipaddress.IPv6Address)
    assert mapped_ip.ipv4_mapped is not None
    assert mapped_ip.ipv4_mapped.is_link_local is True

    private_mapped = ipaddress.ip_address("::ffff:10.0.0.1")
    assert private_mapped.ipv4_mapped.is_private is True


def test_ssrf_validate_safe_url():
    """Verify validate_safe_url blocks private IPs, metadata, loopback, and bad schemes."""
    # Invalid schemes
    is_safe, err = validate_safe_url("file:///etc/passwd")
    assert is_safe is False
    assert "Invalid URL scheme" in err

    is_safe, err = validate_safe_url("ftp://127.0.0.1/test")
    assert is_safe is False
    assert "Invalid URL scheme" in err

    # Localhost / Loopback
    is_safe, err = validate_safe_url("http://127.0.0.1:8000/transcribe")
    assert is_safe is False
    assert "forbidden" in err or "blocked" in err

    # AWS/GCP Cloud Metadata
    is_safe, err = validate_safe_url("http://169.254.169.254/latest/meta-data")
    assert is_safe is False
    assert "blocked" in err

    is_safe, err = validate_safe_url(
        "https://not-approved.example/path",
        allowed_hosts=["api.openai.com"],
    )
    assert is_safe is False
    assert "allowlisted" in err


def test_ssrf_revalidates_redirect_destinations(monkeypatch):
    def fake_dns(hostname, *_args, **_kwargs):
        address = "93.184.216.34" if hostname == "public.example" else "127.0.0.1"
        return [(2, 1, 6, "", (address, 0))]

    class RedirectResponse:
        status_code = 307
        headers = {"Location": "http://127.0.0.1/admin"}

        def close(self):
            return None

    monkeypatch.setattr("backend.utils.ssrf.socket.getaddrinfo", fake_dns)
    monkeypatch.setattr("backend.utils.ssrf.requests.request", lambda *_args, **_kwargs: RedirectResponse())

    with pytest.raises(UnsafeOutboundURLError, match="localhost|loopback"):
        request_with_safe_redirects("POST", "https://public.example/v1/chat", json={"prompt": "test"})

    is_safe, err = validate_safe_url("http://metadata.google.internal/computeMetadata/v1")
    assert is_safe is False
    assert "blocked" in err


def test_validate_http_url():
    """Verify URL validation rejects malicious schemes (XSS/Protocol injection)."""
    # Reject dangerous schemes with ValueError
    with pytest.raises(ValueError, match="Dangerous URL scheme not allowed"):
        validate_http_url("javascript:alert(1)")

    with pytest.raises(ValueError, match="Dangerous URL scheme not allowed"):
        validate_http_url("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")

    with pytest.raises(ValueError, match="Dangerous URL scheme not allowed"):
        validate_http_url("vbscript:msgbox(1)")

    with pytest.raises(ValueError, match="URL must start with http://, https://, or /"):
        validate_http_url("file:///etc/hosts")

    # Valid URLs accepted
    assert validate_http_url("https://example.com/resource") == "https://example.com/resource"
    assert validate_http_url("http://iitb.ac.in/events") == "http://iitb.ac.in/events"
    assert validate_http_url(None) == ""
    assert validate_http_url("") == ""


def test_email_html_injection_prevention():
    """Verify that email templates escape untrusted content to prevent HTML injection."""
    malicious_name = '<script>alert("XSS")</script>'
    reminders = {
        "deadlines": [
            {
                "label": "<b>High Priority</b>",
                "title": '<img src=x onerror=alert(1)>',
                "due": 'Tonight<script>',
            }
        ],
        "overdue_tasks": [
            {
                "title": '<svg onload=alert(document.cookie)>',
            }
        ]
    }

    html = _render_html(malicious_name, reminders)

    # Raw script, img, svg, or b tags must NOT exist in rendered output
    assert "<script>" not in html
    assert "<img" not in html
    assert "<svg" not in html
    assert "<b>High Priority</b>" not in html

    # Escaped versions must exist
    assert "&lt;script&gt;" in html
    assert "&lt;img" in html
    assert "&lt;svg" in html
    assert "&lt;b&gt;High Priority&lt;/b&gt;" in html


def test_anonymous_reports_are_idempotent_and_threshold_based(db_session):
    reporters = [_student(index) for index in range(1, settings.ANONYMOUS_REPORT_THRESHOLD + 1)]
    post = AnonymousPost(content="A post that needs moderator review")
    db_session.add_all([*reporters, post])
    db_session.commit()

    assert report_post(post.id, reporters[0], db_session, None) == {"status": "received"}
    assert report_post(post.id, reporters[0], db_session, None) == {"status": "received"}
    assert db_session.query(AnonymousPostReport).count() == 1
    assert db_session.get(AnonymousPost, post.id).is_flagged is False

    for reporter in reporters[1:]:
        report_post(post.id, reporter, db_session, None)

    assert db_session.query(AnonymousPostReport).count() == settings.ANONYMOUS_REPORT_THRESHOLD
    assert db_session.get(AnonymousPost, post.id).is_flagged is True


def test_campus_event_mutation_requires_creator_or_admin(db_session):
    owner = _student(101)
    stranger = _student(102)
    admin = _student(103, role="admin")
    db_session.add_all([owner, stranger, admin])
    db_session.commit()

    created = create_event(EventCreate(title="Security workshop"), owner, db_session, None)
    assert created.created_by_id == owner.id
    assert created.can_manage is True

    with pytest.raises(HTTPException) as denied:
        archive_event(created.id, current_user=stranger, db=db_session)
    assert denied.value.status_code == 403
    assert db_session.get(Event, created.id).is_archived is False

    archived = archive_event(created.id, current_user=admin, db=db_session)
    assert archived.is_archived is True
    assert archived.can_manage is True


def test_login_issues_httponly_cookie_and_native_bearer_token(db_session):
    student = _student(201)
    student.password_hash = get_password_hash("AtlasTest123!")
    db_session.add(student)
    db_session.commit()
    response = Response()

    token = auth_login(
        response,
        SimpleNamespace(username=student.roll_number, password="AtlasTest123!"),
        db_session,
        None,
    )

    set_cookie_headers = "\n".join(response.headers.getlist("set-cookie")).lower()
    assert "atlas_access=" in set_cookie_headers
    assert "httponly" in set_cookie_headers
    assert "samesite=lax" in set_cookie_headers
    assert "atlas_csrf=" in set_cookie_headers
    assert token["access_token"]
    assert token["csrf_token"]


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"SECRET_KEY": "short"}, "at least 32"),
        ({"CORS_ORIGINS": "*"}, "CORS_ORIGINS"),
        ({"AUTO_SEED_ON_STARTUP": True}, "AUTO_SEED_ON_STARTUP"),
    ],
)
def test_production_security_configuration_fails_closed(overrides, message):
    values = {
        "ENVIRONMENT": "production",
        "DATABASE_URL": "postgresql://atlas:password@db.example.com/atlas",
        "SECRET_KEY": "s" * 40,
        "CORS_ORIGINS": "https://atlas.example.com",
        "REDIS_URL": "redis://redis.example.com:6379/0",
        "AUTO_SEED_ON_STARTUP": False,
        **overrides,
    }
    with pytest.raises(RuntimeError, match=message):
        Settings(_env_file=None, **values)

"""Tests for the unified Today Dashboard aggregation service.

Uses an isolated in-memory SQLite database so no dev data is touched.
Run: pytest tests/ -q
"""

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.orm import sessionmaker

from backend.core.database import Base, create_sqlite_engine
from backend.models import BurnoutScore, PlannerEvent, Student, TaskLog
from backend.services.dashboard_service import (
    build_today_dashboard,
    todays_timetable,
    upcoming_deadlines,
    working_hours_today,
)


@pytest.fixture()
def db():
    engine = create_sqlite_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture()
def student(db):
    s = Student(
        name="Test Student",
        email="test@iitb.ac.in",
        roll_number="21001001",
        password_hash="x",
    )
    db.add(s)
    db.commit()
    return s


def _event(db, student_id, **kwargs):
    defaults = dict(
        userId=student_id,
        title="Block",
        startTime="09:00",
        endTime="10:00",
        tag="OPTIONAL",
        category="CLASS",
    )
    defaults.update(kwargs)
    e = PlannerEvent(**defaults)
    db.add(e)
    db.commit()
    return e


class TestTimetable:
    def test_non_recurring_event_on_day(self, db, student):
        day = date(2026, 8, 24)  # Monday
        _event(db, student.id, title="CS Lecture", date=datetime(2026, 8, 24))
        blocks = todays_timetable(db, student.id, day)
        assert [b["title"] for b in blocks] == ["CS Lecture"]

    def test_non_recurring_event_other_day_excluded(self, db, student):
        _event(db, student.id, date=datetime(2026, 8, 25))
        assert todays_timetable(db, student.id, date(2026, 8, 24)) == []

    def test_recurring_event_expands_on_matching_weekday(self, db, student):
        # recurrenceDay uses the app convention: 0=Sun .. 1=Mon .. 6=Sat
        _event(db, student.id, isRecurring=True, recurrenceDay=1, title="Weekly Lab")
        blocks = todays_timetable(db, student.id, date(2026, 8, 24))  # Monday
        assert len(blocks) == 1 and blocks[0]["is_recurring"] is True

    def test_recurring_event_respects_exdate(self, db, student):
        _event(db, student.id, isRecurring=True, recurrenceDay=1, exdates="2026-08-24")
        assert todays_timetable(db, student.id, date(2026, 8, 24)) == []

    def test_sorted_by_start_time(self, db, student):
        d = datetime(2026, 8, 24)
        _event(db, student.id, title="Late", startTime="14:00", endTime="15:00", date=d)
        _event(db, student.id, title="Early", date=d)
        blocks = todays_timetable(db, student.id, d.date())
        assert [b["title"] for b in blocks] == ["Early", "Late"]

    def test_working_hours_sums_block_durations(self, db, student):
        d = datetime(2026, 8, 24)
        _event(db, student.id, startTime="09:00", endTime="10:30", date=d)
        _event(db, student.id, startTime="11:00", endTime="12:00", date=d)
        assert working_hours_today(db, student.id, d.date()) == 2.5


class TestDeadlines:
    def test_overdue_and_due_soon_split(self, db, student):
        now = datetime(2026, 8, 24, 10, 0)
        _event(db, student.id, title="Past", deadline_date=now - timedelta(hours=2))
        _event(db, student.id, title="Soon", deadline_date=now + timedelta(hours=10))
        _event(db, student.id, title="Far", deadline_date=now + timedelta(hours=100))
        result = upcoming_deadlines(db, student.id, now, horizon_hours=48)
        assert [d["title"] for d in result["overdue"]] == ["Past"]
        assert [d["title"] for d in result["due_soon"]] == ["Soon"]

    def test_null_deadlines_ignored(self, db, student):
        _event(db, student.id, deadline_date=None)
        result = upcoming_deadlines(db, student.id, datetime(2026, 8, 24))
        assert result["overdue"] == [] and result["due_soon"] == []


class TestTaskSummary:
    def test_counts_and_ordering(self, db, student):
        now = datetime(2026, 8, 24)
        db.add(TaskLog(student_id=student.id, title="Overdue task", due_date=now - timedelta(days=1)))
        db.add(TaskLog(student_id=student.id, title="Next task", due_date=now + timedelta(days=1)))
        db.add(TaskLog(student_id=student.id, title="Done", completed=True))
        db.commit()
        summary = build_today_dashboard(db, student.id, now=now).tasks
        assert summary["open_count"] == 2
        assert summary["overdue_count"] == 1
        assert summary["next_tasks"][0]["title"] == "Overdue task"


class TestBurnout:
    def test_no_score_yet(self, db, student):
        assert build_today_dashboard(db, student.id, now=datetime(2026, 8, 24)).burnout == {"exists": False}

    def test_latest_score_returned(self, db, student):
        old = BurnoutScore(student_id=student.id, score=40.0, risk_level="medium", created_at=datetime(2026, 8, 23))
        new = BurnoutScore(student_id=student.id, score=70.0, risk_level="high", created_at=datetime(2026, 8, 24))
        db.add_all([old, new])
        db.commit()
        burnout = build_today_dashboard(db, student.id, now=datetime(2026, 8, 24)).burnout
        assert burnout["score"] == 70.0 and burnout["risk_level"] == "high"

    def test_dashboard_is_scoped_to_student(self, db, student):
        other = Student(name="Other", email="o@iitb.ac.in", roll_number="21001002", password_hash="x")
        db.add(other)
        db.commit()
        _event(db, other.id, date=datetime(2026, 8, 24))
        dashboard = build_today_dashboard(db, student.id, now=datetime(2026, 8, 24))
        assert dashboard.timetable == []

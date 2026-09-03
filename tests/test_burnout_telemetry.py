"""Burnout telemetry correctness tests (recurrence-day + exdate handling).

Verifies the Top-10 #6 DoD: a Mon-recurring 2h class contributes exactly 2h to
weekly working hours, and excluded (exdated) occurrences contribute 0.

Run: pytest tests/ -q
"""

from datetime import datetime, timedelta, date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.api.ai import compute_weekly_working_hours, compute_deadline_pressure
from backend.models.models import Base, Student, PlannerEvent


def _fresh_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    return TestingSession()


def _new_monday(db) -> date:
    """iso date of the Monday that falls inside the 'last 7 days' window."""
    from backend.services.recurrence import last_n_days_endpoints, standard_day
    start, end = last_n_days_endpoints(datetime.utcnow(), days=7)
    curr = start
    while curr <= end:
        if standard_day(curr) == 1:
            return curr
        curr += timedelta(days=1)
    # Safety fallback: should never happen since any 7-day window has a Monday.
    return start


def test_monday_recurring_class_contributes_exactly_two_hours():
    db = _fresh_session()
    student = Student(roll_number="21001001", name="Test", email="t@x.com",
                      password_hash="x", role="student")
    db.add(student)
    db.commit()

    monday = _new_monday(db)
    ev = PlannerEvent(
        userId=student.id, title="Math", startTime="10:00", endTime="12:00",
        tag="IMPORTANT", category="CLASS", isWorkingHour=True,
        isRecurring=True, recurrenceDay=1,  # Monday (0=Sun convention)
    )
    db.add(ev)
    db.commit()

    hours = compute_weekly_working_hours(db, student.id)
    assert hours == 2.0, hours


def test_excluded_date_contributes_zero_hours():
    db = _fresh_session()
    student = Student(roll_number="21001002", name="Test", email="t2@x.com",
                      password_hash="x", role="student")
    db.add(student)
    db.commit()

    monday = _new_monday(db)
    ev = PlannerEvent(
        userId=student.id, title="Math", startTime="10:00", endTime="12:00",
        tag="IMPORTANT", category="CLASS", isWorkingHour=True,
        isRecurring=True, recurrenceDay=1, exdates=monday.isoformat(),
    )
    db.add(ev)
    db.commit()

    hours = compute_weekly_working_hours(db, student.id)
    assert hours == 0.0, hours


def test_deadline_pressure_rises_near_deadline():
    db = _fresh_session()
    student = Student(roll_number="21001003", name="Test", email="t3@x.com",
                      password_hash="x", role="student")
    db.add(student)
    db.commit()

    now = datetime.utcnow()
    near = PlannerEvent(
        userId=student.id, title="Assignment", startTime="10:00", endTime="11:00",
        tag="CRITICAL", category="OTHER", isRecurring=False,
        deadline_date=now + timedelta(days=2),
    )
    db.add(near)
    db.commit()

    pressure = compute_deadline_pressure(db, student.id)
    assert 0.19 <= pressure <= 0.21, pressure
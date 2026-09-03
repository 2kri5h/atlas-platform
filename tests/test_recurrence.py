"""Sanity tests for the shared recurrence helpers (run: pytest tests/ -q)."""

from datetime import date

from backend.services.recurrence import occurrence_dates, parse_exdates, standard_day


def test_standard_day_convention():
    # 2026-08-23 is a Sunday -> 0; Monday -> 1
    assert standard_day(date(2026, 8, 23)) == 0
    assert standard_day(date(2026, 8, 24)) == 1
    assert standard_day(date(2026, 8, 29)) == 6  # Saturday


def test_occurrence_dates_matches_only_recurrence_day():
    days = occurrence_dates(date(2026, 8, 17), date(2026, 8, 23), 1)
    assert [d.isoformat() for d in days] == ["2026-08-17"]


def test_occurrence_dates_respects_exdates():
    days = occurrence_dates(date(2026, 8, 17), date(2026, 8, 23), 1, {"2026-08-17"})
    assert days == []


def test_parse_exdates_comma_format():
    assert parse_exdates("2026-08-17,2026-08-18") == {"2026-08-17", "2026-08-18"}


def test_parse_exdates_json_format():
    assert parse_exdates('["2026-08-17"]') == {"2026-08-17"}


def test_parse_exdates_empty_and_none():
    assert parse_exdates(None) == set()
    assert parse_exdates("") == set()

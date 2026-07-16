import json
from datetime import datetime, timedelta

from db import Application
from services.interview_rounds import (
    EMPTY_NOTES, new_round, load_rounds, find_round, recompute_interview_date,
)


def _iso(delta_days: int) -> str:
    return (datetime.now() + timedelta(days=delta_days)).isoformat()


def test_new_round_has_empty_prep_and_notes():
    r = new_round("Screening")
    assert r["round_type"] == "Screening"
    assert r["date"] is None
    assert r["id"]
    assert r["created_at"]
    assert r["prep"]["common_questions"] == []
    assert r["notes"] == EMPTY_NOTES


def test_find_round_returns_match_or_none():
    rounds = [new_round("Screening"), new_round("Technical")]
    assert find_round(rounds, rounds[1]["id"])["round_type"] == "Technical"
    assert find_round(rounds, "missing") is None


def test_recompute_interview_date_picks_soonest_upcoming():
    rounds = [
        {"date": _iso(5)},
        {"date": _iso(1)},
        {"date": _iso(-3)},
    ]
    assert recompute_interview_date(rounds) == rounds[1]["date"]


def test_recompute_interview_date_falls_back_to_most_recent_past():
    rounds = [{"date": _iso(-10)}, {"date": _iso(-2)}]
    assert recompute_interview_date(rounds) == rounds[1]["date"]


def test_recompute_interview_date_none_when_no_dates():
    assert recompute_interview_date([{"date": None}, {}]) is None
    assert recompute_interview_date([]) is None


def test_load_rounds_empty_when_nothing_stored():
    app = Application(id="a1", company="C", job_title="T", language="en", job_description="d")
    assert load_rounds(app) == []


def test_load_rounds_prefers_existing_rounds_json_over_legacy():
    app = Application(
        id="a1", company="C", job_title="T", language="en", job_description="d",
        interview_rounds_json=json.dumps([{"id": "x", "round_type": "Final"}]),
        interview_date="2026-01-01T10:00",
    )
    rounds = load_rounds(app)
    assert len(rounds) == 1
    assert rounds[0]["id"] == "x"


def test_load_rounds_migrates_legacy_single_round_fields():
    app = Application(
        id="a1", company="C", job_title="T", language="en", job_description="d",
        interview_prep_json=json.dumps({"salary": "80k", "common_questions": []}),
        interview_notes_json=json.dumps({"notes": "remember this"}),
        interview_date="2026-01-01T10:00",
    )
    rounds = load_rounds(app)
    assert len(rounds) == 1
    r = rounds[0]
    assert r["round_type"] == "Technical"
    assert r["date"] == "2026-01-01T10:00"
    assert r["prep"]["salary"] == "80k"
    assert r["notes"]["notes"] == "remember this"
    assert r["id"]

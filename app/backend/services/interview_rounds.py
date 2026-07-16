"""Round-scoped interview data: a list of {id, round_type, date, prep, notes,
created_at} dicts stored as Application.interview_rounds_json.

Pure functions — no DB session. Callers persist the returned/mutated list
themselves (json.dumps into interview_rounds_json)."""
import json
from datetime import datetime
from uuid import uuid4

from db import Application
from services.interview_schema import InterviewPrep

EMPTY_NOTES = {
    "overview": "",
    "red_flags": [],
    "salary": {"ask": "", "market": "", "floor": "", "notes": ""},
    "notes": "",
    "my_q_state": {},
}


def new_round(round_type: str, date: str | None = None) -> dict:
    return {
        "id": uuid4().hex,
        "round_type": round_type,
        "date": date,
        "prep": InterviewPrep().model_dump(),
        "notes": dict(EMPTY_NOTES),
        "created_at": datetime.now().isoformat(),
    }


def find_round(rounds: list[dict], round_id: str) -> dict | None:
    return next((r for r in rounds if r["id"] == round_id), None)


def recompute_interview_date(rounds: list[dict]) -> str | None:
    """Soonest upcoming round date, else most recent past date, else None.
    Dates are naive local ISO strings (matches the frontend's toISO/new Date
    treatment) — compared as naive datetimes, not UTC."""
    dated = [(r["date"], datetime.fromisoformat(r["date"])) for r in rounds if r.get("date")]
    if not dated:
        return None
    now = datetime.now()
    upcoming = sorted((dt, raw) for raw, dt in dated if dt >= now)
    if upcoming:
        return upcoming[0][1]
    return max(dated, key=lambda p: p[1])[0]


def _migrate_legacy(app: Application) -> list[dict]:
    if not (app.interview_prep_json or app.interview_date or app.interview_notes_json):
        return []
    prep = json.loads(app.interview_prep_json) if app.interview_prep_json else InterviewPrep().model_dump()
    notes = json.loads(app.interview_notes_json) if app.interview_notes_json else dict(EMPTY_NOTES)
    return [{
        "id": uuid4().hex,
        "round_type": "Technical",
        "date": app.interview_date,
        "prep": prep,
        "notes": notes,
        "created_at": app.interview_date or datetime.now().isoformat(),
    }]


def load_rounds(app: Application) -> list[dict]:
    """Parsed interview_rounds_json, lazily migrating legacy single-round
    fields into one round on first read. Does not persist — callers that
    intend to keep the migrated result must save it themselves."""
    if app.interview_rounds_json:
        return json.loads(app.interview_rounds_json)
    return _migrate_legacy(app)

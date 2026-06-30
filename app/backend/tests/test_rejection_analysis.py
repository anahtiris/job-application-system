import json as json_lib

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session
from db import Application, JobLead, now_utc


def _make_app(session: Session, status: str, **kwargs) -> Application:
    app = Application(
        company="TestCo",
        job_title="SWE",
        language="en",
        job_description="jd",
        status=status,
        **kwargs,
    )
    session.add(app)
    session.commit()
    session.refresh(app)
    return app


def _make_lead(session: Session, application_id: str) -> JobLead:
    lead = JobLead(
        company="TestCo",
        job_title="SWE",
        language="en",
        status="approved",
        application_id=application_id,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


def test_interview_can_transition_to_rejected_after_interview(client, session):
    app = _make_app(session, "Interview")
    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Rejected after interview"})
    assert resp.status_code == 200
    session.refresh(app)
    assert app.status == "Rejected after interview"


def test_interview_cannot_transition_to_plain_rejected(client, session):
    app = _make_app(session, "Interview")
    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Rejected"})
    assert resp.status_code == 400


def test_interview_can_transition_to_ghosted_after_interview(client, session):
    app = _make_app(session, "Interview")
    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Ghosted after interview"})
    assert resp.status_code == 200


def test_rejected_can_correct_to_rejected_after_interview(client, session):
    app = _make_app(session, "Rejected")
    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Rejected after interview"})
    assert resp.status_code == 200


def test_rejected_after_interview_soft_deletes_lead(client, session):
    app = _make_app(session, "Interview")
    lead = _make_lead(session, app.id)
    client.patch(f"/api/tracker/{app.id}/status", json={"status": "Rejected after interview"})
    session.refresh(lead)
    assert lead.deleted_at is not None


def test_ghosted_after_interview_soft_deletes_lead(client, session):
    app = _make_app(session, "Interview")
    lead = _make_lead(session, app.id)
    client.patch(f"/api/tracker/{app.id}/status", json={"status": "Ghosted after interview"})
    session.refresh(lead)
    assert lead.deleted_at is not None


def test_ghosted_after_interview_can_correct_to_rejected_after_interview(client, session):
    app = _make_app(session, "Ghosted after interview")
    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Rejected after interview"})
    assert resp.status_code == 200


def test_rejected_cannot_transition_to_ghosted(client, session):
    app = _make_app(session, "Rejected")
    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Ghosted after interview"})
    assert resp.status_code == 400


def test_unreject_to_applied_restores_soft_deleted_lead(client, session):
    app = _make_app(session, "Rejected")
    lead = _make_lead(session, app.id)
    lead.deleted_at = now_utc()
    session.add(lead)
    session.commit()

    resp = client.patch(f"/api/tracker/{app.id}/status", json={"status": "Applied"})
    assert resp.status_code == 200
    session.refresh(lead)
    assert lead.deleted_at is None


from services.rejection_analysis import _aggregate


def test_aggregate_skill_gap_frequency():
    data = [
        {
            "app": {"company": "A", "job_title": "SWE", "status": "Rejected", "company_tone": "startup"},
            "fit": {
                "must_haves": [{"skill": "Kubernetes", "status": "GAP"}, {"skill": "Python", "status": "STRONG"}],
                "match_score": 60,
                "goal_alignment": "aligns",
                "goal_alignment_note": "matches AI focus",
            },
        },
        {
            "app": {"company": "B", "job_title": "BE", "status": "Rejected after interview", "company_tone": "direct"},
            "fit": {
                "must_haves": [{"skill": "Kubernetes", "status": "GAP"}, {"skill": "Java", "status": "GAP"}],
                "match_score": 45,
                "goal_alignment": "detours",
                "goal_alignment_note": "no AI work",
            },
        },
    ]
    result = _aggregate(data)
    assert result["total"] == 2
    assert result["skill_gaps"][0]["skill"] == "Kubernetes"
    assert result["skill_gaps"][0]["gap_count"] == 2
    assert result["skill_gaps"][0]["out_of"] == 2


def test_aggregate_stage_counts():
    data = [
        {"app": {"company": "A", "job_title": "x", "status": "Rejected", "company_tone": "startup"},
         "fit": {"must_haves": [], "match_score": 50, "goal_alignment": "neutral", "goal_alignment_note": ""}},
        {"app": {"company": "B", "job_title": "x", "status": "Rejected after interview", "company_tone": "direct"},
         "fit": {"must_haves": [], "match_score": 70, "goal_alignment": "aligns", "goal_alignment_note": ""}},
        {"app": {"company": "C", "job_title": "x", "status": "Ghosted after interview", "company_tone": "startup"},
         "fit": {"must_haves": [], "match_score": 65, "goal_alignment": "neutral", "goal_alignment_note": ""}},
    ]
    result = _aggregate(data)
    assert result["outcome_stage"] == {"before_interview": 1, "after_interview": 1, "ghosted": 1}


def test_aggregate_score_distribution():
    data = [
        {"app": {"company": "A", "job_title": "x", "status": "Rejected", "company_tone": "startup"},
         "fit": {"must_haves": [], "match_score": 40, "goal_alignment": "neutral", "goal_alignment_note": ""}},
        {"app": {"company": "B", "job_title": "x", "status": "Rejected", "company_tone": "direct"},
         "fit": {"must_haves": [], "match_score": 60, "goal_alignment": "neutral", "goal_alignment_note": ""}},
        {"app": {"company": "C", "job_title": "x", "status": "Rejected", "company_tone": "direct"},
         "fit": {"must_haves": [], "match_score": 80, "goal_alignment": "neutral", "goal_alignment_note": ""}},
    ]
    result = _aggregate(data)
    assert result["score_distribution"]["avg"] == 60
    assert result["score_distribution"]["low"] == 1
    assert result["score_distribution"]["mid"] == 1
    assert result["score_distribution"]["high"] == 1


def _make_closed_app_with_lead(session, status: str, fit_analysis: dict, tone: str = "startup"):
    app = Application(
        company="TestCo",
        job_title="SWE",
        language="en",
        job_description="jd",
        status=status,
        company_tone=tone,
    )
    session.add(app)
    session.commit()
    session.refresh(app)

    lead = JobLead(
        company="TestCo",
        job_title="SWE",
        language="en",
        status="approved",
        application_id=app.id,
        fit_analysis_json=json_lib.dumps(fit_analysis),
        fit_score=fit_analysis.get("match_score"),
    )
    session.add(lead)
    session.commit()
    return app


SAMPLE_FIT = {
    "must_haves": [{"skill": "Kubernetes", "status": "GAP"}],
    "match_score": 55,
    "goal_alignment": "neutral",
    "goal_alignment_note": "no strong signal",
}


def test_analysis_insufficient_data(client):
    resp = client.get("/api/tracker/analysis/rejected")
    assert resp.status_code == 200
    assert resp.json().get("insufficient_data") is True


def test_analysis_returns_shape(client, session, monkeypatch):
    async def mock_generate(*args, **kwargs):
        return "Test narrative paragraph."

    monkeypatch.setattr("services.rejection_analysis.generate", mock_generate)

    for status in ("Rejected", "Rejected after interview", "Ghosted after interview"):
        _make_closed_app_with_lead(session, status, SAMPLE_FIT)

    resp = client.get("/api/tracker/analysis/rejected")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["narrative"] == "Test narrative paragraph."
    assert isinstance(data["skill_gaps"], list)
    assert isinstance(data["outcome_stage"], dict)
    assert data["outcome_stage"]["before_interview"] == 1
    assert data["outcome_stage"]["after_interview"] == 1
    assert data["outcome_stage"]["ghosted"] == 1

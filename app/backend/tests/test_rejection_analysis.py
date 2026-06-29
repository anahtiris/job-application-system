import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session
from db import Application, JobLead


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

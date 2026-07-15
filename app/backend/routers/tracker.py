import json as json_module
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import Application, JobLead, get_session, get_setting, now_utc, set_setting
from services.rejection_analysis import _aggregate, generate_narrative

router = APIRouter()

VALID_STATUSES = {
    "Draft", "Finalized", "Applied", "Interview", "Offer",
    "Rejected", "Ghosted",
    "Rejected after interview", "Ghosted after interview",
}

NEXT_STATUSES: dict[str, list[str]] = {
    "New":                      ["Draft"],
    "Draft":                    ["Finalized", "Applied"],
    "Finalized":                ["Applied"],
    "Applied":                  ["Interview", "Offer", "Rejected", "Ghosted"],
    "Interview":                ["Offer", "Rejected after interview", "Ghosted after interview", "Applied"],
    "Offer":                    ["Rejected"],
    "Rejected":                 ["Rejected after interview", "Applied", "Interview"],
    "Ghosted":                  ["Applied", "Interview", "Rejected"],
    "Rejected after interview": ["Rejected", "Ghosted after interview"],
    "Ghosted after interview":  ["Rejected", "Rejected after interview"],
}


class CreateApplicationRequest(BaseModel):
    company: str
    job_title: str
    language: str = "en"
    job_description: str
    company_address: Optional[str] = None
    company_tone: Optional[str] = None
    date_applied: Optional[date] = None
    cover_letter_notes: Optional[str] = None
    source_url: Optional[str] = None


class UpdateDetailsRequest(BaseModel):
    company: str
    job_title: str
    language: str
    job_description: str
    cover_letter_notes: Optional[str] = None
    source_url: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str


class UpdateNotesRequest(BaseModel):
    notes: str


class UpdateDateRequest(BaseModel):
    date_applied: date


@router.post("/")
def create_application(body: CreateApplicationRequest, session: Session = Depends(get_session)):
    app = Application(
        company=body.company,
        job_title=body.job_title,
        language=body.language,
        job_description=body.job_description,
        company_address=body.company_address,
        company_tone=body.company_tone,
        date_applied=body.date_applied,
        cover_letter_notes=body.cover_letter_notes,
        source_url=body.source_url,
    )
    session.add(app)
    session.commit()
    session.refresh(app)
    return app


@router.get("/")
def list_applications(session: Session = Depends(get_session)):
    apps = session.exec(
        select(Application)
        .where(Application.deleted_at == None)  # noqa: E711
        .order_by(Application.created_at.desc())
    ).all()
    return apps


CLOSED_STATUSES = {"Rejected", "Rejected after interview", "Ghosted after interview"}

REJECTION_ANALYSIS_SETTING_KEY = "rejection_analysis_json"


def _closed_apps_with_leads(session: Session) -> list[dict]:
    apps = session.exec(
        select(Application).where(
            Application.status.in_(list(CLOSED_STATUSES)),
            Application.deleted_at == None,  # noqa: E711
        )
    ).all()

    apps_with_leads: list[dict] = []
    for app in apps:
        lead = session.exec(
            select(JobLead).where(JobLead.application_id == app.id)
        ).first()
        fit: dict = {}
        if lead and lead.fit_analysis_json:
            try:
                fit = json_module.loads(lead.fit_analysis_json)
            except (json_module.JSONDecodeError, TypeError):
                fit = {}
        apps_with_leads.append({
            "app": {
                "company": app.company,
                "job_title": app.job_title,
                "status": app.status,
                "company_tone": app.company_tone,
            },
            "fit": fit,
        })
    return apps_with_leads


def _stored_narrative() -> dict:
    raw = get_setting(REJECTION_ANALYSIS_SETTING_KEY)
    if not raw:
        return {"narrative": None, "generated_at": None}
    try:
        return json_module.loads(raw)
    except (json_module.JSONDecodeError, TypeError):
        return {"narrative": None, "generated_at": None}


class RejectionNarrativeIn(BaseModel):
    narrative: str


@router.get("/analysis/rejected")
def rejected_analysis(session: Session = Depends(get_session)):
    apps_with_leads = _closed_apps_with_leads(session)
    if len(apps_with_leads) < 3:
        return {"insufficient_data": True}

    agg = _aggregate(apps_with_leads)
    stored = _stored_narrative()
    return {**agg, **stored}


@router.post("/analysis/rejected/generate")
async def generate_rejected_analysis(session: Session = Depends(get_session)):
    """Ollama path: aggregate + LLM narrative, offline."""
    apps_with_leads = _closed_apps_with_leads(session)
    if len(apps_with_leads) < 3:
        return {"insufficient_data": True}

    agg = _aggregate(apps_with_leads)
    narrative = await generate_narrative(agg)
    generated_at = now_utc().isoformat()
    set_setting(
        REJECTION_ANALYSIS_SETTING_KEY,
        json_module.dumps({"narrative": narrative, "generated_at": generated_at}),
    )
    return {**agg, "narrative": narrative, "generated_at": generated_at}


@router.put("/analysis/rejected")
def save_rejected_analysis(body: RejectionNarrativeIn, session: Session = Depends(get_session)):
    """Write-back endpoint for the Claude 'Copy prompt for Claude' rejection-analysis path."""
    apps_with_leads = _closed_apps_with_leads(session)
    agg = _aggregate(apps_with_leads)
    generated_at = now_utc().isoformat()
    set_setting(
        REJECTION_ANALYSIS_SETTING_KEY,
        json_module.dumps({"narrative": body.narrative, "generated_at": generated_at}),
    )
    return {**agg, "narrative": body.narrative, "generated_at": generated_at}


@router.get("/{app_id}")
def get_application(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    return app


@router.patch("/{app_id}/details")
def update_details(app_id: str, body: UpdateDetailsRequest, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.company = body.company
    app.job_title = body.job_title
    app.language = body.language
    app.job_description = body.job_description
    app.cover_letter_notes = body.cover_letter_notes
    app.source_url = body.source_url
    session.add(app)
    session.commit()
    return {"saved": True}


@router.patch("/{app_id}/status")
def update_status(app_id: str, body: UpdateStatusRequest, session: Session = Depends(get_session)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    allowed = NEXT_STATUSES.get(app.status, set())
    if body.status not in allowed:
        raise HTTPException(400, f"Cannot transition from {app.status!r} to {body.status!r}")
    previous_status = app.status
    app.status = body.status
    session.add(app)
    if body.status in {"Rejected", "Rejected after interview", "Ghosted after interview"}:
        lead = session.exec(select(JobLead).where(JobLead.application_id == app_id)).first()
        if lead and lead.deleted_at is None:
            lead.deleted_at = now_utc()
            session.add(lead)
    elif body.status in {"Applied", "Interview"}:
        if previous_status in {"Rejected", "Rejected after interview", "Ghosted after interview"}:
            # Un-rejecting: restore the lead from trash so it's not orphaned there.
            lead = session.exec(select(JobLead).where(JobLead.application_id == app_id)).first()
            if lead and lead.deleted_at is not None:
                lead.deleted_at = None
                session.add(lead)
        if body.status == "Applied":
            # Keep the source lead in step with its application.
            lead = session.exec(select(JobLead).where(JobLead.application_id == app_id)).first()
            if lead and lead.deleted_at is None and lead.status == "approved":
                lead.status = "applied"
                lead.updated_at = now_utc()
                session.add(lead)
    session.commit()
    return {"status": app.status}


@router.patch("/{app_id}/date")
def update_date(app_id: str, body: UpdateDateRequest, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.date_applied = body.date_applied
    session.add(app)
    session.commit()
    return {"saved": True}


@router.patch("/{app_id}/notes")
def update_notes(app_id: str, body: UpdateNotesRequest, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.notes = body.notes
    session.add(app)
    session.commit()
    return {"saved": True}


class UpdateInterviewDateRequest(BaseModel):
    interview_date: Optional[str] = None


@router.patch("/{app_id}/interview-date")
def update_interview_date(app_id: str, body: UpdateInterviewDateRequest, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.interview_date = body.interview_date
    session.add(app)
    session.commit()
    return {"saved": True}


class UpdateInterviewNotesRequest(BaseModel):
    notes_json: str


@router.patch("/{app_id}/interview-notes")
def update_interview_notes(app_id: str, body: UpdateInterviewNotesRequest, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.interview_notes_json = body.notes_json
    session.add(app)
    session.commit()
    return {"saved": True}


@router.delete("/{app_id}")
def delete_application(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.deleted_at = now_utc()
    session.add(app)
    session.commit()
    return {"deleted": True}

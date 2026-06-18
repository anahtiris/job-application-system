from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import Application, get_session, now_utc

router = APIRouter()

VALID_STATUSES = {"Draft", "Finalized", "Applied", "Interview", "Offer", "Rejected", "Ghosted"}

NEXT_STATUSES: dict[str, set[str]] = {
    "Draft":     {"Applied"},
    "Finalized": {"Applied"},
    "Applied":   {"Interview", "Offer", "Rejected", "Ghosted"},
    "Interview": {"Applied", "Offer", "Rejected", "Ghosted"},
    "Offer":     {"Rejected"},
    "Rejected":  {"Applied", "Interview"},
    "Ghosted":   {"Applied", "Interview", "Rejected"},
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
    app.status = body.status
    session.add(app)
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

from datetime import date
from pathlib import Path
from typing import Optional

import tomllib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import Application, get_session

router = APIRouter()

VALID_STATUSES = {"Draft", "Applied", "Interview", "Offer", "Rejected"}

NEXT_STATUSES: dict[str, set[str]] = {
    "Draft":     {"Applied"},
    "Applied":   {"Interview", "Offer", "Rejected"},
    "Interview": {"Applied", "Offer", "Rejected"},
    "Offer":     {"Rejected"},
    "Rejected":  {"Applied", "Interview"},
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
    return session.exec(select(Application).order_by(Application.created_at.desc())).all()


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


@router.delete("/{app_id}")
def delete_application(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    session.delete(app)
    session.commit()
    return {"deleted": True}

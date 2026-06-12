"""List, restore, and permanently delete soft-deleted applications and leads."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import Application, JobLead, get_session

router = APIRouter()


@router.get("/")
def list_trash(session: Session = Depends(get_session)):
    applications = session.exec(
        select(Application)
        .where(Application.deleted_at != None)
        .order_by(Application.deleted_at.desc())
    ).all()
    leads = session.exec(
        select(JobLead)
        .where(JobLead.deleted_at != None)
        .order_by(JobLead.deleted_at.desc())
    ).all()
    return {"applications": applications, "leads": leads}


@router.post("/applications/{app_id}/restore")
def restore_application(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.deleted_at = None
    session.add(app)
    session.commit()
    return {"restored": True}


@router.post("/leads/{lead_id}/restore")
def restore_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    lead.deleted_at = None
    session.add(lead)
    session.commit()
    return {"restored": True}


@router.delete("/applications/{app_id}")
def delete_application_forever(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    session.delete(app)
    session.commit()
    return {"deleted": True}


@router.delete("/leads/{lead_id}")
def delete_lead_forever(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    session.delete(lead)
    session.commit()
    return {"deleted": True}

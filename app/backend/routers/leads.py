"""CRUD + analysis endpoints for job leads."""
import asyncio
import json
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from config import load_career_goal, load_skills_inventory, model
from db import Application, JobLead, get_session, now_utc
from services import analyzer, llm, researcher

router = APIRouter()
logger = logging.getLogger(__name__)


def _verdict(score: int, is_poor_match: bool) -> str:
    if is_poor_match:
        return "skip"
    if score >= 70:
        return "strong"
    if score >= 50:
        return "maybe"
    return "skip"


class CreateLeadRequest(BaseModel):
    company: str
    job_title: str
    language: str = "en"
    job_description: str
    source_url: Optional[str] = None


class UpdateLeadRequest(BaseModel):
    company: Optional[str] = None
    job_title: Optional[str] = None
    language: Optional[str] = None


@router.get("/pending-count")
def pending_count(session: Session = Depends(get_session)):
    count = len(session.exec(
        select(JobLead)
        .where(JobLead.status.in_(["captured", "new"]))
        .where(JobLead.deleted_at == None)
    ).all())
    return {"count": count}


@router.get("/")
def list_leads(session: Session = Depends(get_session)):
    return session.exec(
        select(JobLead)
        .where(JobLead.deleted_at == None)
        .order_by(JobLead.created_at.desc())
    ).all()


@router.post("/")
def create_lead(body: CreateLeadRequest, session: Session = Depends(get_session)):
    lead = JobLead(
        company=body.company,
        job_title=body.job_title,
        language=body.language,
        job_description=body.job_description,
        source_url=body.source_url,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


@router.get("/{lead_id}")
def get_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.patch("/{lead_id}")
def update_lead(lead_id: str, body: UpdateLeadRequest, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if body.company is not None:
        lead.company = body.company
    if body.job_title is not None:
        lead.job_title = body.job_title
    if body.language is not None:
        lead.language = body.language
    lead.updated_at = now_utc()
    session.add(lead)
    session.commit()
    return lead


@router.delete("/{lead_id}")
def delete_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    lead.deleted_at = now_utc()
    session.add(lead)
    session.commit()
    return {"deleted": True}


@router.post("/{lead_id}/analyze")
async def analyze_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    lead.status = "analyzing"
    lead.updated_at = now_utc()
    session.add(lead)
    session.commit()

    skills_inventory = load_skills_inventory()
    goal_text = load_career_goal()

    recent = session.exec(
        select(JobLead)
        .where(JobLead.status.in_(["approved", "applied", "rejected"]))
        .order_by(JobLead.updated_at.desc())
        .limit(10)
    ).all()
    approved_titles = [l.job_title for l in recent if l.status in ("approved", "applied") and l.job_title]
    rejected_titles = [l.job_title for l in recent if l.status == "rejected" and l.job_title]
    past_decisions = ""
    parts = []
    if approved_titles:
        parts.append(f"Approved: {', '.join(approved_titles)}")
    if rejected_titles:
        parts.append(f"Rejected: {', '.join(rejected_titles)}")
    if parts:
        past_decisions = ". ".join(parts)

    fit_result, research_result = await asyncio.gather(
        analyzer.analyze_jd(
            lead.job_description, skills_inventory, model("research"),
            career_goal=goal_text, past_decisions=past_decisions,
        ),
        researcher.research_company(lead.company, model("research"), lead.source_url or ""),
    )

    score = fit_result.get("match_score", 0)
    # Normalize 0-1 float to 0-100 int if model ignored scale instruction
    if isinstance(score, float) and score <= 1.0:
        score = int(score * 100)
    score = int(score)
    is_poor = fit_result.get("is_poor_match", False)

    lead.fit_score = score
    lead.fit_verdict = _verdict(score, is_poor)
    lead.fit_analysis_json = json.dumps(fit_result)
    lead.company_tone = research_result.get("tone", "direct")
    lead.company_research = research_result.get("tone_reasoning", "")
    lead.status = "analyzed"
    lead.updated_at = now_utc()
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


@router.post("/{lead_id}/approve")
def approve_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.status == "approved" and lead.application_id:
        return {"application_id": lead.application_id}

    app = Application(
        company=lead.company,
        job_title=lead.job_title,
        language=lead.language,
        job_description=lead.job_description,
        company_tone=lead.company_tone,
        source_url=lead.source_url,
        fit_analysis_json=lead.fit_analysis_json,
        status="New",
    )
    session.add(app)
    session.flush()

    lead.application_id = app.id
    lead.status = "approved"
    lead.updated_at = now_utc()
    session.add(lead)
    session.commit()
    return {"application_id": app.id}


class FromTextRequest(BaseModel):
    text: str
    source_url: Optional[str] = None


@router.post("/from-text")
def create_lead_from_text(body: FromTextRequest, session: Session = Depends(get_session)):
    if body.source_url:
        existing = session.exec(
            select(JobLead)
            .where(JobLead.source_url == body.source_url)
            .where(JobLead.status != "rejected")
        ).first()
        if existing:
            return {"id": existing.id, "duplicate": True}

    lead = JobLead(
        raw_text=body.text[:50000],
        source_url=body.source_url,
        status="captured",
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return {"id": lead.id}


@router.post("/extract-captured")
async def extract_captured(session: Session = Depends(get_session)):
    leads = session.exec(select(JobLead).where(JobLead.status == "captured")).all()
    if not leads:
        return {"processed": 0}

    results = []
    for lead in leads:
        if not lead.raw_text:
            continue
        prompt = f"""Extract the job posting details from this job board page text.

Return ONLY a JSON object — no markdown, no explanation:
{{
  "company": "the hiring company name",
  "job_title": "the job title / position",
  "language": "en or de",
  "job_description": "the complete job description text, removing navigation menus, header, footer, and unrelated page content"
}}

Page text:
{lead.raw_text[:15000]}"""

        try:
            raw = await llm.generate(model("research"), prompt)
            clean = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            clean = re.sub(r"\s*```$", "", clean.strip(), flags=re.MULTILINE)
            m = re.search(r"\{.*\}", clean, re.DOTALL)
            if not m:
                continue
            data = json.loads(m.group())
        except Exception:
            continue

        lead.company = data.get("company", "")
        lead.job_title = data.get("job_title", "")
        lead.language = data.get("language", "en")
        lead.job_description = data.get("job_description", "")[:14000]
        lead.status = "new"
        lead.updated_at = now_utc()
        session.add(lead)
        results.append(lead.id)

    session.commit()
    return {"processed": len(results), "ids": results}


class ProcessedLeadRequest(BaseModel):
    """Extraction + analysis results written back by the Claude 'process my captured jobs' flow."""
    company: str = ""
    job_title: str = ""
    language: str = "en"
    job_description: str = ""
    company_tone: str = "direct"
    company_research: Optional[str] = None
    fit_analysis: dict


@router.put("/{lead_id}/processed")
def save_processed_lead(lead_id: str, body: ProcessedLeadRequest, session: Session = Depends(get_session)):
    """Persist Claude-produced extraction + fit analysis for a lead and mark it analyzed.

    Mirrors the fields the Ollama `/analyze` path writes, so the lead renders identically.
    """
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    score = body.fit_analysis.get("match_score", 0)
    # Normalize 0-1 float to 0-100 int if it came through on the wrong scale
    if isinstance(score, float) and score <= 1.0:
        score = int(score * 100)
    score = int(score)
    is_poor = bool(body.fit_analysis.get("is_poor_match", False))

    lead.company = body.company
    lead.job_title = body.job_title
    lead.language = body.language
    lead.job_description = body.job_description
    lead.company_tone = body.company_tone
    lead.company_research = body.company_research or ""
    lead.fit_score = score
    lead.fit_verdict = _verdict(score, is_poor)
    lead.fit_analysis_json = json.dumps(body.fit_analysis)
    lead.status = "analyzed"
    lead.updated_at = now_utc()
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


@router.post("/{lead_id}/reject")
def reject_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    lead.status = "rejected"
    lead.updated_at = now_utc()
    session.add(lead)
    session.commit()
    return {"status": "rejected"}

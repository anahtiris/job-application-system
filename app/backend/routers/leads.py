"""CRUD + analysis endpoints for job leads."""
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import tomllib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import Application, JobLead, get_session, get_setting
from services import analyzer, llm, researcher

router = APIRouter()

with open(Path(__file__).parent.parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

BASE = Path(__file__).parent.parent.parent.parent
SKILLS = BASE / _cfg["paths"]["skills"]
CAREER_GOAL = BASE / _cfg["paths"]["career_goal"]


def _model(role: str) -> str:
    return get_setting(f"model.{role}", _cfg["models"].get(role, ""))


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


@router.get("/")
def list_leads(session: Session = Depends(get_session)):
    return session.exec(select(JobLead).order_by(JobLead.created_at.desc())).all()


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
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    return lead


@router.delete("/{lead_id}")
def delete_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    session.delete(lead)
    session.commit()
    return {"deleted": True}


@router.post("/{lead_id}/analyze")
async def analyze_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    lead.status = "analyzing"
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()

    skills_inventory: dict = {}
    if SKILLS.exists():
        try:
            skills_inventory = json.loads(SKILLS.read_text(encoding="utf-8")).get("skills", {})
        except Exception:
            pass

    goal_text = ""
    if CAREER_GOAL.exists():
        try:
            goal_text = CAREER_GOAL.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    recent = session.exec(
        select(JobLead)
        .where(JobLead.status.in_(["approved", "rejected"]))
        .order_by(JobLead.updated_at.desc())
        .limit(10)
    ).all()
    approved_titles = [l.job_title for l in recent if l.status == "approved" and l.job_title]
    rejected_titles = [l.job_title for l in recent if l.status == "rejected" and l.job_title]
    past_decisions = ""
    parts = []
    if approved_titles:
        parts.append(f"Approved: {', '.join(approved_titles)}")
    if rejected_titles:
        parts.append(f"Rejected: {', '.join(rejected_titles)}")
    if parts:
        past_decisions = ". ".join(parts)

    import asyncio
    fit_result, research_result = await asyncio.gather(
        analyzer.analyze_jd(
            lead.job_description, skills_inventory, _model("research"),
            career_goal=goal_text, past_decisions=past_decisions,
        ),
        researcher.research_company(lead.company, _model("research"), lead.source_url or ""),
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
    lead.updated_at = datetime.utcnow()
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
        status="New",
    )
    session.add(app)
    session.flush()

    lead.application_id = app.id
    lead.status = "approved"
    lead.updated_at = datetime.utcnow()
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
    import re

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
            raw = await llm.generate(_model("research"), prompt)
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
        lead.updated_at = datetime.utcnow()
        session.add(lead)
        results.append(lead.id)

    session.commit()
    return {"processed": len(results), "ids": results}


@router.post("/{lead_id}/reject")
def reject_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    lead.status = "rejected"
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    return {"status": "rejected"}


_TIER_LABELS = {1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure"}


@router.get("/{lead_id}/claude-prompt")
def get_claude_prompt(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    skills_lines: list[str] = []
    if SKILLS.exists():
        try:
            skills_data = json.loads(SKILLS.read_text(encoding="utf-8")).get("skills", {})
            for name, s in skills_data.items():
                label = _TIER_LABELS.get(s.get("tier"), str(s.get("tier", "")))
                evidence = s.get("evidence", "")
                skills_lines.append(f"- {name}: Tier {s.get('tier')} ({label}){' — ' + evidence if evidence else ''}")
        except Exception:
            pass

    goal_text = ""
    if CAREER_GOAL.exists():
        try:
            goal_text = CAREER_GOAL.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    sections: list[str] = []
    sections.append(
        "Please analyze this job posting against my background and give me your honest assessment.\n\n"
        "## What I need\n\n"
        "1. **Match score** (0–100)\n"
        "2. **Skill breakdown** — for each required skill: STRONG (solid experience), HONEST (some exposure), or GAP (missing)\n"
        "3. Separate must-haves from nice-to-haves\n"
        "4. Top 5–8 **ATS keywords** from the JD\n"
        "5. My **strongest angle** — what makes me genuinely competitive here\n"
        "6. The **biggest weakness** the interviewer will push back on\n"
        "7. **Goal alignment** — does this role move me toward my stated direction, or is it a detour?"
    )

    if goal_text:
        sections.append(f"---\n\n## My Career Goal\n\n{goal_text}")

    if skills_lines:
        sections.append("---\n\n## My Skills Inventory\n\n" + "\n".join(skills_lines))

    jd = lead.job_description or lead.raw_text or ""
    label = f"{lead.company or 'Unknown'} — {lead.job_title or 'Unknown'}" if (lead.company or lead.job_title) else "Job Description"
    sections.append(f"---\n\n## {label}\n\n{jd}")

    return {"prompt": "\n\n".join(sections)}

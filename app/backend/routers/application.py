from pathlib import Path
from typing import AsyncIterator

import tomllib
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session

from db import Application, get_session, get_setting
from services import analyzer, generator, interview, researcher, reviewer
from services.pdf import build_pdfs

router = APIRouter()

with open(Path(__file__).parent.parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

BASE = Path(__file__).parent.parent.parent.parent
MASTER_EN = BASE / _cfg["paths"]["resume_master_en"]
MASTER_DE = BASE / _cfg["paths"]["resume_master_de"]
PERSONA = BASE / _cfg["paths"]["persona"]
TMPL_CV_EN = BASE / _cfg["paths"]["templates_resume_en"]
TMPL_CV_DE = BASE / _cfg["paths"]["templates_resume_de"]
TMPL_CL = BASE / _cfg["paths"]["templates_cover_letter"]
APPS_DIR = BASE / _cfg["paths"]["applications_dir"]
SKILLS = BASE / _cfg["paths"]["skills"]
CAREER_GOAL = BASE / _cfg["paths"]["career_goal"]


def _model(role: str) -> str:
    return get_setting(f"model.{role}", _cfg["models"].get(role, ""))


def _master(language: str) -> Path:
    return MASTER_DE if language == "de" else MASTER_EN


def _extract_contact(template_path: Path) -> dict:
    """Read email and phone from the cover letter template header paragraphs."""
    from docx import Document
    import re
    email, phone = "", ""
    try:
        doc = Document(str(template_path))
        for para in doc.paragraphs[:8]:
            text = para.text.strip()
            if re.search(r"[\w.+-]+@[\w-]+\.\w+", text):
                email = re.search(r"[\w.+-]+@[\w-]+\.\w+", text).group(0)
            elif re.search(r"[\+\d][\d\s\(\)\-\.]{6,}", text):
                phone = re.search(r"[\+\d][\d\s\(\)\-\.]{6,}", text).group(0).strip()
    except Exception:
        pass
    return {"email": email, "phone": phone}


# ── Job analysis ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    application_id: str


@router.post("/analyze-jd")
async def analyze_jd_endpoint(body: AnalyzeRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    if not app.job_description:
        raise HTTPException(400, "Application has no job description")

    import json as _json
    skills_inventory: dict = {}
    if SKILLS.exists():
        try:
            skills_inventory = _json.loads(SKILLS.read_text(encoding="utf-8")).get("skills", {})
        except Exception:
            pass

    goal_text = ""
    if CAREER_GOAL.exists():
        try:
            goal_text = CAREER_GOAL.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    from db import JobLead
    from sqlmodel import select as _select
    recent = session.exec(
        _select(JobLead)
        .where(JobLead.status.in_(["approved", "rejected"]))
        .order_by(JobLead.updated_at.desc())
        .limit(10)
    ).all()
    parts = []
    approved_titles = [l.job_title for l in recent if l.status == "approved" and l.job_title]
    rejected_titles = [l.job_title for l in recent if l.status == "rejected" and l.job_title]
    if approved_titles:
        parts.append(f"Approved: {', '.join(approved_titles)}")
    if rejected_titles:
        parts.append(f"Rejected: {', '.join(rejected_titles)}")
    past_decisions = ". ".join(parts) if parts else ""

    return await analyzer.analyze_jd(
        app.job_description, skills_inventory, _model("research"),
        career_goal=goal_text, past_decisions=past_decisions,
    )


# ── Research ──────────────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    company: str
    company_url: str = ""


@router.post("/research")
async def research(body: ResearchRequest):
    return await researcher.research_company(body.company, _model("research"), body.company_url)


# ── Generate (streaming SSE) ──────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    application_id: str
    job_description: str
    company: str
    company_tone: str = "direct"
    company_address: str = ""
    language: str = "en"


@router.post("/generate")
async def generate(body: GenerateRequest, session: Session = Depends(get_session)):
    master = _master(body.language)
    if not master.exists():
        raise HTTPException(404, "Master resume not found. Upload one first via /api/resume/parse.")

    contact = _extract_contact(TMPL_CL)
    app_record = session.get(Application, body.application_id)
    cl_notes = app_record.cover_letter_notes or "" if app_record else ""

    import json as _json
    skills_path = BASE / _cfg["paths"]["skills"]
    skills_inventory: dict = {}
    if skills_path.exists():
        try:
            skills_inventory = _json.loads(skills_path.read_text(encoding="utf-8")).get("skills", {})
        except Exception:
            pass

    async def event_stream() -> AsyncIterator[str]:
        resume_md = ""
        cl_md = ""
        async for chunk in generator.stream_generation(
            master_path=master,
            job_description=body.job_description,
            company_name=body.company,
            company_tone=body.company_tone,
            company_address=body.company_address,
            language=body.language,
            writer_model=_model("writer"),
            contact_email=contact["email"],
            contact_phone=contact["phone"],
            cover_letter_notes=cl_notes,
            skills_inventory=skills_inventory,
        ):
            if '"type": "resume_done"' in chunk:
                import json
                data = json.loads(chunk.removeprefix("data: ").strip())
                resume_md = data.get("markdown", "")
            elif '"type": "cl_done"' in chunk:
                import json
                data = json.loads(chunk.removeprefix("data: ").strip())
                cl_md = data.get("markdown", "")
            yield chunk

        # Persist drafts + research results
        app = session.get(Application, body.application_id)
        if app:
            app.resume_draft_md = resume_md
            app.cover_letter_draft_md = cl_md
            if body.company_address:
                app.company_address = body.company_address
            if body.company_tone:
                app.company_tone = body.company_tone
            session.add(app)
            session.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Save edits ────────────────────────────────────────────────────────────────

class SaveDraftsRequest(BaseModel):
    application_id: str
    resume_md: str
    cover_letter_md: str


@router.put("/drafts")
def save_drafts(body: SaveDraftsRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.resume_draft_md = body.resume_md
    app.cover_letter_draft_md = body.cover_letter_md
    if app.status == "New":
        app.status = "Draft"
    session.add(app)
    session.commit()
    return {"saved": True}


# ── Review ────────────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    application_id: str


@router.post("/review")
async def review(body: ReviewRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    if not app.resume_draft_md or not app.cover_letter_draft_md:
        raise HTTPException(400, "Generate documents first before reviewing")

    result = await reviewer.run_review(
        resume_md=app.resume_draft_md,
        cover_letter_md=app.cover_letter_draft_md,
        master_path=_master(app.language),
        persona_path=PERSONA,
        model=_model("reviewer"),
    )

    app.resume_final_md = result["cv_consolidated"].get("revised_draft", app.resume_draft_md)
    app.cover_letter_final_md = result["cl_consolidated"].get("revised_draft", app.cover_letter_draft_md)
    app.review_completed = True
    session.add(app)
    session.commit()

    return result


# ── Save final (post-review edits) ───────────────────────────────────────────

class SaveFinalsRequest(BaseModel):
    application_id: str
    resume_md: str
    cover_letter_md: str
    company_address: str | None = None


@router.put("/finals")
def save_finals(body: SaveFinalsRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.resume_final_md = body.resume_md
    app.cover_letter_final_md = body.cover_letter_md
    if body.company_address is not None:
        app.company_address = body.company_address
    app.review_completed = True
    if app.status == "New":
        app.status = "Draft"
    session.add(app)
    session.commit()
    return {"saved": True}


# ── PDF generation ────────────────────────────────────────────────────────────

class PdfRequest(BaseModel):
    application_id: str


@router.post("/pdf")
async def generate_pdf(body: PdfRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    if not app.review_completed:
        raise HTTPException(400, "Review must be completed before generating PDFs")
    if not app.resume_final_md or not app.cover_letter_final_md:
        raise HTTPException(400, "Final documents not found")

    import re as _re
    def _slug(s: str) -> str:
        return _re.sub(r"[^\w-]", "_", s.strip()).strip("_") or "unknown"

    company_dir = APPS_DIR / _slug(app.company)
    position_slug = _slug(app.job_title or "unknown")
    out_dir = company_dir / position_slug

    # Move any existing top-level files (from a previous application or old format)
    # to a subfolder named after the other application's position
    if company_dir.exists():
        top_files = [f for f in company_dir.iterdir() if f.is_file() and f.suffix in (".docx", ".pdf")]
        if top_files:
            from sqlmodel import select as _select
            other = session.exec(
                _select(Application)
                .where(Application.company == app.company)
                .where(Application.id != app.id)
                .where(Application.resume_pdf_path != None)  # noqa: E711
                .order_by(Application.created_at.desc())
            ).first()
            old_slug = _slug(other.job_title if other and other.job_title else "unknown")
            old_dir = company_dir / old_slug
            old_dir.mkdir(parents=True, exist_ok=True)
            for f in top_files:
                f.rename(old_dir / f.name)

    tmpl_cv = TMPL_CV_DE if app.language == "de" else TMPL_CV_EN

    try:
        paths = build_pdfs(
            resume_md=app.resume_final_md,
            cover_letter_md=app.cover_letter_final_md,
            job_title=app.job_title,
            company=app.company,
            company_address=app.company_address or "",
            language=app.language,
            template_resume=tmpl_cv,
            template_cover=TMPL_CL,
            output_dir=out_dir,
            person_name=get_setting("person.name", ""),
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(422, str(e))

    app.resume_pdf_path = paths["resume_pdf"]
    app.cover_letter_pdf_path = paths["cover_letter_pdf"]
    app.resume_docx_path = paths["resume_docx"]
    app.cover_letter_docx_path = paths["cover_letter_docx"]
    session.add(app)
    session.commit()

    return paths


# ── Interview preparation ─────────────────────────────────────────────────────

class InterviewPrepRequest(BaseModel):
    application_id: str
    interview_round: str = "Technical"
    interviewer_type: str = "Hiring Manager"
    focus_skills: str = ""


@router.post("/interview-debrief")
async def generate_interview_debrief(body: InterviewPrepRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    resume_md = app.resume_final_md or app.resume_draft_md
    if not resume_md:
        raise HTTPException(400, "Generate documents first before running a skills debrief")

    import json as _json
    skills_inventory: dict = {}
    if SKILLS.exists():
        try:
            skills_inventory = _json.loads(SKILLS.read_text(encoding="utf-8")).get("skills", {})
        except Exception:
            pass

    md = await interview.generate_skills_debrief(
        resume_md=resume_md,
        job_description=app.job_description,
        skills_inventory=skills_inventory,
        model=_model("writer"),
    )
    app.interview_debrief_md = md
    session.add(app)
    session.commit()
    return {"markdown": md}


@router.post("/interview-prep")
async def generate_interview_prep(body: InterviewPrepRequest, session: Session = Depends(get_session)):
    app = session.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    master = _master(app.language)
    if not master.exists():
        raise HTTPException(404, "Master resume not found")

    md = await interview.generate_interview_prep(
        master_path=master,
        job_description=app.job_description,
        company_name=app.company,
        company_tone=app.company_tone or "direct",
        language=app.language,
        interview_round=body.interview_round,
        interviewer_type=body.interviewer_type,
        focus_skills=body.focus_skills,
        model=_model("writer"),
        resume_final=app.resume_final_md or app.resume_draft_md or "",
        cover_letter=app.cover_letter_final_md or app.cover_letter_draft_md or "",
    )
    app.interview_prep_md = md
    session.add(app)
    session.commit()
    return {"markdown": md}


class SaveInterviewPrepRequest(BaseModel):
    markdown: str


@router.put("/{app_id}/interview-prep")
def save_interview_prep(app_id: str, body: SaveInterviewPrepRequest, session: Session = Depends(get_session)):
    """Write-back endpoint for the Claude 'Copy prompt for Claude' interview-prep path."""
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.interview_prep_md = body.markdown
    session.add(app)
    session.commit()
    return {"saved": True}

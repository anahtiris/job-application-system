import json
import re
from datetime import date
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from config import CONFIG, Paths, model
from db import get_setting, set_setting
from services.parser import parse_resume
from services import skill_extractor

router = APIRouter()

MASTER_EN = Paths.MASTER_EN
MASTER_DE = Paths.MASTER_DE
PERSONA = Paths.PERSONA
SKILLS = Paths.SKILLS


def _master_path(language: str) -> Path:
    return MASTER_DE if language == "de" else MASTER_EN


class UpdateResumeRequest(BaseModel):
    language: str = "en"
    content: str


@router.post("/parse")
async def parse(file: UploadFile, language: str = "en"):
    if not file.filename:
        raise HTTPException(400, "No file provided")
    ext = Path(file.filename).suffix.lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(400, "Only PDF and DOCX files are supported")

    content = await file.read()
    markdown = await parse_resume(content, file.filename, get_setting("model.parser", CONFIG["models"].get("parser", "")))

    path = _master_path(language)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown, encoding="utf-8")

    # Auto-save person name from # Contact section if not already set
    if not get_setting("person.name"):
        m = re.search(r"#\s*Contact\s*\n([^\n]+)", markdown)
        if m:
            raw_name = m.group(1).strip().lstrip("#").strip()
            if raw_name and "@" not in raw_name and "+" not in raw_name:
                set_setting("person.name", raw_name.replace(" ", "_"))

    return {"markdown": markdown, "saved_to": str(path)}


@router.get("/master")
def get_master(language: str = "en"):
    path = _master_path(language)
    if not path.exists():
        raise HTTPException(404, f"No master resume found for language '{language}'. Upload one first.")
    return {"language": language, "markdown": path.read_text(encoding="utf-8")}


@router.put("/master")
def update_master(body: UpdateResumeRequest):
    path = _master_path(body.language)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content, encoding="utf-8")
    return {"saved": True}


class PersonaRequest(BaseModel):
    content: str


@router.get("/persona")
def get_persona():
    if not PERSONA.exists():
        return {"content": ""}
    return {"content": PERSONA.read_text(encoding="utf-8")}


@router.put("/persona")
def update_persona(body: PersonaRequest):
    PERSONA.parent.mkdir(parents=True, exist_ok=True)
    PERSONA.write_text(body.content, encoding="utf-8")
    return {"saved": True}


class SkillsRequest(BaseModel):
    skills: dict


def _read_skills_dict() -> dict:
    if not SKILLS.exists():
        return {}
    try:
        return json.loads(SKILLS.read_text(encoding="utf-8")).get("skills", {})
    except Exception:
        return {}


def _write_skills_dict(skills: dict) -> None:
    SKILLS.parent.mkdir(parents=True, exist_ok=True)
    data = {"last_updated": date.today().isoformat(), "skills": skills}
    SKILLS.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


@router.get("/skills")
def get_skills():
    return {"skills": _read_skills_dict()}


@router.put("/skills")
def save_skills(body: SkillsRequest):
    _write_skills_dict(body.skills)
    return {"saved": True}


@router.post("/skills/extract")
async def extract_skills_endpoint():
    if MASTER_EN.exists():
        master_md = MASTER_EN.read_text(encoding="utf-8")
    elif MASTER_DE.exists():
        master_md = MASTER_DE.read_text(encoding="utf-8")
    else:
        raise HTTPException(404, "Upload a résumé first")
    existing = _read_skills_dict()
    extracted = await skill_extractor.extract_skills(master_md, existing, model("research"))
    merged = skill_extractor.merge_skills(existing, extracted)
    _write_skills_dict(merged)
    return {"skills": merged}


@router.post("/skills/merge")
def merge_skills_endpoint(body: SkillsRequest):
    merged = skill_extractor.merge_skills(_read_skills_dict(), body.skills)
    _write_skills_dict(merged)
    return {"skills": merged}

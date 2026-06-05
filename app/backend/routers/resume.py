import json
from datetime import date
from pathlib import Path

import tomllib
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from db import get_setting, set_setting
from services.parser import parse_resume

router = APIRouter()

with open(Path(__file__).parent.parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

BASE = Path(__file__).parent.parent.parent.parent  # repo root
MASTER_EN = BASE / _cfg["paths"]["resume_master_en"]
MASTER_DE = BASE / _cfg["paths"]["resume_master_de"]
PERSONA = BASE / _cfg["paths"]["persona"]
SKILLS = BASE / _cfg["paths"]["skills"]
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
    markdown = await parse_resume(content, file.filename, get_setting("model.parser", _cfg["models"].get("parser", "")))

    path = _master_path(language)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown, encoding="utf-8")

    # Auto-save person name from # Contact section if not already set
    if not get_setting("person.name"):
        import re
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


@router.get("/skills")
def get_skills():
    if not SKILLS.exists():
        return {"skills": {}}
    return json.loads(SKILLS.read_text(encoding="utf-8"))


@router.put("/skills")
def save_skills(body: SkillsRequest):
    SKILLS.parent.mkdir(parents=True, exist_ok=True)
    data = {"last_updated": date.today().isoformat(), "skills": body.skills}
    SKILLS.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"saved": True}

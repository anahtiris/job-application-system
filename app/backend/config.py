"""Single source of truth for config.toml — loaded once, resolved paths, model lookup."""
import json
import logging
import tomllib
from pathlib import Path

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent.parent  # repo root

with open(Path(__file__).parent / "config.toml", "rb") as f:
    CONFIG = tomllib.load(f)


class Paths:
    MASTER_EN = BASE_DIR / CONFIG["paths"]["resume_master_en"]
    MASTER_DE = BASE_DIR / CONFIG["paths"]["resume_master_de"]
    PERSONA = BASE_DIR / CONFIG["paths"]["persona"]
    CAREER_GOAL = BASE_DIR / CONFIG["paths"]["career_goal"]
    SKILLS = BASE_DIR / CONFIG["paths"]["skills"]
    TMPL_CV_EN = BASE_DIR / CONFIG["paths"]["templates_resume_en"]
    TMPL_CV_DE = BASE_DIR / CONFIG["paths"]["templates_resume_de"]
    TMPL_CL = BASE_DIR / CONFIG["paths"]["templates_cover_letter"]
    APPS_DIR = BASE_DIR / CONFIG["paths"]["applications_dir"]


def model(role: str) -> str:
    from db import get_setting  # deferred to avoid a module-level import cycle
    return get_setting(f"model.{role}", CONFIG["models"].get(role, ""))


def load_skills_inventory() -> dict:
    if not Paths.SKILLS.exists():
        return {}
    try:
        return json.loads(Paths.SKILLS.read_text(encoding="utf-8")).get("skills", {})
    except Exception:
        logger.warning("Failed to load skills inventory from %s", Paths.SKILLS, exc_info=True)
        return {}


def load_career_goal() -> str:
    if not Paths.CAREER_GOAL.exists():
        return ""
    try:
        return Paths.CAREER_GOAL.read_text(encoding="utf-8").strip()
    except Exception:
        logger.warning("Failed to read career goal from %s", Paths.CAREER_GOAL, exc_info=True)
        return ""

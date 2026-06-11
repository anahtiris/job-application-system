import json
import os
import tomllib
from pathlib import Path

from fastapi import APIRouter, Request
from pydantic import BaseModel

from db import get_setting, set_setting

router = APIRouter()

with open(Path(__file__).parent.parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

BASE = Path(__file__).parent.parent.parent.parent
CAREER_GOAL = BASE / _cfg["paths"]["career_goal"]
GENERAL_PREP = BASE / "data" / "general_prep.json"

_ROLES = ("parser", "writer", "reviewer", "research")

_API_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "perplexity": "PERPLEXITY_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


@router.get("/models")
def get_models():
    defaults = _cfg.get("models", {})
    return {
        role: get_setting(f"model.{role}", defaults.get(role, ""))
        for role in _ROLES
    }


class ModelsUpdate(BaseModel):
    parser: str | None = None
    writer: str | None = None
    reviewer: str | None = None
    research: str | None = None


@router.put("/models")
def update_models(body: ModelsUpdate):
    updates = body.model_dump(exclude_none=True)
    for role, slug in updates.items():
        if role in _ROLES:
            set_setting(f"model.{role}", slug)
    return {"saved": True}


@router.get("/profile")
def get_profile():
    return {"name": get_setting("person.name", "")}


class ProfileUpdate(BaseModel):
    name: str


@router.put("/profile")
def update_profile(body: ProfileUpdate):
    set_setting("person.name", body.name.strip())
    return {"saved": True}


@router.get("/goal")
def get_goal():
    if not CAREER_GOAL.exists():
        return {"content": ""}
    return {"content": CAREER_GOAL.read_text(encoding="utf-8")}


class GoalUpdate(BaseModel):
    content: str


@router.put("/goal")
def update_goal(body: GoalUpdate):
    CAREER_GOAL.parent.mkdir(parents=True, exist_ok=True)
    CAREER_GOAL.write_text(body.content, encoding="utf-8")
    return {"saved": True}


@router.get("/general-prep")
def get_general_prep():
    if not GENERAL_PREP.exists():
        return {}
    return json.loads(GENERAL_PREP.read_text(encoding="utf-8"))


@router.put("/general-prep")
async def update_general_prep(request: Request):
    data = await request.json()
    GENERAL_PREP.parent.mkdir(parents=True, exist_ok=True)
    GENERAL_PREP.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return {"saved": True}


@router.get("/api-keys")
def get_api_keys():
    return {
        provider: bool(os.environ.get(env_var))
        for provider, env_var in _API_KEY_ENV.items()
    }

import os
import tomllib
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from db import get_setting, set_setting

router = APIRouter()

with open(Path(__file__).parent.parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

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


@router.get("/api-keys")
def get_api_keys():
    return {
        provider: bool(os.environ.get(env_var))
        for provider, env_var in _API_KEY_ENV.items()
    }

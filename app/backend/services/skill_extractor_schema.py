"""Structured shape for skills-inventory extraction (skill_extractor.py).

The output is a map of skill name -> entry, so the root is a dict keyed by
arbitrary skill names. Handed to providers' structured output via
`generate(fmt=...)`. Mirrors the JSON described in EXTRACT_SYSTEM."""
from pydantic import BaseModel, Field, RootModel


class SkillEntry(BaseModel):
    tier: int = 3
    evidence: str = ""
    needs_review: bool = False


class SkillInventory(RootModel[dict[str, SkillEntry]]):
    root: dict[str, SkillEntry] = Field(default_factory=dict)

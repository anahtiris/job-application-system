"""Structured JD-analysis shape — the schema handed to providers' structured
output (via `generate(fmt=...)`) and used to validate the parsed result.

Mirrors the JSON described in ANALYSIS_SYSTEM (analyzer.py) and the
`fit_analysis` shape rendered by the /leads/[id] page. Optional fields default
so a provider may legitimately omit them (e.g. goal_alignment when no
CAREER_GOAL was supplied); validation then fills the default rather than
failing."""
from typing import Optional

from pydantic import BaseModel, Field


class JDSkill(BaseModel):
    skill: str = ""
    status: str = ""  # STRONG | HONEST | GAP | UNKNOWN
    tier: Optional[int] = None
    evidence: str = ""
    inventory_match: Optional[str] = None


class JDAnalysis(BaseModel):
    core_theme: str = ""
    must_haves: list[JDSkill] = Field(default_factory=list)
    nice_to_haves: list[JDSkill] = Field(default_factory=list)
    ats_keywords: list[str] = Field(default_factory=list)
    match_score: int = 0
    strongest_angle: str = ""
    weakest_point: str = ""
    is_poor_match: bool = False
    relevant_skills: list[str] = Field(default_factory=list)
    # Present only when a CAREER_GOAL was supplied to the analyzer.
    goal_alignment: str = ""  # aligns | neutral | detours
    goal_alignment_note: str = ""

"""Structured shapes for the multi-persona review (reviewer.py).

`ReviewResult` is the per-reviewer output (REVIEW_SYSTEM / PERSONA_REVIEW_SYSTEM);
`SynthesisResult` is the reconciled output (SYNTHESIS_SYSTEM). Both are handed to
providers' structured output via `generate(fmt=...)`.

`scores` keys are criterion names that differ between the standard and persona
reviewers, so it is a free-form dict[str, int] rather than fixed fields."""
from pydantic import BaseModel, Field


class Rewrite(BaseModel):
    original: str = ""
    rewrite: str = ""


class ReviewDoc(BaseModel):
    scores: dict[str, int] = Field(default_factory=dict)
    top_issues: list[str] = Field(default_factory=list)
    rewrites: list[Rewrite] = Field(default_factory=list)


class ReviewResult(BaseModel):
    cv: ReviewDoc = Field(default_factory=ReviewDoc)
    cover_letter: ReviewDoc = Field(default_factory=ReviewDoc)


class PriorityIssue(BaseModel):
    issue: str = ""
    severity: str = ""  # high | medium | low
    sources: list[str] = Field(default_factory=list)


class SynthRewrite(BaseModel):
    original: str = ""
    rewrite: str = ""
    sources: list[str] = Field(default_factory=list)


class SynthDoc(BaseModel):
    priority_issues: list[PriorityIssue] = Field(default_factory=list)
    rewrites: list[SynthRewrite] = Field(default_factory=list)


class SynthesisResult(BaseModel):
    cv: SynthDoc = Field(default_factory=SynthDoc)
    cover_letter: SynthDoc = Field(default_factory=SynthDoc)

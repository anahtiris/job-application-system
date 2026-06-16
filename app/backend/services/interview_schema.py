"""Structured interview-prep shape — single source of truth.

`InterviewPrep` is the stored/API shape (items carry ids). `GenInterviewPrep`
is the generation schema handed to Ollama's `format` field (no ids — the server
assigns them) and to describe the shape to the model."""
from uuid import uuid4

from pydantic import BaseModel, Field


class PrepQA(BaseModel):
    id: str = ""
    q: str = ""
    a: str = ""


class PrepQuestion(BaseModel):
    id: str = ""
    text: str = ""


class InterviewPrep(BaseModel):
    company_analysis: str = ""
    introduction_script: str = ""
    common_questions: list[PrepQA] = Field(default_factory=list)
    job_specific_questions: list[PrepQA] = Field(default_factory=list)
    weak_spots: list[PrepQA] = Field(default_factory=list)
    questions_to_ask: list[PrepQuestion] = Field(default_factory=list)
    salary: str = ""


# ── Generation schema (no ids) ──────────────────────────────────────────────
class GenQA(BaseModel):
    q: str = ""
    a: str = ""


class GenQuestion(BaseModel):
    text: str = ""


class GenInterviewPrep(BaseModel):
    company_analysis: str = ""
    introduction_script: str = ""
    common_questions: list[GenQA] = Field(default_factory=list)
    job_specific_questions: list[GenQA] = Field(default_factory=list)
    weak_spots: list[GenQA] = Field(default_factory=list)
    questions_to_ask: list[GenQuestion] = Field(default_factory=list)
    salary: str = ""


_QA_KEYS = ("common_questions", "job_specific_questions", "weak_spots")


def with_ids(gen: dict) -> dict:
    """Map a generated (id-less) dict to the stored shape, assigning fresh ids."""
    out = {
        "company_analysis": gen.get("company_analysis", ""),
        "introduction_script": gen.get("introduction_script", ""),
        "salary": gen.get("salary", ""),
    }
    for key in _QA_KEYS:
        out[key] = [
            {"id": uuid4().hex, "q": i.get("q", ""), "a": i.get("a", "")}
            for i in gen.get(key, [])
        ]
    out["questions_to_ask"] = [
        {"id": uuid4().hex, "text": i.get("text", "")}
        for i in gen.get("questions_to_ask", [])
    ]
    return out


def ensure_ids(prep: dict) -> dict:
    """Fill any blank/missing ids on a stored-shape dict (in place) and return it."""
    for key in _QA_KEYS:
        for item in prep.get(key, []):
            if not item.get("id"):
                item["id"] = uuid4().hex
    for item in prep.get("questions_to_ask", []):
        if not item.get("id"):
            item["id"] = uuid4().hex
    return prep

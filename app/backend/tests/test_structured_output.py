"""Structured-output wiring: providers translate the `fmt` JSON schema into
their own API field, and the analyzer passes its schema then validates the
result. No live API calls — provider tests assert on payload construction."""
import json

import pytest

from services import analyzer, researcher, reviewer, skill_extractor
from services.analyzer_schema import JDAnalysis
from services.providers import anthropic, gemini, openai
from services.researcher_schema import ToneClassification
from services.reviewer_schema import ReviewResult
from services.skill_extractor_schema import SkillInventory


_SCHEMA = {"type": "object", "properties": {"x": {"type": "string"}}}


# ── provider payload construction ─────────────────────────────────────────────

def test_anthropic_payload_forces_tool_when_fmt_set():
    body = anthropic._payload("m", "p", "", stream=False, fmt=_SCHEMA)
    assert body["tools"][0]["input_schema"] == _SCHEMA
    assert body["tool_choice"] == {"type": "tool", "name": anthropic._SCHEMA_TOOL}


def test_anthropic_payload_no_tool_without_fmt():
    body = anthropic._payload("m", "p", "", stream=False)
    assert "tools" not in body and "tool_choice" not in body


def test_anthropic_payload_no_tool_when_streaming():
    body = anthropic._payload("m", "p", "", stream=True, fmt=_SCHEMA)
    assert "tools" not in body


def test_openai_payload_sets_json_schema_when_fmt_set():
    body = openai._payload("m", "p", "", stream=False, fmt=_SCHEMA)
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["schema"] == _SCHEMA


def test_openai_payload_no_response_format_without_fmt():
    body = openai._payload("m", "p", "", stream=False)
    assert "response_format" not in body


def test_openai_payload_no_response_format_when_streaming():
    body = openai._payload("m", "p", "", stream=True, fmt=_SCHEMA)
    assert "response_format" not in body


def test_gemini_payload_sets_json_mime_when_fmt_set():
    body = gemini._payload("p", "", fmt=_SCHEMA)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    # JSON-mode floor only — no responseSchema is sent.
    assert "responseSchema" not in body["generationConfig"]


def test_gemini_payload_no_json_mime_without_fmt():
    body = gemini._payload("p", "")
    assert "responseMimeType" not in body["generationConfig"]


# ── callers pass their schema to generate() ───────────────────────────────────

async def test_researcher_passes_tone_schema(monkeypatch):
    captured = {}

    async def fake_generate(model, prompt, system="", fmt=None):
        captured["fmt"] = fmt
        return json.dumps({"tone": "startup", "reasoning": "small team"})

    monkeypatch.setattr(researcher, "generate", fake_generate)
    result = await researcher.research_company("Acme", "ollama/x")
    assert captured["fmt"] == ToneClassification.model_json_schema()
    assert result["tone"] == "startup"


async def test_reviewer_run_review_passes_schema(monkeypatch):
    captured = {}
    review = {"cv": {"scores": {}, "top_issues": [], "rewrites": []},
              "cover_letter": {"scores": {}, "top_issues": [], "rewrites": []}}

    async def fake_generate(model, prompt, system="", fmt=None):
        captured["fmt"] = fmt
        return json.dumps(review)

    monkeypatch.setattr(reviewer, "generate", fake_generate)
    out = await reviewer._run_review(
        "user", "You", reviewer.PERSONA_REVIEW_SYSTEM, "cv", "cl", "master", "ollama/x"
    )
    assert captured["fmt"] == ReviewResult.model_json_schema()
    assert out["persona"] == "You"


async def test_skill_extractor_passes_schema(monkeypatch):
    captured = {}

    async def fake_generate(model, prompt, system="", fmt=None):
        captured["fmt"] = fmt
        return json.dumps({"Python": {"tier": 1, "evidence": "5y", "needs_review": False}})

    monkeypatch.setattr(skill_extractor, "generate", fake_generate)
    out = await skill_extractor.extract_skills("# resume", {}, "ollama/x")
    assert captured["fmt"] == SkillInventory.model_json_schema()
    assert out["Python"]["tier"] == 1


# ── analyzer: passes fmt, validates result ────────────────────────────────────

_VALID = {
    "core_theme": "build stuff",
    "must_haves": [
        {"skill": "Python", "status": "STRONG", "tier": 1,
         "evidence": "5y", "inventory_match": "Python"}
    ],
    "nice_to_haves": [],
    "ats_keywords": ["python"],
    "match_score": 80,
    "strongest_angle": "a",
    "weakest_point": "b",
    "is_poor_match": False,
}


async def test_analyze_jd_passes_schema_and_parses(monkeypatch):
    captured = {}

    async def fake_generate(model, prompt, system="", fmt=None):
        captured["fmt"] = fmt
        return json.dumps(_VALID)

    monkeypatch.setattr(analyzer, "generate", fake_generate)

    result = await analyze_helper()
    assert captured["fmt"] == JDAnalysis.model_json_schema()
    # relevant_skills is recomputed from the STRONG/tier-1 must_have.
    assert result["relevant_skills"] == ["Python"]


async def test_analyze_jd_raises_on_schema_drift(monkeypatch):
    bad = dict(_VALID, match_score="not-an-int")

    async def fake_generate(model, prompt, system="", fmt=None):
        return json.dumps(bad)

    monkeypatch.setattr(analyzer, "generate", fake_generate)
    with pytest.raises(Exception):
        await analyze_helper()


async def analyze_helper():
    return await analyzer.analyze_jd(
        job_description="JD",
        skills_inventory={"Python": {"tier": 1, "evidence": "5y"}},
        model="ollama/x",
    )

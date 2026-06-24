"""Structured-output wiring: providers translate the `fmt` JSON schema into
their own API field, and the analyzer passes its schema then validates the
result. No live API calls — provider tests assert on payload construction."""
import json

import pytest

from services import analyzer
from services.analyzer_schema import JDAnalysis
from services.providers import anthropic, openai


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

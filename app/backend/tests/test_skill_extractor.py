from services.skill_extractor import merge_skills

import services.skill_extractor as se


def test_merge_adds_new_skills():
    existing = {"TypeScript": {"tier": 1, "evidence": "x"}}
    incoming = {"React": {"tier": 2, "evidence": "y"}}
    merged = merge_skills(existing, incoming)
    assert merged["TypeScript"] == {"tier": 1, "evidence": "x"}
    assert merged["React"] == {"tier": 2, "evidence": "y"}


def test_merge_keeps_existing_on_collision():
    existing = {"Python": {"tier": 1, "evidence": "owned it"}}
    incoming = {"Python": {"tier": 4, "evidence": "guessed", "needs_review": True}}
    merged = merge_skills(existing, incoming)
    assert merged["Python"] == {"tier": 1, "evidence": "owned it"}


def test_merge_carries_needs_review_on_new_skill():
    merged = merge_skills({}, {"Go": {"tier": 3, "evidence": "g", "needs_review": True}})
    assert merged["Go"]["needs_review"] is True


def test_merge_empty_incoming_unchanged():
    existing = {"TypeScript": {"tier": 1, "evidence": "x"}}
    assert merge_skills(existing, {}) == existing


def test_merge_does_not_mutate_existing():
    existing = {"TypeScript": {"tier": 1, "evidence": "x"}}
    merge_skills(existing, {"React": {"tier": 2, "evidence": "y"}})
    assert "React" not in existing


async def test_extract_parses_fenced_json(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '```json\n{"TypeScript": {"tier": 1, "evidence": "5y prod", "needs_review": false}}\n```'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("# résumé", {}, "ollama/x")
    assert out["TypeScript"]["tier"] == 1
    assert out["TypeScript"]["evidence"] == "5y prod"
    assert out["TypeScript"]["needs_review"] is False


async def test_extract_coerces_and_clamps_tier(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '{"A": {"tier": "2", "evidence": "e"}, "B": {"tier": 9}, "C": {"evidence": "e"}}'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("r", {}, "m")
    assert out["A"]["tier"] == 2          # string coerced to int
    assert out["B"]["tier"] == 4          # clamped into 1..4
    assert out["C"]["tier"] == 3          # missing -> default 3


async def test_extract_defaults_needs_review_false(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '{"A": {"tier": 2, "evidence": "e"}}'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("r", {}, "m")
    assert out["A"]["needs_review"] is False


async def test_extract_unparseable_returns_empty(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return "I could not produce JSON."
    monkeypatch.setattr(se, "generate", fake_generate)
    assert await se.extract_skills("r", {}, "m") == {}


async def test_extract_handles_quoted_boolean_needs_review(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '{"A": {"tier": 2, "evidence": "e", "needs_review": "false"}, "B": {"tier": 3, "needs_review": "true"}}'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("r", {}, "m")
    assert out["A"]["needs_review"] is False   # quoted "false" is not truthy
    assert out["B"]["needs_review"] is True

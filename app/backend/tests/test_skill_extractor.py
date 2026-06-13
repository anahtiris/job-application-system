from services.skill_extractor import merge_skills


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

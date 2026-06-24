"""Extract a tiered skills inventory from the master résumé and merge it
into the existing inventory without overwriting manual edits."""

import json
import logging
import re

from services.llm import generate
from services.skill_extractor_schema import SkillInventory

logger = logging.getLogger(__name__)

# Mirrors skills/skill-assessment/SKILL.md — keep in sync
EXTRACT_SYSTEM = """You build a candidate's skills inventory from their résumé.

Read the WHOLE résumé — including experience bullets, not just a skills list. For
each concrete technical or professional skill, assign a tier and write one short
evidence sentence grounded ONLY in the résumé. Never invent skills or experience.

TIERS:
- 1 Core: 3+ production projects, recent, owned end-to-end
- 2 Proficient: 2+ projects, contributed meaningfully, mostly independent
- 3 Familiar: 1 project or did not own it, needs ramp-up
- 4 Exposure: tutorials only, never shipped, or 3+ years ago

If the résumé evidence is too thin to place a skill confidently, pick the most
conservative plausible tier and set "needs_review": true.

EXISTING_INVENTORY lists skills the user already curated — you may still list them,
but focus on surfacing skills not yet captured.

OUTPUT JSON only, no markdown fences, shape:
{ "SkillName": { "tier": 1, "evidence": "...", "needs_review": false }, ... }"""


def _sanitise(raw: str) -> dict:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return {}
    text = re.sub(r",\s*([}\]])", r"\1", m.group())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Skill extraction returned unparseable JSON", exc_info=True)
        return {}


def _as_bool(value) -> bool:
    """Coerce a model-emitted flag to bool. Small models sometimes emit a quoted
    boolean ("false"), which is truthy under bool() — treat those as the words."""
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return bool(value)


def _normalise(entry: dict) -> dict:
    try:
        tier = int(entry.get("tier", 3))
    except (TypeError, ValueError):
        tier = 3
    tier = max(1, min(4, tier))
    return {
        "tier": tier,
        "evidence": str(entry.get("evidence", "")).strip(),
        "needs_review": _as_bool(entry.get("needs_review", False)),
    }


async def extract_skills(master_md: str, existing: dict, model: str) -> dict:
    """Return {name: {tier, evidence, needs_review}} extracted from the résumé."""
    prompt = (
        f"EXISTING_INVENTORY:\n{json.dumps(list(existing.keys()))}\n\n"
        f"RÉSUMÉ:\n{master_md}"
    )
    raw = await generate(model, prompt, system=EXTRACT_SYSTEM, fmt=SkillInventory.model_json_schema())
    parsed = _sanitise(raw)
    return {
        name: _normalise(entry)
        for name, entry in parsed.items()
        if isinstance(entry, dict) and str(name).strip()
    }


def merge_skills(existing: dict, incoming: dict) -> dict:
    """Keep-my-edits merge: add skills from `incoming` that are not already in
    `existing`; on a name collision the existing entry is kept unchanged."""
    merged = dict(existing)
    for name, entry in incoming.items():
        if name not in merged:
            merged[name] = entry
    return merged

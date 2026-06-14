import json
import re

from services.llm import generate

ANALYSIS_SYSTEM = """You are analyzing a job description against a candidate's skills inventory.

Output JSON only — no markdown fences, no explanation:
{
  "core_theme": "one sentence describing what this role does day-to-day",
  "must_haves": [{"skill": "...", "status": "STRONG|HONEST|GAP|UNKNOWN", "tier": 1|2|3|4|null, "evidence": "...", "inventory_match": "exact SKILLS_INVENTORY name or null"}],
  "nice_to_haves": [{"skill": "...", "status": "STRONG|HONEST|GAP|UNKNOWN", "tier": 1|2|3|4|null, "evidence": "...", "inventory_match": "exact SKILLS_INVENTORY name or null"}],
  "ats_keywords": ["top 5-8 keywords an ATS will scan for"],
  "match_score": 85,
  "strongest_angle": "what makes this candidate genuinely competitive for this role",
  "weakest_point": "what the interviewer will push back on most",
  "is_poor_match": false,
  "relevant_skills": ["..."]
}

Classify each required/optional skill from the JD against SKILLS_INVENTORY:
- STRONG: Tier 1 or 2 in inventory
- HONEST: Tier 3 in inventory
- GAP: not in inventory, Tier 4, or skill clearly needed but absent
- UNKNOWN: no SKILLS_INVENTORY provided (use this for all skills when inventory is missing)

inventory_match is the exact skill name as it appears as a key in SKILLS_INVENTORY that this
JD skill corresponds to (the JD may phrase it differently). Use null if there is no matching
inventory entry (e.g. status is GAP or UNKNOWN).

Second step — after classifying every skill, derive relevant_skills: take the inventory_match
values from must_haves and nice_to_haves where status is STRONG or HONEST AND tier is 1 or 2,
order them by tier ascending, remove duplicates, and cap the list at 8 entries. Use the exact
inventory name for each entry.

is_poor_match = true if ≥50% of must_haves are GAP

match_score is an integer from 0 to 100 (not a decimal).

If CAREER_GOAL is provided in the input, add these two fields to the output:
  "goal_alignment": "aligns" | "neutral" | "detours",
  "goal_alignment_note": "one sentence citing the specific goal element matched or missed"

- aligns: role moves clearly toward the stated goal
- detours: role moves away from the goal or locks into an unwanted direction
- neutral: insufficient overlap to judge, or goal is not relevant to this role type

If CAREER_GOAL is absent, omit goal_alignment and goal_alignment_note entirely."""

_TIER_LABELS = {1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure"}


async def analyze_jd(
    job_description: str,
    skills_inventory: dict,
    model: str,
    career_goal: str = "",
    past_decisions: str = "",
) -> dict:
    if skills_inventory:
        lines = [
            f"- {name}: Tier {s['tier']} ({_TIER_LABELS.get(s['tier'], s['tier'])}) — {s.get('evidence', '')}"
            for name, s in skills_inventory.items()
        ]
        skills_block = "SKILLS_INVENTORY:\n" + "\n".join(lines)
    else:
        skills_block = "SKILLS_INVENTORY: (none provided)"

    prompt = f"JOB_DESCRIPTION:\n{job_description}\n\n{skills_block}"
    if career_goal:
        prompt += f"\n\nCAREER_GOAL:\n{career_goal}"
    if past_decisions:
        prompt += f"\n\nRECENT_DECISIONS:\n{past_decisions}"
    raw = await generate(model, prompt, system=ANALYSIS_SYSTEM)
    text = raw.strip()
    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Extract the first {...} block in case the model added preamble text
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        text = m.group(0)
    # Remove trailing commas before } or ] (common LLM JSON mistake)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    result = json.loads(text)

    # Safety net: recompute relevant_skills rather than trusting the LLM's cap/ordering.
    classification = result.get("must_haves", []) + result.get("nice_to_haves", [])
    candidates = [
        s for s in classification
        if s.get("status") in ("STRONG", "HONEST")
        and s.get("tier") in (1, 2)
        and s.get("inventory_match") is not None
    ]
    candidates.sort(key=lambda s: s["tier"])
    relevant: list[str] = []
    for s in candidates:
        name = s["inventory_match"]
        if name not in relevant:
            relevant.append(name)
    result["relevant_skills"] = relevant[:8]

    return result

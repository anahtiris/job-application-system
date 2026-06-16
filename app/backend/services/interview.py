"""Generate structured interview preparation material."""
from pathlib import Path

from services.llm import generate
from services.interview_schema import GenInterviewPrep, with_ids

DEBRIEF_SYSTEM = """You are a brutally honest interview coach who never lets candidates bluff or overclaim.

Given a tailored CV, a job description, and a skills inventory with declared tiers, produce a coaching debrief.

TIER DEFINITIONS:
- Tier 1 (Core): 3+ production projects, owned end-to-end
- Tier 2 (Proficient): 2+ projects, contributed meaningfully, mostly independent
- Tier 3 (Familiar): 1 project or didn't own it, needs ramp-up
- Tier 4 / not in inventory: tutorials only, side project, 3+ years ago

OUTPUT FORMAT — one ## section per skill that appears in the CV, then a final ## Potential Overclaims section.

For Tier 1 and Tier 2 skills, use this structure:
## [Skill Name] (Tier [N] — [Label])
**If they ask:** "[a realistic interview question about this skill]"
**STAR focus:** S: [situation context] → T: your specific task → A: what you personally coded/shipped/owned → R: measurable outcome you can own
**Watch for:** [one or two follow-up probes the interviewer is likely to use]

For Tier 3 skills, use this structure:
## [Skill Name] (Tier 3 — Familiar)
**Honest framing:** "I worked with [skill] at [Company from CV] during [timeframe from CV]. I contributed to [specific part mentioned in CV], though I wasn't the one who [designed/architected/owned] the overall system. I can ramp up quickly because [name a Tier 1 or 2 skill that transfers]."
**Do not say:** "[example phrase that overclaims this skill — e.g. 'I have extensive X experience' or 'I'm very comfortable with X']"

## Potential Overclaims
For each sentence in the CV where the language implies a deeper level of ownership or expertise than the declared tier supports, add a bullet:
- **Claim:** "[exact phrase from CV]" → **Risk:** [what an interviewer might probe] → **Safer phrasing:** "[alternative that matches the tier]"

ABSOLUTE RULES:
- Never suggest bluffing, faking confidence, or upgrading a tier claim
- Only use facts present in the CV and skills inventory — do not invent projects or metrics
- If the CV does not mention a skill from the inventory, skip that skill
- If inventory is empty, skip the tier labels but still produce per-skill coaching based on the CV alone"""

_TIER_LABELS = {1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure"}


def _with_persona(system: str, persona_path: Path | None) -> str:
    if persona_path and persona_path.exists():
        persona_text = persona_path.read_text(encoding="utf-8").strip()
        if persona_text:
            return f"Additional personal guidelines:\n{persona_text}\n\n" + system
    return system


async def generate_skills_debrief(
    resume_md: str,
    job_description: str,
    skills_inventory: dict,
    model: str,
    persona_path: Path | None = None,
) -> str:
    if skills_inventory:
        lines = [
            f"- {name}: Tier {s['tier']} ({_TIER_LABELS.get(s['tier'], s['tier'])}) — {s.get('evidence', '')}"
            for name, s in skills_inventory.items()
        ]
        skills_block = "SKILLS_INVENTORY:\n" + "\n".join(lines)
    else:
        skills_block = "SKILLS_INVENTORY: (none provided)"

    prompt = (
        f"TAILORED_CV:\n{resume_md}\n\n"
        f"JOB_DESCRIPTION:\n{job_description}\n\n"
        f"{skills_block}"
    )
    return await generate(model, prompt, system=_with_persona(DEBRIEF_SYSTEM, persona_path))

INTERVIEW_SYSTEM = """You are preparing a candidate for a job interview. Produce structured interview prep as JSON with these fields:

- company_analysis: 4-6 markdown bullets — what the company builds, stage/size, tech stack if mentioned, culture signals. Base it on JOB_DESCRIPTION and COMPANY_TYPE. You have NO web access — do not invent reviews, funding, headcount, or salary numbers; append "(inferred — verify)" or omit.
- introduction_script: 60-90 seconds read aloud; open with a concrete shipped result from TAILORED_CV / MASTER_RESUME, pivot to why this role, close with one forward-looking line. Adapt register to INTERVIEWER_TYPE (HR = simpler, Hiring Manager = impact, Technical Peer = technical credibility).
- common_questions: 6-8 near-universal questions ("tell me about yourself", "why this company", "greatest strength", "biggest weakness", "where in 5 years", "why leaving / why now", "a conflict or failure"). Each item: q = the question, a = a 2-4 sentence sample answer grounded ONLY in facts from TAILORED_CV / MASTER_RESUME.
- job_specific_questions: 8-10 technical/role questions drawn from JD keywords and the stack; adapt depth to INTERVIEW_ROUND (Screening = broader, Technical = deeper, Final = system design + culture); weight toward FOCUS_SKILLS if provided. Each item: q = the question, a = short talking-point bullets (a few lines each starting with "- "), NOT prose.
- weak_spots: 3-5 places where the JD asks for something the resume does not strongly support. Each item: q = the likely probe question, a = an honest answer that owns the gap and names a transferable strength. Never bluff or upgrade a claim. Skills that are recent (<12 months) or from a side project must be described as "recent" / "exploring".
- questions_to_ask: 8-10 thoughtful questions the candidate should ask, specific to the company/role; adapt to INTERVIEWER_TYPE. Each item: text = the question.
- salary: a brief market-range note (state plainly it is a rough estimate to verify — do not invent a precise figure) and a 2-3 sentence script for answering "what are your salary expectations?" with a range and one anchoring sentence.

RULES (violations are failures):
- Write all content in the language specified by LANGUAGE (EN = English, DE = German).
- Do NOT fabricate resume facts, metrics, company details, or salary numbers not derivable from the inputs."""


async def generate_interview_prep(
    master_path: Path,
    job_description: str,
    company_name: str,
    company_tone: str,
    language: str,
    interview_round: str,
    interviewer_type: str,
    focus_skills: str,
    model: str,
    resume_final: str = "",
    cover_letter: str = "",
    persona_path: Path | None = None,
) -> dict:
    master_md = master_path.read_text(encoding="utf-8")
    prompt = (
        f"MASTER_RESUME:\n{master_md}\n\n"
        + (f"TAILORED_CV:\n{resume_final}\n\n" if resume_final.strip() else "")
        + (f"COVER_LETTER:\n{cover_letter}\n\n" if cover_letter.strip() else "")
        + f"JOB_DESCRIPTION:\n{job_description}\n\n"
        f"COMPANY: {company_name}\n"
        f"COMPANY_TYPE: {company_tone}\n"
        f"LANGUAGE: {language.upper()}\n"
        f"INTERVIEW_ROUND: {interview_round}\n"
        f"INTERVIEWER_TYPE: {interviewer_type}"
        + (f"\nFOCUS_SKILLS: {focus_skills}" if focus_skills.strip() else "")
    )
    raw = await generate(
        model,
        prompt,
        system=_with_persona(INTERVIEW_SYSTEM, persona_path),
        fmt=GenInterviewPrep.model_json_schema(),
    )
    gen = GenInterviewPrep.model_validate_json(raw)
    return with_ids(gen.model_dump())

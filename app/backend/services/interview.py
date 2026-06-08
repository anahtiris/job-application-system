"""Generate structured interview preparation material."""
from pathlib import Path

from services.llm import generate

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


async def generate_skills_debrief(
    resume_md: str,
    job_description: str,
    skills_inventory: dict,
    model: str,
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
    return await generate(model, prompt, system=DEBRIEF_SYSTEM)

INTERVIEW_SYSTEM = """You are preparing a candidate for a job interview.

Output markdown with EXACTLY these seven section headers (## level), in this order:

## Company Analysis
## Introduction Script
## Common Questions
## Job-Specific Questions
## Weak Spots
## Questions to Ask
## Salary & Negotiation

RULES (violations are failures):
- Company Analysis: 4-6 bullets — what the company builds, stage/size, tech stack if mentioned, and culture signals. Base it on the JOB_DESCRIPTION and COMPANY_TYPE. You have NO web access here, so do not invent reviews, funding, headcount, or salary numbers — if a fact is not derivable from the inputs, append "(inferred — verify)" or omit it.
- Introduction Script: 60-90 seconds read aloud; open with a concrete hook (a shipped result from TAILORED_CV / MASTER_RESUME), pivot to why this role, close with one forward-looking line. Draw on TAILORED_CV and COVER_LETTER so the pitch matches what was actually submitted. Adapt register to INTERVIEWER_TYPE (HR = simpler, Hiring Manager = impact, Technical Peer = technical credibility).
- Common Questions: the 6-8 near-universal questions ("tell me about yourself", "why this company", "greatest strength", "biggest weakness", "where in 5 years", "why leaving / why now", "a conflict or failure"). For each: the question as a **bold** line, then a 2-4 sentence sample answer grounded ONLY in facts from TAILORED_CV / MASTER_RESUME.
- Job-Specific Questions: 8-10 numbered technical/role questions drawn directly from JD keywords and the stack; adapt depth to INTERVIEW_ROUND (Screening = broader, Technical = deeper, Final = system design + culture). If FOCUS_SKILLS is provided, weight toward those.
- Weak Spots: 3-5 places where the JD asks for something the resume does not strongly support (a missing skill, thin or recent experience, a gap). For each: **Likely probe:** "[question]" then **Honest answer:** "[a truthful framing that owns the gap and names a transferable strength]". Never suggest bluffing or upgrading a claim. Skills that are recent (<12 months) or from a side project must be described as "recent" / "exploring", never as deep experience.
- Questions to Ask: 8-10 lines, each starting with `- ` (plain bullet, no checkbox); thoughtful and specific to the company/role; adapt to INTERVIEWER_TYPE (HR = culture/process, Technical Peer = engineering practices, Hiring Manager = team/vision).
- Salary & Negotiation: a brief market-range note (state plainly it is a rough estimate to verify — do not invent a precise figure) and a 2-3 sentence script for answering "what are your salary expectations?" with a range and one anchoring sentence.
- Language: write everything in the language specified by LANGUAGE (EN = English, DE = German).
- Do NOT fabricate resume facts, metrics, company details, or salary numbers not derivable from the inputs.
- Do NOT add any sections beyond the seven listed above."""


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
) -> str:
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
    return await generate(model, prompt, system=INTERVIEW_SYSTEM)

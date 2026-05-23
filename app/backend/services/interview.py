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
- This person has NEVER held a lead or management role. Every STAR story must be framed around personal contribution: "I built", "I implemented", "I contributed to". Never "I led the team", "I managed", "I oversaw".
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

Output markdown with EXACTLY these five section headers (## level), in this order:

## Technical Questions
## Company Background
## Introduction Script
## STAR Stories
## Questions to Ask

RULES (violations are failures):
- Technical Questions: 10-12 numbered questions; mix conceptual and practical; drawn directly from JD keywords and stack mentioned; adapt depth to INTERVIEW_ROUND (Screening = broader, Technical = deeper, Final = system design + culture)
- Company Background: 3-5 bullet points covering what the company builds, their tech stack if mentioned, company size/stage, and mission; infer from JD if no direct facts are given; do not fabricate specifics
- Introduction Script: 60-90 seconds when read aloud at natural pace; open with a concrete hook (a shipped result or a problem you solved), pivot to why this role, close with one forward-looking sentence; adapt register to INTERVIEWER_TYPE (HR = simpler language, Hiring Manager = impact focus, Technical Peer = technical credibility)
- STAR Stories: exactly 4 stories; each story has four labelled sub-points: **S:** (Situation), **T:** (Task), **A:** (Action), **R:** (Result); draw only from facts in MASTER_RESUME; map each story to a likely interview theme (e.g. "Leadership", "Technical challenge", "Conflict resolution", "Delivery under pressure")
- Questions to Ask: 8-10 lines; each line starts with `- ` (plain bullet, no checkbox); questions should be thoughtful and specific to the company/role; if INTERVIEWER_TYPE is HR focus on culture/process, if Technical Peer focus on engineering practices, if Hiring Manager focus on team/vision
- If FOCUS_SKILLS is provided, weight Technical Questions and STAR story selection toward those skills
- Language: write everything in the language specified by LANGUAGE (EN = English, DE = German)
- Do NOT fabricate resume facts, metrics, or company details not derivable from the inputs
- Do NOT add any sections beyond the five listed above"""


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
) -> str:
    master_md = master_path.read_text(encoding="utf-8")
    prompt = (
        f"MASTER_RESUME:\n{master_md}\n\n"
        f"JOB_DESCRIPTION:\n{job_description}\n\n"
        f"COMPANY: {company_name}\n"
        f"COMPANY_TYPE: {company_tone}\n"
        f"LANGUAGE: {language.upper()}\n"
        f"INTERVIEW_ROUND: {interview_round}\n"
        f"INTERVIEWER_TYPE: {interviewer_type}"
        + (f"\nFOCUS_SKILLS: {focus_skills}" if focus_skills.strip() else "")
    )
    return await generate(model, prompt, system=INTERVIEW_SYSTEM)

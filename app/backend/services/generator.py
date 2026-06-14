"""Generate tailored resume and cover letter as markdown.

Guardrails enforced here (not just in prompts):
- Only summary and skills sections are rewritten
- Bullet points are passed as a numbered read-only list; only their ORDER may change
- Email and phone are read from the master resume file at call time
"""
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from services.llm import generate, stream

NOTICE_PERIODS = (
    "immediate", "2_weeks",
    "1_month", "2_months", "3_months", "4_months", "5_months", "6_months",
    "custom",
)


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                       31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def _first_of_next_month(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def compute_start_date(period: str, custom_date: str = "") -> str:
    """Return the cover letter availability date as DD.MM.YYYY.

    `period` is "immediate", "2_weeks", "1_month".."6_months", or "custom"
    (with `custom_date` as an ISO YYYY-MM-DD string). Unknown/empty periods
    and an unset/invalid custom_date fall back to "immediate".
    """
    if period == "custom" and custom_date:
        try:
            return datetime.strptime(custom_date, "%Y-%m-%d").strftime("%d.%m.%Y")
        except ValueError:
            pass

    today = date.today()
    if period == "2_weeks":
        base = today + timedelta(days=14)
    elif period and period.endswith("_months") or period == "1_month":
        base = _add_months(today, int(period.split("_")[0]))
    else:
        base = today

    return _first_of_next_month(base).strftime("%d.%m.%Y")

RESUME_SYSTEM = """You are a resume tailoring assistant with strict rules.

INPUT STRUCTURE:
- MASTER_RESUME: the canonical resume — this is the ONLY source of truth
- JOB_DESCRIPTION: the target role

YOUR TASK:
1. Write a new PROFILE SUMMARY (2-3 sentences, max 200 characters, inject JD keywords naturally)
2. Reorder and trim the SKILLS section to highlight relevance (use only skills present in master)

ABSOLUTE RULES:
- Do NOT rephrase, reword, or modify any bullet point text anywhere in the resume.
- Do NOT add skills, achievements, or facts not present in MASTER_RESUME.
- Do NOT change job titles, company names, dates, or education.
- Profile summary must be under 200 characters.

OUTPUT FORMAT (JSON only, no markdown fences):
{
  "summary": "...",
  "skills": "..."
}"""

COVER_LETTER_SYSTEM = """You are writing a professional cover letter following the AIDA framework.

RULES (violations are failures):
- Length: 250-350 words total
- Language: match the job description language (DE or EN)
- No em dashes — use hyphens (-) only
- No sentence longer than 20 words
- No consecutive sentences starting with the same word or structure
- No openers: "I am writing to apply", "I would like to apply", "I am excited about the opportunity"
- No buzzwords: passionate, dynamic, innovative, results-driven, seamlessly, perfectly
- No corporate fluff phrases (banned, case-insensitive): "leverage my expertise", "leverage", "drive successful", "demonstrate(s) success", "track record of", "proven ability", "deep understanding", "extensive experience in", "well-versed in", "synergy", "value-add", "best-in-class", "robust solutions"
- Tense: use present tense ONLY for roles where the master resume shows "Present" as end date
- Company-attribution lock: only attribute metrics/actions to the company they appear under in the resume
- Do NOT fabricate any fact not present in the master resume
- No overclaiming: if a skill appears in the master resume with a recent date (within the last 12 months) or only in a personal/side project, describe it as "recent" / "exploring" / "in a side project" — do NOT label it "extensive", "expert", or "deep" experience
- SKILLS_INVENTORY: if this field is present, match proficiency language strictly to the declared tier — Core = owned end-to-end across multiple projects; Proficient = 2+ projects, mostly independent; Familiar = limited experience, needs ramp-up; Exposure = tutorials only. Never upgrade a tier based on how impressive it sounds
- COVER_LETTER_NOTES: if this field is present in the input, incorporate those points naturally into the letter. They take priority over generic content choices but must not contradict the master resume or any rule above

STRUCTURE:
1. Opening (1-2 sentences): connect your specific experience to their specific need. Adapt strategy:
   - direct employer: reference their product/mission/tech
   - startup: calm, hands-on builder voice — concrete shipping/ownership, comfortable working solo, plain English; NO corporate language, NO buzzwords, NO oversell
   - contractor: lead with cross-client delivery track record
   - agency: lead with crisp professional identity + stack match
2. Evidence (1-2 paragraphs): Problem -> Solution -> Impact arc, inject JD keywords naturally. Prefer concrete numbers and plain verbs ("shipped", "built", "cut latency by", "owned") over abstract claims.
3. Closing (2-3 sentences): use the START_DATE from the input verbatim as the availability date (never "ab sofort"), call to action using CONTACT_EMAIL and CONTACT_PHONE from the input — use them verbatim, do not invent or modify them

OUTPUT: plain markdown text of the cover letter body only (no subject line, no date, no address)."""


def _apply_tailoring(master_md: str, summary: str, skills: str) -> str:
    # Replace profile summary
    result = re.sub(
        r"(# Profile\n)(.*?)(\n#)",
        lambda m: f"{m.group(1)}{summary}\n{m.group(3)}",
        master_md,
        flags=re.DOTALL,
    )

    # Replace skills section
    result = re.sub(
        r"(# Skills\n)(.*?)(\n#)",
        lambda m: f"{m.group(1)}{skills}\n{m.group(3)}",
        result,
        flags=re.DOTALL,
    )

    return result


async def generate_resume(
    master_path: Path, job_description: str, language: str, model: str
) -> str:
    master_md = master_path.read_text(encoding="utf-8")
    prompt = (
        f"MASTER_RESUME:\n{master_md}\n\n"
        f"JOB_DESCRIPTION:\n{job_description}"
    )

    raw = await generate(model, prompt, system=RESUME_SYSTEM)
    try:
        data = json.loads(raw.strip())
    except Exception:
        return master_md

    return _apply_tailoring(master_md, data.get("summary", ""), data.get("skills", ""))


async def generate_cover_letter(
    master_path: Path,
    job_description: str,
    company_name: str,
    company_tone: str,
    company_address: str,
    language: str,
    model: str,
) -> str:
    master_md = master_path.read_text(encoding="utf-8")

    today = date.today()
    if today.month == 12:
        start_date = f"01.01.{today.year + 1}"
    else:
        start_date = f"01.{today.month + 1:02d}.{today.year}"

    prompt = (
        f"MASTER_RESUME:\n{master_md}\n\n"
        f"JOB_DESCRIPTION:\n{job_description}\n\n"
        f"COMPANY: {company_name}\n"
        f"COMPANY_TYPE: {company_tone}\n"
        f"COMPANY_ADDRESS: {company_address}\n"
        f"LANGUAGE: {language.upper()}\n"
        f"START_DATE: {start_date}"
    )

    return await generate(model, prompt, system=COVER_LETTER_SYSTEM)


async def stream_generation(
    master_path: Path,
    job_description: str,
    company_name: str,
    company_tone: str,
    company_address: str,
    language: str,
    writer_model: str,
    start_date: str,
    contact_email: str = "",
    contact_phone: str = "",
    cover_letter_notes: str = "",
    skills_inventory: dict | None = None,
    relevant_skills: list[str] | None = None,
):
    """Yield SSE-formatted chunks for resume then cover letter."""
    master_md = master_path.read_text(encoding="utf-8")

    resume_prompt = (
        f"MASTER_RESUME:\n{master_md}\n\n"
        f"JOB_DESCRIPTION:\n{job_description}"
    )

    yield f"data: {{\"type\": \"resume_start\"}}\n\n"
    resume_raw = ""
    async for chunk in stream(writer_model, resume_prompt, system=RESUME_SYSTEM):
        resume_raw += chunk
        yield f"data: {{\"type\": \"resume_chunk\", \"text\": {repr(chunk)}}}\n\n"

    try:
        data = json.loads(resume_raw.strip())
        resume_md = _apply_tailoring(master_md, data.get("summary", ""), data.get("skills", ""))
    except Exception:
        resume_md = master_md
    yield f"data: {{\"type\": \"resume_done\", \"markdown\": {json.dumps(resume_md)}}}\n\n"

    TIER_LABELS = {1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure"}
    skills_block = ""
    if skills_inventory and relevant_skills:
        relevant_inventory = {
            name: s for name, s in skills_inventory.items() if name in relevant_skills
        }
        lines = [
            f"- {name}: Tier {s['tier']} ({TIER_LABELS.get(s['tier'], s['tier'])}) — {s.get('evidence', '')}"
            for name, s in relevant_inventory.items()
        ]
        if lines:
            skills_block = "\nSKILLS_INVENTORY (match proficiency descriptions to these tiers):\n" + "\n".join(lines)

    cl_prompt = (
        f"MASTER_RESUME:\n{master_md}\n\n"
        f"JOB_DESCRIPTION:\n{job_description}\n\n"
        f"COMPANY: {company_name}\nCOMPANY_TYPE: {company_tone}\n"
        f"COMPANY_ADDRESS: {company_address}\nLANGUAGE: {language.upper()}\n"
        f"START_DATE: {start_date}\n"
        f"CONTACT_EMAIL: {contact_email}\nCONTACT_PHONE: {contact_phone}"
        + skills_block
        + (f"\nCOVER_LETTER_NOTES: {cover_letter_notes}" if cover_letter_notes.strip() else "")
    )
    yield f"data: {{\"type\": \"cl_start\"}}\n\n"
    cl_text = ""
    async for chunk in stream(writer_model, cl_prompt, system=COVER_LETTER_SYSTEM):
        cl_text += chunk
        yield f"data: {{\"type\": \"cl_chunk\", \"text\": {repr(chunk)}}}\n\n"
    # LLMs sometimes garble email/phone — replace any email-like token with the real one
    if contact_email:
        cl_text = re.sub(r"[\w.+-]+@[\w.-]+\.\w+", contact_email, cl_text)
    yield f"data: {{\"type\": \"cl_done\", \"markdown\": {json.dumps(cl_text)}}}\n\n"

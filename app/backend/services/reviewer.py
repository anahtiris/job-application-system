"""Multi-persona review of resume and cover letter drafts.

Always runs the user's persona (data/persona.md) plus 2 randomly selected
from the 4 standard personas. Returns structured review output.
"""
import json
import random
from pathlib import Path

from services.llm import generate

PERSONAS = {
    "faang": {
        "name": "FAANG Recruiter",
        "focus": "signal-to-noise ratio, impact quantification, global readability, bar-raising achievements",
    },
    "german_enterprise": {
        "name": "German Enterprise Hiring Manager",
        "focus": "German market fit, formality, Vita/Anschreiben conventions, certifications, stability over job-hopping",
    },
    "ats": {
        "name": "ATS Parser",
        "focus": "keyword density, parseable structure, no formatting traps, standard section names, parseable dates",
    },
    "engineering_lead": {
        "name": "Skeptical Engineering Lead",
        "focus": "technical depth, credibility of claims, specificity of achievements, absence of buzzword-stuffing",
    },
}

CV_CRITERIA = [
    "ATS Compatibility",
    "Clarity",
    "Impact Orientation",
    "Weak Bullet Points",
    "Repetition",
    "Buzzword Overuse",
    "German Hiring Market",
    "Technical Credibility",
    "Missing Quantified Achievements",
    "Red Flags",
]

CL_CRITERIA = [
    "AIDA Structure",
    "Opening Strength",
    "Clarity & Concision",
    "Weak Paragraphs",
    "Repetition",
    "Buzzword Overuse",
    "German Hiring Market",
    "Technical Credibility",
    "Missing Quantified Impact",
    "Closing Formula",
]

REVIEW_SYSTEM = """You are {persona_name}, reviewing job application documents.
Your focus: {persona_focus}

Score each criterion 1-10 (10 = excellent, 1 = serious problem).
Scores must reflect actual quality — a strong section earns 8-9. Reserve 1-3 for disqualifying problems.
Flag only real issues. Do not manufacture criticism.

REWRITE RULES:
- "original": copy CHARACTER-FOR-CHARACTER from the document. Never paraphrase or shorten. Omit if not found verbatim.
- "rewrite": the replacement sentence ONLY — no comments, no explanations, no meta-text like "This should remain the same" or "No change needed". If you have no better replacement, omit the rewrite entirely.

OUTPUT FORMAT (JSON only, no markdown fences):
{{
  "cv": {{
    "scores": {{"ATS Compatibility": 7, "Clarity": 8, ...}},
    "top_issues": ["issue 1 — be specific about which sentence or section", "issue 2"],
    "rewrites": [{{"original": "verbatim text copied from the document", "rewrite": "replacement sentence only"}}]
  }},
  "cover_letter": {{
    "scores": {{"AIDA Structure": 7, "Opening Strength": 6, ...}},
    "top_issues": ["issue 1 — be specific about which sentence or section", "issue 2"],
    "rewrites": [{{"original": "verbatim text copied from the document", "rewrite": "replacement sentence only"}}]
  }}
}}"""

PERSONA_REVIEW_SYSTEM = """You are the candidate reviewing your own application documents against the MASTER_RESUME.

Your job: flag anything exaggerated, inflated, not grounded in the master resume, or that does not sound like natural first-person voice.

Personal guideline: The candidate has interest and hands-on experience in AI/ML but does NOT position themselves as an AI specialist or AI expert. Flag any claim that implies deep AI specialization.

Scoring (10 = accurate and authentic, 1 = fabricated or seriously inflated):
- 9-10: Claim is accurate, grounded, sounds natural
- 7-8: Minor concern, mostly credible
- 5-6: Noticeable overreach or unnatural phrasing
- 1-4: Contradicts the resume, fabricated, or seriously inflated

CV criteria: Factual Accuracy, Overclaiming, AI Claim Realism, Voice Authenticity, Tense Correctness, No Fabrications, Scope Realism
Cover letter criteria: Factual Accuracy, Overclaiming, AI Claim Realism, Voice Authenticity, Sentence Variety, No Fabrications, Tone Realism

REWRITE RULES:
- "original": copy CHARACTER-FOR-CHARACTER from the document. Never paraphrase or shorten. Omit if not found verbatim.
- "rewrite": the replacement sentence ONLY — no comments, no explanations, no meta-text like "This should remain the same" or "No change needed". If you have no better replacement, omit the rewrite entirely.

OUTPUT FORMAT (JSON only, no markdown fences):
{{
  "cv": {{
    "scores": {{"Factual Accuracy": 8, "Overclaiming": 8, "AI Claim Realism": 9, "Voice Authenticity": 8, "Tense Correctness": 9, "No Fabrications": 9, "Scope Realism": 8}},
    "top_issues": ["describe specifically what is exaggerated or wrong, and where in the document"],
    "rewrites": [{{"original": "verbatim text copied from the document", "rewrite": "replacement sentence only"}}]
  }},
  "cover_letter": {{
    "scores": {{"Factual Accuracy": 8, "Overclaiming": 8, "AI Claim Realism": 9, "Voice Authenticity": 8, "Sentence Variety": 7, "No Fabrications": 9, "Tone Realism": 8}},
    "top_issues": ["describe specifically what does not sound authentic or is inflated, and where"],
    "rewrites": [{{"original": "verbatim text copied from the document", "rewrite": "replacement sentence only"}}]
  }}
}}"""


def _extract_json(raw: str) -> dict:
    """Parse JSON from LLM output, stripping markdown fences if present."""
    text = raw.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    # Find the first { ... } block in case there's preamble text
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


async def _run_review(
    persona_key: str,
    persona_name: str,
    system_template: str,
    resume_md: str,
    cover_letter_md: str,
    master_md: str,
    model: str,
) -> dict:
    system = system_template.format(
        persona_name=persona_name,
        persona_focus=PERSONAS.get(persona_key, {}).get("focus", ""),
    )
    prompt = (
        f"MASTER_RESUME (source of truth):\n{master_md}\n\n"
        f"CV DRAFT:\n{resume_md}\n\n"
        f"COVER LETTER DRAFT:\n{cover_letter_md}"
    )
    raw = await generate(model, prompt, system=system)
    try:
        return {"persona": persona_name, **_extract_json(raw)}
    except Exception:
        return {"persona": persona_name, "cv": {}, "cover_letter": {}, "error": raw[:200]}


def _consolidate(reviews: list[dict], doc_key: str, criteria: list[str]) -> dict:
    """Merge reviews into a consolidated action list for one document."""
    all_issues: list[str] = []
    all_rewrites: list[dict] = []
    score_sums: dict[str, list[int]] = {c: [] for c in criteria}

    for r in reviews:
        doc = r.get(doc_key, {})
        scores = doc.get("scores", {})
        for c in criteria:
            if c in scores:
                score_sums[c].append(scores[c])
        all_issues.extend(doc.get("top_issues", []))
        for rw in doc.get("rewrites", []):
            all_rewrites.append({**rw, "reviewer": r.get("persona", "")})

    avg_scores = {c: round(sum(v) / len(v), 1) if v else None for c, v in score_sums.items()}
    critical = [c for c, s in avg_scores.items() if s is not None and s <= 6]

    return {
        "average_scores": avg_scores,
        "critical_criteria": critical,
        "all_issues": list(dict.fromkeys(all_issues)),  # deduplicate preserving order
        "all_rewrites": all_rewrites,
    }


async def run_review(
    resume_md: str,
    cover_letter_md: str,
    master_path: Path,
    persona_path: Path,
    model: str,
) -> dict:
    master_md = master_path.read_text(encoding="utf-8")
    persona_text = persona_path.read_text(encoding="utf-8") if persona_path.exists() else ""

    selected_keys = random.sample(list(PERSONAS.keys()), 2)
    reviews = []

    # Always run user persona first
    persona_system = PERSONA_REVIEW_SYSTEM
    if persona_text:
        persona_system = f"Additional personal guidelines:\n{persona_text}\n\n" + PERSONA_REVIEW_SYSTEM

    user_review = await _run_review(
        "user", "You (Personal Reviewer)", persona_system,
        resume_md, cover_letter_md, master_md, model,
    )
    reviews.append(user_review)

    # Run 2 random standard personas
    standard_reviews = []
    for key in selected_keys:
        p = PERSONAS[key]
        review = await _run_review(
            key, p["name"], REVIEW_SYSTEM,
            resume_md, cover_letter_md, master_md, model,
        )
        reviews.append(review)
        standard_reviews.append(review)

    return {
        "reviewers": [r["persona"] for r in reviews],
        "persona_review": user_review,
        "standard_reviews": standard_reviews,
        "cv_consolidated": _consolidate(reviews, "cv", CV_CRITERIA),
        "cl_consolidated": _consolidate(reviews, "cover_letter", CL_CRITERIA),
    }

"""Multi-persona review of resume and cover letter drafts.

Always runs the user's persona (data/persona.md) plus 2 randomly selected
from the 4 standard personas. Returns structured review output.
"""
import asyncio
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

# Mirrors skills/cv-review/SKILL.md — keep in sync
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

# Mirrors skills/cv-review/SKILL.md — keep in sync
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


# Mirrors skills/cv-review/SKILL.md — keep in sync
SYNTHESIS_SYSTEM = """You are a synthesis agent reconciling feedback from multiple reviewers
who each independently scored the same CV and cover letter.

You receive each reviewer's top issues and suggested rewrites for both documents.
Your job:

1. Merge near-duplicate issues (different phrasings of the same point) into ONE entry.
   Issues raised by multiple reviewers are more important — rank those higher and
   mark them "high" severity. Order "priority_issues" most-important first.

2. For rewrites, group candidates that target the same (or overlapping) "original" text.
   When reviewers disagree, pick the single best rewrite, or merge the best ideas into
   one improved rewrite. Output ONE rewrite per distinct "original".

HARD RULE: every "original" you output must be copied CHARACTER-FOR-CHARACTER from one
of the input candidates' "original" fields. Never invent or alter "original" text.

OUTPUT FORMAT (JSON only, no markdown fences):
{
  "cv": {
    "priority_issues": [{"issue": "...", "severity": "high|medium|low", "sources": ["FAANG Recruiter", "..."]}],
    "rewrites": [{"original": "verbatim from a candidate", "rewrite": "resolved replacement", "sources": ["FAANG Recruiter", "..."]}]
  },
  "cover_letter": {
    "priority_issues": [{"issue": "...", "severity": "high|medium|low", "sources": ["FAANG Recruiter", "..."]}],
    "rewrites": [{"original": "verbatim from a candidate", "rewrite": "resolved replacement", "sources": ["FAANG Recruiter", "..."]}]
  }
}"""


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


def _validated_rewrites(synth_rewrites: list[dict], candidates: list[dict]) -> list[dict]:
    """Keep only synthesized rewrites whose 'original' matches a candidate verbatim."""
    valid_originals = {c.get("original") for c in candidates if c.get("original")}
    return [rw for rw in synth_rewrites if rw.get("original") in valid_originals and rw.get("rewrite")]


async def _synthesize(reviews: list[dict], cv_consolidated: dict, cl_consolidated: dict, model: str) -> dict:
    """Reconcile the independent persona reviews into prioritized issues + resolved rewrites."""
    payload = {
        "reviewers": [
            {
                "persona": r.get("persona", ""),
                "cv": {
                    "top_issues": r.get("cv", {}).get("top_issues", []),
                    "rewrites": r.get("cv", {}).get("rewrites", []),
                },
                "cover_letter": {
                    "top_issues": r.get("cover_letter", {}).get("top_issues", []),
                    "rewrites": r.get("cover_letter", {}).get("rewrites", []),
                },
            }
            for r in reviews
        ],
        "cv_scores": {
            "average_scores": cv_consolidated["average_scores"],
            "critical_criteria": cv_consolidated["critical_criteria"],
        },
        "cover_letter_scores": {
            "average_scores": cl_consolidated["average_scores"],
            "critical_criteria": cl_consolidated["critical_criteria"],
        },
    }
    prompt = json.dumps(payload, indent=2)
    try:
        raw = await generate(model, prompt, system=SYNTHESIS_SYSTEM)
        return _extract_json(raw)
    except Exception:
        return {}


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

    persona_system = PERSONA_REVIEW_SYSTEM
    if persona_text:
        persona_system = f"Additional personal guidelines:\n{persona_text}\n\n" + PERSONA_REVIEW_SYSTEM

    coros = [
        _run_review("user", "You (Personal Reviewer)", persona_system,
                    resume_md, cover_letter_md, master_md, model),
        *[
            _run_review(key, PERSONAS[key]["name"], REVIEW_SYSTEM,
                        resume_md, cover_letter_md, master_md, model)
            for key in selected_keys
        ],
    ]
    results = await asyncio.gather(*coros)

    user_review = results[0]
    standard_reviews = list(results[1:])
    reviews = list(results)

    cv_consolidated = _consolidate(reviews, "cv", CV_CRITERIA)
    cl_consolidated = _consolidate(reviews, "cover_letter", CL_CRITERIA)

    synthesis = await _synthesize(reviews, cv_consolidated, cl_consolidated, model)
    if synthesis.get("cv"):
        cv_consolidated["priority_issues"] = synthesis["cv"].get("priority_issues", [])
        cv_consolidated["resolved_rewrites"] = _validated_rewrites(
            synthesis["cv"].get("rewrites", []), cv_consolidated["all_rewrites"]
        )
    if synthesis.get("cover_letter"):
        cl_consolidated["priority_issues"] = synthesis["cover_letter"].get("priority_issues", [])
        cl_consolidated["resolved_rewrites"] = _validated_rewrites(
            synthesis["cover_letter"].get("rewrites", []), cl_consolidated["all_rewrites"]
        )

    return {
        "reviewers": [r["persona"] for r in reviews],
        "persona_review": user_review,
        "standard_reviews": standard_reviews,
        "cv_consolidated": cv_consolidated,
        "cl_consolidated": cl_consolidated,
    }

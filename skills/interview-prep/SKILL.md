---
name: interview-prep
description: Web-researched, 7-field interview preparation for an application. Drives the "Interview prep — Claude path" in CLAUDE.md.
---
# Skill: Interview Preparation

**Description**: Produce the `interview_prep_json` object for an application's
Interview tab — Company Analysis grounded in real web research plus six
candidate-facing fields (script, Q&A, gaps, questions to ask, salary).

## Inputs to read first

- `GET http://localhost:8000/api/tracker/{id}` — `company`, `job_title`,
  `job_description`, `language`, `company_tone`, `resume_final` (tailored CV),
  `cover_letter_final`.
- `resume_master.md` / `resume_master_de.md` — fall back to this if `resume_final`
  is empty (no tailored CV generated yet).
- `data/skills.json` — tier + evidence per skill.
- `data/career_goal.md` — career direction, for framing "why this role" angles.
- `data/persona.md` — personal red lines and tone (e.g. how to frame ownership and
  contribution claims). Apply these throughout, especially in the Introduction
  Script and Common Questions answers.

## Parameters (from the "Copy prompt for Claude" button)

- `ROUND_ID`: the id of the interview round this prep is for (a round already
  exists — created via "+ Add Round" in the workspace before this prompt is
  copied). Save into that round, not a new one.
- `INTERVIEW_ROUND`: Screening | Technical | Final — controls depth/breadth of
  Job-Specific Questions (Screening = broader, Technical = deeper, Final = system
  design + culture).
- `INTERVIEWER_TYPE`: HR | Hiring Manager | Technical Peer — adapts the
  Introduction Script register and the Questions to Ask angle.
- `FOCUS_SKILLS` (optional): weight Job-Specific Questions toward these.

## Web research (Company Analysis only)

Search for the company: recent news, funding/stage, tech stack mentions, and
culture/sentiment (review sites, engineering blog, LinkedIn posts). Cite sources
inline. If a fact can't be found, say "no reliable data found" for that point —
**never invent reviews, funding, headcount, or salary numbers**. This is the key
difference from the offline Ollama path, which has no web access and must label
everything "(inferred — verify)" — here, real findings replace that label.

## Output: a single JSON object (no markdown)

Build one JSON object in this exact shape, written in the application's `language`
(EN = English, DE = German). Leave every `id` empty — the server assigns ids.

```json
{
  "company_analysis": "4-6 markdown bullets, web-researched with cited sources",
  "introduction_script": "60-90s spoken intro",
  "common_questions":      [{ "id": "", "q": "Tell me about yourself", "a": "2-4 sentence answer grounded in the CV" }],
  "job_specific_questions": [{ "id": "", "q": "role/technical question", "a": "- talking-point bullet\n- another bullet" }],
  "weak_spots":            [{ "id": "", "q": "likely probe question", "a": "honest answer owning the gap + transferable strength" }],
  "questions_to_ask":      [{ "id": "", "text": "question for the candidate to ask" }],
  "salary": "rough market-range note + a 2-3 sentence answer script"
}
```

The per-field content rules below are unchanged (counts, grounding, honesty,
persona); only the container is now JSON fields instead of `## ` sections.

1. **`company_analysis`** — 4-6 bullets: what the company builds, stage/size,
   tech stack, culture signals — grounded in web research with cited sources.
   Supplement with JD/COMPANY_TYPE details where research is thin.
2. **`introduction_script`** — 60-90 seconds read aloud: open with a concrete
   shipped result from the tailored CV / master résumé, pivot to why this role
   (use `career_goal.md` for the angle), close with one forward-looking line.
   Draw on the tailored CV and cover letter so the pitch matches what was
   actually submitted. Adapt register to `INTERVIEWER_TYPE` (HR = simpler,
   Hiring Manager = impact, Technical Peer = technical credibility).
3. **`common_questions`** — 6-8 near-universal questions ("tell me about
   yourself", "why this company", "greatest strength", "biggest weakness",
   "where in 5 years", "why leaving / why now", "a conflict or failure"). For
   each item: `q` is the question, `a` is a 2-4 sentence sample answer grounded
   only in facts from the tailored CV / master résumé.
4. **`job_specific_questions`** — 8-10 technical/role questions drawn from JD
   keywords and the stack; adapt depth to `INTERVIEW_ROUND`, weight toward
   `FOCUS_SKILLS` if provided. For each item: `q` is the question, `a` is short
   talking-point bullets (a few lines each starting with `- `), not prose.
5. **`weak_spots`** — 3-5 places where the JD asks for something the résumé
   doesn't strongly support (missing skill, thin/recent experience, a gap). For
   each item: `q` is the likely probe question, `a` is a truthful framing that
   owns the gap and names a transferable strength. Never suggest bluffing or
   upgrading a claim. Skills that are recent (<12 months) or from a side project
   must be described as "recent" / "exploring", never deep experience.
6. **`questions_to_ask`** — 8-10 items, each with a `text` field; specific to the
   company/role; adapt to `INTERVIEWER_TYPE` (HR = culture/process, Technical
   Peer = engineering practices, Hiring Manager = team/vision).
7. **`salary`** — a brief market-range note (state plainly it's
   a rough estimate to verify — web research can sharpen this) and a 2-3 sentence
   script for answering "what are your salary expectations?" with a range and one
   anchoring sentence.

## Rules

- Follow `data/persona.md` for how to frame ownership, scope, and contribution —
  it takes precedence over generic phrasing.
- Never fabricate résumé facts, metrics, company details, or salary numbers not
  derivable from the inputs or cited research.
- The Skills Debrief (`interview_debrief_md`) is a separate, parameter-free
  generation — not part of this skill.

## Save

`PUT http://localhost:8000/api/application/{id}/interview-prep` with body
`{"round_id": ROUND_ID, "prep": { …the JSON object above… }}`
(Content-Type: application/json). The server fills any blank `id`s within `prep`
and returns `{"saved": true, "prep": { … }}`.

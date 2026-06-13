---
name: skill-assessment
description: How to build a tiered skills inventory from a résumé, interviewing the user on anything ambiguous.
---
# Skill: Skills Assessment

**Description**: Turn the master résumé into a tiered `data/skills.json` inventory,
asking the user interview-style questions when the evidence is thin. Drives the
"process my skills" flow in CLAUDE.md.

## Inputs to read first
- `resume_master.md` (or `resume_master_de.md`) — the canonical résumé.
- `data/skills.json` — the existing inventory (may be empty). Do NOT overwrite the
  user's curated entries; the backend merge keeps them.
- `data/career_goal.md` — context for which skills matter most.

## Tiers (assign 1–4)
- **1 Core**: 3+ production projects, recent, owned end-to-end
- **2 Proficient**: 2+ projects, contributed meaningfully, mostly independent
- **3 Familiar**: 1 project or did not own it, needs ramp-up
- **4 Exposure**: tutorials only, never shipped, or 3+ years ago

## Procedure
1. Pull every concrete skill from the WHOLE résumé (experience bullets included), not
   just a skills list.
2. For each, draft a tier + one evidence sentence grounded ONLY in the résumé. Never
   fabricate skills, projects, or durations.
3. **Interview the user** about genuinely ambiguous skills — batch the questions, do
   not go skill-by-skill. Ask only where the résumé can't settle the tier, e.g.:
   - "Your CV lists Kubernetes once in 2021 — tutorials, or shipped to production?"
   - "Is Go something you've owned end-to-end, or explored in a side project?"
   Surface skills the user mentions in answers that weren't on the résumé.
4. Apply the answers to finalise tier + evidence.
5. Save via `POST http://localhost:8000/api/resume/skills/merge` with body
   `{"skills": {"SkillName": {"tier": 1, "evidence": "...", "needs_review": false}}}`.
   The backend merges keep-my-edits and persists. Confirm the count back to the user.

## Never
- Never invent experience to justify a higher tier.
- Never label a recent or side-project skill as "extensive"/"expert".

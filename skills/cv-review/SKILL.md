---
name: cv-review
description: Multi-persona review of a tailored CV or cover letter draft before document generation. Scores 10 criteria, provides concrete rewrites, and produces a consolidated action list.
---
# Skill: Document Review (CV & Cover Letter)

## Reviewer Personas

Randomly select **2 of the 4 reviewers** for each application (use any non-deterministic method — state which were selected).

| ID | Persona | Optimises for |
|---|---|---|
| **A** | FAANG Recruiter | Signal-to-noise ratio, impact quantification, global readability, bar-raising achievements |
| **B** | German Enterprise Hiring Manager | German market fit, formality, Vita/Anschreiben conventions, relevant certifications, stability over job-hopping |
| **C** | ATS Parser | Keyword density, clean structure, no formatting traps, standard section names, parseable dates |
| **D** | Skeptical Engineering Lead | Technical depth, credibility of claims, specificity of achievements, absence of buzzword-stuffing, evidence of hands-on work |

The same two randomly selected reviewers review both documents in the same application run.

---

## CV Review Criteria

Score each **1–10** (10 = excellent, 1 = serious problem):

| # | Category | What to assess |
|---|---|---|
| 1 | **ATS Compatibility** | Keyword match to JD, parseable structure, no formatting traps |
| 2 | **Clarity** | Every sentence immediately understandable on first read |
| 3 | **Impact Orientation** | Shows outcomes and results, not just duties |
| 4 | **Weak Bullet Points** | Bullets that describe tasks with no evidence of result |
| 5 | **Repetition** | Repeated words, phrases, or themes across sections |
| 6 | **Buzzword Overuse** | Empty words: passionate, dynamic, results-driven, innovative, etc. |
| 7 | **German Hiring Market** | Appropriate formality, Lebenslauf conventions, Eintrittstermin present |
| 8 | **Technical Credibility** | Are technical claims specific enough to survive a follow-up interview question? |
| 9 | **Missing Quantified Achievements** | Bullets that could carry a number but don't |
| 10 | **Red Flags** | Unexplained gaps, title inflation, vague tenure, anything that triggers recruiter doubt |

---

## Cover Letter Review Criteria

Score each **1–10** (10 = excellent, 1 = serious problem):

| # | Category | What to assess |
|---|---|---|
| 1 | **AIDA Structure** | Does the letter follow Attention → Interest+Desire → Action with clear transitions? |
| 2 | **Opening Strength** | Does the opening immediately connect to the specific role and company type (direct/contractor/agency)? Avoids generic openers. |
| 3 | **Clarity & Concision** | No sentence longer than needed; every sentence adds information |
| 4 | **Weak Paragraphs** | Paragraphs that describe responsibilities without a result or outcome |
| 5 | **Repetition** | Repeated words, phrases, or themes — especially between the CV and letter |
| 6 | **Buzzword Overuse** | Empty words: passionate, motivated, team player, dynamic, etc. |
| 7 | **German Hiring Market** | Appropriate Anrede, formal register if DE, Eintrittstermin in closing, no "ab sofort" |
| 8 | **Technical Credibility** | Technical claims are specific enough; matches what's in the CV |
| 9 | **Missing Quantified Impact** | Paragraphs that could carry a number or outcome but don't |
| 10 | **Closing Formula** | Contains an explicit availability date (`01.MM.YYYY`) and a call to action with contact details |

---

## Output Format

Run each selected reviewer independently. For each document:

```
## Reviewer [X] — [Persona Name]: CV

| # | Category | Score | Notes |
|---|---|---|---|
| 1 | ... | X/10 | ... |
...
| | **Overall** | X/10 | |

### Top 3 Issues
1. ...

### Concrete Rewrites
**Original**: "..."
**Rewrite**: "..."

---

## Reviewer [X] — [Persona Name]: Cover Letter

| # | Category | Score | Notes |
|---|---|---|---|
| 1 | ... | X/10 | ... |
...
| | **Overall** | X/10 | |

### Top 3 Issues
1. ...

### Concrete Rewrites
**Original**: "..."
**Rewrite**: "..."
```

After both reviewers have reviewed both documents, produce:

```
## Consolidated Action List — CV

Critical issues (score ≤ 6) from both reviewers, deduplicated and ranked by impact:
1. [Issue] — flagged by Reviewer X (and Y if both)
...

## Revised CV Draft

[Full updated resume markdown incorporating all consolidated CV rewrites]

---

## Consolidated Action List — Cover Letter

Critical issues (score ≤ 6) from both reviewers, deduplicated and ranked by impact:
1. ...

## Revised Cover Letter Draft

[Full updated cover letter markdown incorporating all consolidated cover letter rewrites]
```

---

## Rules

- Scores must reflect actual quality. A well-written section should score 8–9. Reserve 9–10 for genuinely exceptional work; reserve 1–3 for serious, disqualifying problems.
- Only flag real issues. Do not manufacture criticism to fill a quota. If a section is strong, say so and move on.
- Rewrites must be concrete — show the exact replacement text, not suggestions.
- The Revised Drafts must be complete and ready to use directly in document generation — not partial excerpts.
- If a document has fewer than 3 genuine issues, the Consolidated Action List reflects that honestly. Do not pad it.

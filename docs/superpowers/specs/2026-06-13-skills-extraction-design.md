# Skills Extraction — Design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)

## Problem

Setting up the skills inventory (`data/skills.json`) is fully manual today: after a
user uploads their résumé on `/setup`, they must hand-add every skill on `/skills`,
choosing a tier (1 Core / 2 Proficient / 3 Familiar / 4 Exposure) and writing
evidence for each. This is tedious and the most-skipped setup step.

We want to bootstrap the inventory **from the résumé** using the project's existing
dual-path convention:

- **Claude path** — a "Copy prompt for Claude" button copies an instruction; the user
  pastes it into Claude Code, which reads the résumé, **interviews the user about
  anything ambiguous**, and writes the result back.
- **Ollama path** — a one-shot offline model call that extracts and tiers skills
  without interaction.

## Goals

- After résumé upload, the user can generate a tiered skills inventory via either path.
- Re-running extraction never destroys manual edits (merge, keep-my-edits).
- The Ollama path flags low-confidence guesses for human review.
- The Claude path resolves ambiguity by interviewing the user (in the Claude Code chat).

## Non-goals (YAGNI)

- A full multi-step setup wizard.
- Per-language skill inventories (skills.json stays single, language-agnostic).
- A conflict-resolution UI (we chose keep-my-edits, not show-conflicts).

## Decisions

| Decision | Choice |
|---|---|
| Entry points | **Both** `/setup` (after upload) and `/skills` (topbar action) |
| Merge policy | **Merge, keep my edits** — new skills added; existing tier/evidence preserved |
| Ollama uncertainty | **Best-guess + flag** — conservative tier, `needs_review` set, noted in evidence |
| Merge logic location | **Shared backend** — one endpoint both paths use |
| Interview location | **Claude Code chat** when the prompt is pasted — not a UI in the app |

## Architecture

The dual-path convention already exists (interview-prep, captured-jobs). This mirrors it.

### Data model

`data/skills.json` skill entries gain an optional flag:

```json
{
  "last_updated": "2026-06-13",
  "skills": {
    "TypeScript": { "tier": 1, "evidence": "..." },
    "Kubernetes": { "tier": 4, "evidence": "Listed once in 2021; tier guessed.", "needs_review": true }
  }
}
```

`needs_review` absent ⇒ confident. Backwards-compatible: existing files just lack it.

### Backend

**New service** `app/backend/services/skill_extractor.py`

```
async def extract_skills(master_md: str, existing: dict, model: str) -> dict
```

Prompts the model to pull skills from the **whole** résumé (including experience
bullets), tier each 1–4 with concrete evidence, and mark low-confidence skills
`needs_review: true`. Reuses the JSON-sanitisation pattern from the other services
(strip markdown fences, extract the `{...}` block, `json.loads`). Returns
`{skillName: {tier, evidence, needs_review?}}`. Never fabricates skills not supported
by the résumé text.

**Merge helper** in `skill_extractor.py` (pure function, unit-tested):

```
def merge_skills(existing: dict, incoming: dict) -> dict
```

Keep-my-edits rule: for each incoming skill, if the name already exists in `existing`,
**keep the existing entry unchanged**; otherwise add the incoming entry. New entries
carry their `needs_review` flag through.

**New endpoints** on `/api/resume` (`routers/resume.py`):

- `POST /skills/extract` — **Ollama path.** Loads the current master résumé (EN
  preferred, fall back to DE), runs `extract_skills` with `model("research")` (the
  role already used for the analogous extract-captured / analyze-JD text-analysis
  tasks), merges into `skills.json` via `merge_skills`, writes the file, returns the
  merged inventory. 404 if no master résumé exists.
- `POST /skills/merge` — **shared write-back** for the Claude path. Body `{skills: {...}}`.
  Merges keep-my-edits into `skills.json`, writes, returns the merged inventory.

The existing `PUT /skills` (full replace) is unchanged — it remains what the manual
`/skills` editor uses.

### New skill: `skills/skill-assessment/SKILL.md`

Self-contained instruction set for the Claude path. Instructs Claude to:

1. Read the master résumé (`resume_master.md` / `_de.md`), `data/skills.json`
   (existing inventory), and `data/career_goal.md`.
2. Draft a tier (1–4) + evidence for each skill, grounded **only** in résumé/inventory
   evidence — never fabricate.
3. **Batch interview-style questions** for genuinely ambiguous skills only (thin or
   stale evidence). Example: "Your CV lists Kubernetes once in 2021 — tutorials, or
   shipped to production?" Ask several at once; do not interrogate skill-by-skill.
4. Apply the user's answers to finalise tier + evidence.
5. `POST /api/resume/skills/merge` with the result.

Tier criteria are copied verbatim from the `/skills` UI legend:
- **Core (1):** 3+ production projects, recent, owned end-to-end
- **Proficient (2):** 2+ projects, contributed meaningfully, mostly independent
- **Familiar (3):** 1 project or didn't own it, needs ramp-up
- **Exposure (4):** tutorials only, never shipped, or 3+ years ago

### CLAUDE.md

New **"process my skills"** section, mirroring "process my captured jobs": the trigger
phrase, the read → draft → interview → write-back flow, and a pointer to
`skills/skill-assessment/SKILL.md`. Emphasises the interview step and **never
fabricate**.

### Frontend

**`/setup`** — a "Skills" block under the parsed résumé, shown only when a master
résumé exists, with two buttons:
- **Copy prompt for Claude** — copies the prompt (below).
- **Extract with Ollama** — calls `POST /api/resume/skills/extract`, toasts the count,
  links to `/skills`.

**`/skills`** — topbar gains an **"Extract from résumé ▾"** action with the same two
options. The page's `Skill` interface gains an optional `needsReview` field and
**round-trips it**: it's loaded from `skills.json`, preserved for untouched rows, and
cleared **only for the row the user saves via Edit**. Rows with `needsReview` show a
small amber **review** chip. Because `PUT /skills` is a full replace, the client must
send `needs_review` back for rows that still carry it — otherwise a single manual
save would wipe every flag. (So `PUT /skills` persists whatever the UI holds,
including flags; it does not unconditionally clear them.)

**Claude-path prompt** (both buttons copy the same text):

> Build my skills inventory from my résumé — follow the "process my skills" steps in
> CLAUDE.md (read the master résumé, interview me on anything ambiguous, then POST
> /api/resume/skills/merge).

## Data flow

```
Ollama path:
  /setup or /skills  →  POST /api/resume/skills/extract
    → load master résumé  → extract_skills (model)  → merge_skills(existing, extracted)
    → write skills.json  → return merged  → UI refresh (review chips on flagged rows)

Claude path:
  Copy prompt for Claude  →  user pastes in Claude Code
    → Claude reads résumé + skills.json + career_goal
    → drafts tiers  → interviews user on ambiguous skills (chat)
    → POST /api/resume/skills/merge  → backend merge_skills → write skills.json
    → user reviews on /skills
```

## Error handling

- `POST /skills/extract` with no master résumé → 404 ("Upload a résumé first").
- Model returns unparseable JSON → service returns `{}` (logged); endpoint reports
  "no skills extracted" rather than 500.
- `merge_skills` is pure and total; empty incoming → inventory unchanged.

## Testing

- `skill_extractor`: JSON sanitisation (fenced / trailing-comma / wrapped output →
  parsed dict); fabrication guard is prompt-level (not unit-tested).
- `merge_skills` (pure): new skills added; existing tier/evidence preserved on
  collision; `needs_review` carried through on new, never forced onto existing.
- Endpoints via TestClient: `POST /skills/merge` merges keep-my-edits; `PUT /skills`
  full-replaces with exactly the payload sent (including any `needs_review` flags);
  `POST /skills/extract` 404s without a résumé.

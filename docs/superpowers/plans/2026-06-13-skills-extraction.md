# Skills Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `data/skills.json` inventory from the master résumé via two paths — an offline Ollama one-shot and a "Copy prompt for Claude" interview flow — merging into existing skills without destroying manual edits.

**Architecture:** Mirror the established dual-path convention (Ollama `POST` endpoint + "Copy prompt for Claude" button + write-back `POST`). A new pure `skill_extractor` service holds extraction (model call + JSON sanitisation) and a keep-my-edits `merge_skills`. Both paths funnel through shared backend merge + write helpers. A new `skill-assessment` SKILL.md and a CLAUDE.md "process my skills" section drive the Claude path.

**Tech Stack:** FastAPI + SQLModel (backend), pytest + TestClient (tests), Next.js 16 / React 19 (frontend).

---

## File Structure

- **Create** `app/backend/services/skill_extractor.py` — `extract_skills()` (model call + sanitise + normalise), `merge_skills()` (pure, keep-my-edits).
- **Create** `app/backend/tests/test_skill_extractor.py` — unit tests for `merge_skills` and `extract_skills` sanitisation/normalisation.
- **Modify** `app/backend/routers/resume.py` — add `_read_skills_dict`/`_write_skills_dict` helpers, refactor `save_skills` onto them, add `POST /skills/extract` and `POST /skills/merge`.
- **Create** `app/backend/tests/test_skills_api.py` — TestClient tests for the two new endpoints.
- **Create** `skills/skill-assessment/SKILL.md` — Claude-path instruction set.
- **Modify** `CLAUDE.md` — add "process my skills" section.
- **Create** `app/frontend/lib/prompts.ts` — shared `SKILLS_PROMPT` constant.
- **Modify** `app/frontend/app/setup/page.tsx` — Skills CTA block (two buttons) under the parsed résumé.
- **Modify** `app/frontend/app/skills/page.tsx` — topbar extract buttons + `needsReview` round-trip + amber review chip.

---

## Task 1: `merge_skills` (pure, keep-my-edits)

**Files:**
- Create: `app/backend/services/skill_extractor.py`
- Test: `app/backend/tests/test_skill_extractor.py`

- [ ] **Step 1: Write the failing test**

```python
# app/backend/tests/test_skill_extractor.py
from services.skill_extractor import merge_skills


def test_merge_adds_new_skills():
    existing = {"TypeScript": {"tier": 1, "evidence": "x"}}
    incoming = {"React": {"tier": 2, "evidence": "y"}}
    merged = merge_skills(existing, incoming)
    assert merged["TypeScript"] == {"tier": 1, "evidence": "x"}
    assert merged["React"] == {"tier": 2, "evidence": "y"}


def test_merge_keeps_existing_on_collision():
    existing = {"Python": {"tier": 1, "evidence": "owned it"}}
    incoming = {"Python": {"tier": 4, "evidence": "guessed", "needs_review": True}}
    merged = merge_skills(existing, incoming)
    assert merged["Python"] == {"tier": 1, "evidence": "owned it"}


def test_merge_carries_needs_review_on_new_skill():
    merged = merge_skills({}, {"Go": {"tier": 3, "evidence": "g", "needs_review": True}})
    assert merged["Go"]["needs_review"] is True


def test_merge_empty_incoming_unchanged():
    existing = {"TypeScript": {"tier": 1, "evidence": "x"}}
    assert merge_skills(existing, {}) == existing


def test_merge_does_not_mutate_existing():
    existing = {"TypeScript": {"tier": 1, "evidence": "x"}}
    merge_skills(existing, {"React": {"tier": 2, "evidence": "y"}})
    assert "React" not in existing
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest tests/test_skill_extractor.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.skill_extractor'`

- [ ] **Step 3: Write minimal implementation**

```python
# app/backend/services/skill_extractor.py
"""Extract a tiered skills inventory from the master résumé and merge it
into the existing inventory without overwriting manual edits."""


def merge_skills(existing: dict, incoming: dict) -> dict:
    """Keep-my-edits merge: add skills from `incoming` that are not already in
    `existing`; on a name collision the existing entry is kept unchanged."""
    merged = dict(existing)
    for name, entry in incoming.items():
        if name not in merged:
            merged[name] = entry
    return merged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest tests/test_skill_extractor.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add app/backend/services/skill_extractor.py app/backend/tests/test_skill_extractor.py
git commit -m "feat(backend): add merge_skills keep-my-edits helper"
```

---

## Task 2: `extract_skills` (model call + sanitise + normalise)

**Files:**
- Modify: `app/backend/services/skill_extractor.py`
- Test: `app/backend/tests/test_skill_extractor.py`

- [ ] **Step 1: Write the failing test**

Append to `app/backend/tests/test_skill_extractor.py`:

```python
import services.skill_extractor as se


async def test_extract_parses_fenced_json(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '```json\n{"TypeScript": {"tier": 1, "evidence": "5y prod", "needs_review": false}}\n```'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("# résumé", {}, "ollama/x")
    assert out["TypeScript"]["tier"] == 1
    assert out["TypeScript"]["evidence"] == "5y prod"
    assert out["TypeScript"]["needs_review"] is False


async def test_extract_coerces_and_clamps_tier(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '{"A": {"tier": "2", "evidence": "e"}, "B": {"tier": 9}, "C": {"evidence": "e"}}'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("r", {}, "m")
    assert out["A"]["tier"] == 2          # string coerced to int
    assert out["B"]["tier"] == 4          # clamped into 1..4
    assert out["C"]["tier"] == 3          # missing -> default 3


async def test_extract_defaults_needs_review_false(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return '{"A": {"tier": 2, "evidence": "e"}}'
    monkeypatch.setattr(se, "generate", fake_generate)
    out = await se.extract_skills("r", {}, "m")
    assert out["A"]["needs_review"] is False


async def test_extract_unparseable_returns_empty(monkeypatch):
    async def fake_generate(model, prompt, system=""):
        return "I could not produce JSON."
    monkeypatch.setattr(se, "generate", fake_generate)
    assert await se.extract_skills("r", {}, "m") == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest tests/test_skill_extractor.py -k extract -v`
Expected: FAIL — `AttributeError: module 'services.skill_extractor' has no attribute 'generate'` / `extract_skills`

- [ ] **Step 3: Write minimal implementation**

Add to the top and body of `app/backend/services/skill_extractor.py`:

```python
import json
import logging
import re

from services.llm import generate

logger = logging.getLogger(__name__)

EXTRACT_SYSTEM = """You build a candidate's skills inventory from their résumé.

Read the WHOLE résumé — including experience bullets, not just a skills list. For
each concrete technical or professional skill, assign a tier and write one short
evidence sentence grounded ONLY in the résumé. Never invent skills or experience.

TIERS:
- 1 Core: 3+ production projects, recent, owned end-to-end
- 2 Proficient: 2+ projects, contributed meaningfully, mostly independent
- 3 Familiar: 1 project or did not own it, needs ramp-up
- 4 Exposure: tutorials only, never shipped, or 3+ years ago

If the résumé evidence is too thin to place a skill confidently, pick the most
conservative plausible tier and set "needs_review": true.

EXISTING_INVENTORY lists skills the user already curated — you may still list them,
but focus on surfacing skills not yet captured.

OUTPUT JSON only, no markdown fences, shape:
{ "SkillName": { "tier": 1, "evidence": "...", "needs_review": false }, ... }"""


def _sanitise(raw: str) -> dict:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return {}
    text = re.sub(r",\s*([}\]])", r"\1", m.group())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Skill extraction returned unparseable JSON", exc_info=True)
        return {}


def _normalise(entry: dict) -> dict:
    try:
        tier = int(entry.get("tier", 3))
    except (TypeError, ValueError):
        tier = 3
    tier = max(1, min(4, tier))
    return {
        "tier": tier,
        "evidence": str(entry.get("evidence", "")).strip(),
        "needs_review": bool(entry.get("needs_review", False)),
    }


async def extract_skills(master_md: str, existing: dict, model: str) -> dict:
    """Return {name: {tier, evidence, needs_review}} extracted from the résumé."""
    prompt = (
        f"EXISTING_INVENTORY:\n{json.dumps(list(existing.keys()))}\n\n"
        f"RÉSUMÉ:\n{master_md}"
    )
    raw = await generate(model, prompt, system=EXTRACT_SYSTEM)
    parsed = _sanitise(raw)
    return {
        name: _normalise(entry)
        for name, entry in parsed.items()
        if isinstance(entry, dict) and str(name).strip()
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest tests/test_skill_extractor.py -v`
Expected: PASS (9 passed — 5 from Task 1, 4 here)

- [ ] **Step 5: Commit**

```bash
git add app/backend/services/skill_extractor.py app/backend/tests/test_skill_extractor.py
git commit -m "feat(backend): add résumé skill extraction with JSON sanitisation"
```

---

## Task 3: Backend endpoints (`/skills/extract`, `/skills/merge`)

**Files:**
- Modify: `app/backend/routers/resume.py`
- Test: `app/backend/tests/test_skills_api.py`

- [ ] **Step 1: Write the failing test**

```python
# app/backend/tests/test_skills_api.py
import json

import services.skill_extractor as se
import routers.resume as resume


def _seed_skills(path, skills):
    path.write_text(json.dumps({"last_updated": "2026-01-01", "skills": skills}), encoding="utf-8")


def test_merge_endpoint_keeps_existing_edits(client, tmp_path, monkeypatch):
    skills_file = tmp_path / "skills.json"
    _seed_skills(skills_file, {"TypeScript": {"tier": 1, "evidence": "mine"}})
    monkeypatch.setattr(resume, "SKILLS", skills_file)

    r = client.post("/api/resume/skills/merge", json={
        "skills": {"TypeScript": {"tier": 4, "evidence": "guess"}, "React": {"tier": 2, "evidence": "y"}}
    })
    assert r.status_code == 200
    out = r.json()["skills"]
    assert out["TypeScript"] == {"tier": 1, "evidence": "mine"}  # kept
    assert out["React"]["tier"] == 2                              # added


def test_extract_404_without_resume(client, tmp_path, monkeypatch):
    monkeypatch.setattr(resume, "MASTER_EN", tmp_path / "none_en.md")
    monkeypatch.setattr(resume, "MASTER_DE", tmp_path / "none_de.md")
    assert client.post("/api/resume/skills/extract").status_code == 404


def test_extract_merges_into_existing(client, tmp_path, monkeypatch):
    master = tmp_path / "master.md"
    master.write_text("# Experience\nBuilt things in Python.", encoding="utf-8")
    monkeypatch.setattr(resume, "MASTER_EN", master)
    skills_file = tmp_path / "skills.json"
    _seed_skills(skills_file, {"TypeScript": {"tier": 1, "evidence": "mine"}})
    monkeypatch.setattr(resume, "SKILLS", skills_file)

    async def fake_extract(master_md, existing, model):
        return {"Python": {"tier": 3, "evidence": "side project", "needs_review": True}}
    monkeypatch.setattr(se, "extract_skills", fake_extract)

    out = client.post("/api/resume/skills/extract").json()["skills"]
    assert out["TypeScript"]["tier"] == 1          # preserved
    assert out["Python"]["needs_review"] is True   # added + flagged
    # persisted to disk
    saved = json.loads(skills_file.read_text())["skills"]
    assert "Python" in saved


def test_put_skills_persists_payload_verbatim(client, tmp_path, monkeypatch):
    skills_file = tmp_path / "skills.json"
    monkeypatch.setattr(resume, "SKILLS", skills_file)
    client.put("/api/resume/skills", json={
        "skills": {"Go": {"tier": 3, "evidence": "e", "needs_review": True}}
    })
    saved = json.loads(skills_file.read_text())["skills"]
    assert saved["Go"]["needs_review"] is True  # full-replace keeps the flag the client sent
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest tests/test_skills_api.py -v`
Expected: FAIL — 404/405 on the new routes (not yet defined)

- [ ] **Step 3: Write minimal implementation**

In `app/backend/routers/resume.py`, change the config import line:

```python
from config import CONFIG, Paths, model
```

Add the service import next to the existing `from services.parser import parse_resume`:

```python
from services import skill_extractor
```

Replace the existing `get_skills` / `save_skills` block (lines ~90–106) with helpers + reuse, and append the two new endpoints:

```python
class SkillsRequest(BaseModel):
    skills: dict


def _read_skills_dict() -> dict:
    if not SKILLS.exists():
        return {}
    try:
        return json.loads(SKILLS.read_text(encoding="utf-8")).get("skills", {})
    except Exception:
        return {}


def _write_skills_dict(skills: dict) -> None:
    SKILLS.parent.mkdir(parents=True, exist_ok=True)
    data = {"last_updated": date.today().isoformat(), "skills": skills}
    SKILLS.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


@router.get("/skills")
def get_skills():
    return {"skills": _read_skills_dict()}


@router.put("/skills")
def save_skills(body: SkillsRequest):
    _write_skills_dict(body.skills)
    return {"saved": True}


@router.post("/skills/extract")
async def extract_skills_endpoint():
    if MASTER_EN.exists():
        master_md = MASTER_EN.read_text(encoding="utf-8")
    elif MASTER_DE.exists():
        master_md = MASTER_DE.read_text(encoding="utf-8")
    else:
        raise HTTPException(404, "Upload a résumé first")
    existing = _read_skills_dict()
    extracted = await skill_extractor.extract_skills(master_md, existing, model("research"))
    merged = skill_extractor.merge_skills(existing, extracted)
    _write_skills_dict(merged)
    return {"skills": merged}


@router.post("/skills/merge")
def merge_skills_endpoint(body: SkillsRequest):
    merged = skill_extractor.merge_skills(_read_skills_dict(), body.skills)
    _write_skills_dict(merged)
    return {"skills": merged}
```

Note: `get_skills` now returns `{"skills": {...}}` even when the file is missing (previously returned `{"skills": {}}` only via the missing-file branch) — the `/skills` page already reads `data?.skills ?? {}`, so this is compatible.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest tests/test_skills_api.py -v && pytest -q`
Expected: PASS (4 new pass; full suite green — 35 prior + 9 extractor + 4 api = 48)

- [ ] **Step 5: Commit**

```bash
git add app/backend/routers/resume.py app/backend/tests/test_skills_api.py
git commit -m "feat(backend): add /skills/extract and /skills/merge endpoints"
```

---

## Task 4: `skill-assessment` SKILL.md (Claude path)

**Files:**
- Create: `skills/skill-assessment/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/skill-assessment/SKILL.md
git commit -m "docs(skills): add skill-assessment SKILL.md for the Claude path"
```

---

## Task 5: CLAUDE.md "process my skills" section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the section**

In `CLAUDE.md`, immediately after the "Processing captured jobs — \"process my captured jobs\"" subsection (it ends just before `### Browser extension`), insert:

```markdown
### Building the skills inventory — "process my skills"

When the user says **"process my skills"** (or clicks "Copy prompt for Claude" on the
Setup or Skills page), Claude Code builds the tiered skills inventory itself — do NOT
call the Ollama `/api/resume/skills/extract` endpoint (that is the offline fallback):

1. Read the master résumé (`resume_master.md` / `resume_master_de.md`),
   `data/skills.json` (existing inventory), and `data/career_goal.md` from disk.
2. Follow `skills/skill-assessment/SKILL.md`: draft a tier (1–4) + evidence per skill
   from concrete résumé evidence; **never fabricate**.
3. **Interview the user** (batched questions) about any skill whose tier the résumé
   cannot settle. Surface skills mentioned in answers that weren't on the résumé.
4. Save via `PUT`/`POST http://localhost:8000/api/resume/skills/merge` with
   `{"skills": {"Name": {"tier": 1, "evidence": "...", "needs_review": false}}}`. The
   backend merges keep-my-edits (existing entries win on collision) and persists.

The Ollama fallback (`POST /api/resume/skills/extract`) does the same extraction in
one offline pass with no interview, flagging low-confidence guesses `needs_review`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the 'process my skills' Claude path"
```

---

## Task 6: Shared `SKILLS_PROMPT` constant

**Files:**
- Create: `app/frontend/lib/prompts.ts`

- [ ] **Step 1: Write the constant**

```typescript
// app/frontend/lib/prompts.ts

/** Copied by the "Copy prompt for Claude" buttons on the Setup and Skills pages. */
export const SKILLS_PROMPT =
  'Build my skills inventory from my résumé — follow the "process my skills" steps in ' +
  "CLAUDE.md (read the master résumé, interview me on anything ambiguous, then POST " +
  "/api/resume/skills/merge).";
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app/frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add app/frontend/lib/prompts.ts
git commit -m "feat(frontend): add shared SKILLS_PROMPT constant"
```

---

## Task 7: `/setup` Skills CTA block

**Files:**
- Modify: `app/frontend/app/setup/page.tsx`

- [ ] **Step 1: Add imports and handlers**

After the existing imports, add:

```typescript
import { SKILLS_PROMPT } from "@/lib/prompts";
```

Inside `SetupPage`, after the `fileRef` declaration, add state + handlers:

```typescript
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);

  const extractOllama = async () => {
    setExtracting(true);
    const res = await api
      .post("/api/resume/skills/extract", {})
      .catch((err) => { toast.error(err.message); return null; });
    setExtracting(false);
    if (res?.skills) {
      toast.success(`Extracted ${Object.keys(res.skills).length} skills — review on the Skills page.`);
    }
  };

  const copyClaudePrompt = async () => {
    await navigator.clipboard.writeText(SKILLS_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
```

- [ ] **Step 2: Add the CTA block under the editor**

Replace the content branch:

```tsx
          {markdown ? (
            <MarkdownEditor value={markdown} onChange={setMarkdown} />
          ) : (
```

with:

```tsx
          {markdown ? (
            <>
              <MarkdownEditor value={markdown} onChange={setMarkdown} />
              <div className="mt-5 py-3.5 px-4 border-[0.5px] border-border-tertiary rounded-card bg-background-secondary flex items-center gap-3 flex-wrap">
                <span className="text-[12px] text-text-secondary font-shell">
                  Generate your skills inventory from this resume:
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={copyClaudePrompt} className={btnCls(false)}>
                    {copied ? "Copied" : "Copy prompt for Claude"}
                  </button>
                  <button onClick={extractOllama} disabled={extracting} className={btnCls(true, extracting)}>
                    {extracting ? "Extracting…" : "Extract with Ollama"}
                  </button>
                </div>
              </div>
            </>
          ) : (
```

(The closing `)` of the ternary and the empty-state `<div>` after it are unchanged.)

- [ ] **Step 3: Verify**

Run: `cd app/frontend && npx tsc --noEmit && npm run lint`
Expected: both exit 0

- [ ] **Step 4: Commit**

```bash
git add app/frontend/app/setup/page.tsx
git commit -m "feat(frontend): add skills-extraction CTA to setup page"
```

---

## Task 8: `/skills` extract actions + `needsReview` round-trip + chip

**Files:**
- Modify: `app/frontend/app/skills/page.tsx`

- [ ] **Step 1: Extend the Skill type and imports**

Add imports after the existing ones:

```typescript
import { SKILLS_PROMPT } from "@/lib/prompts";
```

Change the interface and add a module-level mapping helper (right below the
interface) so the initial load and the post-extract reload share one mapping:

```typescript
interface Skill { name: string; tier: number; evidence: string; needsReview?: boolean; }

function mapSkills(raw: Record<string, unknown>): Skill[] {
  return Object.entries(raw).map(([name, s]) => {
    const v = s as { tier: number; evidence?: string; needs_review?: boolean };
    return { name, tier: v.tier, evidence: v.evidence ?? "", needsReview: v.needs_review === true };
  });
}
```

- [ ] **Step 2: Round-trip `needs_review` on load and persist**

In `SkillsPage`, replace the load effect body and `persist`:

```typescript
  useEffect(() => {
    api.get("/api/resume/skills").then((data) => {
      setSkills(mapSkills(data?.skills ?? {}));
      setLoading(false);
    });
  }, []);

  const persist = async (updated: Skill[]) => {
    const skillsObj = Object.fromEntries(
      updated.map((s) => [
        s.name,
        s.needsReview
          ? { tier: s.tier, evidence: s.evidence, needs_review: true }
          : { tier: s.tier, evidence: s.evidence },
      ])
    );
    await api.put("/api/resume/skills", { skills: skillsObj });
    toast.success("Skills saved.");
  };
```

Because `SkillRow.onSave` returns only `{name, tier, evidence}` (no `needsReview`),
`handleSave` already replaces the row with an unflagged entry — so saving a row clears
its review flag while untouched rows keep theirs.

- [ ] **Step 3: Add the review chip to the read-only row**

In `SkillRow`, in the `if (!editing)` branch, change the name cell:

```tsx
        <span className="text-[13px] font-medium font-shell flex items-center gap-1.5">
          {skill.name}
          {skill.needsReview && (
            <span className="text-[9px] font-medium py-px px-[6px] rounded-full bg-custom-l text-custom-d font-shell">
              review
            </span>
          )}
        </span>
```

- [ ] **Step 4: Add extract handlers and topbar buttons**

In `SkillsPage`, after `addSkill`, add:

```typescript
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);

  const reload = () =>
    api.get("/api/resume/skills").then((data) => setSkills(mapSkills(data?.skills ?? {})));

  const extractOllama = async () => {
    setExtracting(true);
    const res = await api.post("/api/resume/skills/extract", {}).catch((err) => { toast.error(err.message); return null; });
    setExtracting(false);
    if (res?.skills) { await reload(); toast.success("Skills extracted — review the flagged rows."); }
  };

  const copyClaudePrompt = async () => {
    await navigator.clipboard.writeText(SKILLS_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
```

Replace the topbar's Add button line:

```tsx
        <button onClick={addSkill} className={`${btnCls(true)} ml-auto`}>+ Add Skill</button>
```

with:

```tsx
        <div className="ml-auto flex items-center gap-2">
          <button onClick={copyClaudePrompt} className={btnCls(false)}>
            {copied ? "Copied" : "Copy prompt for Claude"}
          </button>
          <button onClick={extractOllama} disabled={extracting} className={btnCls(false, extracting)}>
            {extracting ? "Extracting…" : "Extract with Ollama"}
          </button>
          <button onClick={addSkill} className={btnCls(true)}>+ Add Skill</button>
        </div>
```

(`reload()` is extracted so the Ollama path refreshes the table; the initial load
effect keeps `setLoading(false)` and stays as-is in Step 2.)

- [ ] **Step 5: Verify**

Run: `cd app/frontend && npx tsc --noEmit && npm run lint`
Expected: both exit 0

- [ ] **Step 6: Commit**

```bash
git add app/frontend/app/skills/page.tsx
git commit -m "feat(frontend): add skills extraction + review flag to skills page"
```

---

## Final verification

- [ ] **Run the full backend suite**

Run: `cd app/backend && source ../../.venv/bin/activate && pytest -q`
Expected: all pass (35 prior + 13 new = 48)

- [ ] **Run frontend checks**

Run: `cd app/frontend && npx tsc --noEmit && npm run lint`
Expected: both exit 0

- [ ] **Update README** — under "First-time setup", note that after uploading a résumé
  the user can generate the skills inventory via "Copy prompt for Claude" or "Extract
  with Ollama" on the Setup/Skills pages. Commit `docs: document skills extraction in README`.

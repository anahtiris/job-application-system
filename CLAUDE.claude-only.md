# CLAUDE.md (Claude-only variant)

This is a trimmed copy of [CLAUDE.md](CLAUDE.md) for running the entire pipeline through Claude Code chat, with **no Ollama install and no LLM API key**. It removes every "offline fallback" / "Generate with Ollama" path from the original and replaces the wizard's auto-triggered LLM steps (Job Analysis, Generate, Review) with the existing fully-manual pipeline from `workflows/end-to-end.md`, wired into the same app via its plain write endpoints.

Why this exists: `app/backend/config.toml` defaults every model role to `ollama/...`, so the web app's Job Analysis / Generate / Review steps require either a local Ollama install or an Anthropic/OpenAI API key configured in Settings. Those steps are the only parts of this repo with no manual alternative documented — this file is that alternative. Everything else in the original CLAUDE.md already has a manual-only path; this file just drops the Ollama mentions so nothing steers you toward installing it.

For anything not covered here (DB migrations, trash/soft-delete, templates, full endpoint list), see the original [CLAUDE.md](CLAUDE.md) — it's all still accurate, just not repeated below.

## What this system does

1. **Lead capture → triage**: Browser extension sends raw job board text to the backend instantly. Claude Code (not an LLM API call) extracts company/title/JD and analyzes fit + company tone, then the lead is approved (→ Application) or rejected.
2. **Application pipeline**: Given a job description, Claude Code produces a tailored one-page CV and cover letter as markdown, which the app then converts to DOCX + PDF (no LLM call in that conversion step) and stores under `applications/[Company]/`.

Initial setup: Claude Code parses a raw resume into `resume_master.md` / `resume_master_de.md`.

## Workflow permission protocol

Before starting any multi-step workflow (process captured jobs, generate CV/cover letter, interview prep), list every command you plan to run — reads AND writes — grouped by type, and ask once before doing anything:

**Read (auto-approved):** GET /api/leads/, resume_master.md, data/skills.json
**Write (will prompt):** PUT /api/leads/{id}/processed ×3, WebSearch ×3

After the user says proceed, run everything. Write-operation prompts still appear from the permission system — click "Allow for this session" on the first occurrence of each pattern to avoid repeated prompts.

## Session-bounding convention

For any workflow that processes many similar items (captured-job triage, skills extraction, multi-application generation):

1. Process at most **N items per pass** (default N=4).
2. **STOP** after the batch — do not continue past N in the same pass. Report what was processed and how many remain.
3. Tell the user to `/clear` and re-paste the prompt to continue, so each batch runs in a fresh context.

Small counts (a handful of items) are fine to do in one pass.

## Key commands

```bash
# Start the web app (both must run simultaneously) — no Ollama, no API key needed for this variant
cd app/backend && source ../../.venv/bin/activate && uvicorn main:app --reload   # :8000
cd app/frontend && npm run dev                                                   # :3000

# Install backend dependencies (first time)
source .venv/bin/activate && pip install -r app/backend/requirements.txt

# Unpack/pack DOCX for XML editing
python app/backend/office/unpack.py <template.docx> <output_dir>/
python app/backend/office/pack.py <unpacked_dir>/ <output.docx> --original <template.docx>

# Convert DOCX to PDF (requires LibreOffice, not Ollama)
libreoffice --headless --convert-to pdf <file.docx> --outdir <outdir>/

# Check page count of a PDF
pdfinfo <file.pdf> | grep Pages
```

## Web App (`app/`)

- **Backend**: `app/backend/` — FastAPI + SQLite. Routers used in this variant: `/api/resume`, `/api/application`, `/api/tracker`, `/api/leads`, `/api/trash`. `pdf.py` (LibreOffice + 1-page check) is the only "generation" step this variant calls automatically — it does not touch an LLM.
- **Frontend**: `app/frontend/` — dashboard (`/`), setup (`/setup`), skills inventory (`/skills`), trash (`/trash`), leads list (`/leads`), lead detail (`/leads/[id]`), wizard (`/apply/new`), detail (`/apply/[id]`). In this variant, skip the wizard's Job Analysis and Generate steps entirely (see "Manual application generation" below) and land directly on Finalize.
- **Persona**: `data/persona.md` (gitignored) — the obligated personal reviewer for the CV/cover-letter review pass. Edit via `/settings`.
- **PDF gate**: the "Finalize & Generate PDFs" button enforces a 1-page check and returns HTTP 422 if the CV overflows.

## Architecture

### Source of truth
`resume_master.md` (EN) and `resume_master_de.md` (DE) are the canonical resume data. **Never modify them.** All tailoring happens inside the DOCX XML.

### DOCX editing approach
DOCX files are ZIP archives. Unpack with `app/backend/office/unpack.py`, edit `word/document.xml` with string replacement, repack with `app/backend/office/pack.py`. The accent colour `1a56a4` in the CV template can be replaced wholesale with a company brand colour.

### Leads pipeline (`/api/leads/`)

Two-table funnel: `JobLead` → `Application`. Statuses: `captured → new → analyzing → analyzed → approved → applied → rejected`.

- **`POST /from-text`** — browser extension posts `{text, url}`. Saved instantly with `status="captured"`. Deduplicates by `source_url`.
- **`POST /{id}/approve`** — creates an `Application` record (copies company, job_title, language, JD, tone, source_url from lead). Sets `lead.status="approved"`, `lead.application_id=app.id`. New application starts `status="New"`.
- **`POST /{id}/reject`** — sets `status="rejected"`.
- **`PUT /{id}/processed`** — write-back endpoint used below. Accepts `{company, job_title, language, job_description, company_tone, company_research, fit_analysis}`, stores `fit_analysis` as `fit_analysis_json`, derives `fit_score`/`fit_verdict`, sets `status="analyzed"`.

### Processing captured jobs — "process my captured jobs"

Claude Code does extraction **and** analysis itself, always:

1. `GET /api/leads/` and select leads whose `status` is `captured` or `new`.
2. Read `resume_master.md` (or `resume_master_de.md` for German), `data/skills.json`, and `data/career_goal.md` from disk.
3. For each lead: extract `company`/`job_title`/`language`/`job_description` from `raw_text`; analyze fit against the resume + skills inventory + career goal; research the company on the web for tone + sentiment. Say "no reliable data found" when a company is thin — **never fabricate** reviews, salary, or facts.
   - **`job_description` must be the verbatim role content, not a summary.** Copy the actual posting sections word-for-word from `raw_text`. Only strip job-board chrome (nav, related-jobs lists, SEO spam, footers, auto-match widgets). Keep original wording/language. Flag board-estimated salaries as such, never as the employer's stated number.
4. `PUT /api/leads/{id}/processed` with:
   ```json
   {
     "company": "...", "job_title": "...", "language": "en|de", "job_description": "...",
     "company_tone": "direct|startup|contractor|agency",
     "company_research": "one-line tone reasoning",
     "fit_analysis": {
       "core_theme": "...",
       "must_haves":    [{"skill": "...", "status": "STRONG|HONEST|GAP|UNKNOWN", "tier": 1, "evidence": "..."}],
       "nice_to_haves": [{"skill": "...", "status": "STRONG|HONEST|GAP|UNKNOWN", "tier": null, "evidence": "..."}],
       "ats_keywords": ["..."],
       "match_score": 0,
       "strongest_angle": "...",
       "weakest_point": "...",
       "is_poor_match": false,
       "goal_alignment": "aligns|neutral|detours",
       "goal_alignment_note": "..."
     }
   }
   ```

**Batch mode — "process my captured jobs in batches of N" (default N=4).** Process only the next N captured/`new` leads (oldest first), then **STOP**, report progress, and tell the user to `/clear` and re-paste to continue.

### Processing an uploaded profile — "process my profile"

1. The upload saves raw extracted text to `data/resume_raw_en.txt` / `data/resume_raw_de.txt`. Read the file for the active language.
2. Structure it into clean markdown (`# Profile`, `# Contact`, `# Skills`, `# Experience`, `# Projects`, `# Education`). **Never fabricate.** Save via `PUT /api/resume/master` with `{language, content}`.
3. Then build the skills inventory (next section).

### Building the skills inventory — "process my skills"

1. Read `resume_master.md` / `resume_master_de.md`, `data/skills.json`, and `data/career_goal.md`.
2. Follow `skills/skill-assessment/SKILL.md`: draft a tier (1–4) + evidence per skill from concrete résumé evidence; **never fabricate**.
3. **Interview the user** (batched questions) about any skill the résumé can't settle. Surface skills mentioned in answers that weren't on the résumé.
4. Save via `PUT`/`POST http://localhost:8000/api/resume/skills/merge` with `{"skills": {"Name": {"tier": 1, "evidence": "...", "needs_review": false}}}`.

### Browser extension (`browser-extension/`)

Manifest V3. Click → grabs `{text: body.innerText, url: location.href}` → `POST /api/leads/from-text` → opens `localhost:3000/leads/{id}`. ~1 second, no LLM. Deduplicates by URL.

### Manual application generation — replaces the wizard's Job Analysis / Generate / Review steps

The web app's wizard steps 2–4 normally call an LLM (Ollama or a paid API key) directly. Skip those UI steps entirely and do the equivalent through Claude Code chat, following `workflows/end-to-end.md` Mode 2 and the `skills/*` folders — then push the result into the same `Application` record so the app's Finalize step (DOCX/PDF export, no LLM) can pick it up.

1. **Job Details**: create/patch the application via `PATCH /api/tracker/{id}/details` (or approve a lead, which does this automatically) — company, job title, language, job description, cover letter notes.
2. **Analyze**: use `skills/job-analysis/SKILL.md` to extract keywords/priorities/ATS terms from the JD.
3. **Research**: use `skills/company-research/SKILL.md` to classify company tone (`direct`/`startup`/`contractor`/`agency`) and adapt the cover letter opening strategy.
4. **Tailor resume (MD draft)**: draw exclusively from `resume_master.md`/`resume_master_de.md`. Save as `applications/[Company]/resume_draft.md`.
5. **Cover letter draft**: use `skills/cover-letter-aida/SKILL.md`. Save as `applications/[Company]/cover_letter_draft.md`.
6. **Review**: run `skills/cv-review/SKILL.md` on both drafts — 2 randomly selected personas (plus the mandatory persona from `data/persona.md`) each score 10 criteria and give concrete rewrites. Produce `resume_final.md` and `cover_letter_final.md`.
7. **⏸ Pause for confirmation** — present both final drafts to the user before writing anything to the app or disk further.
8. **Push into the app**: `PUT /api/application/drafts` with the confirmed markdown content (auto-promotes `New → Draft`).
9. **Generate DOCX**: use `skills/resume-tailoring/SKILL.md` (XML-level edit of the template) and the cover-letter template, drawing from the confirmed final drafts. Run the mandatory `pdfinfo` 1-page check before copying into `applications/[Company]/`.
10. **Finalize in the app**: open `/apply/{id}` at the Finalize step and click "Finalize & Generate PDFs" (or call `POST /api/application/pdf` directly) — this only runs the LibreOffice conversion + 1-page gate, no LLM involved.

This produces the same `Draft → Finalized` state transitions as the wizard, without ever calling `services/llm.py`.

### Company tone classification
- `direct` — established product/service company
- `startup` — small/early-stage; calm, hands-on builder voice, no corporate language
- `contractor` — IT consulting/contracting firm
- `agency` — recruiting or staffing agency

### Cover letter guardrails
- Availability date must be `01.MM.YYYY` format, computed from today's date — never "ab sofort", never guessed.
- Contact email must match the value in `data/persona.md` / settings — never invent one.
- Banned phrases (case-insensitive): "leverage", "drive successful", "demonstrate(s) success", "track record of", "proven ability", "deep understanding", "extensive experience in", "well-versed in", "synergy", "best-in-class".
- No overclaiming: skills that are recent (< 12 months) or from a side project must be described as "recent" / "exploring" / "in a side project".

### Skills (manual Claude Code workflow)
- `job-analysis` — extract keywords/priorities from a JD
- `company-research` — classify employer type and adapt opening strategy accordingly
- `resume-tailoring` — XML-level CV tailoring with mandatory 1-page check before finalising
- `cover-letter-aida` — AIDA-structured letter, closing formula (availability date + clickable mailto hyperlink in DOCX XML)
- `cv-review` — multi-persona review of both documents; produces a Revised Draft for each

### Skills inventory
`data/skills.json` (gitignored) stores skill tiers (1=Core, 2=Proficient, 3=Familiar, 4=Exposure) + evidence. Managed via `/skills` page. Used both for cover letter honesty checks and for classifying JD requirements during manual analysis.

### Interview preparation (detail page, Interview tab)

Follow `skills/interview-prep/SKILL.md`: gather context from `GET /api/tracker/{id}` and disk, **web-research the company** (never fabricate), build all seven fields (`company_analysis`, `introduction_script`, `common_questions[]`, `job_specific_questions[]`, `weak_spots[]`, `questions_to_ask[]`, `salary`) in the page's language, save via `PUT /api/application/{id}/interview-prep` with the JSON object. The Introduction Script should be fed the tailored CV + cover letter, not just the master resume.

**Export to PDF** — `GET /api/application/{id}/interview-export.pdf` assembles the seven fields + working notes + verbatim JD into a standalone PDF via LibreOffice — no LLM involved.

### Rejection analysis (`/applications/analysis`)

Requires at least 3 closed applications (`Rejected`, `Rejected after interview`, `Ghosted after interview`, not soft-deleted). Fetch stats from `GET /api/tracker/analysis/rejected`, read `data/career_goal.md`, write a 2-3 paragraph narrative (specific, honest, actionable, no corporate language), save via `PUT /api/tracker/analysis/rejected` with `{"narrative": "..."}`.

### Templates
`templates/resume/resume_en.docx` and `templates/resume/resume_de.docx` are the base CV DOCX files. `templates/cover-letter/cover_letter.docx` is the cover letter base. All gitignored — `.gitkeep` preserves the folders.

### Output structure
Every application lives in `applications/[Company]/` and is gitignored. Detail page (`/apply/[id]`) provides PDF and DOCX download links.

## Critical constraints

- **CV must be exactly 1 page.** Always run `pdfinfo` before copying to the applications folder. Profile summary must be under 200 characters.
- **Never fabricate resume content.** Only surface, reorder, or rephrase what exists in the master file.
- **Cover letter closing is strictly formatted**: `01.MM.YYYY` availability date and a clickable `mailto:` hyperlink embedded in the DOCX XML (see `skills/cover-letter-aida/SKILL.md`).
- **Language matching**: German JD → `resume_master_de.md` + German template + German filenames (`Lebenslauf`, `Anschreiben`). English JD → `resume_master.md` + English template + English filenames (`Resume`, `Cover_Letter`).

## File naming convention

| Language | Type | Filename |
|---|---|---|
| DE | Resume | `[FirstName_LastName]_Lebenslauf.docx/.pdf` |
| DE | Cover letter | `[FirstName_LastName]_Anschreiben.docx/.pdf` |
| EN | Resume | `[FirstName_LastName]_CV.docx/.pdf` |
| EN | Cover letter | `[FirstName_LastName]_Cover_Letter.docx/.pdf` |

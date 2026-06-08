# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this system does

An AI-assisted job application pipeline with a two-stage funnel:

1. **Lead capture → triage**: Browser extension sends raw job board text to the backend instantly. Batch extraction (`POST /api/leads/extract-captured`) parses company/title/JD via LLM. Each lead is then analyzed (fit score + company tone) and either approved (→ Application) or rejected.
2. **Application pipeline**: Given a job description, produces a tailored one-page CV and cover letter (DOCX + PDF) stored under `applications/[Company]/`.

Initial setup: Parse a raw resume into `resume_master.md` / `resume_master_de.md`.

The full step-by-step orchestration is in `workflows/end-to-end.md`.

## Key commands

```bash
# Start the web app (both must run simultaneously)
cd app/backend && source ../../.venv/bin/activate && uvicorn main:app --reload   # :8000
cd app/frontend && npm run dev                                                   # :3000

# Install backend dependencies (first time)
source .venv/bin/activate && pip install -r app/backend/requirements.txt

# Unpack/pack DOCX for XML editing
python app/backend/office/unpack.py <template.docx> <output_dir>/
python app/backend/office/pack.py <unpacked_dir>/ <output.docx> --original <template.docx>

# Convert DOCX to PDF (requires LibreOffice)
libreoffice --headless --convert-to pdf <file.docx> --outdir <outdir>/

# Check page count of a PDF
pdfinfo <file.pdf> | grep Pages
```

## Web App (`app/`)

A local Next.js + FastAPI app that replaces the manual Claude Code workflow with a structured UI. It enforces all guardrails in code so the LLM cannot exaggerate.

- **Backend**: `app/backend/` — FastAPI + SQLite. Routers: `/api/resume`, `/api/application`, `/api/tracker`, `/api/settings`, `/api/leads`. Services: `generator.py` (locked tailoring + streaming), `reviewer.py` (persona + 2 random reviewers), `researcher.py` (company scraper + tone classifier), `analyzer.py` (JD gap analysis), `interview.py` (prep + skills debrief), `pdf.py` (LibreOffice + 1-page check).
- **Frontend**: `app/frontend/` — Next.js 14. Pages: dashboard (`/`), setup (`/setup`), skills inventory (`/skills`), leads list (`/leads`), lead detail (`/leads/[id]`), 5-step wizard (`/apply/new`), detail (`/apply/[id]`), settings (`/settings`).
- **Ollama models** (configured in `app/backend/config.toml`): all four roles (parser, writer, reviewer, research) are set there. Restart the backend after editing `config.toml` — it is read once at startup.
- **Persona**: `data/persona.md` (gitignored) — the obligated personal reviewer. Edit via `/settings`.
- **PDF gate**: the "Finalize & Generate PDFs" button is gated until review completes. The backend enforces a 1-page check and returns HTTP 422 if the CV overflows.

## Architecture

### Source of truth
`resume_master.md` (EN) and `resume_master_de.md` (DE) are the canonical resume data. **Never modify them.** All tailoring happens inside the DOCX XML.

### DOCX editing approach
DOCX files are ZIP archives. The workflow unpacks them (`unzip`-equivalent via `app/backend/office/unpack.py`), edits `word/document.xml` with string replacement, then repacks. The accent colour `1a56a4` in the CV template can be replaced wholesale with a company brand colour.

### Leads pipeline (`/api/leads/`)

Two-table funnel: `JobLead` → `Application`. Statuses: `captured → new → analyzing → analyzed → approved → rejected`.

- **`POST /from-text`** — browser extension posts `{text: body.innerText, url}`. Saved instantly with `status="captured"`, no LLM blocking. Deduplicates by `source_url`.
- **`POST /extract-captured`** — batch LLM extraction for all `captured` leads. Parses company/job_title/language/job_description from raw text; sets `status="new"`.
- **`POST /{id}/analyze`** — runs `analyzer.analyze_jd` + `researcher.research_company` in parallel. Stores fit score (0–100), verdict (`strong`/`maybe`/`skip`), company tone. Score normalization guard: float 0–1 is multiplied by 100.
- **`POST /{id}/approve`** — creates an `Application` record (copies company, job_title, language, JD, tone, source_url from lead). Sets `lead.status="approved"`, `lead.application_id=app.id`. New application starts with `status="New"`.
- **`POST /{id}/reject`** — sets `status="rejected"`.
- **`PUT /{id}/processed`** — write-back endpoint for the Claude flow below. Accepts `{company, job_title, language, job_description, company_tone, company_research, fit_analysis}`, stores `fit_analysis` as `fit_analysis_json`, derives `fit_score`/`fit_verdict` from it (reusing `_verdict`), and sets `status="analyzed"`. Mirrors what the Ollama `/analyze` path writes.

### Processing captured jobs — "process my captured jobs"

When the user says **"process my captured jobs"**, Claude Code does extraction **and** analysis itself in one pass (do NOT call the Ollama `/extract-captured` or `/{id}/analyze` endpoints — those are the offline fallback):

1. `GET /api/leads/` and select leads whose `status` is `captured` or `new`.
2. Read `resume_master.md` (or `resume_master_de.md` for German), `data/skills.json`, and `data/career_goal.md` from disk.
3. For each lead: extract `company`/`job_title`/`language`/`job_description` from `raw_text`; analyze fit against the resume + skills inventory + career goal; research the company on the web for tone + sentiment. Say "no reliable data found" when a company is thin — **never fabricate** reviews, salary, or facts.
4. `PUT /api/leads/{id}/processed` with this body (the `fit_analysis` shape must match exactly — it is what `/leads/[id]` renders):
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

The `/leads` page shows color-coded status badges and fit verdict chips. The `/leads/[id]` detail page shows must-haves/nice-to-haves/ATS keywords from `fit_analysis_json`; all three arrays default to `[]` if missing (LLM sometimes uses non-standard field names).

### Browser extension (`browser-extension/`)

Manifest V3. Click → `chrome.scripting.executeScript` grabs `{text: body.innerText, url: location.href}` from the active tab → `POST /api/leads/from-text` → opens `localhost:3000/leads/{id}`. Returns in ~1 second (no LLM on the capture path). Deduplication: if a non-rejected lead already exists for the URL, shows "Already captured" and opens the existing lead.

### Application status flow

`New → Draft → Applied → Interview → Offer / Rejected`

- **New**: application created from an approved lead, no documents yet.
- **Draft**: documents written (either via the wizard Generate step or via `PUT /api/application/drafts` or `PUT /api/application/finals`). Both endpoints auto-promote `New → Draft`.
- Further transitions are manual via `PATCH /api/tracker/{id}/status`.

### Person name / file naming

`person.name` is stored in the settings DB table and used for PDF/DOCX filenames. It is auto-extracted from the `# Contact` section when a resume is first parsed via `POST /api/resume/parse`. It can also be set manually via `PUT /api/settings/profile`. Files are named `[FirstName_LastName]_CV.docx` (EN) / `[FirstName_LastName]_Lebenslauf.docx` (DE), etc.

### Wizard flow (5 steps)
1. **Job Details** — company, company website, job posting URL (`source_url`, carried over from the lead on approve), job title, language, job description, cover letter notes. Creating saves to DB; revisiting patches via `PATCH /api/tracker/{id}/details`.
2. **Job Analysis** — auto-runs `POST /api/application/analyze-jd` on entry; shows STRONG/HONEST/GAP classification per JD skill against the skills inventory, ATS keywords, match score, and overclaim flags. Uses the `research` model. LLM output is sanitised (markdown fence stripping, trailing comma removal) before `json.loads`. Clears result on Back so re-entry re-runs fresh.
3. **Generate** — auto-runs company research (tone + address) on entry; streams resume tailoring + cover letter via SSE. Tone can be overridden before generating.
4. **Review** — persona + 2 random reviewers score and rewrite both documents. Side-by-side panel: left = highlighted document, right = rewrite queue. Items sorted by document position.
5. **Finalize** — editable company address, side-by-side markdown editors, word count indicator on cover letter, "Finalize & Generate PDFs" exports DOCX + PDF.

When resuming an existing application, `inferStep` skips Job Analysis (returns step 3/4/5 based on progress).

### Company tone classification
`researcher.py` classifies companies into 4 tones used to adapt the cover letter opening strategy:
- `direct` — established product/service company
- `startup` — small/early-stage; triggers calm, hands-on builder voice with no corporate language
- `contractor` — IT consulting/contracting firm
- `agency` — recruiting or staffing agency

### Cover letter guardrails (enforced in `COVER_LETTER_SYSTEM`)
- Start date is computed in Python (`01.MM.YYYY` format, never "ab sofort") and injected as `START_DATE` — the LLM must not compute or guess it.
- Contact email is injected as `CONTACT_EMAIL` and enforced post-generation via regex replacement to prevent LLM hallucination.
- Banned phrases (case-insensitive): "leverage", "drive successful", "demonstrate(s) success", "track record of", "proven ability", "deep understanding", "extensive experience in", "well-versed in", "synergy", "best-in-class", and others — see `COVER_LETTER_SYSTEM` in `generator.py`.
- No overclaiming: skills that are recent (< 12 months) or from a side project must be described as "recent" / "exploring" / "in a side project".

### Skills (manual Claude Code workflow)
Each `skills/*/SKILL.md` is a self-contained instruction set consumed during a manual application run:
- `job-analysis` — extract keywords/priorities from a JD
- `company-research` — classify employer type and adapt opening strategy accordingly
- `resume-tailoring` — XML-level CV tailoring with mandatory 1-page check before finalising
- `cover-letter-aida` — AIDA-structured letter with specific closing formula (availability date + clickable mailto hyperlink in DOCX XML)
- `cv-review` — multi-persona review of both documents; 2 randomly selected personas each score 10 criteria 1–10 and provide concrete rewrites; produces a Revised Draft for each document

### Skills inventory
`data/skills.json` (gitignored) stores skill tiers (1=Core, 2=Proficient, 3=Familiar, 4=Exposure) + evidence. Managed via `/skills` page. Injected into cover letter generation as `SKILLS_INVENTORY` block to enforce honest tier-appropriate language, and used by Job Analysis to classify JD requirements.

### Interview preparation (detail page, Interview tab)
Two independent generation blocks, both only active when `app.status === "Interview"`:
- **Interview Prep** — 7 sections (`Company Analysis`, `Introduction Script`, `Common Questions`, `Job-Specific Questions`, `Weak Spots`, `Questions to Ask`, `Salary & Negotiation`), parameterised by round/interviewer/focus skills. The Introduction Script is fed the tailored CV + cover letter, not just the master resume. Stored in `interview_prep_md`. Rendered by `InterviewPrepDisplay`, which cards each `## ` section and special-cases the exact header `Questions to Ask`. Two generation paths (below).
- **Skills Debrief** — tier-aware per-skill coaching: STAR prompts for Tier 1/2, honest answer templates for Tier 3, overclaim flags. No parameters. Stored in `interview_debrief_md`.

**Two ways to generate Interview Prep** (mirrors the captured-jobs pattern):
- **Generate with Ollama** — `POST /api/application/interview-prep` runs `interview.generate_interview_prep` offline. Company Analysis is inferred from the JD (no web), labelled "(inferred — verify)".
- **Copy prompt for Claude** — the button copies an instruction referencing the application id. When the user pastes it, Claude Code: (1) `GET /api/tracker/{id}` for company/JD/CV/cover letter; (2) reads `data/skills.json`, `data/career_goal.md`, and the master resume from disk; (3) **web-researches the company** (reviews, salary, news, sentiment — cite sources, say "no reliable data found" when thin, **never fabricate**); (4) drafts all seven `## ` sections in the page's language; (5) saves via `PUT /api/application/{id}/interview-prep` with `{markdown}`. This is the **Interview prep — Claude path**.

### Templates
`templates/resume/resume_en.docx` and `templates/resume/resume_de.docx` are the base CV DOCX files. `templates/cover-letter/cover_letter.docx` is the cover letter base. All are gitignored — `.gitkeep` preserves the folders.

### Output structure
Every application lives in `applications/[Company]/` and is gitignored. Detail page (`/apply/[id]`) provides PDF and DOCX download links for both documents.

### Database migrations
`db.py` runs safe `ALTER TABLE` migrations on startup for new nullable columns (try/except loop). Current extra columns on `Application`: `resume_docx_path`, `cover_letter_docx_path`, `cover_letter_notes`, `interview_prep_md`, `interview_debrief_md`. `JobLead` table: `raw_text` added via migration. For constraint changes (e.g. making a column nullable), use the SQLite table-recreation pattern: CREATE new → INSERT SELECT → DROP old → RENAME.

## Critical constraints

- **CV must be exactly 1 page.** Always run the `pdfinfo` page count check before copying to the applications folder. Profile summary must be under 200 characters.
- **Never fabricate resume content.** Only surface, reorder, or rephrase what exists in the master file.
- **Cover letter closing is strictly formatted**: must include an `01.MM.YYYY` availability date (never "ab sofort") and a clickable `mailto:` hyperlink embedded in the DOCX XML (see `skills/cover-letter-aida/SKILL.md` for the exact XML snippet).
- **Language matching**: German JD → `resume_master_de.md` + German template + German filenames (`Lebenslauf`, `Anschreiben`). English JD → `resume_master.md` + English template + English filenames (`Resume`, `Cover_Letter`).

## File naming convention

| Language | Type | Filename |
|---|---|---|
| DE | Resume | `[FirstName_LastName]_Lebenslauf.docx/.pdf` |
| DE | Cover letter | `[FirstName_LastName]_Anschreiben.docx/.pdf` |
| EN | Resume | `[FirstName_LastName]_CV.docx/.pdf` |
| EN | Cover letter | `[FirstName_LastName]_Cover_Letter.docx/.pdf` |

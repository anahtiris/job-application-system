# Job Application System

A local AI-assisted pipeline that produces a tailored one-page CV and cover letter (DOCX + PDF) for each job application. Runs entirely on-device using Ollama models.

## Requirements

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.ai) with the models configured in `app/backend/config.toml`
- LibreOffice (for PDF export): `brew install --cask libreoffice`
- `pdfinfo` (for page count check): `brew install poppler`

## Setup

```bash
# Python dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r app/backend/requirements.txt

# Frontend dependencies
cd app/frontend && npm install
```

Edit `app/backend/config.toml`:
- Set `[person] name` to `FirstName_LastName` (used for output filenames)
- Set Ollama model names under `[models]` to match what you have pulled
- Set `[paths]` if your resume master files live elsewhere

## Running

Both processes must run simultaneously:

```bash
# Terminal 1 — backend
cd app/backend && source ../../.venv/bin/activate && uvicorn main:app --reload

# Terminal 2 — frontend
cd app/frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## First-time setup

1. Go to **Settings** → paste your resume master (EN and/or DE) and persona description.
2. Go to **Skills** → add your skills with tier ratings (1=Core, 2=Proficient, 3=Familiar, 4=Exposure) and evidence snippets.
3. Drop your CV and cover letter DOCX templates into `templates/resume/` and `templates/cover-letter/`. The expected filenames are in `config.toml`.

## Workflow (5-step wizard)

1. **Job Details** — paste the job description, set language and cover letter notes.
2. **Job Analysis** — auto-runs gap analysis (STRONG / HONEST / GAP) per JD skill against your skills inventory, ATS keywords, match score.
3. **Generate** — streams tailored resume + cover letter via SSE. Company tone is auto-detected and can be overridden.
4. **Review** — persona + 2 random expert reviewers score and rewrite both documents. Side-by-side panel: accept, edit, or skip each suggestion. Can be skipped entirely.
5. **Finalize** — edit final markdown, check cover letter word count, export DOCX + PDF.

Output lands in `applications/[Company]/`.

## Structure

```
app/
  backend/          FastAPI + SQLite
    routers/        API routes (application, tracker, resume, settings)
    services/       analyzer, generator, reviewer, researcher, interview, pdf
    office/         unpack.py / pack.py — DOCX ZIP editing helpers
    config.toml     Model names, paths, person name
  frontend/         Next.js 14
    app/            Pages: /, /setup, /skills, /apply/new, /apply/[id], /settings
    components/     ReviewPanel, Nav, shared UI
data/               persona.md, skills.json  (gitignored)
templates/          Base DOCX files  (gitignored, .gitkeep preserves folders)
applications/       Per-company output folders  (gitignored)
resume_master.md    Canonical EN resume  (source of truth, never edit)
resume_master_de.md Canonical DE resume
skills/             Manual Claude Code skill files (legacy workflow)
workflows/          End-to-end orchestration guide (legacy workflow)
```

## Notes

- The CV **must be exactly 1 page**. The backend enforces this with a `pdfinfo` check and returns HTTP 422 if it overflows.
- Only the **Profile Summary** section of the CV DOCX is replaced from the markdown editor. Job history and bullets come from the template.
- The cover letter body is fully replaced from the markdown editor.
- Restart the backend after editing `config.toml` — it is read once at startup.
- `data/` and `applications/` are gitignored. Templates are gitignored but folder structure is preserved via `.gitkeep`.

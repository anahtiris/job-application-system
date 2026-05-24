# Job Application System

An AI-assisted pipeline that produces a tailored one-page CV and cover letter (DOCX + PDF) for each job application. Works with any combination of Ollama (local), Anthropic, OpenAI, Gemini, and Perplexity — assign a different model to each role (parser, writer, reviewer, research) and swap them from the UI without restarting.

---

## Screenshots

**Dashboard — application tracker with status filters**
![Dashboard](docs/screenshots/dashboard.png)

**Job Analysis — STRONG / HONEST / GAP breakdown per JD skill**
![Job Analysis](docs/screenshots/job-analysis.png)

**Settings — model assignment per role + API key status**
![Settings](docs/screenshots/settings.png)

---

## Requirements

- Python 3.11+
- Node.js 18+
- At least one LLM provider: [Ollama](https://ollama.ai) (local) or an API key for Anthropic / OpenAI / Gemini / Perplexity
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

Copy `.env.example` to `.env` and fill in any API keys you want to use:

```bash
cp .env.example .env
```

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

1. Go to **Settings** → configure which model handles each role (parser / writer / reviewer / research) using `provider/model` format (e.g. `anthropic/claude-sonnet-4-6`, `ollama/qwen3.6:latest`).
2. Go to **Settings** → paste your persona description (your personal review guardrails).
3. Go to **Skills** → add your skills with tier ratings (1=Core, 2=Proficient, 3=Familiar, 4=Exposure) and evidence snippets.
4. Drop your CV and cover letter DOCX templates into `templates/resume/` and `templates/cover-letter/`.

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
      providers/    ollama, anthropic, openai, perplexity, gemini
    office/         unpack.py / pack.py — DOCX ZIP editing helpers
    config.toml     Default model slugs and file paths
  frontend/         Next.js 14
    app/            Pages: /, /setup, /skills, /apply/new, /apply/[id], /settings
    components/     ReviewPanel, Nav, shared UI
data/               persona.md, skills.json  (gitignored — see examples/)
templates/          Base DOCX files  (gitignored, .gitkeep preserves folders)
applications/       Per-company output folders  (gitignored)
resume_master.md    Canonical EN resume  (source of truth, never modify)
resume_master_de.md Canonical DE resume
```

## Notes

- The CV **must be exactly 1 page**. The backend enforces this with a `pdfinfo` check and returns HTTP 422 if it overflows.
- Model assignments are stored in the database and editable from **Settings** — no restart required.
- `data/` and `applications/` are gitignored. See `data/persona.example.md` and `data/skills.example.json` for the expected format.

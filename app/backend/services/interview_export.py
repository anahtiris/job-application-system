"""Assemble a single scheduled interview's prep into a standalone HTML document.

Pure functions over an Application's stored fields — no DB or LibreOffice here.
The HTML is converted to PDF by `render_interview_pdf` (added in a later task)."""
import json
import subprocess
from html import escape
from pathlib import Path
from typing import Any

from db import Application
from services.pdf import _find_soffice

LABELS = {
    "en": {
        "title": "Interview Preparation",
        "prep": "Interview Prep",
        "company_analysis": "Company Analysis",
        "introduction_script": "Introduction Script",
        "common_questions": "Common Questions",
        "job_specific_questions": "Technical / Job-Specific Questions",
        "weak_spots": "Weak Spots",
        "questions_to_ask": "Questions to Ask",
        "salary": "Salary",
        "notes": "Notes",
        "overview": "Overview",
        "red_flags": "Red Flags",
        "my_questions": "My Questions",
        "gaps": "Gaps",
        "free_notes": "Free-form Notes",
        "ask": "My ask", "market": "Market rate", "floor": "Floor",
        "jd": "Job Description",
        "date": "Interview date",
    },
    "de": {
        "title": "Interview-Vorbereitung",
        "prep": "Vorbereitung",
        "company_analysis": "Unternehmensanalyse",
        "introduction_script": "Vorstellungsskript",
        "common_questions": "Häufige Fragen",
        "job_specific_questions": "Technische / Stellenspezifische Fragen",
        "weak_spots": "Schwachstellen",
        "questions_to_ask": "Eigene Fragen",
        "salary": "Gehalt",
        "notes": "Notizen",
        "overview": "Überblick",
        "red_flags": "Warnsignale",
        "my_questions": "Meine Fragen",
        "gaps": "Lücken",
        "free_notes": "Freie Notizen",
        "ask": "Meine Forderung", "market": "Marktwert", "floor": "Minimum",
        "jd": "Stellenbeschreibung",
        "date": "Interviewtermin",
    },
}

_STYLE = """
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }
h1 { font-size: 20pt; margin: 0 0 2pt 0; }
h2 { font-size: 14pt; border-bottom: 1px solid #1a56a4; color: #1a56a4; margin: 18pt 0 6pt 0; padding-bottom: 2pt; }
h3 { font-size: 11.5pt; margin: 12pt 0 2pt 0; }
.meta { color: #555; font-size: 10pt; margin-bottom: 6pt; }
.qa { margin: 0 0 8pt 0; }
.q { font-weight: bold; }
.a { white-space: pre-wrap; margin-top: 1pt; }
.muted { color: #888; }
ul { margin: 2pt 0 8pt 1em; padding-left: 1em; }
.jd { white-space: pre-wrap; font-size: 10pt; }
.salary-grid { margin: 4pt 0; }
.salary-grid span { display: inline-block; min-width: 120pt; }
"""

EMPTY = "—"


def _esc(v: Any) -> str:
    return escape(str(v)) if v not in (None, "") else EMPTY


def _load(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return {}


def _qa_block(items: list[dict], lab: str) -> str:
    if not items:
        return f"<h3>{lab}</h3><p class='muted'>{EMPTY}</p>"
    rows = "".join(
        f"<div class='qa'><div class='q'>{_esc(i.get('q'))}</div>"
        f"<div class='a'>{_esc(i.get('a'))}</div></div>"
        for i in items
    )
    return f"<h3>{lab}</h3>{rows}"


def _para(value: str, lab: str) -> str:
    return f"<h3>{lab}</h3><div class='a'>{_esc(value)}</div>"


def _list_block(items: list[str], lab: str) -> str:
    if not items:
        return f"<h3>{lab}</h3><p class='muted'>{EMPTY}</p>"
    lis = "".join(f"<li>{_esc(i)}</li>" for i in items)
    return f"<h3>{lab}</h3><ul>{lis}</ul>"


def build_interview_html(app: Application, round: dict | None) -> str:
    lang = app.language if app.language in LABELS else "en"
    L = LABELS[lang]
    prep = (round or {}).get("prep", {}) or {}
    notes = (round or {}).get("notes", {}) or {}
    date = (round or {}).get("date")

    head = (
        f"<h1>{_esc(app.company)}</h1>"
        f"<div class='meta'>{_esc(app.job_title)}</div>"
    )
    if date:
        head += f"<div class='meta'>{L['date']}: {_esc(date)}</div>"

    # Interview Prep section
    prep_html = (
        f"<h2>{L['prep']}</h2>"
        + _para(prep.get("company_analysis", ""), L["company_analysis"])
        + _para(prep.get("introduction_script", ""), L["introduction_script"])
        + _qa_block(prep.get("common_questions", []), L["common_questions"])
        + _qa_block(prep.get("job_specific_questions", []), L["job_specific_questions"])
        + _qa_block(prep.get("weak_spots", []), L["weak_spots"])
        + _para(prep.get("salary", ""), L["salary"])
    )
    ask_items = prep.get("questions_to_ask", [])
    prep_html += _list_block([i.get("text", "") for i in ask_items], L["questions_to_ask"])

    # Notes section
    notes_html = f"<h2>{L['notes']}</h2>"
    notes_html += _para(notes.get("overview", ""), L["overview"])
    notes_html += _list_block(notes.get("red_flags", []), L["red_flags"])
    notes_html += _qa_block(notes.get("questions", []), L["my_questions"])
    gaps = notes.get("gaps", [])
    gap_lines = [
        f"{g.get('skill', '')} ({g.get('severity', '')}): {g.get('note', '')}"
        for g in gaps
    ]
    notes_html += _list_block(gap_lines, L["gaps"])
    sal = notes.get("salary", {}) or {}
    notes_html += (
        f"<h3>{L['salary']}</h3><div class='salary-grid'>"
        f"<span>{L['ask']}: {_esc(sal.get('ask'))}</span>"
        f"<span>{L['market']}: {_esc(sal.get('market'))}</span>"
        f"<span>{L['floor']}: {_esc(sal.get('floor'))}</span></div>"
        f"<div class='a'>{_esc(sal.get('notes'))}</div>"
    )
    notes_html += _para(notes.get("notes", ""), L["free_notes"])

    # Job description
    jd_html = f"<h2>{L['jd']}</h2><div class='jd'>{_esc(app.job_description)}</div>"

    return (
        f"<!DOCTYPE html><html lang='{lang}'><head><meta charset='utf-8'>"
        f"<title>{_esc(L['title'])}</title><style>{_STYLE}</style></head>"
        f"<body>{head}{prep_html}{notes_html}{jd_html}</body></html>"
    )


def render_interview_pdf(app: Application, out_dir: Path, round: dict | None = None) -> Path:
    """Write the assembled HTML to a temp file and convert it to PDF via
    LibreOffice. Returns the path to the generated PDF inside `out_dir`."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    html = build_interview_html(app, round)

    html_path = out_dir / "interview_prep.html"
    html_path.write_text(html, encoding="utf-8")

    soffice = _find_soffice()
    result = subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", str(html_path), "--outdir", str(out_dir)],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice failed: {result.stderr}")
    pdf_path = out_dir / (html_path.stem + ".pdf")
    if not pdf_path.exists():
        raise RuntimeError(f"PDF not found at {pdf_path}")
    return pdf_path

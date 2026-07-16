import json

from db import Application
from services.interview_export import build_interview_html


def _round(**over):
    base = dict(
        id="r1", round_type="Technical", date="2026-07-01T10:00:00", created_at="x",
        prep={
            "company_analysis": "Solid company.",
            "introduction_script": "Hi, I'm…",
            "common_questions": [{"id": "1", "q": "Why us?", "a": "Because…"}],
            "job_specific_questions": [{"id": "2", "q": "Explain X", "a": "- point"}],
            "weak_spots": [{"id": "3", "q": "Gap in Y?", "a": "Honest answer."}],
            "questions_to_ask": [{"id": "4", "text": "What's the roadmap?"}],
            "salary": "70-80k",
        },
        notes={
            "overview": "Mid-size, growing.",
            "red_flags": ["High turnover?"],
            "questions": [{"id": "q", "q": "My note Q", "a": "My note A"}],
            "gaps": [{"id": "g", "skill": "Kafka", "severity": "amber", "note": "self-study"}],
            "salary": {"ask": "80k", "market": "75k", "floor": "70k", "notes": "flexible"},
            "notes": "Remember to ask about on-call.",
            "my_q_state": {},
        },
    )
    base.update(over)
    return base


def _app(**over):
    base = dict(
        id="a1", company="Acme", job_title="Engineer", language="en",
        status="Interview", job_description="Build things.",
    )
    base.update(over)
    return Application(**base)


def test_html_includes_all_sections_and_content_en():
    html = build_interview_html(_app(), _round())
    assert html.lstrip().startswith("<")
    # English headings
    assert "Interview Prep" in html
    assert "Notes" in html
    assert "Job Description" in html
    # Prep content
    assert "Why us?" in html and "Explain X" in html and "Gap in Y?" in html
    assert "What&#x27;s the roadmap?" in html or "What's the roadmap?" in html
    assert "70-80k" in html
    # Notes content
    assert "Remember to ask about on-call." in html
    assert "Kafka" in html
    # JD
    assert "Build things." in html


def test_html_uses_german_headings_for_de_app():
    html = build_interview_html(_app(language="de"), _round())
    assert "Stellenbeschreibung" in html
    assert "Notizen" in html


def test_html_escapes_user_content():
    html = build_interview_html(_app(job_description="<script>alert(1)</script>"), _round())
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


def test_html_handles_empty_prep_and_notes():
    html = build_interview_html(_app(), _round(prep=None, notes=None))
    assert html.lstrip().startswith("<")
    assert "Interview Prep" in html  # structure still present
    assert "—" in html  # placeholder for empty sections


def test_html_renders_empty_state_with_no_round():
    html = build_interview_html(_app(), None)
    assert html.lstrip().startswith("<")
    assert "—" in html  # EMPTY placeholder used throughout


from pathlib import Path

from services import interview_export


def test_render_invokes_libreoffice_on_html(monkeypatch, tmp_path):
    calls = {}

    def fake_run(cmd, *a, **k):
        # cmd: [soffice, --headless, --convert-to, pdf, <html>, --outdir, <dir>]
        calls["cmd"] = cmd
        html_in = Path(cmd[4])
        calls["html"] = html_in.read_text(encoding="utf-8")
        out_dir = Path(cmd[6])
        (out_dir / (html_in.stem + ".pdf")).write_bytes(b"%PDF-1.4 fake")

        class R:
            returncode = 0
            stderr = ""

        return R()

    monkeypatch.setattr(interview_export, "_find_soffice", lambda: "soffice")
    monkeypatch.setattr(interview_export.subprocess, "run", fake_run)

    pdf_path = interview_export.render_interview_pdf(_app(), tmp_path, _round())
    assert pdf_path.exists()
    assert pdf_path.suffix == ".pdf"
    assert "--convert-to" in calls["cmd"] and "pdf" in calls["cmd"]
    assert "Interview Prep" in calls["html"]

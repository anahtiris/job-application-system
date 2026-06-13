from pathlib import Path

from services import pdf


# ── _strip_letter_boilerplate ────────────────────────────────────────────────

def test_strips_english_greeting_and_closing_but_rescues_email():
    text = (
        "Dear Hiring Manager,\n"
        "I am excited to apply for this role.\n"
        "Best regards,\n"
        "Jane Smith\n"
        "jane@example.com"
    )
    result = pdf._strip_letter_boilerplate(text)
    assert "Dear Hiring Manager" not in result
    assert "Best regards" not in result
    assert "Jane Smith" not in result
    assert result.startswith("I am excited to apply for this role.")
    assert result.endswith("jane@example.com")


def test_strips_german_greeting_and_closing_but_rescues_phone():
    text = (
        "Sehr geehrte Damen und Herren,\n"
        "Ich bewerbe mich auf die ausgeschriebene Stelle.\n"
        "Mit freundlichen Grüßen\n"
        "Max Mustermann\n"
        "+49 151 23456789"
    )
    result = pdf._strip_letter_boilerplate(text)
    assert "Sehr geehrte" not in result
    assert "Mit freundlichen Grüßen" not in result
    assert "Max Mustermann" not in result
    assert result.startswith("Ich bewerbe mich auf die ausgeschriebene Stelle.")
    assert result.endswith("+49 151 23456789")


def test_no_closing_line_leaves_body_untouched_aside_from_greeting():
    text = "Dear Hiring Manager,\nThis is the body.\nMore body text."
    result = pdf._strip_letter_boilerplate(text)
    assert result == "This is the body.\nMore body text."


# ── _page_count ───────────────────────────────────────────────────────────────

class _FakeCompletedProcess:
    def __init__(self, stdout: str):
        self.stdout = stdout


def test_page_count_parses_single_page(monkeypatch):
    monkeypatch.setattr(
        pdf.subprocess, "run", lambda *a, **k: _FakeCompletedProcess("Pages:           1\n")
    )
    assert pdf._page_count(Path("dummy.pdf")) == 1


def test_page_count_parses_multiple_pages(monkeypatch):
    monkeypatch.setattr(
        pdf.subprocess, "run", lambda *a, **k: _FakeCompletedProcess("Pages:           2\n")
    )
    assert pdf._page_count(Path("dummy.pdf")) == 2


def test_page_count_returns_minus_one_when_unparseable(monkeypatch):
    monkeypatch.setattr(
        pdf.subprocess, "run", lambda *a, **k: _FakeCompletedProcess("garbage output")
    )
    assert pdf._page_count(Path("dummy.pdf")) == -1

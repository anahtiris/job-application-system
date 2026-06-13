"""Code-enforced guardrails — the promises that must hold regardless of the LLM.

Covers the availability-date computation and the post-generation contact-email
enforcement (the anti-hallucination replacement in stream_generation)."""
import re

from services import generator
from services.generator import compute_start_date


# ── compute_start_date ────────────────────────────────────────────────────────

def test_start_date_format_is_dd_mm_yyyy():
    assert re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", compute_start_date("immediate"))


def test_start_date_never_says_sofort():
    for period in ("immediate", "2_weeks", "1_month", "3_months", ""):
        assert "sofort" not in compute_start_date(period).lower()


def test_immediate_lands_on_first_of_next_month():
    assert compute_start_date("immediate").startswith("01.")


def test_month_periods_land_on_first_of_month():
    assert compute_start_date("2_months").startswith("01.")


def test_custom_date_is_reformatted_to_dd_mm_yyyy():
    assert compute_start_date("custom", "2027-03-15") == "15.03.2027"


def test_invalid_custom_date_falls_back_to_first_of_next_month():
    out = compute_start_date("custom", "not-a-date")
    assert out.startswith("01.")
    assert re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", out)


# ── contact-email enforcement in stream_generation ────────────────────────────

async def test_streamed_cover_letter_overrides_hallucinated_email(tmp_path, monkeypatch):
    master = tmp_path / "master.md"
    master.write_text("# Profile\nold\n# Skills\nold\n# Experience\nz\n", encoding="utf-8")

    async def fake_stream(model, prompt, system=""):
        # The cover-letter call uses the AIDA system prompt; the resume call does not.
        if "AIDA" in system:
            yield "Reach me at wrong@hallucinated.test to discuss."
        else:
            yield '{"summary": "s", "skills": "k"}'

    monkeypatch.setattr(generator, "stream", fake_stream)

    chunks = [
        chunk
        async for chunk in generator.stream_generation(
            master_path=master,
            job_description="JD",
            company_name="Acme",
            company_tone="direct",
            company_address="",
            language="en",
            writer_model="ollama/x",
            start_date="01.07.2026",
            contact_email="real@example.com",
            contact_phone="+49 1",
        )
    ]

    cl_done = next(c for c in chunks if '"type": "cl_done"' in c)
    assert "real@example.com" in cl_done
    assert "wrong@hallucinated.test" not in cl_done

import io

import pytest
from docx import Document

from services import parser


def _docx_bytes(text: str) -> bytes:
    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_extract_text_from_upload_reads_docx():
    raw = parser.extract_text_from_upload(_docx_bytes("Hello CV"), "resume.docx")
    assert "Hello CV" in raw


@pytest.mark.asyncio
async def test_structure_resume_calls_generate(monkeypatch):
    captured = {}

    async def fake_generate(model, prompt, system=""):
        captured["model"] = model
        captured["prompt"] = prompt
        captured["system"] = system
        return "# Profile\nx"

    monkeypatch.setattr(parser, "generate", fake_generate)
    out = await parser.structure_resume("raw text here", "ollama/test")
    assert out == "# Profile\nx"
    assert captured["model"] == "ollama/test"
    assert captured["prompt"] == "raw text here"
    assert captured["system"] == parser.PARSE_SYSTEM

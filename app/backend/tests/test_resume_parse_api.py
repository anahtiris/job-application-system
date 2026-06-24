import io

from docx import Document

import routers.resume as resume
from services import parser


def _docx_bytes(text: str) -> bytes:
    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _upload(client, content: bytes, name="resume.docx", lang="en"):
    return client.post(
        f"/api/resume/parse?language={lang}",
        files={"file": (name, content, "application/octet-stream")},
    )


def test_parse_success_writes_master_and_raw(client, tmp_path, monkeypatch):
    monkeypatch.setattr(resume, "MASTER_EN", tmp_path / "master_en.md")
    monkeypatch.setattr(resume.Paths, "RESUME_RAW_EN", tmp_path / "raw_en.txt")

    async def fake_structure(raw_text, model):
        return "# Profile\nStructured."

    monkeypatch.setattr(parser, "structure_resume", fake_structure)

    r = _upload(client, _docx_bytes("Hello CV"))
    assert r.status_code == 200
    body = r.json()
    assert body["parse_error"] is None
    assert body["markdown"] == "# Profile\nStructured."
    assert (tmp_path / "master_en.md").read_text(encoding="utf-8") == "# Profile\nStructured."
    assert "Hello CV" in (tmp_path / "raw_en.txt").read_text(encoding="utf-8")


def test_parse_llm_failure_returns_200_with_error_and_saves_raw(client, tmp_path, monkeypatch):
    monkeypatch.setattr(resume, "MASTER_EN", tmp_path / "master_en.md")
    monkeypatch.setattr(resume.Paths, "RESUME_RAW_EN", tmp_path / "raw_en.txt")

    async def boom(raw_text, model):
        raise RuntimeError("ANTHROPIC_API_KEY is not set.")

    monkeypatch.setattr(parser, "structure_resume", boom)

    r = _upload(client, _docx_bytes("Hello CV"))
    assert r.status_code == 200
    body = r.json()
    assert body["markdown"] == ""
    assert body["saved_to"] is None
    assert "ANTHROPIC_API_KEY is not set." in body["parse_error"]
    assert "Copy prompt for Claude" in body["parse_error"]
    assert not (tmp_path / "master_en.md").exists()       # master NOT written
    assert "Hello CV" in (tmp_path / "raw_en.txt").read_text(encoding="utf-8")


def test_parse_rejects_unsupported_extension(client):
    r = _upload(client, b"x", name="resume.txt")
    assert r.status_code == 400


def test_parse_extraction_failure_returns_400_and_no_raw_file(client, tmp_path, monkeypatch):
    raw_path = tmp_path / "raw_en.txt"
    monkeypatch.setattr(resume, "MASTER_EN", tmp_path / "master_en.md")
    monkeypatch.setattr(resume.Paths, "RESUME_RAW_EN", raw_path)

    def boom(content: bytes, filename: str) -> str:
        raise ValueError("corrupt or encrypted file")

    monkeypatch.setattr(parser, "extract_text_from_upload", boom)

    r = _upload(client, b"not a real docx", name="bad.docx")
    assert r.status_code == 400
    assert not raw_path.exists()

"""Parse an uploaded resume (PDF or DOCX) into markdown using Ollama."""
import tempfile
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from services.llm import generate


def _extract_text_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_text_docx(path: Path) -> str:
    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs)


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _extract_text_pdf(path)
    if suffix in (".docx", ".doc"):
        return _extract_text_docx(path)
    raise ValueError(f"Unsupported file type: {suffix}")


PARSE_SYSTEM = """You are a resume parser. Convert the raw resume text into clean, structured markdown.

Use exactly these sections in this order:
# Profile
(2-3 sentence professional summary)

# Contact
(email, phone, location, LinkedIn — one per line)

# Skills
(group by category, e.g. Languages & Frameworks | DevOps & Cloud | etc.)

# Experience
For each role:
## Job Title — Company (Start – End or Present)
Location
- bullet
- bullet

# Projects
## Project Name
- bullet

# Education
## Degree — Institution (Year)

Rules:
- Extract only what is present in the raw text. Do not invent anything.
- Dates must match the source exactly.
- Keep bullet points concise and factual."""


async def parse_resume(file_bytes: bytes, filename: str, model: str) -> str:
    suffix = Path(filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = Path(tmp.name)

    raw_text = extract_text(tmp_path)
    tmp_path.unlink(missing_ok=True)

    return await generate(model, raw_text, system=PARSE_SYSTEM)

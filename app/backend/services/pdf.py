"""Generate DOCX and PDF from final markdown content.

Resume: unpack template → edit XML → repack → 1-page check → LibreOffice PDF
Cover letter: python-docx body replacement → LibreOffice PDF
"""
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt

from office.unpack import unpack
from office.pack import pack


def _apply_calibri(doc: Document) -> None:
    """Force Calibri on every run in the document to ensure font consistency."""
    for para in doc.paragraphs:
        for run in para.runs:
            run.font.name = "Calibri"
            rPr = run._r.get_or_add_rPr()
            rFonts = rPr.find(qn("w:rFonts"))
            if rFonts is None:
                rFonts = OxmlElement("w:rFonts")
                rPr.insert(0, rFonts)
            for attr in ("w:ascii", "w:hAnsi", "w:cs"):
                rFonts.set(qn(attr), "Calibri")


_SOFFICE_CANDIDATES = [
    "soffice",
    "libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/libreoffice",
]


def _find_soffice() -> str:
    import shutil as _shutil
    for candidate in _SOFFICE_CANDIDATES:
        if _shutil.which(candidate) or Path(candidate).exists():
            return candidate
    raise RuntimeError(
        "LibreOffice not found. Install it with: brew install --cask libreoffice\n"
        "Then restart the backend server."
    )


def _libreoffice_to_pdf(docx_path: Path, out_dir: Path) -> Path:
    soffice = _find_soffice()
    result = subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", str(docx_path), "--outdir", str(out_dir)],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice failed: {result.stderr}")
    pdf_path = out_dir / (docx_path.stem + ".pdf")
    if not pdf_path.exists():
        raise RuntimeError(f"PDF not found at {pdf_path}")
    return pdf_path


def _page_count(pdf_path: Path) -> int:
    result = subprocess.run(
        ["pdfinfo", str(pdf_path)], capture_output=True, text=True, timeout=30,
    )
    match = re.search(r"Pages:\s+(\d+)", result.stdout)
    return int(match.group(1)) if match else -1


_BOILERPLATE_PATTERNS = [
    r"sehr geehrte",
    r"dear ",
    r"mit freundlichen grüßen",
    r"kind regards",
    r"freundliche grüße",
    r"best regards",
    r"yours sincerely",
    r"hochachtungsvoll",
]


def _strip_letter_boilerplate(text: str) -> str:
    """Remove greeting/closing lines the LLM may include in the body output."""
    lines = text.split("\n")
    filtered = [
        line for line in lines
        if not any(re.match(p, line.strip().lower()) for p in _BOILERPLATE_PATTERNS)
    ]
    return "\n".join(filtered)


def _md_to_xml_map(resume_md: str) -> dict[str, str]:
    """Extract the new summary and skills text from tailored markdown."""
    summary_match = re.search(r"# Profile\n(.*?)(?=\n#)", resume_md, re.DOTALL)
    skills_match = re.search(r"# Skills\n(.*?)(?=\n#)", resume_md, re.DOTALL)
    return {
        "summary": (summary_match.group(1).strip() if summary_match else ""),
        "skills": (skills_match.group(1).strip() if skills_match else ""),
    }


def generate_resume_docx(
    resume_md: str,
    template_path: Path,
    output_path: Path,
    accent_colour: str | None = None,
) -> Path:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        unpacked = tmp_dir / "unpacked"
        unpack(template_path, unpacked)

        doc_xml = unpacked / "word" / "document.xml"
        xml = doc_xml.read_text(encoding="utf-8")

        content = _md_to_xml_map(resume_md)

        # Replace profile summary paragraph (paraId 00000006, any namespace prefix)
        # Preserve run properties (font/color/size) from the original first run.
        if content["summary"]:
            def _replace_summary(m: re.Match) -> str:
                inner = m.group(2)
                rpr_match = re.search(r"<w:rPr>.*?</w:rPr>", inner, re.DOTALL)
                rpr = rpr_match.group(0) if rpr_match else ""
                return (
                    m.group(1)
                    + f'<w:r>{rpr}<w:t xml:space="preserve">{content["summary"]}</w:t></w:r>'
                    + m.group(3)
                )
            xml = re.sub(
                r'(<w:p\b[^>]*paraId="00000006"[^>]*>)(.*?)(</w:p>)',
                _replace_summary,
                xml, flags=re.DOTALL,
            )

        if accent_colour:
            xml = xml.replace("1a56a4", accent_colour)

        doc_xml.write_text(xml, encoding="utf-8")

        temp_docx = tmp_dir / "cv_check.docx"
        pack(unpacked, temp_docx, template_path)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(temp_docx, output_path)

    return output_path


def generate_cover_letter_docx(
    cover_letter_md: str,
    template_path: Path,
    output_path: Path,
    job_title: str,
    company: str,
    company_address: str,
    language: str,
) -> Path:
    doc = Document(str(template_path))
    date_str = datetime.now().strftime("%d.%m.%Y")

    if language == "en":
        subject = f"Application for {job_title}"
        greeting = "Dear Hiring Manager,"
        closing_text = "Kind regards,"
    else:
        subject = f"Bewerbung als {job_title}"
        greeting = "Sehr geehrte Damen und Herren,"
        closing_text = "Mit freundlichen Grüßen,"

    # Split address into lines (street on first, city on second)
    addr_lines = [ln.strip() for ln in company_address.splitlines() if ln.strip()]

    # ── First pass: replace fixed placeholders ────────────────────────────────
    paras_to_remove = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text == "[Unternehmensname]":
            para.text = company
        elif text == "[Straße Nr.]":
            if addr_lines:
                para.text = addr_lines[0]
            else:
                paras_to_remove.append(para)
        elif text == "[PLZ Stadt]":
            if len(addr_lines) > 1:
                para.text = addr_lines[1]
            else:
                paras_to_remove.append(para)
        elif "Bewerbung als" in text or "Application as" in text or "Application for" in text:
            para.text = subject
        elif re.search(r'\w+,\s+\d{2}\.\d{2}\.\d{4}', text):
            para.text = re.sub(r'\w+,\s+\d{2}\.\d{2}\.\d{4}', f"München, {date_str}", text)
        elif "Sehr geehrte" in text:
            para.text = greeting
        elif "Mit freundlichen Grüßen" in text and language == "en":
            para.text = closing_text

    for para in paras_to_remove:
        para._p.getparent().remove(para._p)

    # ── Second pass: replace body between greeting and closing ────────────────
    greeting_para = None
    closing_para = None
    old_body = []
    in_body = False

    for para in doc.paragraphs:
        text = para.text.strip()
        if text == greeting:
            greeting_para = para
            in_body = True
            continue
        if "Mit freundlichen Grüßen" in text or "Kind regards" in text:
            closing_para = para
            in_body = False
            break
        if in_body:
            old_body.append(para)

    # Save body style before removing old paragraphs
    body_style = old_body[0].style if old_body else None

    # Remove old body paragraphs from XML
    for para in old_body:
        para._p.getparent().remove(para._p)

    # Insert new body paragraphs before the closing
    if closing_para:
        clean_body = _strip_letter_boilerplate(cover_letter_md)
        new_paras = [p.strip() for p in clean_body.strip().split("\n\n") if p.strip()]
        for p_text in new_paras:
            new_p = closing_para.insert_paragraph_before(p_text)
            if body_style:
                new_p.style = body_style
            new_p.paragraph_format.space_after = Pt(8)

    _apply_calibri(doc)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
    return output_path


def _person_name_from_template(template: Path, language: str) -> str:
    """Strip the document-type suffix from the template stem to get the person name.

    e.g. 'FirstName_LastName_CV' -> 'FirstName_LastName'
    Falls back to the full stem if no known suffix is found.
    """
    stem = template.stem
    for suffix in ("_CV", "_Lebenslauf", "_Resume"):
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def build_pdfs(
    resume_md: str,
    cover_letter_md: str,
    job_title: str,
    company: str,
    company_address: str,
    language: str,
    template_resume: Path,
    template_cover: Path,
    output_dir: Path,
    person_name: str = "",
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)

    if not person_name:
        person_name = _person_name_from_template(template_resume, language)

    if language == "de":
        cv_name = f"{person_name}_Lebenslauf"
        cl_name = f"{person_name}_Anschreiben"
    else:
        cv_name = f"{person_name}_CV"
        cl_name = f"{person_name}_Cover_Letter"

    cv_docx = output_dir / f"{cv_name}.docx"
    cl_docx = output_dir / f"{cl_name}.docx"

    generate_resume_docx(resume_md, template_resume, cv_docx)
    generate_cover_letter_docx(cover_letter_md, template_cover, cl_docx, job_title, company, company_address, language)

    cv_pdf = _libreoffice_to_pdf(cv_docx, output_dir)
    pages = _page_count(cv_pdf)
    if pages != 1:
        cv_pdf.unlink(missing_ok=True)
        raise ValueError(
            f"CV is {pages} pages — must be exactly 1. "
            "Shorten the profile summary (< 200 chars) or trim skills/bullets."
        )

    cl_pdf = _libreoffice_to_pdf(cl_docx, output_dir)

    return {
        "resume_docx": str(cv_docx),
        "resume_pdf": str(cv_pdf),
        "cover_letter_docx": str(cl_docx),
        "cover_letter_pdf": str(cl_pdf),
    }

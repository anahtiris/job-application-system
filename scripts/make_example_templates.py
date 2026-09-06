#!/usr/bin/env python3
"""Generate the dummy DOCX templates under templates/.

The exporter in app/backend/services/pdf.py does not read placeholders — it
locates content by exact heading text and by literal placeholder strings. This
script builds templates that satisfy that contract, so a fresh clone of the repo
can export a CV and a cover letter without supplying any personal files.

Usage:
    python scripts/make_example_templates.py

Writes (overwrites):
    templates/resume/resume_en.example.docx
    templates/resume/resume_de.example.docx
    templates/cover-letter/cover_letter.example.docx

See templates/README.md for the contract these files encode.
"""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

ROOT = Path(__file__).resolve().parent.parent

# Lowercase on purpose: pdf._recolour_docx does a byte replacement of this exact
# token in word/document.xml when an application sets a company accent colour.
ACCENT = "1a56a4"

PERSON = "Jane Doe"
EMAIL = "jane.doe@example.com"
PHONE = "+49 (0) 000 0000000"
CITY = "München"


def _set_run_colour(run, hex_colour: str) -> None:
    """Set a run's colour by raw XML so the hex stays lowercase.

    python-docx's RGBColor writes uppercase hex, which would not match the
    lowercase token pdf._recolour_docx searches for.
    """
    rPr = run._element.get_or_add_rPr()
    colour = OxmlElement("w:color")
    colour.set(qn("w:val"), hex_colour)
    rPr.append(colour)


def _para(doc, text="", *, size=10, bold=False, colour=None, space_after=4, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    if align is not None:
        p.alignment = align
    if text:
        run = p.add_run(text)
        run.font.size = Pt(size)
        run.bold = bold
        if colour:
            _set_run_colour(run, colour)
    return p


def _heading(doc, text: str):
    """Section heading. Its paragraph text must equal the anchor string exactly —
    pdf.generate_resume_docx matches on p.text.strip().lower()."""
    return _para(doc, text, size=11, bold=True, colour=ACCENT, space_after=4)


def _skill_line(doc, label: str, items: str):
    """Skill row with exactly two runs: bold label, then the item list.

    pdf._set_skill_runs clones this paragraph once per skill group and writes
    into its <w:t> elements positionally, so the two-run shape is required.
    """
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(0)
    label_run = p.add_run(f"{label}: ")
    label_run.bold = True
    label_run.font.size = Pt(10)
    items_run = p.add_run(items)
    items_run.font.size = Pt(10)
    return p


def _new_doc() -> Document:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)
    section = doc.sections[0]
    section.top_margin = Cm(1.4)
    section.bottom_margin = Cm(1.4)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    return doc


def _experience_entry(doc, title: str, meta: str, bullets: list[str]) -> None:
    _para(doc, title, size=10, bold=True, space_after=0)
    _para(doc, meta, size=9, colour="595959", space_after=2)
    for bullet in bullets:
        p = _para(doc, f"• {bullet}", size=10, space_after=2)
        p.paragraph_format.left_indent = Cm(0.4)


def build_resume_en(out: Path) -> Path:
    doc = _new_doc()

    _para(doc, PERSON, size=20, bold=True, colour=ACCENT, space_after=0)
    _para(doc, "Software Engineer", size=11, colour="595959", space_after=2)
    _para(doc, f"{CITY}, Germany  |  {EMAIL}  |  {PHONE}", size=9, space_after=8)

    _heading(doc, "PROFESSIONAL SUMMARY")
    # Replaced wholesale by the tailored summary. Keep it to ONE paragraph:
    # only the paragraph directly after the heading is overwritten.
    _para(
        doc,
        "Backend engineer with six years building web services and data pipelines. "
        "Works close to the database and cares about boring, testable code.",
        space_after=8,
    )

    _heading(doc, "TECHNICAL SKILLS")
    # Every paragraph between this heading and PROFESSIONAL EXPERIENCE is
    # deleted on export and rebuilt from the tailored resume markdown. These
    # rows only exist to donate their run formatting.
    _skill_line(doc, "Languages", "Python, TypeScript, SQL, Go")
    _skill_line(doc, "Backend", "FastAPI, Django, PostgreSQL, Redis")
    _skill_line(doc, "Frontend", "React, Next.js, Tailwind CSS")
    _skill_line(doc, "Infrastructure", "Docker, GitHub Actions, Terraform, AWS")
    doc.paragraphs[-1].paragraph_format.space_after = Pt(8)

    _heading(doc, "PROFESSIONAL EXPERIENCE")
    _experience_entry(
        doc,
        "Senior Backend Engineer, Example GmbH",
        "Munich  |  03.2022 – present",
        [
            "Rebuilt the order ingestion service, cutting median processing time from 4s to 900ms.",
            "Introduced contract tests between four internal services, removing a recurring class of deploy failures.",
            "Mentored two junior engineers through their first on-call rotations.",
        ],
    )
    _experience_entry(
        doc,
        "Backend Engineer, Sample Systems AG",
        "Berlin  |  08.2019 – 02.2022",
        [
            "Built the reporting API used by 30 internal analysts.",
            "Migrated a legacy MySQL schema to PostgreSQL with no reported data loss.",
        ],
    )

    _heading(doc, "EDUCATION")
    _para(doc, "B.Sc. Computer Science, Example University", size=10, bold=True, space_after=0)
    _para(doc, "2015 – 2019", size=9, colour="595959", space_after=0)

    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out))
    return out


def build_resume_de(out: Path) -> Path:
    doc = _new_doc()

    _para(doc, PERSON, size=20, bold=True, colour=ACCENT, space_after=0)
    _para(doc, "Softwareentwicklerin", size=11, colour="595959", space_after=2)
    _para(doc, f"{CITY}, Deutschland  |  {EMAIL}  |  {PHONE}", size=9, space_after=8)

    _heading(doc, "PROFIL")
    _para(
        doc,
        "Backend-Entwicklerin mit sechs Jahren Erfahrung in Webservices und Datenpipelines. "
        "Arbeitet nah an der Datenbank und schreibt testbaren, unaufgeregten Code.",
        space_after=8,
    )

    _heading(doc, "TECHNISCHE KENNTNISSE")
    _skill_line(doc, "Sprachen", "Python, TypeScript, SQL, Go")
    _skill_line(doc, "Backend", "FastAPI, Django, PostgreSQL, Redis")
    _skill_line(doc, "Frontend", "React, Next.js, Tailwind CSS")
    _skill_line(doc, "Infrastruktur", "Docker, GitHub Actions, Terraform, AWS")
    doc.paragraphs[-1].paragraph_format.space_after = Pt(8)

    _heading(doc, "BERUFSERFAHRUNG")
    _experience_entry(
        doc,
        "Senior Backend-Entwicklerin, Example GmbH",
        "München  |  03.2022 – heute",
        [
            "Order-Ingestion-Service neu gebaut, mediane Verarbeitungszeit von 4s auf 900ms gesenkt.",
            "Contract-Tests zwischen vier internen Services eingeführt und wiederkehrende Deploy-Fehler beseitigt.",
            "Zwei Junior-Entwickler durch ihre erste Rufbereitschaft begleitet.",
        ],
    )
    _experience_entry(
        doc,
        "Backend-Entwicklerin, Sample Systems AG",
        "Berlin  |  08.2019 – 02.2022",
        [
            "Reporting-API für 30 interne Analysten gebaut.",
            "Legacy-MySQL-Schema ohne gemeldeten Datenverlust nach PostgreSQL migriert.",
        ],
    )

    _heading(doc, "AUSBILDUNG")
    _para(doc, "B.Sc. Informatik, Example University", size=10, bold=True, space_after=0)
    _para(doc, "2015 – 2019", size=9, colour="595959", space_after=0)

    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out))
    return out


def build_cover_letter(out: Path) -> Path:
    """Cover letter template.

    pdf.generate_cover_letter_docx rewrites this by matching literal strings:
    "[Unternehmensname]", "[Straße Nr.]", "[PLZ Stadt]", a subject containing
    "Bewerbung als", a "<Place>, DD.MM.YYYY" date line, "Sehr geehrte" and
    "Mit freundlichen Grüßen". Every one of them must be present, each alone in
    its own paragraph. The paragraphs between greeting and closing are deleted
    and replaced with the generated letter body.
    """
    doc = _new_doc()

    # Sender block (never touched by the exporter — edit it by hand).
    _para(doc, PERSON, size=11, bold=True, space_after=0)
    _para(doc, "Musterstraße 1", space_after=0)
    _para(doc, f"80331 {CITY}", space_after=0)
    _para(doc, PHONE, space_after=0)
    _para(doc, EMAIL, space_after=16)

    # Recipient placeholders — matched literally, keep the brackets and spelling.
    _para(doc, "[Unternehmensname]", space_after=0)
    _para(doc, "[Straße Nr.]", space_after=0)
    _para(doc, "[PLZ Stadt]", space_after=16)

    # Date line: "<Place>, DD.MM.YYYY". The place is kept, the date refreshed.
    _para(doc, f"{CITY}, 01.01.2026", space_after=16, align=WD_ALIGN_PARAGRAPH.RIGHT)

    # Subject line — must contain "Bewerbung als" (or "Application as/for").
    _para(doc, "Bewerbung als Softwareentwicklerin", size=11, bold=True, space_after=12)

    _para(doc, "Sehr geehrte Damen und Herren,", space_after=8)

    # Placeholder body. Deleted on export; the first paragraph donates its style.
    _para(
        doc,
        "dieser Absatz ist ein Platzhalter. Der gesamte Text zwischen Anrede und "
        "Grußformel wird beim Export durch das generierte Anschreiben ersetzt.",
        space_after=8,
    )
    _para(
        doc,
        "Ein zweiter Platzhalterabsatz, damit der Fließtext-Stil sichtbar ist.",
        space_after=12,
    )

    _para(doc, "Mit freundlichen Grüßen,", space_after=24)
    _para(doc, PERSON, space_after=0)

    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out))
    return out


def main() -> None:
    written = [
        build_resume_en(ROOT / "templates" / "resume" / "resume_en.example.docx"),
        build_resume_de(ROOT / "templates" / "resume" / "resume_de.example.docx"),
        build_cover_letter(ROOT / "templates" / "cover-letter" / "cover_letter.example.docx"),
    ]
    for path in written:
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

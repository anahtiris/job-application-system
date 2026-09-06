# DOCX templates

The exporter fills two DOCX files: a CV template and a cover letter template.
Both are gitignored because they normally contain your real name, address and
work history. What *is* committed is a dummy set you can copy and edit:

```
templates/resume/resume_en.example.docx
templates/resume/resume_de.example.docx
templates/cover-letter/cover_letter.example.docx
examples/resume_master.example.md
examples/resume_master_de.example.md
```

## Quick start after cloning

```bash
cp templates/resume/resume_en.example.docx        templates/resume/resume_en.docx
cp templates/resume/resume_de.example.docx        templates/resume/resume_de.docx
cp templates/cover-letter/cover_letter.example.docx templates/cover-letter/cover_letter.docx
cp examples/resume_master.example.md    resume_master.md
cp examples/resume_master_de.example.md resume_master_de.md
```

Now open each DOCX and replace the dummy content (Jane Doe, Example GmbH, …)
with your own, **keeping the structural markers listed below intact**. Only the
DE template is needed if you never apply in German, and vice versa.

Regenerate the dummy files at any time:

```bash
python scripts/make_example_templates.py
```

Paths are configured in `app/backend/config.toml` (`templates_resume_en`,
`templates_resume_de`, `templates_cover_letter`).

## Read this before using your own design

The exporter (`app/backend/services/pdf.py`) does **not** use `{{PLACEHOLDER}}`
tokens in the DOCX. It walks the paragraph list and matches **literal strings**.
An arbitrary CV template downloaded from the web will not work — it will export,
but the tailored content will be silently dropped. This is the main rigidity of
the system, and it is deliberate: string anchors keep your existing layout,
fonts and spacing untouched.

Nothing else in the CV is generated. **Experience, education, projects and the
header come straight out of the template**, unedited. Only the profile summary
and the skills block are tailored per application.

### CV template contract

| Requirement | EN template | DE template |
|---|---|---|
| Summary heading, alone in its paragraph, matched case-insensitively | `PROFESSIONAL SUMMARY` | `PROFIL` |
| Skills heading | `TECHNICAL SKILLS` | `TECHNISCHE KENNTNISSE` |
| Heading that terminates the skills block | `PROFESSIONAL EXPERIENCE` | `BERUFSERFAHRUNG` |

- The **single paragraph directly after the summary heading** is overwritten with
  the tailored summary. A summary split over two paragraphs loses its second half.
- **Every paragraph between the skills heading and the experience heading** is
  deleted and rebuilt, one paragraph per skill group. At least one such
  paragraph must exist — it is cloned to donate its formatting.
- That skill paragraph must have **exactly two runs**: a bold `Label: ` run and a
  regular items run. One run means the label and the items merge; three or more
  means the extras are blanked.
- The accent colour token `1a56a4` (lowercase hex, in `word/document.xml`) is
  replaced wholesale when an application specifies a company brand colour. Use a
  different accent and that feature simply does nothing.
- The exported PDF **must be one page**. The backend runs a `pdfinfo` page count
  and returns HTTP 422 if the CV overflows, so keep the template tight — the
  tailored skills block can be longer than the placeholder one.

Heading strings live in `RESUME_HEADINGS` in `app/backend/services/pdf.py`.
Changing them there is currently a code edit, not a setting.

### Cover letter template contract

Each of these must appear **alone in its own paragraph**, spelled exactly as
shown (the German strings are the anchors even for English letters — the
exporter rewrites them into English on export):

| Paragraph | Becomes |
|---|---|
| `[Unternehmensname]` | company name |
| `[Straße Nr.]` | street line(s) of the company address |
| `[PLZ Stadt]` | postcode + city (paragraph removed if unknown) |
| a line containing `Bewerbung als` (or `Application as` / `Application for`) | subject line |
| a line matching `<Place>, DD.MM.YYYY` | same place, today's date (`München` → `Munich` in EN) |
| a line starting with `Sehr geehrte` | greeting |
| a line containing `Mit freundlichen Grüßen` | closing (English: `Kind regards,`) |

Everything **between the greeting and the closing** is deleted and replaced with
the generated letter body, one paragraph per blank-line-separated block. The
first old body paragraph donates its style, so keep at least one placeholder
paragraph there. The sender block above the recipient address is never touched —
edit it by hand.

Matching is substring-based for the subject, greeting and closing, so a
paragraph elsewhere that happens to contain `Sehr geehrte` will also be
rewritten.

### Filenames of the output

Not derived from the template names — the person name comes from Settings
(auto-extracted from the `# Contact` section on resume upload):

| Language | Type | Filename |
|---|---|---|
| EN | CV | `[FirstName_LastName]_CV.docx/.pdf` |
| EN | Cover letter | `[FirstName_LastName]_Cover_Letter.docx/.pdf` |
| DE | CV | `[FirstName_LastName]_Lebenslauf.docx/.pdf` |
| DE | Cover letter | `[FirstName_LastName]_Anschreiben.docx/.pdf` |

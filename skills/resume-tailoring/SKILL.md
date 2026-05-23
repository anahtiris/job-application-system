---
name: resume-tailoring
description: How to tailor the resume template DOCX to a specific job description.
---
# Skill: Resume Tailoring

**Description**: Tailors the `.docx` CV template for a specific job application. The master resume markdown files (`resume_master.md` / `resume_master_de.md`) are the source of truth and must **never be modified**. All tailoring happens inside the DOCX template.

## Content Rules
- Draw content exclusively from `resume_master.md` (EN) or `resume_master_de.md` (DE).
- Do not add skills, experiences, or claims that do not exist in the master file.
- Do not exaggerate or invent anything.
- Reorder skills groups, update the profile summary, and surface keywords from the job description.
- Deprioritise or omit sections that are irrelevant to the role to keep it to one page.
- If the company has a known brand colour, replace the template accent colour (`1a56a4`) with it throughout the XML.

## Workflow

### Step 1 — Determine language
Use the language of the job posting. DE posting → `resume_master_de.md` + German template. EN posting → `resume_master.md` + English template.

### Step 2 — Decide tailored content
Before touching any file, produce a tailoring plan:
- New profile summary (2–3 sentences, keywords from JD injected)
- Skills section: which groups to keep, reorder, or trim; which specific skills to highlight
- Experience bullets: which to keep verbatim, which to reword slightly to echo JD language
- Anything to drop to save space

### Step 3 — Unpack the template
```bash
python scripts/office/unpack.py templates/resume/[FirstName_LastName]_Lebenslauf.docx unpacked_cv/
# For English template:
python scripts/office/unpack.py templates/resume/[FirstName_LastName]_CV.docx unpacked_cv/
```

### Step 4 — Edit the XML
Edit `unpacked_cv/word/document.xml` using the Edit tool (string replacement).

Key text nodes to update:
| Node content | What to change |
|---|---|
| Profile paragraph (`paraId 00000006`) | Replace with tailored summary |
| Skills lines (`Sprachen & Web`, `CMS, DevOps & Cloud`, `Testing & Schwerpunkte`) | Replace with reordered/trimmed skill groups from master |
| Job bullet paragraphs | Reword where needed to echo JD keywords |
| Accent colour `1a56a4` | Replace with company brand colour if known (use `replace_all: true`) |

**Never edit** name, contact details, dates, company names, job titles, education, or certifications — these are factual and must remain unchanged.

### Step 5 — Profile summary length rule
The profile summary (paraId 00000006) must fit on **2 lines maximum** at the template's font size. As a proxy: keep it under **200 characters**. If the draft exceeds this, shorten before packing — cut adjectives, merge clauses, or drop the least relevant detail.

### Step 6 — Pack to DOCX (to a temp file first)

**File naming convention:**
| Language | Document type | Format | Example |
|---|---|---|---|
| German | Resume | `[FirstName_LastName]_Lebenslauf.docx` | `applications/[Company]/[FirstName_LastName]_Lebenslauf.docx` |
| English | Resume | `[FirstName_LastName]_Resume.docx` | `applications/[Company]/[FirstName_LastName]_Resume.docx` |

Pack to a **temporary output file first** (not the final path), so a length check can be done before committing:

```bash
# German — pack to temp
python scripts/office/pack.py unpacked_cv/ outputs/cv_check.docx --original templates/resume/[FirstName_LastName]_Lebenslauf.docx
# English — pack to temp
python scripts/office/pack.py unpacked_cv/ outputs/cv_check.docx --original templates/resume/[FirstName_LastName]_CV.docx
```

### Step 7 — Page count check (MANDATORY before PDF)

Convert the **temp file** to PDF and verify it is exactly 1 page using `pdfinfo`:

```bash
libreoffice --headless --convert-to pdf outputs/cv_check.docx --outdir outputs/
pdfinfo outputs/cv_check.pdf | grep Pages
```

**If `Pages: 1`** → proceed to Step 8.

**If `Pages: 2` or more** → do NOT copy to the applications folder. Go back and trim:
- Shorten the profile summary (target < 200 chars)
- Trim the longest skills line (remove 1–2 lower-priority items)
- Compress a verbose bullet point (remove filler phrases)
- Repeat Steps 4–7 until 1 page is confirmed.

### Step 8 — Copy to final destination
Only after page count is confirmed as 1:

```bash
# German
cp outputs/cv_check.docx applications/[Company]/[FirstName_LastName]_Lebenslauf.docx
cp outputs/cv_check.pdf  applications/[Company]/[FirstName_LastName]_Lebenslauf.pdf
# English
cp outputs/cv_check.docx applications/[Company]/[FirstName_LastName]_Resume.docx
cp outputs/cv_check.pdf  applications/[Company]/[FirstName_LastName]_Resume.pdf
```

# End-to-End Workflow

## Mode 1: Initial Setup
1. **Input**: Receive Resume (PDF, docx, json, or text).
2. **Parse**: Extract and structure into markdown (`resume_master.md`).
3. **Format**:
   - `# Profile`
   - `# Skills`
   - `# Experience` (Role, Company, Duration, Responsibilities, Achievements)
   - `# Projects`
   - `# Education`
4. **Store**: Save `resume_master.md` for future use.
5. **Template Prep**: Ensure a `.docx` template with placeholders (e.g. `{{SUMMARY}}`, `{{SKILLS}}`) is placed in the `templates/` folder.

## Mode 2: Job Application
1. **Input**: Job description + stored `resume_master.md`.
2. **Step 0: Store Job Description**: Save the raw job description as a markdown file to `applications/[Company Name]/job_description.md`. Include: company, location, job ID, URL, summary, responsibilities, minimum qualifications, and preferred qualifications.
3. **Step 1: Analyze**: Extract keywords, priorities, language, and company focus using `skills/job-analysis`.
4. **Step 2: Tailor Resume (MD Draft)**: Produce a tailored resume as a markdown draft. Draw exclusively from `resume_master.md` (EN) or `resume_master_de.md` (DE). Do not write any DOCX yet. Save draft to `applications/[Company Name]/resume_draft.md`.
5. **Step 3: Generate Cover Letter Draft**: Write cover letter using `skills/cover-letter-aida` and `skills/company-research`. Save as `applications/[Company Name]/cover_letter_draft.md`.
6. **Step 4: Document Review**: Run `skills/cv-review` on both drafts in a single pass. Randomly select 2 of the 4 reviewer personas (the same pair reviews both documents). Each reviewer scores all 10 criteria per document and provides concrete rewrites. Produce a Consolidated Action List and Revised Draft for each document. Save final content to `applications/[Company Name]/resume_final.md` and `applications/[Company Name]/cover_letter_final.md`.
7. **⏸ PAUSE — User Confirmation**: Present `resume_final.md` and `cover_letter_final.md` to the user. **Do not proceed until the user explicitly confirms.** The user may request changes; if so, update the relevant MD file and re-present before continuing.
8. **Step 5: Document Generation (Resume)**: Tailor and pack the DOCX template using `skills/resume-tailoring`, drawing content from the confirmed `resume_final.md`. Run the mandatory 1-page check before copying to the application folder.
9. **Step 6: Document Generation (Cover Letter)**: Generate the cover letter DOCX from the confirmed `cover_letter_final.md` using the template in `templates/cover-letter/`.
10. **Step 7: Generate PDF files**: Convert both DOCX files to PDF using LibreOffice.

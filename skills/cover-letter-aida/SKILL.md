---
name: cover-letter-aida
description: Guidelines for generating an effective cover letter using the AIDA framework.
---
# Skill: Cover Letter (AIDA Framework)

## Strategic Framework & Voice
- **Tone**: Confident but approachable — like a seasoned professional who knows their value. Match the German market standard of directness and professionalism when writing in DE.
- **Voice**: Natural first-person that sounds like real speech, with varied and fluid sentence construction.
- **Rhythm**: Deliberately mix short, direct statements with more detailed explanations. Vary paragraph lengths intentionally for natural flow. Never repeat sentence patterns.
- **Language**: Clear, specific, and human. Use language you'd actually say in a professional conversation.

---

## Strict Prohibitions

**Punctuation**
- Em dashes (—) are forbidden. Use hyphens (-) only.

**Sentence construction**
- Any sentence longer than 20 words — break it into shorter, clearer statements.
- Long sentences with multiple clauses.
- Any construction that feels awkward when read aloud.
- Starting consecutive sentences with the same word or similar structure.
- Starting more than 2 sentences in the entire letter with the word "I" — vary openings with My, With, Having, At [Company], This experience, etc.
- Abstract concepts without a concrete example immediately following.

**Language & tone**
- Corporate jargon that real humans don't use in conversation.
- Phrases that sound like business writing templates.
- Any opener in the "I am writing to apply" family: "I am writing to apply for...", "I would like to apply for...", "I am reaching out to express my interest in...", "I am applying for the position of..." — the opening sentence must lead with a relevant experience or observation, never with the act of applying itself.
- "I am excited about the opportunity"
- "that I observe are in line with"
- "Living and breathing [concept]"
- "aligns perfectly / seamlessly with"
- Any phrase combining "adopting" + "processes"

---

## Factual Accuracy

These rules are mandatory. Violations are lies.

- **Never extend** the duration of any project or role beyond what is explicitly stated in the resume.
- **Employment status**: Only describe a role as current if the resume explicitly shows "Present" as the end date. Any other end date means the role is past.
- **Tense rule**: Roles with end date "Present" → use present tense. All other roles → use past tense without exception.
- **Company-attribution lock**: For every sentence that names a company, confirm the metric or action described exists under that company's entry in the resume (same employer, same date range). Never merge metrics from different companies in one sentence.
- **No seniority inflation**: Do not inflate the seniority, scope, or impact of any role beyond what the resume supports.
- **No assumptions**: If a detail is ambiguous (timeline, role scope, achievement scale), omit or downplay it — do not guess or infer.
- **Temporal connectors**: Do not use "earlier", "later", "previously", or similar unless you have verified the chronology against the resume dates.
- **No fabrication**: Every fact, metric, title, and company name must be directly supported by the resume. If it is not in the resume, it does not go in the letter.

## Skills Depth Constraints

Before writing ANY technical claim, cross-reference against the skills inventory below. This overrides resume text.

TIER 1 — use: "built", "delivered", "deep experience with", "specialized in"
TIER 2 — use: "worked with", "contributed to", "experience with", "proficient in"
TIER 3/4 — DO NOT MENTION under any circumstances

[PASTE skills_inventory.json here at runtime]

Rules:
- Only mention skills that are TIER 1 or TIER 2 AND directly relevant to the JD
- Weave skills into achievement stories only — never list or summarize them in isolation
- If a JD requirement maps to TIER 3/4, omit it — do not acknowledge the gap

---

## Content Organisation (AIDA)

**Total length**: 250–350 words.

### 1. Opening (1-2 sentences)
*A – Attention (Motivation, Company Fit)*
A direct, natural statement connecting your specific experience to their specific need.
Goal: show you chose them, not just "any job". Avoid generic phrases.

**Adapt opening strategy based on company type** (determined in `skills/company-research`):
- **Direct employer**: Reference their specific mission, product, or tech stack.
- **IT contractor / consulting firm**: Lead with your cross-client delivery track record. See `skills/company-research/SKILL.md → IT Contractor Opening`.
- **Recruiting agency**: Lead with a crisp professional identity + stack match. See `skills/company-research/SKILL.md → Recruiting Agency Opening`.

### 2. Evidence (1-2 paragraphs)
*I + D – Interest & Desire (Story + Proof)*
Present achievements as brief success stories that demonstrate how you solve problems similar to theirs.
This is the most important part (70% of impact). Tell one coherent story using a **Problem → Solution → Impact** arc. Include projects, technologies, and measurable outcomes (impact over tasks). Inject keywords from the job description naturally into this section.

### 3. Closing (2-3 sentences)
*A – Action (Call to Action)*
A clear statement of mutual benefit that sounds like the end of a real conversation.

**Required elements — both must be present:**

1. **Availability date**: State the next realistic start date — the first of the following month from today, or later if notice period requires it. Format: `01.MM.YYYY`. Never write "ab sofort" (sounds desperate). Never leave it vague with "zeitnah" alone.
   - Calculate: today's date + ~2 weeks notice = earliest realistic start → round to the 1st of that month.
   - Example: if today is May 2026, write `01.06.2026`.

2. **Call to action with clickable contact details**: Invite the reader to schedule an interview and give them a direct way to reach you. The email address must be a clickable hyperlink (mailto: in DOCX XML). Phone number as plain text.

   **MANDATORY before writing the closing — read contact details from the resume file:**
   Open `resume_master.md` (EN job) or `resume_master_de.md` (DE job) right now and extract:
   - `CONTACT_EMAIL` — the email address in the contact/header section
   - `CONTACT_PHONE` — the phone number in the contact/header section

   Do not proceed to write the closing until both values have been read from the file.
   Do not use any email or phone from session context, system prompts, or user account information — the file is the only valid source.

   **DE formula**:
   > "Ich bin ab [Datum] verfügbar und freue mich auf Ihre Einladung zum Vorstellungsgespräch. Unter der E-Mail-Adresse {CONTACT_EMAIL} oder telefonisch unter {CONTACT_PHONE} erreichen Sie mich jederzeit zur Vereinbarung eines Termins."

   **EN formula**:
   > "I'm available from [date] and would welcome the opportunity to discuss this role. You can reach me at {CONTACT_EMAIL} or by phone at {CONTACT_PHONE} to arrange a meeting."

**To add a clickable mailto link in DOCX XML** (substitute `{CONTACT_EMAIL}` with the value read from the resume):
1. Add relationship to `word/_rels/document.xml.rels`:
   ```xml
   <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="mailto:{CONTACT_EMAIL}" TargetMode="External"/>
   ```
2. In `document.xml`, wrap the email run in `<w:hyperlink r:id="rId7" w:history="1">`:
   ```xml
   <w:hyperlink r:id="rId7" w:history="1">
     <w:r>
       <w:rPr>
         <w:rStyle w:val="Hyperlink"/>
         <w:rFonts w:ascii="Cambria" w:cs="Cambria" w:eastAsia="Cambria" w:hAnsi="Cambria"/>
       </w:rPr>
       <w:t>{CONTACT_EMAIL}</w:t>
     </w:r>
   </w:hyperlink>
   ```

---

## Mandatory Quality Control

After writing the letter, review it line by line before finalising:

1. **Read aloud test**: Read each sentence aloud. If it sounds forced or unnatural, rewrite it.
2. **Punctuation check**: Scan every punctuation mark. Replace any em dash (—) with a hyphen (-).
3. **Sentence length**: Flag any sentence over 20 words and break it into shorter statements.
4. **Jargon sweep**: Rewrite any sentence using business jargon into plain, direct language.
5. **Consecutive sentence check**: Confirm no two consecutive sentences begin with the same word or structure.
5a. **"I" count**: Count sentences starting with "I". If more than 2, rewrite the excess with varied openers (My, With, Having, At [Company], This work, etc.).
6. **Relevance check**: Confirm every achievement connects directly to a specific employer need from the job description.
7. **Factual verification** — check all of the following against the resume:
   - Job titles, company names, employment dates, and project timelines match exactly.
   - Roles with end date "Present" are written in present tense; all others are in past tense.
   - Company-attribution lock: every metric or action attributed to a company exists under that company's entry in the resume (same employer and date range). No merged metrics from different companies.
   - No temporal connectors ("earlier", "later") unless chronology is verified against resume dates.
8. **Ambiguity rule**: If any resume detail is ambiguous, confirm it is omitted or downplayed — not assumed.
9. **Contact details check**: Confirm the email and phone in the closing were read directly from `resume_master.md` / `resume_master_de.md` and match the file exactly. If you cannot confirm this, re-read the file and correct them before proceeding.
10. **Honesty check**: Confirm there are no fabricated facts. Everything in the letter is directly supported by the resume.

---

## Document Generation
- Use "Cover Letter Sample.docx" as template — keep the exact same format, font, spacing, and layout including the signature.
- Write in the language of the job posting (EN or DE).
- Convert final output to PDF.

**File naming convention:**
| Language | Document type | Example path |
|---|---|---|
| German | Cover letter | `applications/[Company]/[FirstName_LastName]_Anschreiben.docx` |
| English | Cover letter | `applications/[Company]/[FirstName_LastName]_Cover_Letter.docx` |

Save both `.docx` and `.pdf` to `applications/[Company]/`.

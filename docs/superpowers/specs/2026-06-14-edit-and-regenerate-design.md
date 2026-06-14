# Edit & Regenerate Documents — Design

## Problem

Once an application's resume/cover letter have been generated and finalized
(`resume_pdf_path` set), there is no way to make a small manual edit to the
generated markdown and regenerate the PDF/DOCX files. The only existing path
("Regenerate", visible for New/Draft only) re-runs the LLM generation from
Step 2, discarding the current draft text.

Additionally, the "Finalize & Generate PDFs" button on wizard Step 5
silently overwrites existing PDF/DOCX files with no warning, which is risky
once a real edit/regenerate flow exists.

## Goals

1. Let the user edit the generated resume/cover letter markdown for any
   application (regardless of status) and regenerate the PDF/DOCX from the
   edit.
2. Warn the user before "Finalize & Generate PDFs" overwrites existing
   PDF/DOCX files.

## Non-goals

- No new markdown editor component — reuse the existing Step 5
  `MarkdownEditor` fields.
- No backend changes — `PUT /api/application/finals` and
  `POST /api/application/pdf` already do everything needed.

## Design

### 1. Detail page (`app/frontend/app/apply/[id]/page.tsx`) — "Edit documents" link

Add a topbar link, shown when `app.resume_final_md` exists and `canContinue`
is false (i.e. documents have already been generated):

```ts
const canEdit = !!app.resume_final_md && !canContinue;
```

- Label: **"Edit documents"**
- `href={`/apply/new?id=${id}`}` (no `regen` param)
- Via the existing `inferStep`, this lands directly on **Step 5: Finalize**
  because `resume_pdf_path` is already set.
- Rendered alongside the existing "Continue wizard" / "Regenerate" links
  (not a replacement) — "Regenerate" re-runs the LLM (Step 2), "Edit
  documents" jumps straight to manual editing + PDF regen (Step 5).
- Visible for any application status (Draft, Applied, Interview, Offer,
  Rejected, Ghosted), as long as final markdown exists.

### 2. Wizard Step 5 (`app/frontend/app/apply/new/page.tsx`) — overwrite confirmation modal

State additions:

- `hadExistingPdfRef = useRef(false)` — set to `!!app.resume_pdf_path` when
  loading an existing application (in the `existingId` load effect).
- `showOverwriteConfirm` (boolean state) — controls modal visibility.

Behavior change to `handlePdf`:

- Rename current body to an internal function (e.g. `doGeneratePdf`) that
  performs the existing save-finals + generate-pdf + navigate sequence.
- The button's `onClick` becomes a new `handlePdf`:
  - If `hadExistingPdfRef.current` is `true` → set
    `showOverwriteConfirm = true` (do not call any API yet).
  - Else → call `doGeneratePdf()` directly (first-time finalize, nothing to
    overwrite).

New modal component (inline in `apply/new/page.tsx`, styled with existing
`Btn` / card conventions — bordered rounded card, centered overlay):

- Text: "This will overwrite the existing CV and Cover Letter files (PDF +
  DOCX). Continue?"
- **Cancel** button → closes modal, no API calls, stays on Step 5.
- **Overwrite** button → closes modal, calls `doGeneratePdf()`.
- While `doGeneratePdf()` is running, reuse existing `generatingPdf` /
  `pdfError` state for the button's loading label and error display.

## Data flow summary

```
/apply/[id] (any status, resume_final_md set)
  → click "Edit documents"
  → /apply/new?id={id}  (inferStep → Step 5, since resume_pdf_path set)
  → user edits Resume / Cover Letter markdown (autosaves via existing
    Step 4 autosave effect → PUT /api/application/finals)
  → click "Finalize & Generate PDFs"
     → hadExistingPdfRef true → show overwrite modal
        → Cancel: stop
        → Overwrite: PUT /api/application/finals + POST /api/application/pdf
     → navigate back to /apply/{id}
```

## Testing

- Manual verification via the running dev app (frontend `npm run dev` +
  backend `uvicorn`):
  - From an application with status Applied/Interview/etc. and generated
    documents, "Edit documents" appears and lands on Step 5.
  - Editing markdown and clicking "Finalize & Generate PDFs" shows the
    overwrite modal; Cancel makes no network calls; Overwrite regenerates
    files and returns to the detail page with updated PDF/DOCX links.
  - For a brand-new application reaching Step 5 for the first time (no
    `resume_pdf_path` yet), no modal appears.

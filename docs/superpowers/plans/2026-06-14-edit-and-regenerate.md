# Edit & Regenerate Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users jump from the application detail page into the wizard's Finalize step to edit and regenerate the resume/cover letter PDF+DOCX for any application, with a confirmation dialog before overwriting existing files.

**Architecture:** Two frontend-only changes, no backend changes. (1) `/apply/[id]/page.tsx` gets a new "Edit documents" link that routes to `/apply/new?id={id}`, which `inferStep` already resolves to Step 5 (Finalize) once `resume_pdf_path` is set. (2) `/apply/new/page.tsx` Step 5 gains a custom confirmation modal that gates the existing "Finalize & Generate PDFs" action whenever PDFs already existed when the wizard loaded.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind classes, existing `Btn`/`pillBtnCls` UI conventions. No test runner exists for the frontend — verification is via `tsc --noEmit` and manual checks in the running dev app.

---

### Task 1: "Edit documents" link on the detail page

**Files:**
- Modify: `app/frontend/app/apply/[id]/page.tsx:401-402` (new `canEdit` constant)
- Modify: `app/frontend/app/apply/[id]/page.tsx:462-471` (new link)

- [ ] **Step 1: Add the `canEdit` constant**

In `app/frontend/app/apply/[id]/page.tsx`, find:

```tsx
  const canContinue = !app.resume_pdf_path && (app.status === "New" || app.status === "Draft");
  const canRegen = !canContinue && (app.status === "New" || app.status === "Draft");
```

Replace with:

```tsx
  const canContinue = !app.resume_pdf_path && (app.status === "New" || app.status === "Draft");
  const canRegen = !canContinue && (app.status === "New" || app.status === "Draft");
  const canEdit = !!app.resume_final_md && !canContinue;
```

- [ ] **Step 2: Add the "Edit documents" link**

In the same file, find:

```tsx
        {canContinue && (
          <Link href={`/apply/new?id=${id}`} className={pillBtnCls(true)}>
            Continue wizard
          </Link>
        )}
        {canRegen && (
          <Link href={`/apply/new?id=${id}&regen=1`} className={pillBtnCls()}>
            Regenerate
          </Link>
        )}
```

Replace with:

```tsx
        {canContinue && (
          <Link href={`/apply/new?id=${id}`} className={pillBtnCls(true)}>
            Continue wizard
          </Link>
        )}
        {canRegen && (
          <Link href={`/apply/new?id=${id}&regen=1`} className={pillBtnCls()}>
            Regenerate
          </Link>
        )}
        {canEdit && (
          <Link href={`/apply/new?id=${id}`} className={pillBtnCls()}>
            Edit documents
          </Link>
        )}
```

- [ ] **Step 3: Type-check**

Run: `cd app/frontend && npx tsc --noEmit`
Expected: no errors (exits 0).

- [ ] **Step 4: Commit**

```bash
git add app/frontend/app/apply/\[id\]/page.tsx
git commit -m "feat(frontend): add edit-documents link to application detail page"
```

---

### Task 2: Overwrite confirmation modal on wizard Step 5

**Files:**
- Modify: `app/frontend/app/apply/new/page.tsx:190-195` (new ref + state)
- Modify: `app/frontend/app/apply/new/page.tsx:197-212` (record existing-pdf flag on load)
- Modify: `app/frontend/app/apply/new/page.tsx:377-383` (split `handlePdf`)
- Modify: `app/frontend/app/apply/new/page.tsx:671-685` (render modal)

- [ ] **Step 1: Add the ref and modal state**

Find:

```tsx
  // Step 4
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const finalsBaselineRef = useRef<{ resume: string; cl: string; address: string } | null>(null);
```

Replace with:

```tsx
  // Step 4
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const finalsBaselineRef = useRef<{ resume: string; cl: string; address: string } | null>(null);
  const hadExistingPdfRef = useRef(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
```

- [ ] **Step 2: Record whether PDFs already existed when loading an existing application**

Find:

```tsx
  useEffect(() => {
    if (!existingId) return;
    api.get(`/api/tracker/${existingId}`).then((app) => {
      setCompany(app.company);
      setJobTitle(app.job_title);
      setLanguage(app.language);
      setJd(app.job_description ?? "");
      setResumeMd(app.resume_final_md ?? app.resume_draft_md ?? "");
      setClMd(app.cover_letter_final_md ?? app.cover_letter_draft_md ?? "");
      setCompanyAddress(app.company_address ?? "");
      setClNotes(app.cover_letter_notes ?? "");
      setSourceUrl(app.source_url ?? "");
      setStep(regen ? 2 : inferStep(app));
      setLoading(false);
    });
  }, [existingId, regen]);
```

Replace with:

```tsx
  useEffect(() => {
    if (!existingId) return;
    api.get(`/api/tracker/${existingId}`).then((app) => {
      setCompany(app.company);
      setJobTitle(app.job_title);
      setLanguage(app.language);
      setJd(app.job_description ?? "");
      setResumeMd(app.resume_final_md ?? app.resume_draft_md ?? "");
      setClMd(app.cover_letter_final_md ?? app.cover_letter_draft_md ?? "");
      setCompanyAddress(app.company_address ?? "");
      setClNotes(app.cover_letter_notes ?? "");
      setSourceUrl(app.source_url ?? "");
      hadExistingPdfRef.current = !!app.resume_pdf_path;
      setStep(regen ? 2 : inferStep(app));
      setLoading(false);
    });
  }, [existingId, regen]);
```

- [ ] **Step 3: Split `handlePdf` into a gated trigger and the actual PDF generation**

Find:

```tsx
  const handlePdf = async () => {
    setGeneratingPdf(true); setPdfError("");
    await api.put("/api/application/finals", { application_id: appId, resume_md: resumeMd, cover_letter_md: clMd, company_address: companyAddress });
    const res = await api.post("/api/application/pdf", { application_id: appId }).catch((e: unknown) => ({ error: (e as Error).message }));
    if (res?.detail || res?.error) { setPdfError(res.detail ?? res.error); setGeneratingPdf(false); return; }
    router.push(`/apply/${appId}`);
  };
```

Replace with:

```tsx
  const doGeneratePdf = async () => {
    setGeneratingPdf(true); setPdfError("");
    await api.put("/api/application/finals", { application_id: appId, resume_md: resumeMd, cover_letter_md: clMd, company_address: companyAddress });
    const res = await api.post("/api/application/pdf", { application_id: appId }).catch((e: unknown) => ({ error: (e as Error).message }));
    if (res?.detail || res?.error) { setPdfError(res.detail ?? res.error); setGeneratingPdf(false); return; }
    router.push(`/apply/${appId}`);
  };

  const handlePdf = () => {
    if (hadExistingPdfRef.current) { setShowOverwriteConfirm(true); return; }
    doGeneratePdf();
  };

  const confirmOverwrite = () => {
    setShowOverwriteConfirm(false);
    doGeneratePdf();
  };
```

- [ ] **Step 4: Render the confirmation modal in Step 5**

Find the end of the Step 4 (Finalize) block:

```tsx
              {pdfError && <ErrorBanner msg={pdfError} />}
              <div className="flex gap-2 items-center">
                <Btn onClick={() => setStep(3)}>← Back</Btn>
                {autoSaveStatus === "saving" && (
                  <span className="text-[11px] text-text-tertiary font-shell">Saving…</span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="text-[11px] text-text-tertiary font-shell">✓ Saved</span>
                )}
                <Btn primary onClick={handlePdf} disabled={generatingPdf} className="ml-auto">
                  {generatingPdf ? "Finalizing…" : "Finalize & Generate PDFs"}
                </Btn>
              </div>
            </>
          )}
```

Replace with:

```tsx
              {pdfError && <ErrorBanner msg={pdfError} />}
              <div className="flex gap-2 items-center">
                <Btn onClick={() => setStep(3)}>← Back</Btn>
                {autoSaveStatus === "saving" && (
                  <span className="text-[11px] text-text-tertiary font-shell">Saving…</span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="text-[11px] text-text-tertiary font-shell">✓ Saved</span>
                )}
                <Btn primary onClick={handlePdf} disabled={generatingPdf} className="ml-auto">
                  {generatingPdf ? "Finalizing…" : "Finalize & Generate PDFs"}
                </Btn>
              </div>
              {showOverwriteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-5 max-w-[360px] flex flex-col gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
                    <p className="text-[13px] font-shell text-text-primary m-0">
                      This will overwrite the existing CV and Cover Letter files (PDF + DOCX). Continue?
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Btn onClick={() => setShowOverwriteConfirm(false)}>Cancel</Btn>
                      <Btn primary onClick={confirmOverwrite}>Overwrite</Btn>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
```

- [ ] **Step 5: Type-check**

Run: `cd app/frontend && npx tsc --noEmit`
Expected: no errors (exits 0).

- [ ] **Step 6: Commit**

```bash
git add app/frontend/app/apply/new/page.tsx
git commit -m "feat(frontend): confirm before overwriting existing CV/cover letter files"
```

---

### Task 3: Manual verification in the running app

**Files:** none (manual browser check only)

- [ ] **Step 1: Start both servers**

```bash
cd app/backend && source ../../.venv/bin/activate && uvicorn main:app --reload &
cd app/frontend && npm run dev &
```

- [ ] **Step 2: Verify "Edit documents" link**

In the browser, open an application that already has generated PDFs (any status — e.g. Applied or Interview). Confirm:
- An "Edit documents" pill button appears in the topbar next to the download dropdowns.
- Clicking it navigates to `/apply/new?id={id}` and lands directly on **Step 5: Finalize** (step indicator shows "5" highlighted), with the existing resume/cover letter markdown pre-filled.

- [ ] **Step 3: Verify overwrite confirmation — Cancel path**

On Step 5, click "Finalize & Generate PDFs". Confirm:
- A modal appears with the text "This will overwrite the existing CV and Cover Letter files (PDF + DOCX). Continue?" and "Cancel"/"Overwrite" buttons.
- Clicking "Cancel" closes the modal, makes no network requests (check Network tab), and stays on Step 5.

- [ ] **Step 4: Verify overwrite confirmation — Overwrite path**

Make a small edit to the resume markdown, then click "Finalize & Generate PDFs" again and click "Overwrite". Confirm:
- The button shows "Finalizing…", then the page navigates back to `/apply/{id}`.
- The downloaded CV PDF/DOCX reflect the edit (open the PDF link and check the change).

- [ ] **Step 5: Verify first-time finalize has no modal**

Create a brand-new application, go through Steps 1–4 (Job Details → Analysis → Generate → Review/Skip) to reach Step 5 for the first time, and click "Finalize & Generate PDFs". Confirm:
- No overwrite modal appears (since `resume_pdf_path` was not set on load) — PDFs generate immediately and the page navigates to `/apply/{id}`.

- [ ] **Step 6: Stop dev servers**

Stop both background processes started in Step 1.

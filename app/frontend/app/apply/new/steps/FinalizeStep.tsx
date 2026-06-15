"use client";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { SectionCard, InfoText, ErrorBanner, CopyButton } from "@/components/ui-kit";
import { Btn, ClWordCount } from "../_shared";
import type { WizardState } from "../useApplicationWizard";

export function FinalizeStep({ w }: { w: WizardState }) {
  return (
    <>
      {w.jd && (
        <details className="border-[0.5px] border-border-tertiary rounded-card overflow-hidden shrink-0 group">
          <summary className="flex items-center gap-2 py-[9px] px-[13px] cursor-pointer list-none text-[12px] font-medium font-shell text-text-secondary">
            <span className="text-text-tertiary transition-transform group-open:rotate-90">›</span>
            Job description
            <span className="ml-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <CopyButton text={`${w.company} - ${w.jobTitle}\n\n${w.jd}`} title="Copy job description" />
            </span>
          </summary>
          <pre className="font-shell text-[13px] leading-[1.7] whitespace-pre-wrap text-text-secondary m-0 py-3 px-[13px] border-t-[0.5px] border-border-tertiary max-h-[280px] overflow-auto">
            {w.jd}
          </pre>
        </details>
      )}
      <SectionCard title="Company address">
        <div className="flex flex-col gap-1.5">
          <textarea
            className="w-full text-[13px] py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary outline-none resize-y min-h-[56px] font-mono"
            value={w.companyAddress}
            onChange={(e) => w.setCompanyAddress(e.target.value)}
            placeholder={"Street\nPostcode City"}
          />
          <InfoText>Used in the cover letter header. Auto-filled from research; edit if incorrect.</InfoText>
        </div>
      </SectionCard>
      <div className="grid grid-cols-2 gap-3">
        <MarkdownEditor label="Final Resume" value={w.resumeMd} onChange={w.setResumeMd} copyText={w.resumeMd} />
        <div className="flex flex-col gap-1.5">
          <MarkdownEditor label="Final Cover Letter" value={w.clMd} onChange={w.setClMd} copyText={w.clMd} />
          <ClWordCount text={w.clMd} />
        </div>
      </div>
      {w.pdfError && <ErrorBanner msg={w.pdfError} />}
      <div className="flex gap-2 items-center">
        <Btn onClick={() => w.setStep(3)}>← Back</Btn>
        {w.autoSaveStatus === "saving" && (
          <span className="text-[11px] text-text-tertiary font-shell">Saving…</span>
        )}
        {w.autoSaveStatus === "saved" && (
          <span className="text-[11px] text-text-tertiary font-shell">✓ Saved</span>
        )}
        <Btn primary onClick={w.handlePdf} disabled={w.generatingPdf} className="ml-auto">
          {w.generatingPdf ? "Finalizing…" : "Finalize & Generate PDFs"}
        </Btn>
      </div>
      {w.showOverwriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-5 max-w-[360px] flex flex-col gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            <p className="text-[13px] font-shell text-text-primary m-0">
              This will overwrite the existing CV and Cover Letter files (PDF + DOCX). Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <Btn onClick={() => w.setShowOverwriteConfirm(false)}>Cancel</Btn>
              <Btn primary onClick={w.confirmOverwrite}>Overwrite</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { SectionCard, Label, InfoText, ErrorBanner, inputCls as inputClsFn } from "@/components/ui-kit";
import { Btn } from "../_shared";
import type { WizardState } from "../useApplicationWizard";

const inputCls = inputClsFn();

export function JobDetailsStep({ w }: { w: WizardState }) {
  return (
    <>
      <SectionCard title="Job Details">
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <input className={inputCls} value={w.company} onChange={(e) => w.setCompany(e.target.value)} />
            </div>
            <div>
              <Label>Job title</Label>
              <input className={inputCls} value={w.jobTitle} onChange={(e) => w.setJobTitle(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Company website</Label>
            <input className={inputCls} type="url" value={w.companyUrl} onChange={(e) => w.setCompanyUrl(e.target.value)} placeholder="https://www.example.com" />
          </div>
          <div>
            <Label hint="optional">Job posting URL</Label>
            <input className={inputCls} type="url" value={w.sourceUrl} onChange={(e) => w.setSourceUrl(e.target.value)} placeholder="https://jobs.example.com/postings/123" />
            {w.sourceUrl && (
              <a href={w.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[11px] text-custom font-shell no-underline">
                Open posting →
              </a>
            )}
          </div>
          <div>
            <Label>Language</Label>
            <div className="flex border-[0.5px] border-border-tertiary rounded-[6px] overflow-hidden w-fit">
              {(["en", "de"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => w.setLanguage(l)}
                  className={`text-[11px] font-medium py-1 px-3 cursor-pointer font-mono border-none ${
                    w.language === l ? "bg-custom text-white" : "bg-transparent text-text-secondary"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Job description</Label>
            <textarea className={`${inputCls} resize-y min-h-[180px]`} value={w.jd} onChange={(e) => w.setJd(e.target.value)} placeholder="Paste the full job description here…" />
          </div>
          <div>
            <Label hint="optional">Cover letter notes</Label>
            <textarea className={`${inputCls} resize-y min-h-[70px]`} value={w.clNotes} onChange={(e) => w.setClNotes(e.target.value)} placeholder="e.g. mention relocating to Munich, emphasise Python over React…" />
            <InfoText>Points to incorporate. Must not contradict your resume.</InfoText>
          </div>
        </div>
      </SectionCard>
      {w.submitError && <ErrorBanner msg={w.submitError} />}
      <div>
        <Btn primary onClick={w.handleJobDetails} disabled={!w.company || !w.jobTitle || !w.jd || w.submitting}>
          {w.submitting ? "Saving…" : "Continue →"}
        </Btn>
      </div>
    </>
  );
}

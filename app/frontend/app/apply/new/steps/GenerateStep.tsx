"use client";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { SectionCard, ErrorBanner } from "@/components/ui-kit";
import { Btn, ClWordCount } from "../_shared";
import type { WizardState } from "../useApplicationWizard";

const TONES = ["direct", "startup", "contractor", "agency"] as const;

export function GenerateStep({ w }: { w: WizardState }) {
  return (
    <>
      {w.genError && <ErrorBanner msg={w.genError} />}
      {!w.generating && !w.resumeMd && (
        <SectionCard title="Generate">
          <div className="flex flex-col gap-3">
            {w.researchingCompany && (
              <p className="text-[12px] text-text-tertiary font-shell">Researching {w.company}…</p>
            )}
            {w.researchResult && (
              <div className="py-2.5 px-3 rounded-card border-[0.5px] border-border-tertiary bg-background-secondary flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-tertiary font-shell">Tone:</span>
                  <span className="text-[11px] font-medium py-0.5 px-2 rounded-full border-[0.5px] border-border-tertiary font-shell text-text-secondary">
                    {w.toneOverride || w.researchResult.tone}
                  </span>
                  <select
                    value={w.toneOverride || w.researchResult.tone}
                    onChange={(e) => w.setToneOverride(e.target.value)}
                    className="text-[11px] py-0.5 px-1.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-background-primary text-text-secondary font-shell cursor-pointer outline-none"
                  >
                    {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {w.researchResult.address && (
                  <span className="text-[11px] text-text-tertiary font-shell">Address: {w.researchResult.address}</span>
                )}
                {w.researchResult.tone_reasoning && (
                  <span className="text-[11px] text-text-tertiary font-shell">{w.researchResult.tone_reasoning}</span>
                )}
              </div>
            )}
            <Btn primary onClick={w.handleGenerate} disabled={w.researchingCompany} className="w-full justify-center">
              Generate Resume & Cover Letter
            </Btn>
          </div>
        </SectionCard>
      )}
      {w.generating && (
        <SectionCard title="Generating…">
          <pre className="text-[12px] font-mono text-text-tertiary whitespace-pre-wrap max-h-[200px] overflow-auto m-0">
            {w.genLog || "Starting…"}
          </pre>
        </SectionCard>
      )}
      {w.resumeMd && !w.generating && (
        <>
          <MarkdownEditor label="Tailored Resume" value={w.resumeMd} onChange={w.setResumeMd} />
          <MarkdownEditor label="Cover Letter" value={w.clMd} onChange={w.setClMd} />
          <ClWordCount text={w.clMd} />
        </>
      )}
      <div className="flex gap-2 flex-wrap">
        <Btn onClick={() => w.setStep(1)}>← Back</Btn>
        {w.resumeMd && !w.generating && <Btn onClick={w.handleGenerate}>Regenerate</Btn>}
        {w.resumeMd && !w.generating && (
          <Btn primary onClick={() => w.setStep(3)} className="ml-auto">Continue →</Btn>
        )}
      </div>
    </>
  );
}

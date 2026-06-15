"use client";
import { SectionCard, ErrorBanner, SkillRow } from "@/components/ui-kit";
import { Btn } from "../_shared";
import type { WizardState } from "../useApplicationWizard";

export function AnalysisStep({ w }: { w: WizardState }) {
  const { activeResult } = w;
  return (
    <>
      {w.analyzing && (
        <SectionCard>
          <p className="text-[12px] text-text-tertiary font-shell">Analysing job description…</p>
        </SectionCard>
      )}
      {w.analyzeError && <ErrorBanner msg={w.analyzeError} />}
      {activeResult && (
        <SectionCard title="Job Analysis">
          <div className="flex flex-col gap-3">
            {activeResult.core_theme && (
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-medium font-shell">{activeResult.core_theme}</span>
                {activeResult.match_score != null && (
                  <span className="text-[12px] font-mono text-text-tertiary">{activeResult.match_score}/10</span>
                )}
              </div>
            )}
            {activeResult.is_poor_match && (
              <div className="py-2 px-3 rounded-[6px] bg-badge-passed-bg text-[12px] text-badge-passed-fg font-shell">
                Many must-have skills are gaps — consider carefully.
              </div>
            )}
            {(activeResult.must_haves?.length ?? 0) > 0 && (
              <div>
                <div className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell mb-1.5">Must-haves</div>
                <div>{activeResult.must_haves!.map((item, i) => <SkillRow key={i} {...item} />)}</div>
              </div>
            )}
            {(activeResult.nice_to_haves?.length ?? 0) > 0 && (
              <div>
                <div className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell mb-1.5">Nice-to-haves</div>
                <div>{activeResult.nice_to_haves!.map((item, i) => <SkillRow key={i} {...item} />)}</div>
              </div>
            )}
            {(activeResult.ats_keywords?.length ?? 0) > 0 && (
              <div>
                <div className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell mb-1.5">ATS keywords</div>
                <div className="flex flex-wrap gap-[5px]">
                  {activeResult.ats_keywords!.map((kw) => (
                    <span key={kw} className="text-[11px] py-0.5 px-2 rounded-full bg-background-secondary text-text-secondary font-mono">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {(activeResult.strongest_angle || activeResult.weakest_point) && (
              <div className="flex flex-col gap-1.5">
                {activeResult.strongest_angle && (
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-badge-interview-bg text-badge-interview-fg font-shell">Lead with</span>
                    <span className="text-[12px] text-text-secondary font-shell">{activeResult.strongest_angle}</span>
                  </div>
                )}
                {activeResult.weakest_point && (
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-custom-l text-custom-d font-shell">Watch out</span>
                    <span className="text-[12px] text-text-secondary font-shell">{activeResult.weakest_point}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}
      <div className="flex gap-2 flex-wrap">
        <Btn onClick={() => { w.setAnalysisResult(null); w.setAnalyzeError(""); w.setStep(0); }}>← Back</Btn>
        {!w.analyzing && (
          <Btn onClick={w.runAnalysis}>{activeResult ? "Analyse again" : "Retry"}</Btn>
        )}
        <Btn primary onClick={() => w.setStep(2)} disabled={w.analyzing} className="ml-auto">
          {w.analyzing ? "Analysing…" : "Continue →"}
        </Btn>
      </div>
    </>
  );
}

"use client";
import { ReviewPanel } from "@/components/ReviewPanel";
import { SectionCard, InfoText, ErrorBanner } from "@/components/ui-kit";
import { Btn } from "../_shared";
import type { WizardState } from "../useApplicationWizard";

export function ReviewStep({ w }: { w: WizardState }) {
  return (
    <>
      {!w.reviewResult && (
        <SectionCard title="Review">
          <div className="flex flex-col gap-2.5">
            <InfoText>3 reviewers evaluate your documents: your personal persona + 2 randomly selected expert reviewers.</InfoText>
            <div className="flex gap-2 flex-wrap">
              <Btn onClick={() => w.setStep(2)}>← Back</Btn>
              <Btn onClick={() => w.setStep(4)} disabled={w.reviewing}>Skip</Btn>
              <Btn primary onClick={w.handleReview} disabled={w.reviewing} className="ml-auto">
                {w.reviewing ? "Reviewing… (may take a few minutes)" : "Run Review"}
              </Btn>
            </div>
            {w.reviewError && <ErrorBanner msg={w.reviewError} />}
          </div>
        </SectionCard>
      )}
      {w.reviewResult && (
        <>
          <div className="flex gap-2">
            <Btn onClick={() => w.setStep(2)}>← Back</Btn>
            <Btn onClick={() => { w.setReviewResult(null); w.handleReview(); }}>Re-review</Btn>
          </div>
          <ReviewPanel
            result={w.reviewResult}
            resumeDraft={w.resumeMd}
            clDraft={w.clMd}
            onApply={w.applyRewrites}
          />
        </>
      )}
    </>
  );
}

"use client";
import { Suspense } from "react";
import { StepBar } from "./_shared";
import { useApplicationWizard } from "./useApplicationWizard";
import { JobDetailsStep } from "./steps/JobDetailsStep";
import { AnalysisStep } from "./steps/AnalysisStep";
import { GenerateStep } from "./steps/GenerateStep";
import { ReviewStep } from "./steps/ReviewStep";
import { FinalizeStep } from "./steps/FinalizeStep";

function NewApplicationPageInner() {
  const w = useApplicationWizard();

  if (w.loading) {
    return (
      <div className="p-10 text-[12px] text-text-tertiary font-shell">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background-primary">

      {/* Topbar */}
      <div className="flex items-center gap-4 py-2.5 px-5 shrink-0 border-b-[0.5px] border-border-tertiary flex-wrap">
        <span className="text-[13px] font-semibold font-shell text-text-primary shrink-0">
          {w.existingId ? `${w.company} — ${w.jobTitle}` : "New Application"}
        </span>
        <StepBar current={w.step} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-6 px-5">
        <div className="max-w-[680px] mx-auto flex flex-col gap-3.5">
          {w.step === 0 && <JobDetailsStep w={w} />}
          {w.step === 1 && <AnalysisStep w={w} />}
          {w.step === 2 && <GenerateStep w={w} />}
          {w.step === 3 && <ReviewStep w={w} />}
          {w.step === 4 && <FinalizeStep w={w} />}
        </div>
      </div>
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <Suspense>
      <NewApplicationPageInner />
    </Suspense>
  );
}

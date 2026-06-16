"use client";
import React from "react";
import { type SaveState, SectionCard, GrowTextarea, mutedTextCls } from "@/components/ui-kit";
import { type InterviewPrep } from "../types";
import { PrepQAList } from "../shared";

// ─── Background tab — company analysis, weak spots, salary prep notes ──────────

export function CompanyBackgroundTab({
  prep,
  updatePrep,
  generatingPrep,
  hasPrep,
}: {
  prep: InterviewPrep;
  updatePrep: (patch: Partial<InterviewPrep>) => void;
  generatingPrep: boolean;
  hasPrep: boolean;
  prepSaveState?: SaveState;
}) {
  if (generatingPrep) {
    return <div className={`text-center py-5 ${mutedTextCls()}`}>Generating…</div>;
  }
  if (!hasPrep) {
    return (
      <div className={`text-center py-12 px-5 ${mutedTextCls()}`}>
        No prep yet — generate one from the Overview tab.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <SectionCard title="Company Analysis">
        <GrowTextarea
          value={prep.company_analysis}
          onChange={(v) => updatePrep({ company_analysis: v })}
          placeholder="Company analysis…"
          className="leading-[1.75]"
        />
      </SectionCard>

      <SectionCard title="Weak Spots">
        <PrepQAList
          items={prep.weak_spots}
          onChange={(items) => updatePrep({ weak_spots: items })}
          aPlaceholder="Honest answer…"
        />
      </SectionCard>

      <SectionCard title="Salary & Negotiation">
        <GrowTextarea
          value={prep.salary}
          onChange={(v) => updatePrep({ salary: v })}
          placeholder="Market range + answer script…"
          className="leading-[1.75]"
        />
      </SectionCard>
    </div>
  );
}

"use client";
import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  GrowTextarea, SectionCard, iconBtnCls, monoMutedCls,
} from "@/components/ui-kit";
import { type InterviewNotes } from "../types";
import { uid } from "../helpers";

const SEVERITY_NEXT: Record<string, "red" | "amber" | "green"> = {
  red: "amber", amber: "green", green: "red",
};

const SEVERITY_DOT_CLS: Record<string, string> = {
  red: "bg-badge-passed-fg",
  amber: "bg-custom",
  green: "bg-badge-interview-fg",
};

// ─── Anticipate tab — expected questions they'll ask + skill gaps ───────────────

export function CompanyAnticipateTab({
  notes,
  update,
}: {
  notes: InterviewNotes;
  update: (patch: Partial<InterviewNotes>) => void;
}) {
  const [newGapSkill, setNewGapSkill] = useState("");
  const [newExpectedQ, setNewExpectedQ] = useState("");

  return (
    <div className="flex flex-col gap-3">
      {/* Expected questions from them + prepared answers */}
      <SectionCard title="Questions they might ask">
        {notes.questions.map((item, i) => (
          <div key={item.id} className="pb-2.5 border-b-[0.5px] border-border-tertiary mb-2.5">
            <div className="flex gap-2 items-start">
              <span className={`${monoMutedCls("11px")} mt-0.5 shrink-0 min-w-[16px]`}>{i + 1}.</span>
              <GrowTextarea
                value={item.q}
                onChange={(v) => update({ questions: notes.questions.map((q) => (q.id === item.id ? { ...q, q: v } : q)) })}
                placeholder="Question…"
                className="font-medium !text-text-primary flex-1"
              />
              <button
                onClick={() => update({ questions: notes.questions.filter((q) => q.id !== item.id) })}
                className={`${iconBtnCls} hover:text-badge-passed-fg`}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <GrowTextarea
              value={item.a}
              onChange={(v) => update({ questions: notes.questions.map((q) => (q.id === item.id ? { ...q, a: v } : q)) })}
              placeholder="My prepared answer…"
              className="ml-6 mt-1"
            />
          </div>
        ))}
        <input
          value={newExpectedQ}
          onChange={(e) => setNewExpectedQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newExpectedQ.trim()) {
              update({ questions: [...notes.questions, { id: uid(), q: newExpectedQ.trim(), a: "" }] });
              setNewExpectedQ("");
            }
          }}
          placeholder="Add expected question… (Enter)"
          className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none"
        />
      </SectionCard>

      {/* Skill gaps */}
      <SectionCard title="Skill gaps">
        {notes.gaps.map((gap) => (
          <div key={gap.id} className="flex items-start gap-2 pb-2 border-b-[0.5px] border-border-tertiary mb-2">
            <button
              title="Click to change severity"
              onClick={() => update({ gaps: notes.gaps.map((g) => (g.id === gap.id ? { ...g, severity: SEVERITY_NEXT[g.severity] } : g)) })}
              className={`w-2.5 h-2.5 rounded-full border-none cursor-pointer shrink-0 mt-1 ${SEVERITY_DOT_CLS[gap.severity]}`}
            />
            <div className="flex-1 flex flex-col gap-0.5">
              <input
                value={gap.skill}
                onChange={(e) => update({ gaps: notes.gaps.map((g) => (g.id === gap.id ? { ...g, skill: e.target.value } : g)) })}
                placeholder="Skill…"
                className="text-[12px] font-medium bg-transparent border-none outline-none text-text-primary font-shell w-full"
              />
              <GrowTextarea
                value={gap.note}
                onChange={(v) => update({ gaps: notes.gaps.map((g) => (g.id === gap.id ? { ...g, note: v } : g)) })}
                placeholder="Notes on this gap…"
              />
            </div>
            <button
              onClick={() => update({ gaps: notes.gaps.filter((g) => g.id !== gap.id) })}
              className={`${iconBtnCls} hover:text-badge-passed-fg`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <input
          value={newGapSkill}
          onChange={(e) => setNewGapSkill(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newGapSkill.trim()) {
              update({ gaps: [...notes.gaps, { id: uid(), skill: newGapSkill.trim(), severity: "amber", note: "" }] });
              setNewGapSkill("");
            }
          }}
          placeholder="Add skill gap… (Enter, starts amber)"
          className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none"
        />
      </SectionCard>
    </div>
  );
}

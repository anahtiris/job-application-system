"use client";
import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/lib/api";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  GrowTextarea, cardBoxCls, cardHeaderBarCls, monoMutedCls, mutedTextCls,
} from "@/components/ui-kit";
import { type GeneralPrep, type InterviewNotes, DEFAULT_PREP } from "../types";
import { parsePrepSection } from "../helpers";
import { SortableItem } from "../shared";

// ─── Questions tab ──────────────────────────────────────────────────────────────

export function CompanyQuestionsTab({
  notes,
  update,
  prepMd,
}: {
  notes: InterviewNotes;
  update: (patch: Partial<InterviewNotes>) => void;
  prepMd: string;
}) {
  const [generalPrep, setGeneralPrep] = useState<GeneralPrep>(DEFAULT_PREP);
  const [catCollapsed, setCatCollapsed] = useState<Record<string, boolean>>({});
  const [prepAskCollapsed, setPrepAskCollapsed] = useState(false);

  useEffect(() => {
    api.get("/api/settings/general-prep").then((data) => {
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        setGeneralPrep({ ...DEFAULT_PREP, ...(data as Partial<GeneralPrep>) });
      }
    }).catch(() => {});
  }, []);

  const toggleMyQ = (qId: string) => {
    const cur = (notes.my_q_state ?? {})[qId] ?? { asked: false, note: "" };
    update({ my_q_state: { ...(notes.my_q_state ?? {}), [qId]: { ...cur, asked: !cur.asked } } });
  };
  const setMyQNote = (qId: string, note: string) => {
    const cur = (notes.my_q_state ?? {})[qId] ?? { asked: false, note: "" };
    update({ my_q_state: { ...(notes.my_q_state ?? {}), [qId]: { ...cur, note } } });
  };

  const cats = generalPrep.question_categories ?? [];
  const allQs = cats.flatMap((c) => c.questions);

  const compCatSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorderCompCats = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.id === active.id);
    const newIdx = cats.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(cats, oldIdx, newIdx);
    const next = { ...generalPrep, question_categories: reordered };
    setGeneralPrep(next);
    api.put("/api/settings/general-prep", next).catch(() => {});
  };
  const askedCount = allQs.filter((q) => (notes.my_q_state ?? {})[q.id]?.asked).length;

  // "Questions to Ask" parsed from prep markdown
  const prepAskText = prepMd ? parsePrepSection(prepMd, "Questions to Ask") : "";
  const prepAskItems = prepAskText
    .split("\n")
    .map((l) => l.replace(/^\d+\.\s+/, "").replace(/^[-*]\s+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
  const prepAskAsked = prepAskItems.filter((_, i) => (notes.my_q_state ?? {})[`prep-ask-${i}`]?.asked).length;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Total asked counter */}
      {(allQs.length > 0 || prepAskItems.length > 0) && (
        <div className={monoMutedCls("11px")}>
          {askedCount + prepAskAsked}/{allQs.length + prepAskItems.length} asked
        </div>
      )}

      {/* "Questions to Ask" from prep — collapsible */}
      {prepAskItems.length > 0 && (() => {
        const isCollapsed = prepAskCollapsed;
        return (
          <div className={cardBoxCls}>
            <div
              className={`${cardHeaderBarCls(isCollapsed, "bg-custom-l")} cursor-pointer`}
              onClick={() => setPrepAskCollapsed((v) => !v)}
            >
              <span className="text-[10px] text-custom leading-none">{isCollapsed ? "▶" : "▼"}</span>
              <span className="flex-1 text-[12px] font-semibold text-custom-d font-shell">
                Specific questions for this interview
              </span>
              <span className="text-[10px] font-mono text-custom-d">
                {prepAskAsked}/{prepAskItems.length}
              </span>
            </div>
            {!isCollapsed && (
              <div className="py-1 px-3">
                {prepAskItems.map((q, i) => {
                  const key = `prep-ask-${i}`;
                  const state = (notes.my_q_state ?? {})[key] ?? { asked: false, note: "" };
                  const isLast = i === prepAskItems.length - 1;
                  return (
                    <div key={key} className={`py-[7px] ${isLast ? "" : "border-b-[0.5px] border-border-tertiary"}`}>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => {
                            const cur = (notes.my_q_state ?? {})[key] ?? { asked: false, note: "" };
                            update({ my_q_state: { ...(notes.my_q_state ?? {}), [key]: { ...cur, asked: !cur.asked } } });
                          }}
                          className={`w-[15px] h-[15px] rounded-[4px] shrink-0 mt-0.5 cursor-pointer flex items-center justify-center ${
                            state.asked ? "border-none bg-badge-interview-fg" : "border-[0.5px] border-border-tertiary bg-transparent"
                          }`}
                        >
                          {state.asked && <Check size={9} color="#fff" />}
                        </button>
                        <span className={`flex-1 text-[12px] font-shell ${state.asked ? "text-text-tertiary line-through" : "text-text-secondary"}`}>
                          {q}
                        </span>
                      </div>
                      <GrowTextarea
                        value={state.note}
                        onChange={(v) => {
                          const cur = (notes.my_q_state ?? {})[key] ?? { asked: false, note: "" };
                          update({ my_q_state: { ...(notes.my_q_state ?? {}), [key]: { ...cur, note: v } } });
                        }}
                        placeholder="Their answer…"
                        className="ml-[23px] mt-2 !text-[12px]"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* General prep categories — each collapsible, sortable */}
      <DndContext sensors={compCatSensors} collisionDetection={closestCenter} onDragEnd={reorderCompCats}>
        <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cats.map((cat) => {
            const isCollapsed = catCollapsed[cat.id] === true;
            const catAsked = cat.questions.filter((q) => (notes.my_q_state ?? {})[q.id]?.asked).length;
            return (
              <SortableItem key={cat.id} id={cat.id}>
                {(grip) => (
                  <div className={cardBoxCls}>
                    <div className={cardHeaderBarCls(isCollapsed)}>
                      {grip}
                      <button
                        onClick={() => setCatCollapsed((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                        className="bg-transparent border-none cursor-pointer text-text-tertiary pr-0.5 shrink-0 text-[10px] leading-none"
                      >
                        {isCollapsed ? "▶" : "▼"}
                      </button>
                      <span className="flex-1 text-[12px] font-medium font-shell">{cat.name}</span>
                      {cat.questions.length > 0 && (
                        <span className={monoMutedCls("10px")}>
                          {catAsked}/{cat.questions.length}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div className="py-1 px-3">
                        {cat.questions.map((q, qi) => {
                          const state = (notes.my_q_state ?? {})[q.id] ?? { asked: false, note: "" };
                          const isLast = qi === cat.questions.length - 1;
                          return (
                            <div key={q.id} className={`py-[7px] ${isLast ? "" : "border-b-[0.5px] border-border-tertiary"}`}>
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => toggleMyQ(q.id)}
                                  className={`w-[15px] h-[15px] rounded-[4px] shrink-0 mt-0.5 cursor-pointer flex items-center justify-center ${
                                    state.asked ? "border-none bg-badge-interview-fg" : "border-[0.5px] border-border-tertiary bg-transparent"
                                  }`}
                                >
                                  {state.asked && <Check size={9} color="#fff" />}
                                </button>
                                <span className={`flex-1 text-[12px] font-shell ${state.asked ? "text-text-tertiary line-through" : "text-text-secondary"}`}>
                                  {q.text}
                                </span>
                              </div>
                              <GrowTextarea
                                value={state.note}
                                onChange={(v) => setMyQNote(q.id, v)}
                                placeholder="Their answer…"
                                className="ml-[23px] mt-2 !text-[12px]"
                              />
                            </div>
                          );
                        })}
                        {cat.questions.length === 0 && (
                          <div className={`py-2 ${mutedTextCls("11px")}`}>
                            No questions in this category.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>
      {cats.length === 0 && prepAskItems.length === 0 && (
        <div className={`text-center p-8 ${mutedTextCls()}`}>
          No questions — generate prep to get role-specific questions, or add categories in General prep.
        </div>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  SaveIndicator, useAutoSave, GrowTextarea, SectionCard,
} from "@/components/ui-kit";
import { type GeneralPrep, type QAItem, type MyQuestion, DEFAULT_PREP } from "../types";
import { uid } from "../helpers";
import { TabBar, LangToggle } from "../shared";
import { GeneralQATab } from "./GeneralQATab";
import { GeneralMyQuestionsTab } from "./GeneralMyQuestionsTab";

// ─── General Prep Panel ────────────────────────────────────────────────────────

const GENERAL_TABS = ["Introduction", "Common Q&A", "Behavioral", "My questions"] as const;
type GeneralTab = (typeof GENERAL_TABS)[number];

export function GeneralPrepPanel() {
  const [prep, setPrep] = useState<GeneralPrep>(DEFAULT_PREP);
  const [tab, setTab] = useState<GeneralTab>("Introduction");
  const [lang, setLang] = useState<"en" | "de">("en");

  useEffect(() => {
    api.get("/api/settings/general-prep").then((data) => {
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        setPrep({ ...DEFAULT_PREP, ...(data as Partial<GeneralPrep>) });
      }
    }).catch(() => {});
  }, []);

  const saveFn = useCallback(async (p: GeneralPrep) => {
    await api.put("/api/settings/general-prep", p);
  }, []);

  const { saveState, markDirty } = useAutoSave(prep, saveFn);

  const update = (patch: Partial<GeneralPrep>) => {
    markDirty();
    setPrep((p) => ({ ...p, ...patch }));
  };

  const updateQA = (field: "common_qa" | "behavioral_qa", items: QAItem[]) =>
    update({ [field]: items });

  const addQA = (field: "common_qa" | "behavioral_qa") =>
    updateQA(field, [...prep[field], { id: uid(), q_en: "", q_de: "", a_en: "", a_de: "" }]);

  const deleteQA = (field: "common_qa" | "behavioral_qa", id: string) =>
    updateQA(field, prep[field].filter((i) => i.id !== id));

  const patchQA = (field: "common_qa" | "behavioral_qa", id: string, patch: Partial<QAItem>) =>
    updateQA(field, prep[field].map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const cats = prep.question_categories ?? [];

  const addCategory = () =>
    update({ question_categories: [...cats, { id: uid(), name: "New Category", questions: [] }] });

  const deleteCategory = (catId: string) =>
    update({ question_categories: cats.filter((c) => c.id !== catId) });

  const renameCategory = (catId: string, name: string) =>
    update({ question_categories: cats.map((c) => (c.id === catId ? { ...c, name } : c)) });

  const addQuestionToCategory = (catId: string, text: string) =>
    update({
      question_categories: cats.map((c) =>
        c.id === catId ? { ...c, questions: [...c.questions, { id: uid(), text, done: false }] } : c
      ),
    });

  const deleteQuestionFromCategory = (catId: string, qId: string) =>
    update({
      question_categories: cats.map((c) =>
        c.id === catId ? { ...c, questions: c.questions.filter((q) => q.id !== qId) } : c
      ),
    });

  const reorderCategories = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.id === active.id);
    const newIdx = cats.findIndex((c) => c.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1)
      update({ question_categories: arrayMove(cats, oldIdx, newIdx) });
  };

  const reorderQuestionsInCategory = (catId: string, questions: MyQuestion[]) =>
    update({ question_categories: cats.map((c) => (c.id === catId ? { ...c, questions } : c)) });

  const qaField = tab === "Common Q&A" ? "common_qa" : "behavioral_qa";

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center py-[11px] px-4 border-b-[0.5px] border-border-tertiary gap-2.5 shrink-0 flex-wrap">
        <span className="text-[14px] font-medium font-shell">General prep</span>
        <TabBar tabs={[...GENERAL_TABS]} active={tab} onChange={(t) => setTab(t as GeneralTab)} />
        {tab !== "My questions" && <LangToggle lang={lang} onChange={setLang} />}
        <SaveIndicator state={saveState} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-3.5 px-4 flex flex-col gap-3 min-h-0">

        {/* Introduction */}
        {tab === "Introduction" && (
          <SectionCard title="Self introduction">
            <GrowTextarea
              value={prep.intro[lang]}
              onChange={(v) => update({ intro: { ...prep.intro, [lang]: v } })}
              placeholder={`Write your ${lang === "en" ? "English" : "German"} introduction…`}
            />
          </SectionCard>
        )}

        {/* Common Q&A or Behavioral */}
        {(tab === "Common Q&A" || tab === "Behavioral") && (
          <GeneralQATab
            title={tab === "Common Q&A" ? "Common questions" : "Behavioral Q&A"}
            items={prep[qaField]}
            lang={lang}
            onAdd={() => addQA(qaField)}
            onPatch={(id, patch) => patchQA(qaField, id, patch)}
            onDelete={(id) => deleteQA(qaField, id)}
          />
        )}

        {/* My questions */}
        {tab === "My questions" && (
          <GeneralMyQuestionsTab
            categories={cats}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
            onRenameCategory={renameCategory}
            onAddQuestion={addQuestionToCategory}
            onDeleteQuestion={deleteQuestionFromCategory}
            onReorderCategories={reorderCategories}
            onReorderQuestions={reorderQuestionsInCategory}
          />
        )}
      </div>
    </>
  );
}

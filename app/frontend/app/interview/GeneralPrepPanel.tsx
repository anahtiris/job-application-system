"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { api } from "@/lib/api";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SaveIndicator, useAutoSave, GrowTextarea, SectionCard,
  cardBoxCls, cardHeaderBarCls, iconBtnCls, mutedTextCls, monoMutedCls,
} from "@/components/ui-kit";
import { type GeneralPrep, type QAItem, type MyQuestion, type QuestionCategory, DEFAULT_PREP } from "./types";
import { uid } from "./helpers";
import { TabBar, LangToggle, QARow } from "./shared";

// ─── General Prep Panel ────────────────────────────────────────────────────────

const GENERAL_TABS = ["Introduction", "Common Q&A", "Behavioral", "My questions"] as const;
type GeneralTab = (typeof GENERAL_TABS)[number];

export function GeneralPrepPanel() {
  const [prep, setPrep] = useState<GeneralPrep>(DEFAULT_PREP);
  const [tab, setTab] = useState<GeneralTab>("Introduction");
  const [lang, setLang] = useState<"en" | "de">("en");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/api/settings/general-prep").then((data) => {
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        setPrep({ ...DEFAULT_PREP, ...(data as Partial<GeneralPrep>) });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const saveFn = useCallback(async (p: GeneralPrep) => {
    await api.put("/api/settings/general-prep", p);
  }, []);

  const saveState = useAutoSave(loaded ? prep : DEFAULT_PREP, saveFn);

  const update = (patch: Partial<GeneralPrep>) => setPrep((p) => ({ ...p, ...patch }));

  const updateQA = (field: "common_qa" | "behavioral_qa", items: QAItem[]) =>
    update({ [field]: items });

  const addQA = (field: "common_qa" | "behavioral_qa") =>
    updateQA(field, [...prep[field], { id: uid(), q_en: "", q_de: "", a_en: "", a_de: "" }]);

  const deleteQA = (field: "common_qa" | "behavioral_qa", id: string) =>
    updateQA(field, prep[field].filter((i) => i.id !== id));

  const patchQA = (field: "common_qa" | "behavioral_qa", id: string, patch: Partial<QAItem>) =>
    updateQA(field, prep[field].map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const cats = prep.question_categories ?? [];

  const catSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
          <SectionCard title={tab === "Common Q&A" ? "Common questions" : "Behavioral Q&A"}>
            {prep[qaField].length === 0 && (
              <p className={mutedTextCls()}>
                No questions yet.
              </p>
            )}
            {prep[qaField].map((item, i) => (
              <QARow
                key={item.id}
                item={item}
                lang={lang}
                isLast={i === prep[qaField].length - 1}
                onPatch={(patch) => patchQA(qaField, item.id, patch)}
                onDelete={() => deleteQA(qaField, item.id)}
              />
            ))}
            <button
              onClick={() => addQA(qaField)}
              className="inline-flex items-center gap-[5px] mt-2 text-[12px] font-medium text-amb bg-transparent border-none cursor-pointer font-shell p-0"
            >
              <Plus size={13} /> Add question
            </button>
          </SectionCard>
        )}

        {/* My questions */}
        {tab === "My questions" && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center">
              <button
                onClick={addCategory}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
              >
                <Plus size={12} /> Add category
              </button>
            </div>
            <DndContext sensors={catSensors} collisionDetection={closestCenter} onDragEnd={reorderCategories}>
              <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {cats.map((cat) => (
                  <SortableCategoryCard
                    key={cat.id}
                    category={cat}
                    onRename={(name) => renameCategory(cat.id, name)}
                    onDelete={() => deleteCategory(cat.id)}
                    onAddQuestion={(text) => addQuestionToCategory(cat.id, text)}
                    onDeleteQuestion={(qId) => deleteQuestionFromCategory(cat.id, qId)}
                    onReorderQuestions={(qs) => reorderQuestionsInCategory(cat.id, qs)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {cats.length === 0 && (
              <div className={`text-center p-8 ${mutedTextCls()}`}>
                No categories — add one above.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── My questions row ──────────────────────────────────────────────────────────

function MyQuestionRow({
  item, onDelete,
  dragListeners, dragAttributes,
}: {
  item: MyQuestion;
  onDelete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: any;
}) {
  return (
    <div className="flex items-center gap-1.5 py-[5px] group">
      <button
        {...dragListeners}
        {...dragAttributes}
        className="bg-transparent border-none cursor-grab text-text-tertiary p-0 shrink-0 flex items-center opacity-25 group-hover:opacity-70 transition-opacity touch-none"
      >
        <GripVertical size={12} />
      </button>
      <span className="flex-1 text-[12px] font-shell text-text-secondary">
        {item.text}
      </span>
      <button
        onClick={onDelete}
        className={`${iconBtnCls} opacity-0 group-hover:opacity-100 hover:text-badge-passed-fg transition-opacity`}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function SortableMyQuestionRow({ item, onDelete }: { item: MyQuestion; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <MyQuestionRow item={item} onDelete={onDelete} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  );
}

// ─── Categorized questions ─────────────────────────────────────────────────────

function QuestionCategoryCard({
  category, onRename, onDelete, onAddQuestion, onDeleteQuestion, onReorderQuestions,
  dragListeners, dragAttributes,
}: {
  category: QuestionCategory;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddQuestion: (text: string) => void;
  onDeleteQuestion: (qId: string) => void;
  onReorderQuestions: (questions: MyQuestion[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: any;
}) {
  const [newQ, setNewQ] = useState("");
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(category.name);
  const [collapsed, setCollapsed] = useState(false);
  const total = category.questions.length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const commitName = () => {
    const trimmed = nameVal.trim();
    onRename(trimmed || category.name);
    setEditing(false);
  };

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = category.questions.findIndex((q) => q.id === active.id);
    const newIdx = category.questions.findIndex((q) => q.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) onReorderQuestions(arrayMove(category.questions, oldIdx, newIdx));
  };

  return (
    <div className={cardBoxCls}>
      {/* Category header */}
      <div className={cardHeaderBarCls(collapsed)}>
        {/* Drag handle for category */}
        <button
          {...dragListeners}
          {...dragAttributes}
          className="bg-transparent border-none cursor-grab text-text-tertiary p-0 shrink-0 flex items-center opacity-40 touch-none"
        >
          <GripVertical size={12} />
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="bg-transparent border-none cursor-pointer text-text-tertiary pr-0.5 shrink-0 text-[10px] leading-none"
        >
          {collapsed ? "▶" : "▼"}
        </button>

        {editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") { setNameVal(category.name); setEditing(false); }
            }}
            className="flex-1 text-[12px] font-medium bg-transparent border-none outline-none text-text-primary font-shell p-0"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="flex-1 text-left text-[12px] font-medium bg-transparent border-none cursor-text text-text-primary font-shell p-0"
          >
            {category.name}
          </button>
        )}
        {total > 0 && (
          <span className={`${monoMutedCls("10px")} shrink-0`}>
            {total}
          </span>
        )}
        <button
          onClick={onDelete}
          className={`${iconBtnCls} flex items-center hover:text-badge-passed-fg`}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Questions + add input (hidden when collapsed) */}
      {!collapsed && (
        <div className="pt-1.5 px-3 pb-2.5 flex flex-col">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
            <SortableContext items={category.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {category.questions.map((q) => (
                <SortableMyQuestionRow
                  key={q.id}
                  item={q}
                  onDelete={() => onDeleteQuestion(q.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <div className={total > 0 ? "mt-1.5" : ""}>
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newQ.trim()) {
                  onAddQuestion(newQ.trim());
                  setNewQ("");
                }
              }}
              placeholder="Add question… (Enter)"
              className="w-full text-[12px] py-1 px-[7px] rounded-[5px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SortableCategoryCard(props: React.ComponentProps<typeof QuestionCategoryCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.category.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 0 }}
    >
      <QuestionCategoryCard {...props} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  );
}

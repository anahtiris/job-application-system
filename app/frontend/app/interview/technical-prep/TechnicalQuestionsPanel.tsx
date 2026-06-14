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
  SaveIndicator, useAutoSave,
  cardBoxCls, cardHeaderBarCls, iconBtnCls, mutedTextCls, monoMutedCls,
} from "@/components/ui-kit";
import { type GeneralPrep, type QAItem, type TechQAGroup, DEFAULT_PREP } from "./types";
import { uid } from "./helpers";
import { LangToggle, QARow } from "./shared";

// ─── Technical Questions Panel ─────────────────────────────────────────────────

export function TechnicalQuestionsPanel() {
  const [prep, setPrep] = useState<GeneralPrep>(DEFAULT_PREP);
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

  const groups = prep.technical_qa_groups ?? [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addGroup = () =>
    update({ technical_qa_groups: [...groups, { id: uid(), name: "New Group", questions: [] }] });

  const deleteGroup = (groupId: string) =>
    update({ technical_qa_groups: groups.filter((g) => g.id !== groupId) });

  const renameGroup = (groupId: string, name: string) =>
    update({ technical_qa_groups: groups.map((g) => (g.id === groupId ? { ...g, name } : g)) });

  const addQuestionToGroup = (groupId: string) =>
    update({
      technical_qa_groups: groups.map((g) =>
        g.id === groupId ? { ...g, questions: [...g.questions, { id: uid(), q_en: "", q_de: "", a_en: "", a_de: "" }] } : g
      ),
    });

  const patchQuestionInGroup = (groupId: string, qId: string, patch: Partial<QAItem>) =>
    update({
      technical_qa_groups: groups.map((g) =>
        g.id === groupId ? { ...g, questions: g.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)) } : g
      ),
    });

  const deleteQuestionFromGroup = (groupId: string, qId: string) =>
    update({
      technical_qa_groups: groups.map((g) =>
        g.id === groupId ? { ...g, questions: g.questions.filter((q) => q.id !== qId) } : g
      ),
    });

  const reorderGroups = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex((g) => g.id === active.id);
    const newIdx = groups.findIndex((g) => g.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) update({ technical_qa_groups: arrayMove(groups, oldIdx, newIdx) });
  };

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center py-[11px] px-4 border-b-[0.5px] border-border-tertiary gap-2.5 shrink-0 flex-wrap">
        <span className="text-[14px] font-medium font-shell">Technical questions</span>
        <LangToggle lang={lang} onChange={setLang} />
        <SaveIndicator state={saveState} />
        <button
          onClick={addGroup}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
        >
          <Plus size={12} /> Add group
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-3.5 px-4 flex flex-col gap-2.5 min-h-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderGroups}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            {groups.map((group) => (
              <SortableTechQAGroupCard
                key={group.id}
                group={group}
                lang={lang}
                onRename={(name) => renameGroup(group.id, name)}
                onDelete={() => deleteGroup(group.id)}
                onAddQuestion={() => addQuestionToGroup(group.id)}
                onPatchQuestion={(qId, patch) => patchQuestionInGroup(group.id, qId, patch)}
                onDeleteQuestion={(qId) => deleteQuestionFromGroup(group.id, qId)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {groups.length === 0 && (
          <div className={`text-center p-8 ${mutedTextCls()}`}>
            No groups — add one above.
          </div>
        )}
      </div>
    </>
  );
}

// ─── Technical Q&A groups ───────────────────────────────────────────────────────

function TechQAGroupCard({
  group, lang, onRename, onDelete, onAddQuestion, onPatchQuestion, onDeleteQuestion,
  dragListeners, dragAttributes,
}: {
  group: TechQAGroup;
  lang: "en" | "de";
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddQuestion: () => void;
  onPatchQuestion: (qId: string, patch: Partial<QAItem>) => void;
  onDeleteQuestion: (qId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: any;
}) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(group.name);
  const [collapsed, setCollapsed] = useState(false);
  const total = group.questions.length;

  const commitName = () => {
    const trimmed = nameVal.trim();
    onRename(trimmed || group.name);
    setEditing(false);
  };

  return (
    <div className={cardBoxCls}>
      {/* Group header */}
      <div className={cardHeaderBarCls(collapsed)}>
        {/* Drag handle for group */}
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
              if (e.key === "Escape") { setNameVal(group.name); setEditing(false); }
            }}
            className="flex-1 text-[12px] font-medium bg-transparent border-none outline-none text-text-primary font-shell p-0"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="flex-1 text-left text-[12px] font-medium bg-transparent border-none cursor-text text-text-primary font-shell p-0"
          >
            {group.name}
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

      {/* Questions + add button (hidden when collapsed) */}
      {!collapsed && (
        <div className="py-2.5 px-3">
          {total === 0 && (
            <p className={`${mutedTextCls()} mb-2`}>
              No questions yet.
            </p>
          )}
          {group.questions.map((item, i) => (
            <QARow
              key={item.id}
              item={item}
              lang={lang}
              isLast={i === group.questions.length - 1}
              onPatch={(patch) => onPatchQuestion(item.id, patch)}
              onDelete={() => onDeleteQuestion(item.id)}
              accent
            />
          ))}
          <button
            onClick={onAddQuestion}
            className={`inline-flex items-center gap-[5px] text-[12px] font-medium text-custom bg-transparent border-none cursor-pointer font-shell p-0 ${
              total > 0 ? "mt-2" : ""
            }`}
          >
            <Plus size={13} /> Add question
          </button>
        </div>
      )}
    </div>
  );
}

function SortableTechQAGroupCard(props: React.ComponentProps<typeof TechQAGroupCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.group.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 0 }}
    >
      <TechQAGroupCard {...props} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  );
}

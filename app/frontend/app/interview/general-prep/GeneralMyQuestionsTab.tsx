"use client";
import React, { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  cardBoxCls, cardHeaderBarCls, iconBtnCls, mutedTextCls, monoMutedCls,
} from "@/components/ui-kit";
import { type MyQuestion, type QuestionCategory } from "../types";

// ─── My questions tab ───────────────────────────────────────────────────────────

export function GeneralMyQuestionsTab({
  categories,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
  onAddQuestion,
  onDeleteQuestion,
  onReorderCategories,
  onReorderQuestions,
}: {
  categories: QuestionCategory[];
  onAddCategory: () => void;
  onDeleteCategory: (catId: string) => void;
  onRenameCategory: (catId: string, name: string) => void;
  onAddQuestion: (catId: string, text: string) => void;
  onDeleteQuestion: (catId: string, qId: string) => void;
  onReorderCategories: (event: DragEndEvent) => void;
  onReorderQuestions: (catId: string, questions: MyQuestion[]) => void;
}) {
  const catSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center">
        <button
          onClick={onAddCategory}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
        >
          <Plus size={12} /> Add category
        </button>
      </div>
      <DndContext sensors={catSensors} collisionDetection={closestCenter} onDragEnd={onReorderCategories}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {categories.map((cat) => (
            <SortableCategoryCard
              key={cat.id}
              category={cat}
              onRename={(name) => onRenameCategory(cat.id, name)}
              onDelete={() => onDeleteCategory(cat.id)}
              onAddQuestion={(text) => onAddQuestion(cat.id, text)}
              onDeleteQuestion={(qId) => onDeleteQuestion(cat.id, qId)}
              onReorderQuestions={(qs) => onReorderQuestions(cat.id, qs)}
            />
          ))}
        </SortableContext>
      </DndContext>
      {categories.length === 0 && (
        <div className={`text-center p-8 ${mutedTextCls()}`}>
          No categories — add one above.
        </div>
      )}
    </div>
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

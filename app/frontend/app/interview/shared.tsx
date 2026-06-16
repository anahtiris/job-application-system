"use client";
import React from "react";
import { Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GrowTextarea, iconBtnCls, cardBoxCls, SaveIndicator, type SaveState } from "@/components/ui-kit";
import type { QAItem, PrepQA } from "./types";
import { uid } from "./helpers";

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex gap-[3px]">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`text-[11px] font-medium py-[5px] px-[11px] rounded-[6px] cursor-pointer font-shell transition-all duration-100 ${
            active === t
              ? "border-none bg-custom text-white"
              : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function LangToggle({ lang, onChange }: { lang: "en" | "de"; onChange: (l: "en" | "de") => void }) {
  return (
    <div className="flex border-[0.5px] border-border-tertiary rounded-[6px] overflow-hidden ml-auto">
      {(["en", "de"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`text-[11px] font-medium py-1 px-2.5 cursor-pointer font-mono border-none ${
            lang === l ? "text-white bg-custom" : "text-text-secondary bg-transparent"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function QARow({
  item,
  lang,
  isLast,
  onPatch,
  onDelete,
  accent = false,
}: {
  item: QAItem;
  lang: "en" | "de";
  isLast: boolean;
  onPatch: (patch: Partial<QAItem>) => void;
  onDelete: () => void;
  accent?: boolean;
}) {
  const qKey = lang === "en" ? "q_en" : "q_de";
  const aKey = lang === "en" ? "a_en" : "a_de";
  return (
    <div className={isLast ? "" : "pb-2.5 border-b-[0.5px] border-border-tertiary mb-2.5"}>
      <div className="flex gap-2 items-start">
        <GrowTextarea
          value={item[qKey]}
          onChange={(v) => onPatch({ [qKey]: v })}
          placeholder="Question…"
          className={`font-medium ${accent ? "!text-custom-d" : "text-text-primary"}`}
        />
        <button
          onClick={onDelete}
          className={`${iconBtnCls} hover:text-badge-passed-fg`}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <GrowTextarea
        value={item[aKey]}
        onChange={(v) => onPatch({ [aKey]: v })}
        placeholder="Answer…"
        className="mt-1"
      />
    </div>
  );
}

export function EditablePrepSection({
  title,
  value,
  onChange,
  saveState,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  saveState: SaveState;
}) {
  return (
    <div className={`${cardBoxCls} bg-background-primary`}>
      <div className="flex items-center justify-between py-[9px] px-[13px] border-b-[0.5px] border-border-tertiary">
        <span className="text-[12px] font-medium font-shell">{title}</span>
        <SaveIndicator state={saveState} />
      </div>
      <div className="pt-1 px-[13px] pb-3">
        <GrowTextarea
          value={value}
          onChange={onChange}
          placeholder="No content yet — generate prep to populate."
          className="leading-[1.75]"
        />
      </div>
    </div>
  );
}

// ─── Single-language structured Q&A list (interview prep) ───────────────────────

export function PrepQARow({
  item,
  onPatch,
  onDelete,
  aPlaceholder = "Answer…",
}: {
  item: PrepQA;
  onPatch: (patch: Partial<PrepQA>) => void;
  onDelete: () => void;
  aPlaceholder?: string;
}) {
  return (
    <div className="pb-2.5 border-b-[0.5px] border-border-tertiary mb-2.5 last:border-b-0 last:mb-0 last:pb-0">
      <div className="flex gap-2 items-start">
        <GrowTextarea
          value={item.q}
          onChange={(v) => onPatch({ q: v })}
          placeholder="Question…"
          className="font-medium !text-text-primary flex-1"
        />
        <button onClick={onDelete} className={`${iconBtnCls} hover:text-badge-passed-fg`}>
          <Trash2 size={12} />
        </button>
      </div>
      <GrowTextarea
        value={item.a}
        onChange={(v) => onPatch({ a: v })}
        placeholder={aPlaceholder}
        className="mt-1"
      />
    </div>
  );
}

export function PrepQAList({
  items,
  onChange,
  aPlaceholder,
}: {
  items: PrepQA[];
  onChange: (items: PrepQA[]) => void;
  aPlaceholder?: string;
}) {
  return (
    <div>
      {items.map((it) => (
        <PrepQARow
          key={it.id}
          item={it}
          aPlaceholder={aPlaceholder}
          onPatch={(p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x)))}
          onDelete={() => onChange(items.filter((x) => x.id !== it.id))}
        />
      ))}
      <button
        onClick={() => onChange([...items, { id: uid(), q: "", a: "" }])}
        className="text-[11px] font-medium py-1 px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell mt-1"
      >
        + Add question
      </button>
    </div>
  );
}

export function SortableItem({ id, children }: { id: string; children: (grip: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const grip = (
    <button
      {...listeners}
      {...attributes}
      className="bg-transparent border-none cursor-grab text-text-tertiary p-0 shrink-0 flex items-center opacity-40 touch-none"
    >
      <GripVertical size={12} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {children(grip)}
    </div>
  );
}

"use client";
import { Plus } from "lucide-react";
import { SectionCard, mutedTextCls } from "@/components/ui-kit";
import { type QAItem } from "../types";
import { QARow } from "../shared";

// ─── Common Q&A / Behavioral tab ────────────────────────────────────────────────

export function GeneralQATab({
  title,
  items,
  lang,
  onAdd,
  onPatch,
  onDelete,
}: {
  title: string;
  items: QAItem[];
  lang: "en" | "de";
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<QAItem>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <SectionCard title={title}>
      {items.length === 0 && (
        <p className={mutedTextCls()}>
          No questions yet.
        </p>
      )}
      {items.map((item, i) => (
        <QARow
          key={item.id}
          item={item}
          lang={lang}
          isLast={i === items.length - 1}
          onPatch={(patch) => onPatch(item.id, patch)}
          onDelete={() => onDelete(item.id)}
          accent
        />
      ))}
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-[5px] mt-2 text-[12px] font-medium text-custom bg-transparent border-none cursor-pointer font-shell p-0"
      >
        <Plus size={13} /> Add question
      </button>
    </SectionCard>
  );
}

"use client";
import { useState } from "react";
import { CopyButton } from "@/components/ui-kit";

interface Props {
  value: string;
  onChange?: (v: string) => void;
  label?: string;
  copyText?: string;
}

export function MarkdownEditor({ value, onChange, label, copyText }: Props) {
  const [text, setText] = useState(value);

  // Sync local edits when the parent supplies a new value — adjusted during
  // render (React's recommended pattern) rather than in an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  const handleChange = (v: string) => {
    setText(v);
    onChange?.(v);
  };

  return (
    <div className="flex flex-col gap-2">
      {(label || copyText) && (
        <div className="flex items-center justify-between gap-2">
          {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
          {copyText && <CopyButton text={copyText} />}
        </div>
      )}
      <textarea
        className="w-full min-h-[420px] font-mono text-sm p-3 border rounded-md resize-y bg-background"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}

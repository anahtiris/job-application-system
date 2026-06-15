"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

// ─── Markdown ──────────────────────────────────────────────────────────────────

export function MdStrong({ children }: { children?: React.ReactNode }) {
  return <strong className="text-text-primary font-semibold">{children}</strong>;
}

// ─── Copy button ───────────────────────────────────────────────────────────────

export function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title={title}
      className={`bg-transparent border-none cursor-pointer p-0.5 flex items-center rounded-[4px] transition-colors duration-150 ${
        copied ? "text-badge-interview-fg" : "text-text-tertiary"
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

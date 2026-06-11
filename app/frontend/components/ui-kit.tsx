"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";

// ─── Fonts ─────────────────────────────────────────────────────────────────────

export const monoFontCls = "font-mono";
export const shellFontCls = "font-shell";

// ─── Save state ────────────────────────────────────────────────────────────────

export type SaveState = "idle" | "saving" | "saved";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className="text-[11px] text-text-tertiary font-mono">
      {state === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}

export function useAutoSave<T>(value: T, saveFn: (v: T) => Promise<void>, delay = 800) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      await saveFn(value);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    }, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return saveState;
}

// ─── Inputs ────────────────────────────────────────────────────────────────────

export function GrowTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full text-[13px] leading-[1.7] text-text-secondary bg-transparent border-none outline-none resize-none font-shell overflow-hidden ${className}`}
      style={style}
    />
  );
}

// ─── Markdown ──────────────────────────────────────────────────────────────────

export function MdStrong({ children }: { children?: React.ReactNode }) {
  return <strong className="text-text-primary font-semibold">{children}</strong>;
}

// ─── Buttons ───────────────────────────────────────────────────────────────────

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

export function pillBtnCls(primary = false, danger = false): string {
  const border = danger
    ? "border-[0.5px] border-badge-passed-bg"
    : primary
    ? "border-none"
    : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-amb" : "bg-transparent";
  const color = danger ? "text-badge-passed-fg" : primary ? "text-white" : "text-text-secondary";
  return `inline-flex items-center gap-[5px] text-[12px] font-medium py-[5px] px-[13px] rounded-full cursor-pointer font-shell whitespace-nowrap no-underline ${border} ${bg} ${color}`;
}

// ─── Chips / status colors ─────────────────────────────────────────────────────

// `extra` is appended verbatim, e.g. chipCls(skillStatusStyleCls(status)).
export function chipCls(extra = ""): string {
  return `inline-flex items-center text-[11px] font-medium py-[3px] px-[9px] rounded-full font-shell ${extra}`.trim();
}

export function skillStatusStyleCls(status: string): string {
  switch (status) {
    case "STRONG":  return "bg-badge-interview-bg text-badge-interview-fg";
    case "HONEST":  return "bg-amb-l text-amb-d";
    case "GAP":     return "bg-badge-passed-bg text-badge-passed-fg";
    default:        return "bg-background-secondary text-text-tertiary";
  }
}

export function verdictStyleCls(verdict: string): string {
  switch (verdict) {
    case "strong": return "bg-badge-interview-bg text-badge-interview-fg";
    case "skip":   return "bg-badge-passed-bg text-badge-passed-fg";
    default:       return "bg-amb-l text-amb-d";
  }
}

export function goalAlignStyleCls(alignment: string): string {
  switch (alignment) {
    case "aligns":  return "bg-badge-interview-bg text-badge-interview-fg";
    case "detours": return "bg-amb-l text-amb-d";
    default:        return "bg-background-secondary text-text-tertiary";
  }
}

export function statusChipStyleCls(status: string): string {
  switch (status) {
    case "approved":  return "bg-badge-interview-bg text-badge-interview-fg";
    case "rejected":  return "bg-badge-passed-bg text-badge-passed-fg";
    case "analyzed":  return "bg-badge-analyzed-bg text-badge-analyzed-fg";
    case "analyzing": return "bg-amb-l text-amb-d";
    case "new":       return "bg-badge-responded-bg text-badge-responded-fg";
    default:          return "bg-background-secondary text-text-tertiary";
  }
}

// ─── Layout helpers ─────────────────────────────────────────────────────────────

export const cardBoxCls = "border-[0.5px] border-border-tertiary rounded-card overflow-hidden";

// `background` must be a Tailwind background className, e.g. "bg-amb-l".
export function cardHeaderBarCls(collapsed = false, background = "bg-background-secondary"): string {
  const border = collapsed ? "" : " border-b-[0.5px] border-border-tertiary";
  return `flex items-center gap-2 py-[7px] px-3 ${background}${border}`;
}

export const sectionLabelCls = "text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell mb-1.5";

export const iconBtnCls = "bg-transparent border-none cursor-pointer text-text-tertiary p-0.5 shrink-0";

const TEXT_SIZE_CLS: Record<string, string> = {
  "10px": "text-[10px]",
  "11px": "text-[11px]",
  "12px": "text-[12px]",
  "13px": "text-[13px]",
};

export function mutedTextCls(size = "12px"): string {
  return `${TEXT_SIZE_CLS[size] ?? "text-[12px]"} text-text-tertiary font-shell`;
}

export function monoMutedCls(size = "11px"): string {
  return `${TEXT_SIZE_CLS[size] ?? "text-[11px]"} font-mono text-text-tertiary`;
}

// ─── Section card ──────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  hint,
  badge,
  action,
  variant = "plain",
  children,
}: {
  title?: string;
  hint?: string;
  badge?: string;
  action?: React.ReactNode;
  variant?: "plain" | "labeled";
  children: React.ReactNode;
}) {
  if (variant === "labeled") {
    return (
      <div className="border-[0.5px] border-border-tertiary rounded-card overflow-hidden shrink-0">
        <div className="flex items-center gap-2 py-2 px-[14px] border-b-[0.5px] border-border-tertiary bg-background-secondary">
          <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-text-tertiary font-shell">
            {title}
          </span>
          {action && <div className="ml-auto">{action}</div>}
        </div>
        <div className="py-3 px-[14px]">{children}</div>
      </div>
    );
  }

  return (
    <div className="bg-background-primary border-[0.5px] border-border-tertiary rounded-card overflow-hidden shrink-0">
      {(title || action || badge) && (
        <div className="flex items-center justify-between gap-2 py-[9px] px-[13px] border-b-[0.5px] border-border-tertiary">
          <span className="flex items-baseline gap-2">
            {title && <span className="text-[12px] font-medium font-shell">{title}</span>}
            {hint && <span className="text-[11px] text-text-tertiary font-shell">{hint}</span>}
          </span>
          {badge && <span className="text-[10px] font-medium font-mono text-text-tertiary">{badge}</span>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="py-3 px-[13px]">{children}</div>
    </div>
  );
}

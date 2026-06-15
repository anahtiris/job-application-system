"use client";
import { useEffect, useRef, useState } from "react";

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

// ─── Error banner ──────────────────────────────────────────────────────────────

export function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="py-2.5 px-[13px] rounded-card border-[0.5px] border-badge-passed-fg bg-badge-passed-bg text-[12px] text-badge-passed-fg font-shell whitespace-pre-wrap">
      {msg}
    </div>
  );
}

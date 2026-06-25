"use client";
import { useCallback, useEffect, useRef, useState } from "react";

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

// Saves `value` after `delay`, but only once the consumer has signalled a real
// user edit via `markDirty`. Value changes that come from initial state, an
// async server load, or switching the tracked record (use `markClean` to
// re-baseline) do not trigger a save — that prevents the "saving on open"
// flicker and redundant idempotent writes.
export function useAutoSave<T>(value: T, saveFn: (v: T) => Promise<void>, delay = 800) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const dirty = useRef(false);

  const markDirty = useCallback(() => { dirty.current = true; }, []);
  const markClean = useCallback(() => { dirty.current = false; }, []);

  useEffect(() => {
    if (!dirty.current) return;
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

  return { saveState, markDirty, markClean };
}

// ─── Error banner ──────────────────────────────────────────────────────────────

export function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="py-2.5 px-[13px] rounded-card border-[0.5px] border-badge-passed-fg bg-badge-passed-bg text-[12px] text-badge-passed-fg font-shell whitespace-pre-wrap">
      {msg}
    </div>
  );
}

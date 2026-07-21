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

type IdItem = { id: string };

function isIdArray(x: unknown): x is IdItem[] {
  return Array.isArray(x) && x.every((i) => typeof i === "object" && i !== null && "id" in i);
}

// Three-way merge for an array of objects keyed by `id`. `local`'s order and
// per-item edits win for anything actually touched since `base`; items left
// untouched locally take whatever `fresh` has for that id (including having
// been deleted upstream); items added upstream since `base` (present in
// `fresh` but not `base` or `local`) are appended. This is what lets two
// independent edits to different items in the same array (e.g. two different
// question groups) both survive instead of one clobbering the other.
function mergeIdArray<I extends IdItem>(fresh: I[], base: I[], local: I[]): I[] {
  const freshMap = new Map(fresh.map((i) => [i.id, i]));
  const baseMap = new Map(base.map((i) => [i.id, i]));
  const localIds = new Set(local.map((i) => i.id));

  const result: I[] = [];
  for (const localItem of local) {
    const baseItem = baseMap.get(localItem.id);
    const changedLocally = JSON.stringify(localItem) !== JSON.stringify(baseItem);
    if (changedLocally) {
      result.push(localItem);
    } else if (freshMap.has(localItem.id)) {
      result.push(freshMap.get(localItem.id)!);
    }
    // else: unchanged locally but removed upstream — drop it.
  }
  for (const freshItem of fresh) {
    if (!baseMap.has(freshItem.id) && !localIds.has(freshItem.id)) result.push(freshItem);
  }
  return result;
}

// Rebuilds a save payload on top of a freshly-fetched server copy: array
// fields keyed by `id` (groups, categories, Q&A lists, …) are merged
// item-by-item via `mergeIdArray` so two edits to different items in the
// same array both survive; other fields fall back to "local wins if it
// differs from the last known baseline". This is what avoids clobbering
// out-of-band writes (another tab, a direct API call, a second in-flight
// autosave) with a stale full-object PUT — the classic lost-update race.
export function mergeOnFresh<T extends object>(value: T, baseline: T, fresh: T): T {
  const merged: T = { ...fresh };
  (Object.keys(value) as (keyof T)[]).forEach((key) => {
    const localVal = value[key];
    const baseVal = baseline[key];
    const freshVal = fresh[key];
    if (isIdArray(localVal) && isIdArray(baseVal) && isIdArray(freshVal)) {
      merged[key] = mergeIdArray(freshVal, baseVal, localVal) as T[typeof key];
    } else if (localVal !== baseVal) {
      merged[key] = localVal;
    }
  });
  return merged;
}

// Saves `value` after `delay`, but only once the consumer has signalled a real
// user edit via `markDirty`. Value changes that come from initial state, an
// async server load, or switching the tracked record do not trigger a save —
// that prevents the "saving on open" flicker and redundant idempotent writes.
//
// Before writing, it re-fetches the current server record and merges onto it
// via `mergeOnFresh`, then calls `onMerge` so the caller's own state picks up
// whatever changed server-side in the meantime.
export function useAutoSave<T extends object>(
  value: T,
  saveFn: (v: T) => Promise<void>,
  fetchFn: () => Promise<T>,
  onMerge: (merged: T) => void,
  delay = 800
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const dirty = useRef(false);
  const baseline = useRef<T>(value);

  const markDirty = useCallback(() => { dirty.current = true; }, []);
  const markClean = useCallback(() => { dirty.current = false; }, []);

  useEffect(() => {
    if (!dirty.current) {
      // Load or post-merge state change, not a user edit — re-baseline silently.
      baseline.current = value;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      const prevBaseline = baseline.current;
      const fresh = await fetchFn();
      const merged = mergeOnFresh(value, prevBaseline, fresh);
      await saveFn(merged);
      dirty.current = false;
      baseline.current = merged;
      onMerge(merged);
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

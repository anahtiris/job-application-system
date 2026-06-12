"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Rewrite { original: string; rewrite: string; reviewer?: string; }
interface PriorityIssue { issue: string; severity: "high" | "medium" | "low"; sources: string[]; }
interface Consolidated {
  average_scores: Record<string, number | null>;
  critical_criteria: string[];
  all_issues: string[];
  all_rewrites: Rewrite[];
  priority_issues?: PriorityIssue[];
  resolved_rewrites?: Rewrite[];
}
interface ReviewResult {
  reviewers: string[];
  cv_consolidated: Consolidated;
  cl_consolidated: Consolidated;
  [key: string]: unknown;
}

interface QueueItem { id: string; doc: "cv" | "cl"; original: string; rewrite: string; }
type ItemState = "pending" | "accepted" | "skipped";

// ── Item card (right panel) ───────────────────────────────────────────────────

const ItemCard = forwardRef<HTMLDivElement, {
  item: QueueItem;
  idx: number;
  total: number;
  state: ItemState;
  isActive: boolean;
  editText: string;
  onEditText: (v: string) => void;
  onSelect: () => void;
  onAccept: (text: string) => void;
  onSkip: () => void;
  onUndo: () => void;
}>(function ItemCard({ item, idx, total, state, isActive, editText, onEditText, onSelect, onAccept, onSkip, onUndo }, ref) {
  const [editing, setEditing] = useState(false);
  const done = state !== "pending";

  return (
    <div
      ref={ref}
      onClick={done ? undefined : onSelect}
      className={`p-3 text-sm border-b last:border-0 transition-colors ${
        done ? "opacity-40" : isActive ? "bg-amber-50 dark:bg-amber-950/20" : "cursor-pointer hover:bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{idx + 1} / {total}</span>
        {done && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${state === "accepted" ? "text-green-600" : ""}`}>
              {state === "accepted" ? "✓ Accepted" : "Skipped"}
            </span>
            <button
              className="text-xs text-muted-foreground underline"
              onClick={(e) => { e.stopPropagation(); onUndo(); }}
            >Undo</button>
          </div>
        )}
      </div>

      <p className="text-xs line-through text-muted-foreground leading-snug mb-1.5">{item.original}</p>

      {!done && (
        editing ? (
          <textarea
            className="w-full border rounded p-1.5 text-xs min-h-[60px] bg-background mb-1.5"
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <p className="text-xs leading-snug mb-2">{editText}</p>
        )
      )}

      {!done && (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" className="h-6 text-xs px-2" onClick={() => onAccept(editText)}>Accept</Button>
          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(e => !e)}>
            {editing ? "Done" : "Edit"}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onSkip}>Skip</Button>
        </div>
      )}
    </div>
  );
});

// ── Document panel (left) ─────────────────────────────────────────────────────

function HighlightedDoc({
  text,
  items,
  states,
  edits,
  activeId,
  onSelect,
}: {
  text: string;
  items: QueueItem[];
  states: Record<string, ItemState>;
  edits: Record<string, string>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  // Split text into plain/highlighted segments
  type Seg = { text: string; itemId?: string };
  let segs: Seg[] = [{ text }];

  for (const item of items) {
    const next: Seg[] = [];
    for (const seg of segs) {
      if (seg.itemId !== undefined) { next.push(seg); continue; }
      const idx = seg.text.indexOf(item.original);
      if (idx === -1) { next.push(seg); continue; }
      if (idx > 0) next.push({ text: seg.text.slice(0, idx) });
      next.push({ text: item.original, itemId: item.id });
      const rest = seg.text.slice(idx + item.original.length);
      if (rest) next.push({ text: rest });
    }
    segs = next;
  }

  return (
    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
      {segs.map((seg, i) => {
        if (!seg.itemId) return <span key={i}>{seg.text}</span>;
        const st = states[seg.itemId];
        const active = activeId === seg.itemId;
        if (st === "skipped") return <span key={i}>{seg.text}</span>;
        const cls =
          st === "accepted" ? "bg-green-200 dark:bg-green-900/60" :
          active            ? "bg-amber-300 dark:bg-amber-600/60" :
                              "bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200";
        return (
          <span
            key={i}
            className={`${cls} cursor-pointer rounded-sm px-0.5 transition-colors`}
            onClick={() => onSelect(seg.itemId!)}
          >
            {st === "accepted" ? edits[seg.itemId!] : seg.text}
          </span>
        );
      })}
    </pre>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReviewPanel({
  result,
  resumeDraft,
  clDraft,
  onApply,
}: {
  result: ReviewResult;
  resumeDraft: string;
  clDraft: string;
  onApply: (resume: string, cl: string) => void;
}) {
  const noChangePatterns = /^(this should remain|no change|keep as is|looks good|unchanged|same as|n\/a)/i;

  const cvItems: QueueItem[] = (result.cv_consolidated?.resolved_rewrites ?? result.cv_consolidated?.all_rewrites ?? [])
    .filter(rw => rw.original && resumeDraft.includes(rw.original) && rw.rewrite && !noChangePatterns.test(rw.rewrite.trim()))
    .map((rw, i) => ({ id: `cv-${i}`, doc: "cv" as const, original: rw.original, rewrite: rw.rewrite }))
    .sort((a, b) => resumeDraft.indexOf(a.original) - resumeDraft.indexOf(b.original));
  const clItems: QueueItem[] = (result.cl_consolidated?.resolved_rewrites ?? result.cl_consolidated?.all_rewrites ?? [])
    .filter(rw => rw.original && clDraft.includes(rw.original) && rw.rewrite && !noChangePatterns.test(rw.rewrite.trim()))
    .map((rw, i) => ({ id: `cl-${i}`, doc: "cl" as const, original: rw.original, rewrite: rw.rewrite }))
    .sort((a, b) => clDraft.indexOf(a.original) - clDraft.indexOf(b.original));
  const allItems = [...cvItems, ...clItems];

  const [activeDoc, setActiveDoc] = useState<"cv" | "cl">("cv");
  const [activeId, setActiveId] = useState<string | null>(allItems[0]?.id ?? null);
  const [states, setStates] = useState<Record<string, ItemState>>(
    Object.fromEntries(allItems.map(i => [i.id, "pending" as ItemState]))
  );
  const [edits, setEdits] = useState<Record<string, string>>(
    Object.fromEntries(allItems.map(i => [i.id, i.rewrite]))
  );

  // Accepted replacements stored in a ref so handleApply always reads the
  // latest values without depending on a potentially stale state closure.
  const acceptedRef = useRef<Map<string, { original: string; rewrite: string; doc: "cv" | "cl" }>>(new Map());

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const docItems = activeDoc === "cv" ? cvItems : clItems;
  const docText  = activeDoc === "cv" ? resumeDraft : clDraft;

  useEffect(() => {
    if (activeId) itemRefs.current[activeId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  const handleAccept = (item: QueueItem, text: string) => {
    acceptedRef.current.set(item.id, { original: item.original, rewrite: text, doc: item.doc });
    setStates(prev => ({ ...prev, [item.id]: "accepted" }));
    const next = docItems.find(i => i.id !== item.id && states[i.id] === "pending");
    if (next) setActiveId(next.id);
  };

  const handleUndo = (id: string) => {
    acceptedRef.current.delete(id);
    setStates(prev => ({ ...prev, [id]: "pending" }));
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setActiveDoc(id.startsWith("cv") ? "cv" : "cl");
  };

  const reviewed = Object.values(states).filter(s => s !== "pending").length;
  const total = allItems.length;
  const cvPending = cvItems.filter(i => states[i.id] === "pending").length;
  const clPending = clItems.filter(i => states[i.id] === "pending").length;

  const handleApply = () => {
    let newResume = resumeDraft;
    let newCl = clDraft;
    acceptedRef.current.forEach(({ original, rewrite, doc }) => {
      if (doc === "cv") newResume = newResume.split(original).join(rewrite);
      else newCl = newCl.split(original).join(rewrite);
    });
    onApply(newResume, newCl);
  };

  type DisplayIssue = { issue: string; severity?: PriorityIssue["severity"]; sources?: string[] };
  const toDisplayIssues = (consolidated?: Consolidated): DisplayIssue[] =>
    consolidated?.priority_issues?.length
      ? consolidated.priority_issues
      : (consolidated?.all_issues ?? []).map(issue => ({ issue }));

  const cvIssues = toDisplayIssues(result.cv_consolidated);
  const clIssues = toDisplayIssues(result.cl_consolidated);

  const severityStyles: Record<NonNullable<PriorityIssue["severity"]>, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    low: "bg-muted text-muted-foreground",
  };

  if (allItems.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/10">
          Reviewers had no rewrite suggestions. Documents look good.
        </p>
        <Button onClick={handleApply} className="w-full">Apply & Continue</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant={activeDoc === "cv" ? "default" : "outline"} onClick={() => setActiveDoc("cv")}>
            CV {cvPending > 0 && <span className="ml-1.5 opacity-60">{cvPending}</span>}
          </Button>
          <Button size="sm" variant={activeDoc === "cl" ? "default" : "outline"} onClick={() => setActiveDoc("cl")}>
            Cover Letter {clPending > 0 && <span className="ml-1.5 opacity-60">{clPending}</span>}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{reviewed} / {total}</span>
          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Side-by-side */}
      <div className="grid grid-cols-[3fr_2fr] gap-0 border rounded-lg overflow-hidden min-h-[400px] max-h-[70vh]">
        {/* Left: document */}
        <div className="overflow-auto p-5 bg-muted/10 border-r min-h-0">
          {docItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions for this document.</p>
          ) : (
            <HighlightedDoc
              text={docText}
              items={docItems}
              states={states}
              edits={edits}
              activeId={activeId}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* Right: issue queue */}
        <div className="overflow-auto flex flex-col divide-y min-h-0">
          {docItems.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No rewrites for this document.</p>
          )}
          {docItems.map((item, idx) => (
            <ItemCard
              key={item.id}
              ref={(el) => { itemRefs.current[item.id] = el; }}
              item={item}
              idx={idx}
              total={docItems.length}
              state={states[item.id]}
              isActive={activeId === item.id}
              editText={edits[item.id]}
              onEditText={(v) => setEdits(prev => ({ ...prev, [item.id]: v }))}
              onSelect={() => setActiveId(item.id)}
              onAccept={(text) => handleAccept(item, text)}
              onSkip={() => setStates(prev => ({ ...prev, [item.id]: "skipped" }))}
              onUndo={() => handleUndo(item.id)}
            />
          ))}
        </div>
      </div>

      {/* Collapsed notes */}
      {(cvIssues.length > 0 || clIssues.length > 0) && (
        <details className="border rounded-lg p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Also noted ({cvIssues.length + clIssues.length})
          </summary>
          <div className="mt-3 space-y-4 pt-1">
            {cvIssues.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5">Resume</p>
                <ul className="space-y-1">
                  {cvIssues.map((item, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground">
                      <span className="shrink-0">•</span>
                      <span className="flex-1">
                        {item.issue}
                        {item.sources && item.sources.length > 0 && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-60">
                            ({item.sources.join(", ")})
                          </span>
                        )}
                      </span>
                      {item.severity && (
                        <span className={`shrink-0 h-fit text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${severityStyles[item.severity]}`}>
                          {item.severity}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {clIssues.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5">Cover Letter</p>
                <ul className="space-y-1">
                  {clIssues.map((item, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground">
                      <span className="shrink-0">•</span>
                      <span className="flex-1">
                        {item.issue}
                        {item.sources && item.sources.length > 0 && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-60">
                            ({item.sources.join(", ")})
                          </span>
                        )}
                      </span>
                      {item.severity && (
                        <span className={`shrink-0 h-fit text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${severityStyles[item.severity]}`}>
                          {item.severity}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <Button onClick={handleApply} className="w-full">
        {reviewed === total
          ? "Apply & Continue"
          : `Apply & Continue (${total - reviewed} remaining will be skipped)`}
      </Button>
    </div>
  );
}

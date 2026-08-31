export const STATUS_ORDER = ["New", "Draft", "Finalized", "Applied", "Interview", "Offer", "Rejected"] as const;

// Backend status → display label. `New` shows as "Analyzed".
export const STATUS_DISPLAY: Record<string, string> = {
  New: "Analyzed", Draft: "Draft", Finalized: "Finalized", Applied: "Applied",
  Interview: "Interview", Offer: "Offer", Rejected: "Rejected", Ghosted: "Ghosted",
  "Rejected after interview": "Rejected",
  "Ghosted after interview": "Ghosted",
};

// Allowed status transitions (backend values).
export const NEXT_STATUSES: Record<string, string[]> = {
  Draft: ["Applied"],
  Finalized: ["Applied"],
  Applied: ["Interview", "Offer", "Rejected", "Ghosted"],
  Interview: ["Offer", "Rejected after interview", "Ghosted after interview", "Applied"],
  Offer: ["Rejected"],
  Rejected: ["Rejected after interview", "Applied", "Interview"],
  Ghosted: ["Applied", "Interview", "Rejected"],
  "Rejected after interview": ["Rejected", "Ghosted after interview"],
  "Ghosted after interview": ["Interview", "Rejected after interview"],
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d + "T00:00:00"));
}

// ─── Lead statuses ─────────────────────────────────────────────────────────────

// Display order for lead statuses. This is an ORDERING HINT ONLY — it must never
// gate which statuses are visible. Filter options are derived from the leads
// actually fetched, so a status added on the backend still shows up here (sorted
// last) instead of silently disappearing from the UI.
export const LEAD_STATUS_ORDER = [
  "captured", "new", "analyzing", "analyzed", "approved", "applied", "rejected",
] as const;
export type KnownLeadStatus = (typeof LEAD_STATUS_ORDER)[number];

// Sort key for a lead status. Unknown (newly added backend) statuses sort last.
export function leadStatusRank(status: string): number {
  const i = (LEAD_STATUS_ORDER as readonly string[]).indexOf(status);
  return i === -1 ? LEAD_STATUS_ORDER.length : i;
}

export const FIT_VERDICTS = ["strong", "maybe", "skip"] as const;
export type FitVerdict = (typeof FIT_VERDICTS)[number];

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
  "Ghosted after interview": ["Rejected", "Rejected after interview"],
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d + "T00:00:00"));
}

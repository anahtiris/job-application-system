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

export const STATUS_CLASSES: Record<string, string> = {
  New:       "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Draft:     "bg-muted/60 text-muted-foreground border border-border",
  Finalized: "bg-teal-50 text-teal-700 border border-teal-200",
  Applied:   "bg-blue-100 text-blue-700 border border-blue-200",
  Interview: "bg-amber-100 text-amber-700 border border-amber-200",
  Offer:     "bg-green-100 text-green-700 border border-green-200",
  Rejected:  "bg-red-100 text-red-600 border border-red-200",
  "Rejected after interview": "bg-red-100 text-red-600 border border-red-200",
  "Ghosted after interview": "bg-gray-100 text-gray-600 border border-gray-200",
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d + "T00:00:00"));
}

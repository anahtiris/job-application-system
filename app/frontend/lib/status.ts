export const STATUS_ORDER = ["Draft", "Applied", "Interview", "Offer", "Rejected"] as const;

export const STATUS_CLASSES: Record<string, string> = {
  Draft:     "bg-muted/60 text-muted-foreground border border-border",
  Applied:   "bg-blue-100 text-blue-700 border border-blue-200",
  Interview: "bg-amber-100 text-amber-700 border border-amber-200",
  Offer:     "bg-green-100 text-green-700 border border-green-200",
  Rejected:  "bg-red-100 text-red-600 border border-red-200",
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d + "T00:00:00"));
}

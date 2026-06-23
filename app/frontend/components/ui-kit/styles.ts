// ─── Fonts ─────────────────────────────────────────────────────────────────────

export const monoFontCls = "font-mono";
export const shellFontCls = "font-shell";

// ─── Inputs ────────────────────────────────────────────────────────────────────

// Shared text-input class. `font` defaults to the shell font; pass "mono" for
// monospace fields (e.g. settings, addresses).
export function inputCls(font: "shell" | "mono" = "shell"): string {
  const fontCls = font === "mono" ? "font-mono" : "font-shell";
  return `w-full text-[13px] py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary ${fontCls} outline-none`;
}

// ─── Buttons ───────────────────────────────────────────────────────────────────

export function pillBtnCls(primary = false, danger = false, size: "sm" | "md" = "md"): string {
  const border = danger
    ? "border-[0.5px] border-badge-passed-bg"
    : primary
    ? "border-none"
    : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-custom" : "bg-transparent";
  const color = danger ? "text-badge-passed-fg" : primary ? "text-white" : "text-text-secondary";
  const sizing = size === "sm"
    ? "gap-1 text-[11px] py-1 px-2.5"
    : "gap-[5px] text-[12px] py-[5px] px-[13px]";
  return `inline-flex items-center font-medium rounded-full cursor-pointer font-shell whitespace-nowrap no-underline ${sizing} ${border} ${bg} ${color}`;
}

// ─── Chips / status colors ─────────────────────────────────────────────────────

// `extra` is appended verbatim, e.g. chipCls(skillStatusStyleCls(status)).
export function chipCls(extra = ""): string {
  return `inline-flex items-center text-[11px] font-medium py-[3px] px-[9px] rounded-full font-shell ${extra}`.trim();
}

export function skillStatusStyleCls(status: string): string {
  switch (status) {
    case "STRONG":  return "bg-badge-interview-bg text-badge-interview-fg";
    case "HONEST":  return "bg-custom-l text-custom-d";
    case "GAP":     return "bg-badge-passed-bg text-badge-passed-fg";
    default:        return "bg-background-secondary text-text-tertiary";
  }
}

export function verdictStyleCls(verdict: string): string {
  switch (verdict) {
    case "strong": return "bg-badge-interview-bg text-badge-interview-fg";
    case "skip":   return "bg-badge-passed-bg text-badge-passed-fg";
    default:       return "bg-custom-l text-custom-d";
  }
}

export function goalAlignStyleCls(alignment: string): string {
  switch (alignment) {
    case "aligns":  return "bg-badge-interview-bg text-badge-interview-fg";
    case "detours": return "bg-custom-l text-custom-d";
    default:        return "bg-background-secondary text-text-tertiary";
  }
}

export function statusChipStyleCls(status: string): string {
  switch (status) {
    case "approved":  return "bg-badge-interview-bg text-badge-interview-fg";
    case "applied":   return "bg-badge-offer-bg text-badge-offer-fg";
    case "rejected":  return "bg-badge-passed-bg text-badge-passed-fg";
    case "analyzed":  return "bg-badge-analyzed-bg text-badge-analyzed-fg";
    case "analyzing": return "bg-custom-l text-custom-d";
    case "new":       return "bg-badge-responded-bg text-badge-responded-fg";
    default:          return "bg-background-secondary text-text-tertiary";
  }
}

// Color classes for an application's *display* label (e.g. "Applied", "Interview").
// Single source of truth shared by the tracker list and the detail page.
export function appLabelStyleCls(label: string): string {
  switch (label) {
    case "Applied":   return "bg-custom-l text-custom-d";
    case "Interview": return "bg-badge-interview-bg text-badge-interview-fg";
    case "Offer":     return "bg-badge-offer-bg text-badge-offer-fg";
    case "Rejected":  return "bg-badge-passed-bg text-badge-passed-fg";
    case "Ghosted":   return "bg-badge-ghosted-bg text-badge-ghosted-fg";
    case "Draft":     return "bg-badge-responded-bg text-badge-responded-fg";
    case "Finalized": return "bg-badge-finalized-bg text-badge-finalized-fg";
    case "Analyzed":  return "bg-badge-analyzed-bg text-badge-analyzed-fg";
    default:          return "bg-custom-l text-custom-d";
  }
}

// ─── Layout helpers ─────────────────────────────────────────────────────────────

export const cardBoxCls = "border-[0.5px] border-border-tertiary rounded-card overflow-hidden";

// `background` must be a Tailwind background className, e.g. "bg-custom-l".
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

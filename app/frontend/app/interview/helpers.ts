import type { DateTimeValue, InterviewPrep } from "./types";
import { EMPTY_PREP } from "./types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function uid(): string {
  return crypto.randomUUID();
}

export function parsePrepJson(raw: string | null | undefined): InterviewPrep {
  if (!raw) return { ...EMPTY_PREP };
  try {
    const obj = JSON.parse(raw) as Partial<InterviewPrep>;
    return {
      ...EMPTY_PREP,
      ...obj,
      common_questions: obj.common_questions ?? [],
      job_specific_questions: obj.job_specific_questions ?? [],
      weak_spots: obj.weak_spots ?? [],
      questions_to_ask: obj.questions_to_ask ?? [],
    };
  } catch {
    return { ...EMPTY_PREP };
  }
}

export function parseDate(iso: string | null): DateTimeValue | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() };
}

export function toISO(v: DateTimeValue): string {
  return `${v.year}-${String(v.month).padStart(2, "0")}-${String(v.day).padStart(2, "0")}T${String(v.hour).padStart(2, "0")}:${String(v.minute).padStart(2, "0")}`;
}

export function formatDate(iso: string | null): { label: string; isToday: boolean } {
  if (!iso) return { label: "TBD", isToday: false };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { label: "TBD", isToday: false };
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const dateStr = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { label: `${dateStr} · ${timeStr}`, isToday };
}

import type { InterviewNotes, DateTimeValue } from "./types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function uid(): string {
  return crypto.randomUUID();
}

export function parsePrepSection(md: string, heading: string): string {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = md.match(new RegExp(`## ${esc}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
  return m ? m[1].trim() : "";
}

export function updatePrepSection(md: string, section: string, newBody: string): string {
  const esc = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(## ${esc}[^\\n]*)\\n[\\s\\S]*?(?=\\n## |$)`);
  return regex.test(md)
    ? md.replace(regex, `$1\n\n${newBody}`)
    : `${md}\n\n## ${section}\n\n${newBody}`;
}

export function importNotesFromPrep(prepMd: string): Partial<InterviewNotes> {
  const overview = parsePrepSection(prepMd, "Company Analysis");

  const qBody = parsePrepSection(prepMd, "Job-Specific Questions");
  const questions = qBody
    .split("\n")
    .flatMap((line) => {
      const m = line.match(/^\d+\.\s+(.+)/);
      return m ? [{ id: uid(), q: m[1].replace(/\*\*/g, "").trim(), a: "" }] : [];
    });

  const gapBody = parsePrepSection(prepMd, "Weak Spots");
  const gaps = [...gapBody.matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => ({
    id: uid(),
    skill: m[1].replace(/\.$/, "").trim(),
    severity: "amber" as const,
    note: "",
  }));

  const salaryBody = parsePrepSection(prepMd, "Salary & Negotiation");
  const askM = salaryBody.match(/€([\d]{2,3}[–\-][\d]{2,3})/);
  const ask = askM ? `€${askM[1]}` : "";

  return { overview, questions, gaps, salary: { ask, market: "", floor: "", notes: salaryBody } };
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

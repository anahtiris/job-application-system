"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, FileText, Download, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { FlipClock, type DateValue } from "@anahtiris/flipclock";
import "@anahtiris/flipclock/dist/flipclock.css";
import { api, BASE } from "@/lib/api";
import { useIsDark } from "@/hooks/useIsDark";
import { pillBtnCls, SectionCard } from "@/components/ui-kit";
import { isoToDateValue, dateValueToISO } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<string, string> = {
  New: "Analyzed", Draft: "Draft", Applied: "Applied",
  Interview: "Interview", Offer: "Offer", Rejected: "Rejected", Ghosted: "Ghosted",
};

const NEXT_STATUSES: Record<string, string[]> = {
  Draft: ["Applied"],
  Applied: ["Interview", "Offer", "Rejected", "Ghosted"],
  Interview: ["Applied", "Offer", "Rejected", "Ghosted"],
  Offer: ["Rejected"],
  Rejected: ["Applied", "Interview"],
  Ghosted: ["Applied", "Interview", "Rejected"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDateValue(): DateValue {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function formatAppliedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso + "T00:00:00")
  );
}

function badgeCls(status: string): string {
  const label = STATUS_DISPLAY[status] ?? status;
  const color =
    label === "Applied"   ? "bg-custom-l text-custom-d" :
    label === "Interview" ? "bg-badge-interview-bg text-badge-interview-fg" :
    label === "Offer"     ? "bg-badge-offer-bg text-badge-offer-fg" :
    label === "Rejected"  ? "bg-badge-passed-bg text-badge-passed-fg" :
    label === "Ghosted"   ? "bg-badge-ghosted-bg text-badge-ghosted-fg" :
    label === "Draft"     ? "bg-badge-responded-bg text-badge-responded-fg" :
                            "bg-badge-analyzed-bg text-badge-analyzed-fg";
  return `inline-flex items-center text-[12px] font-medium py-[3px] px-2.5 rounded-full border-none font-shell ${color}`;
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-[3px]">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`text-[11px] font-medium py-[5px] px-[11px] rounded-[6px] cursor-pointer font-shell transition-all duration-100 ${
            active === t
              ? "border-none bg-custom text-white"
              : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Download dropdown ─────────────────────────────────────────────────────────

function DownloadDropdown({ label, pdf, docx }: { label: string; pdf?: string; docx?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (!pdf && !docx) return null;

  return (
    <div ref={ref} className="relative">
      <button
        className="inline-flex items-center gap-1 text-[12px] font-medium py-[5px] px-[13px] rounded-full cursor-pointer font-shell whitespace-nowrap no-underline border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 z-30 bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-1 min-w-[110px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {pdf && (
            <a
              href={pdf} target="_blank" rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-[12px] font-medium py-1.5 px-2 rounded-[5px] text-text-secondary font-shell no-underline hover:bg-background-secondary"
            >
              <FileText size={12} /> PDF
            </a>
          )}
          {docx && (
            <a
              href={docx} download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-[12px] font-medium py-1.5 px-2 rounded-[5px] text-text-secondary font-shell no-underline hover:bg-background-secondary"
            >
              <Download size={12} /> DOCX
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status badge w/ dropdown ──────────────────────────────────────────────────

function StatusBadge({ app, onUpdate, onRequestApplied }: { app: { id: string; status: string }; onUpdate: (id: string, s: string) => void; onRequestApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nextOptions = NEXT_STATUSES[app.status] ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={`${badgeCls(app.status)} ${nextOptions.length ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => { if (nextOptions.length) setOpen((o) => !o); }}
      >
        {STATUS_DISPLAY[app.status] ?? app.status}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-30 bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-1 min-w-[110px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {nextOptions.map((s) => (
            <button
              key={s}
              onClick={() => { setOpen(false); if (s === "Applied") { onRequestApplied(); } else { onUpdate(app.id, s); } }}
              className="block w-full text-left text-[12px] font-medium py-1.5 px-2 rounded-[5px] border-none cursor-pointer bg-transparent font-shell text-text-secondary hover:bg-background-secondary"
            >
              {STATUS_DISPLAY[s] ?? s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Analysis tab ──────────────────────────────────────────────────────────────

const SKILL_STYLE: Record<string, { cls: string; label: string }> = {
  STRONG:  { cls: "bg-badge-interview-bg text-badge-interview-fg", label: "Strong" },
  HONEST:  { cls: "bg-custom-l text-custom-d",                           label: "Honest" },
  GAP:     { cls: "bg-badge-passed-bg text-badge-passed-fg",       label: "Gap" },
  UNKNOWN: { cls: "bg-background-secondary text-text-tertiary",    label: "Unknown" },
};

function SkillRow({ skill, status, tier, evidence }: { skill: string; status: string; tier: number | null; evidence: string }) {
  const s = SKILL_STYLE[status] ?? SKILL_STYLE.UNKNOWN;
  return (
    <div className="grid grid-cols-[170px_72px_1fr] gap-2.5 items-baseline py-[5px] border-b-[0.5px] border-border-tertiary">
      <span className="text-[12px] font-medium font-shell text-text-primary">
        {skill}
        {tier && <span className="ml-[5px] text-[10px] text-text-tertiary font-mono">T{tier}</span>}
      </span>
      <span className={`inline-flex items-center text-[10px] font-medium py-0.5 px-[7px] rounded-full font-shell ${s.cls}`}>
        {s.label}
      </span>
      <span className="text-[11px] text-text-tertiary font-shell">{evidence}</span>
    </div>
  );
}

interface AnalysisResult {
  core_theme?: string;
  match_score?: number;
  goal_alignment?: string;
  goal_alignment_note?: string;
  is_poor_match?: boolean;
  strongest_angle?: string;
  weakest_point?: string;
  must_haves?: { skill: string; status: string; tier: number | null; evidence: string }[];
  nice_to_haves?: { skill: string; status: string; tier: number | null; evidence: string }[];
  ats_keywords?: string[];
}

function AnalysisView({ result, onRefresh }: { result: AnalysisResult; onRefresh: () => void }) {
  const goalColorCls = result.goal_alignment === "aligns"
    ? "bg-badge-interview-bg text-badge-interview-fg"
    : result.goal_alignment === "detours"
    ? "bg-badge-passed-bg text-badge-passed-fg"
    : "bg-background-secondary text-text-tertiary";

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {result.core_theme && (
          <span className="text-[13px] font-medium font-shell text-text-primary">
            {result.core_theme}
          </span>
        )}
        {result.match_score != null && (
          <span className="text-[12px] font-mono text-text-tertiary">
            {result.match_score}/10
          </span>
        )}
        {result.goal_alignment && (
          <span className={`text-[10px] font-medium py-0.5 px-2 rounded-full font-shell ${goalColorCls}`}>
            {result.goal_alignment}
          </span>
        )}
        <button
          className="inline-flex items-center gap-[5px] text-[11px] font-medium py-[5px] px-[13px] rounded-full cursor-pointer font-shell whitespace-nowrap no-underline border-[0.5px] border-border-tertiary bg-transparent text-text-secondary ml-auto"
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>

      {result.is_poor_match && (
        <div className="py-2.5 px-[13px] rounded-card bg-badge-passed-bg text-[12px] text-badge-passed-fg font-shell">
          Many must-have skills are gaps — consider carefully whether to proceed.
        </div>
      )}

      {(result.must_haves?.length ?? 0) > 0 && (
        <SectionCard title={`Must-haves (${result.must_haves!.length})`}>
          <div>{result.must_haves!.map((item, i) => <SkillRow key={i} {...item} />)}</div>
        </SectionCard>
      )}

      {(result.nice_to_haves?.length ?? 0) > 0 && (
        <SectionCard title={`Nice-to-haves (${result.nice_to_haves!.length})`}>
          <div>{result.nice_to_haves!.map((item, i) => <SkillRow key={i} {...item} />)}</div>
        </SectionCard>
      )}

      {(result.ats_keywords?.length ?? 0) > 0 && (
        <SectionCard title="ATS keywords">
          <div className="flex flex-wrap gap-[5px]">
            {result.ats_keywords!.map((kw) => (
              <span key={kw} className="text-[11px] py-0.5 px-2 rounded-full bg-background-secondary text-text-secondary font-mono">
                {kw}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {(result.strongest_angle || result.weakest_point || result.goal_alignment_note) && (
        <SectionCard title="Angles">
          <div className="flex flex-col gap-2">
            {result.strongest_angle && (
              <div className="flex gap-2 items-start">
                <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-badge-interview-bg text-badge-interview-fg font-shell">Lead with</span>
                <span className="text-[12px] text-text-secondary font-shell">{result.strongest_angle}</span>
              </div>
            )}
            {result.weakest_point && (
              <div className="flex gap-2 items-start">
                <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-custom-l text-custom-d font-shell">Watch out</span>
                <span className="text-[12px] text-text-secondary font-shell">{result.weakest_point}</span>
              </div>
            )}
            {result.goal_alignment_note && (
              <div className="flex gap-2 items-start">
                <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-background-secondary text-text-tertiary font-shell">Goal</span>
                <span className="text-[12px] text-text-secondary font-shell">{result.goal_alignment_note}</span>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Record<string, string> | null>(null);
  const [tab, setTab] = useState("JD");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  // Analysis state (hoisted so it persists across tab switches)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisRan, setAnalysisRan] = useState(false);

  // Applied-date picker state
  const isDark = useIsDark();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<DateValue | undefined>(undefined);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/api/tracker/${id}`).then((a) => {
      setApp(a);
      setNotes(a.notes ?? "");
      if (a.fit_analysis_json) {
        try {
          setAnalysisResult(JSON.parse(a.fit_analysis_json) as AnalysisResult);
          setAnalysisRan(true);
        } catch {}
      }
    });
  }, [id]);

  // Run analysis when Analysis tab is first opened
  useEffect(() => {
    if (tab !== "Analysis" || analysisRan || analysisLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs an async fetch on tab open; the loading flag is intentional
    setAnalysisLoading(true);
    api.post("/api/application/analyze-jd", { application_id: id })
      .then((r) => { setAnalysisResult(r); })
      .catch(() => { setAnalysisResult(null); })
      .finally(() => { setAnalysisLoading(false); setAnalysisRan(true); });
  }, [tab, analysisRan, analysisLoading, id]);

  const rerunAnalysis = useCallback(() => {
    setAnalysisRan(false);
    setAnalysisResult(null);
  }, []);

  const updateStatus = useCallback(async (appId: string, newStatus: string) => {
    await api.patch(`/api/tracker/${appId}/status`, { status: newStatus });
    setApp((prev) => prev ? { ...prev, status: newStatus } : prev);
  }, []);

  const openDatePicker = useCallback((statusChange: string | null) => {
    setPendingStatusChange(statusChange);
    setPendingDate(isoToDateValue(app?.date_applied) ?? todayDateValue());
    setShowDatePicker(true);
  }, [app?.date_applied]);

  const cancelDatePicker = () => {
    setShowDatePicker(false);
    setPendingStatusChange(null);
  };

  const confirmDatePicker = async () => {
    if (!pendingDate) return;
    const iso = dateValueToISO(pendingDate);
    if (pendingStatusChange) {
      await updateStatus(id, pendingStatusChange);
    }
    await api.patch(`/api/tracker/${id}/date`, { date_applied: iso });
    setApp((prev) => prev ? { ...prev, date_applied: iso } : prev);
    setShowDatePicker(false);
    setPendingStatusChange(null);
  };

  const saveNotes = async () => {
    setSaving(true);
    await api.patch(`/api/tracker/${id}/notes`, { notes });
    setSaving(false);
    toast.success("Notes saved.");
  };

  const copyJd = async () => {
    if (!app?.job_description) return;
    setCopying(true);
    await navigator.clipboard.writeText(`${app.company ?? ""}\n${app.job_title ?? ""}\n\n${app.job_description}`);
    toast.success("Copied");
    setTimeout(() => setCopying(false), 1500);
  };

  if (!app) {
    return (
      <div className="p-10 text-[12px] text-text-tertiary font-shell">
        Loading…
      </div>
    );
  }

  const canContinue = !app.resume_pdf_path && (app.status === "New" || app.status === "Draft");
  const canRegen = !canContinue && (app.status === "New" || app.status === "Draft");

  const cvPdf  = app.resume_pdf_path    ? `${BASE}/files/${app.resume_pdf_path.split("/applications/")[1]}`    : undefined;
  const cvDocx = app.resume_docx_path   ? `${BASE}/files/${app.resume_docx_path.split("/applications/")[1]}`   : undefined;
  const clPdf  = app.cover_letter_pdf_path  ? `${BASE}/files/${app.cover_letter_pdf_path.split("/applications/")[1]}`  : undefined;
  const clDocx = app.cover_letter_docx_path ? `${BASE}/files/${app.cover_letter_docx_path.split("/applications/")[1]}` : undefined;

  const allTabs = ["JD", "Analysis", "Resume", "Cover Letter"];
  const visibleTabs = allTabs.filter((t) => {
    if (t === "Resume" && !app.resume_final_md) return false;
    if (t === "Cover Letter" && !app.cover_letter_final_md) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background-primary">
      {/* ── Topbar ── */}
      <div className="flex items-center gap-2.5 py-2.5 px-4 shrink-0 border-b-[0.5px] border-border-tertiary flex-wrap">
        <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
          <span className="text-[14px] font-semibold font-shell text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
            {app.company}
          </span>
          <span className="text-[12px] text-text-tertiary font-shell shrink-0">·</span>
          <span className="text-[13px] font-shell text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
            {app.job_title}
          </span>
          {app.language && (
            <span className="shrink-0 text-[10px] font-mono text-text-tertiary border-[0.5px] border-border-tertiary py-px px-1.5 rounded-[4px]">
              {app.language.toUpperCase()}
            </span>
          )}
        </div>

        <div className="relative">
          <div className="flex items-center gap-1.5">
            <StatusBadge app={{ id, status: app.status }} onUpdate={updateStatus} onRequestApplied={() => openDatePicker("Applied")} />
            {app.date_applied && (
              <button
                onClick={() => openDatePicker(null)}
                className="inline-flex items-center text-[12px] font-medium py-[3px] px-2.5 rounded-full border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell whitespace-nowrap"
              >
                Applied {formatAppliedDate(app.date_applied)}
              </button>
            )}
          </div>
          {showDatePicker && (
            <div className="absolute top-[calc(100%+6px)] left-0 z-40 bg-background-primary border-[0.5px] border-border-tertiary rounded-[12px] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col gap-3">
              <FlipClock
                mode="date" theme={isDark ? "dark" : "light"} size="xs"
                defaultValue={pendingDate}
                onChange={setPendingDate}
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={cancelDatePicker} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell">Cancel</button>
                <button onClick={confirmDatePicker} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-none bg-custom text-white cursor-pointer font-shell">Confirm</button>
              </div>
            </div>
          )}
        </div>

        {canContinue && (
          <Link href={`/apply/new?id=${id}`} className={pillBtnCls(true)}>
            Continue wizard
          </Link>
        )}
        {canRegen && (
          <Link href={`/apply/new?id=${id}&regen=1`} className={pillBtnCls()}>
            Regenerate
          </Link>
        )}

        {app.status === "Interview" && (
          <Link
            href="/interview"
            className="inline-flex items-center gap-[5px] text-[12px] font-medium py-[5px] px-[13px] rounded-full cursor-pointer font-shell whitespace-nowrap no-underline border-none bg-badge-interview-bg text-badge-interview-fg"
          >
            Interview prep →
          </Link>
        )}

        <DownloadDropdown label="CV" pdf={cvPdf} docx={cvDocx} />
        <DownloadDropdown label="Cover Letter" pdf={clPdf} docx={clDocx} />
      </div>

      {/* ── Body: left tabs + right notes ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — tab strip + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab strip */}
          <div className="flex items-center py-2 px-4 shrink-0 border-b-[0.5px] border-border-tertiary">
            <TabBar
              tabs={visibleTabs}
              active={visibleTabs.includes(tab) ? tab : visibleTabs[0]}
              onChange={setTab}
            />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">

            {/* JD */}
            {tab === "JD" && (
              <div className="relative">
                <button
                  onClick={copyJd}
                  title="Copy"
                  className={`absolute top-0 right-0 p-[5px] rounded-[5px] border-[0.5px] border-border-tertiary bg-transparent cursor-pointer hover:text-text-primary ${
                    copying ? "text-text-primary" : "text-text-tertiary"
                  }`}
                >
                  <Copy size={13} />
                </button>
                <pre className="font-shell text-[13px] leading-[1.7] whitespace-pre-wrap text-text-secondary m-0 pr-7">
                  {app.job_description}
                </pre>
              </div>
            )}

            {/* Analysis */}
            {tab === "Analysis" && (
              analysisLoading ? (
                <div className="text-center py-8 text-[12px] text-text-tertiary font-shell">
                  Analysing job description…
                </div>
              ) : analysisResult ? (
                <AnalysisView result={analysisResult} onRefresh={rerunAnalysis} />
              ) : analysisRan ? (
                <div className="flex flex-col gap-2.5 items-start">
                  <p className="text-[12px] text-text-tertiary font-shell">Analysis failed — check backend.</p>
                  <button className={pillBtnCls(true)} onClick={rerunAnalysis}>Retry</button>
                </div>
              ) : null
            )}

            {/* Resume */}
            {tab === "Resume" && app.resume_final_md && (
              <div className="text-[13px] leading-[1.7] text-text-secondary font-shell">
                <ReactMarkdown>{app.resume_final_md}</ReactMarkdown>
              </div>
            )}

            {/* Cover Letter */}
            {tab === "Cover Letter" && app.cover_letter_final_md && (
              <div className="text-[13px] leading-[1.7] text-text-secondary font-shell">
                <ReactMarkdown>{app.cover_letter_final_md}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Right — Notes column */}
        <div className="w-[240px] shrink-0 border-l-[0.5px] border-border-tertiary flex flex-col p-3.5 gap-2 items-start">
          <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell">
            Notes
          </div>
          <textarea
            className="notes-textarea text-[12px] leading-[1.7] font-shell text-text-secondary bg-transparent border-none resize-none outline-none p-0 w-full overflow-y-auto"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Follow-up dates, recruiter contact, interview notes…"
            rows={10}
          />
          <button
            onClick={saveNotes}
            disabled={saving}
            className="inline-flex items-center gap-[5px] text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell whitespace-nowrap no-underline border-none bg-custom text-white self-start"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

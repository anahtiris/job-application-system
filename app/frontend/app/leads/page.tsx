"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Search, Check, CheckCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { pillBtnCls, useClickOutside, statusChipStyleCls, verdictStyleCls } from "@/components/ui-kit";

type Lead = {
  id: string;
  company: string;
  job_title: string;
  language: string;
  status: string;
  source_url: string | null;
  fit_score: number | null;
  fit_verdict: string | null;
  created_at: string;
};

const STATUS_TABS = ["new", "analyzing", "analyzed", "approved", "applied", "rejected"] as const;
const CLAUDE_PROMPT = "process my captured jobs";

const COL_GRID_CLS = "grid-cols-[2fr_2fr_64px_100px_90px_70px_66px]";

const FIT_VERDICTS = ["strong", "maybe", "skip"] as const;

const selectCls = "text-[12px] font-medium py-1 px-2.5 rounded-full border-[0.5px] border-border-tertiary bg-background-secondary text-text-secondary font-shell cursor-pointer outline-none capitalize";

function hostname(url: string | null): string {
  if (!url) return "captured job";
  try { return new URL(url).hostname; } catch { return url; }
}

function leadBadgeCls(status: string): string {
  return `inline-flex items-center text-[12px] font-medium py-[3px] px-[9px] rounded-full font-shell capitalize ${statusChipStyleCls(status)}`;
}

function verdictCls(verdict: string): string {
  return `text-[11px] font-semibold py-0.5 px-[7px] rounded-full font-shell capitalize ${verdictStyleCls(verdict)}`;
}

function colHeader(label: string) {
  return (
    <span className="flex items-center text-[11px] font-medium tracking-[0.06em] uppercase text-text-tertiary py-[9px] font-shell">
      {label}
    </span>
  );
}

function FitFilterDropdown({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  const label =
    selected.length === 0 || selected.length === FIT_VERDICTS.length
      ? "All fits"
      : selected.map((v) => v.charAt(0).toUpperCase() + v.slice(1)).join(", ");

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`${selectCls} inline-flex items-center gap-1`}>
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 z-30 bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-1 min-w-[110px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {FIT_VERDICTS.map((v) => (
            <label
              key={v}
              className="flex items-center gap-2 text-[12px] font-medium py-1.5 px-2 rounded-[5px] text-text-secondary font-shell capitalize cursor-pointer hover:bg-background-secondary"
            >
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
              {v}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusFilterDropdown({
  selected,
  onChange,
  counts,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  const options = STATUS_TABS.filter((s) => counts[s] > 0);
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  const label =
    selected.length === 0 || selected.length === options.length
      ? "All statuses"
      : selected.map((v) => v.charAt(0).toUpperCase() + v.slice(1)).join(", ");

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`${selectCls} inline-flex items-center gap-1`}>
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 z-30 bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-1 min-w-[150px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {options.length === 0 ? (
            <div className="text-[12px] text-text-tertiary py-1.5 px-2 font-shell">No statuses</div>
          ) : (
            options.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-[12px] font-medium py-1.5 px-2 rounded-[5px] text-text-secondary font-shell capitalize cursor-pointer hover:bg-background-secondary"
              >
                <input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)} />
                {s} ({counts[s]})
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [search, setSearch] = useState("");
  const [fitFilters, setFitFilters] = useState<string[]>([]);
  const [capturedCollapsed, setCapturedCollapsed] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/api/leads/").then((data) => { setLeads(data); setLoading(false); });
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch; the loading flag inside load() is intentional
  useEffect(() => { load(); }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted filters on mount
  useEffect(() => {
    try {
      const storedStatus = localStorage.getItem("leads.statusFilters");
      if (storedStatus) setStatusFilters(JSON.parse(storedStatus));
      const storedFit = localStorage.getItem("leads.fitFilters");
      if (storedFit) setFitFilters(JSON.parse(storedFit));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("leads.statusFilters", JSON.stringify(statusFilters));
  }, [statusFilters]);

  useEffect(() => {
    localStorage.setItem("leads.fitFilters", JSON.stringify(fitFilters));
  }, [fitFilters]);

  const handleApprove = async (leadId: string) => {
    setApprovingId(leadId);
    try {
      const result = await api.post(`/api/leads/${leadId}/approve`, {});
      toast.success("Approved → Application created");
      if (result?.application_id) {
        router.push(`/apply/${result.application_id}`);
      } else {
        load();
      }
    } catch {
      toast.error("Approve failed");
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAll = async () => {
    const analyzedLeads = leads.filter((l) => l.status === "analyzed");
    if (!analyzedLeads.length) return;
    setApprovingAll(true);
    try {
      for (const lead of analyzedLeads) {
        await api.post(`/api/leads/${lead.id}/approve`, {});
      }
      toast.success(`${analyzedLeads.length} lead${analyzedLeads.length !== 1 ? "s" : ""} approved`);
      load();
    } catch {
      toast.error("Some approvals failed");
      load();
    } finally {
      setApprovingAll(false);
    }
  };

  const handleDelete = async (leadId: string) => {
    setPendingDelete(null);
    await api.delete(`/api/leads/${leadId}`);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    toast.success("Job deleted");
  };

  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});

  const q = search.trim().toLowerCase();
  const visible = (statusFilters.length > 0
    ? leads.filter((l) => statusFilters.includes(l.status))
    : leads.filter((l) => l.status !== "captured")
  )
    .filter((l) => (fitFilters.length === 0 ? true : !!l.fit_verdict && fitFilters.includes(l.fit_verdict)))
    .filter((l) =>
      q
        ? l.company.toLowerCase().includes(q) || l.job_title.toLowerCase().includes(q)
        : true
    );
  const captured = leads.filter((l) => l.status === "captured");
  const unanalyzed = leads.filter((l) => l.status === "captured" || l.status === "new");

  const copyPrompt = async () => {
    setCopying(true);
    await navigator.clipboard.writeText(CLAUDE_PROMPT);
    toast.success("Copied");
    setCopying(false);
  };

  const analyzeAll = async () => {
    setBulkAnalyzing(true);
    try {
      setBulkProgress("Extracting…");
      await api.post("/api/leads/extract-captured", {});
      const updated: Lead[] = await api.get("/api/leads/");
      setLeads(updated);
      const toAnalyze = updated.filter((l) => l.status === "new");
      for (let i = 0; i < toAnalyze.length; i++) {
        setBulkProgress(`Analyzing ${i + 1}/${toAnalyze.length}…`);
        await api.post(`/api/leads/${toAnalyze[i].id}/analyze`, {});
      }
      toast.success("Analysis complete");
    } finally {
      setBulkProgress(null);
      setBulkAnalyzing(false);
      load();
    }
  };

  return (
    <div className="flex flex-col overflow-hidden h-full bg-background-primary">
      {/* Pending analysis panel */}
      {unanalyzed.length > 0 && (
        <div className="shrink-0 border-b-[0.5px] border-border-tertiary">
          {/* Two-column body */}
          <div className="grid grid-cols-2 gap-0 bg-background-secondary">
            {/* Left — count + actions */}
            <div className="py-3.5 px-4 flex flex-col gap-3.5 border-r-[0.5px] border-border-tertiary">
              {/* Count */}
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-custom text-white text-[16px] font-mono font-bold shrink-0">
                  {unanalyzed.length}
                </span>
                <span className="text-[13px] font-medium text-text-secondary font-shell">
                  pending analysis
                </span>
              </div>

              {/* Claude Code path */}
              <div className="flex flex-col gap-[5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell">
                    Use Claude Code
                  </span>
                  <span className="text-[10px] text-text-tertiary font-shell">add /clear after pasting</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 py-1.5 px-2.5 rounded-[6px] bg-background-tertiary text-[12px] font-mono text-text-secondary border-[0.5px] border-border-tertiary">
                    {CLAUDE_PROMPT}
                  </code>
                  <button
                    onClick={copyPrompt}
                    disabled={copying}
                    className="text-[11px] font-medium py-1 px-2.5 rounded-full border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell shrink-0"
                  >
                    {copying ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Ollama path */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell">
                  Analyze with configured model
                </span>
                <button
                  onClick={analyzeAll}
                  disabled={bulkAnalyzing}
                  className={`text-[11px] font-medium py-1 px-2.5 rounded-full border-none bg-custom text-white font-shell ${
                    bulkAnalyzing ? "opacity-60 cursor-default" : "opacity-100 cursor-pointer"
                  }`}
                >
                  {bulkProgress ?? "Analyze all →"}
                </button>
              </div>
            </div>

            {/* Right — captured list */}
            <div className="py-3.5 px-4 flex flex-col gap-2">
              <button
                onClick={() => setCapturedCollapsed((c) => !c)}
                className="flex items-center gap-1.5 text-left bg-transparent border-none p-0 cursor-pointer group"
              >
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell">
                  {captured.length > 0 ? `Captured (${captured.length})` : "No raw captures"}
                </span>
                {captured.length > 0 && (
                  <ChevronDown
                    size={11}
                    className={`text-text-tertiary transition-transform ${capturedCollapsed ? "-rotate-90" : ""}`}
                  />
                )}
              </button>
              {!capturedCollapsed && captured.length > 0 && (
                <div className="border-[0.5px] border-border-tertiary rounded-[6px] overflow-hidden">
                  {captured.map((lead, i) => (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className={`flex items-center justify-between gap-3 py-[7px] px-2.5 bg-background-primary cursor-pointer transition-colors hover:bg-background-secondary ${
                        i > 0 ? "border-t-[0.5px] border-border-tertiary" : ""
                      }`}
                    >
                      <span className="text-text-tertiary font-mono text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {hostname(lead.source_url)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(lead.id);
                        }}
                        className="text-[11px] font-medium shrink-0 bg-transparent border-none cursor-pointer font-shell text-text-tertiary hover:text-badge-passed-fg"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* List topbar */}
      <div className="flex items-center py-2.5 px-4 border-b-[0.5px] border-border-tertiary gap-2 shrink-0">
        <span className="text-[15px] font-medium mr-1.5 font-shell">
          Captured Jobs
        </span>
        <span className="text-[12px] font-medium bg-background-secondary text-text-tertiary py-0.5 px-2 rounded-full font-mono">
          {visible.length}
        </span>

        {/* Search */}
        <div className="relative ml-2">
          <Search
            size={13}
            className="absolute left-[9px] top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="text-[12px] py-1 pr-2.5 pl-7 rounded-full border-[0.5px] border-border-tertiary bg-background-secondary text-text-primary font-shell outline-none w-[180px]"
          />
        </div>

        {/* Approve all */}
        {leads.some((l) => l.status === "analyzed") && (
          <button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className={`${pillBtnCls(true)} ${approvingAll ? "opacity-60 cursor-default" : "opacity-100 cursor-pointer"}`}
          >
            <CheckCheck size={12} />
            {approvingAll ? "Approving…" : "Approve all analyzed"}
          </button>
        )}

        {/* Filters */}
        <div className="flex gap-[5px] ml-auto items-center">
          <FitFilterDropdown selected={fitFilters} onChange={setFitFilters} />
          <StatusFilterDropdown selected={statusFilters} onChange={setStatusFilters} counts={counts} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        {/* Sticky header */}
        <div className={`grid ${COL_GRID_CLS} px-4 border-b-[0.5px] border-border-tertiary bg-background-secondary sticky top-0 z-[2]`}>
          {colHeader("Company")}
          {colHeader("Role")}
          {colHeader("Lang")}
          {colHeader("Fit")}
          {colHeader("Status")}
          <div />
          <div />
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-text-tertiary">
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-text-tertiary">
            No captured jobs yet
          </div>
        ) : (
          visible.map((lead) => (
            <div
              key={lead.id}
              onClick={() => router.push(`/leads/${lead.id}`)}
              className={`app-row grid ${COL_GRID_CLS} py-2.5 px-4 border-b-[0.5px] border-border-tertiary items-center cursor-pointer relative`}
            >
              {/* Company */}
              <div className="text-[14px] font-medium min-w-0 line-clamp-2 break-words">
                {lead.company || (
                  <span className="text-text-tertiary italic text-[12px]">
                    pending
                  </span>
                )}
              </div>

              {/* Role */}
              <div className="text-[13px] text-text-secondary min-w-0 line-clamp-2 break-words">
                {lead.job_title || (
                  <span className="font-mono text-[11px] text-text-tertiary">
                    {hostname(lead.source_url)}
                  </span>
                )}
              </div>

              {/* Language */}
              <div>
                {lead.language ? (
                  <span className="text-[11px] font-medium font-mono py-0.5 px-1.5 rounded-[4px] bg-background-secondary text-text-secondary">
                    {lead.language.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-text-tertiary text-[12px]">—</span>
                )}
              </div>

              {/* Fit */}
              <div className="flex items-center gap-1.5">
                {lead.fit_score !== null ? (
                  <>
                    <span className="text-[13px] font-medium font-mono">
                      {lead.fit_score}
                    </span>
                    {lead.fit_verdict && (
                      <span className={verdictCls(lead.fit_verdict)}>{lead.fit_verdict}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[12px] text-text-tertiary">
                    {lead.status === "analyzing" ? "Analyzing…" : "—"}
                  </span>
                )}
              </div>

              {/* Status */}
              <div>
                <span className={leadBadgeCls(lead.status)}>{lead.status}</span>
              </div>

              {/* Approve */}
              <div onClick={(e) => e.stopPropagation()}>
                {lead.status === "analyzed" && (
                  <button
                    disabled={approvingId === lead.id}
                    onClick={() => handleApprove(lead.id)}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium py-[3px] px-[9px] rounded-[6px] border-none bg-custom text-white font-shell whitespace-nowrap ${
                      approvingId === lead.id ? "opacity-60 cursor-default" : "opacity-100 cursor-pointer"
                    }`}
                  >
                    {approvingId === lead.id ? "…" : (
                      <>
                        <Check size={12} />
                        Approve
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Delete */}
              <div onClick={(e) => e.stopPropagation()} className="app-row-del justify-self-end flex items-center">
                {pendingDelete === lead.id ? (
                  <div className="flex flex-col items-center gap-1 text-[11px]">
                    <span className="text-text-tertiary whitespace-nowrap">Delete?</span>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Confirm delete"
                        onClick={() => handleDelete(lead.id)}
                        className="text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-badge-passed-bg text-badge-passed-fg border-none cursor-pointer font-shell"
                      >
                        Yes
                      </button>
                      <button
                        aria-label="Cancel delete"
                        onClick={() => setPendingDelete(null)}
                        className="text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-transparent text-text-tertiary border-[0.5px] border-border-tertiary cursor-pointer font-shell"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    aria-label="Delete"
                    onClick={() => setPendingDelete(lead.id)}
                    className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center border-none bg-transparent cursor-pointer text-text-tertiary transition-colors hover:text-badge-passed-fg hover:bg-badge-passed-bg"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

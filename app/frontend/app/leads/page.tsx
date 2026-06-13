"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

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

const STATUS_TABS = ["new", "analyzing", "analyzed", "approved", "rejected"] as const;
const CLAUDE_PROMPT = "process my captured jobs";

const COL_GRID_CLS = "grid-cols-[2fr_2fr_64px_100px_90px_70px_66px]";

function hostname(url: string | null): string {
  if (!url) return "captured job";
  try { return new URL(url).hostname; } catch { return url; }
}

function leadBadgeCls(status: string): string {
  const color =
    status === "approved"  ? "bg-badge-interview-bg text-badge-interview-fg" :
    status === "rejected"  ? "bg-badge-passed-bg text-badge-passed-fg" :
    status === "analyzed"  ? "bg-badge-analyzed-bg text-badge-analyzed-fg" :
    status === "analyzing" ? "bg-custom-l text-custom-d" :
    status === "new"       ? "bg-badge-responded-bg text-badge-responded-fg" :
                             "bg-background-secondary text-text-tertiary";
  return `inline-flex items-center text-[12px] font-medium py-[3px] px-[9px] rounded-full font-shell capitalize ${color}`;
}

function verdictCls(verdict: string): string {
  const color =
    verdict === "strong" ? "bg-badge-interview-bg text-badge-interview-fg" :
    verdict === "skip"   ? "bg-badge-passed-bg text-badge-passed-fg" :
                           "bg-custom-l text-custom-d"; // maybe
  return `text-[11px] font-semibold py-0.5 px-[7px] rounded-full font-shell capitalize ${color}`;
}

function colHeader(label: string) {
  return (
    <span className="flex items-center text-[11px] font-medium tracking-[0.06em] uppercase text-text-tertiary py-[9px] font-shell">
      {label}
    </span>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/api/leads/").then((data) => { setLeads(data); setLoading(false); });
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch; the loading flag inside load() is intentional
  useEffect(() => { load(); }, []);

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

  const visible = tab
    ? leads.filter((l) => l.status === tab)
    : leads.filter((l) => l.status !== "captured");
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
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell">
                  Use Claude Code
                </span>
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
              <span className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell">
                {captured.length > 0 ? `Captured (${captured.length})` : "No raw captures"}
              </span>
              {captured.length > 0 && (
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

        {/* Approve all */}
        {leads.some((l) => l.status === "analyzed") && (
          <button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className={`text-[12px] font-medium py-1 px-2.5 rounded-[6px] border-none bg-badge-interview-bg text-badge-interview-fg font-shell ${
              approvingAll ? "opacity-60 cursor-default" : "opacity-100 cursor-pointer"
            }`}
          >
            {approvingAll ? "Approving…" : "Approve all analyzed"}
          </button>
        )}

        {/* Filter tabs */}
        <div className="flex gap-[5px] ml-auto flex-wrap">
          <button
            onClick={() => setTab(null)}
            className={`text-[12px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell ${
              !tab
                ? "border-none bg-background-secondary text-text-primary"
                : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
            }`}
          >
            All
          </button>
          {STATUS_TABS.filter((s) => counts[s] > 0).map((s) => (
            <button
              key={s}
              onClick={() => setTab(tab === s ? null : s)}
              className={`text-[12px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell capitalize ${
                tab === s
                  ? "border-none bg-background-secondary text-text-primary"
                  : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
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
                    className={`text-[11px] font-medium py-[3px] px-[9px] rounded-full border-none bg-badge-interview-bg text-badge-interview-fg font-shell whitespace-nowrap ${
                      approvingId === lead.id ? "opacity-60 cursor-default" : "opacity-100 cursor-pointer"
                    }`}
                  >
                    {approvingId === lead.id ? "…" : "Approve"}
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

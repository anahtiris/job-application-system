"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

// `captured` leads are not shown in the table — they live in the pending-analysis panel.
const STATUS_TABS = ["new", "analyzing", "analyzed", "approved", "rejected"] as const;

const VERDICT_CLASSES: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  maybe: "bg-yellow-100 text-yellow-800",
  skip: "bg-red-100 text-red-800",
};

const STATUS_BADGE: Record<string, string> = {
  captured:  "bg-slate-100 text-slate-600 border border-slate-200",
  new:       "bg-blue-50 text-blue-600 border border-blue-200",
  analyzing: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  analyzed:  "bg-violet-100 text-violet-700 border border-violet-300",
  approved:  "bg-green-100 text-green-700 border border-green-300",
  rejected:  "bg-red-100 text-red-500 border border-red-200",
};

const CLAUDE_PROMPT = "process my captured jobs";

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copying, setCopying] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/api/leads/").then((data) => { setLeads(data); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (leadId: string) => {
    if (pendingDelete === leadId) {
      setPendingDelete(null);
      await api.delete(`/api/leads/${leadId}`);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      toast.success("Job deleted");
    } else {
      setPendingDelete(leadId);
    }
  };

  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});

  // Table never shows captured leads; they appear only in the pending-analysis panel.
  const visible = tab ? leads.filter((l) => l.status === tab) : leads.filter((l) => l.status !== "captured");
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
    <main className="w-full max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Captured Jobs</h1>
          <p className="text-muted-foreground text-sm">
            Jobs of interest — analyze fit before committing to an application
          </p>
        </div>
      </div>

      {unanalyzed.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/20 transition-colors text-left"
          >
            <span>{unanalyzed.length} job{unanalyzed.length !== 1 ? "s" : ""} pending analysis</span>
            <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Use Claude Code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-muted text-xs font-mono">{CLAUDE_PROMPT}</code>
                  <Button variant="outline" size="sm" onClick={copyPrompt} disabled={copying}>
                    {copying ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analyze with configured model</p>
                <Button size="sm" onClick={analyzeAll} disabled={bulkAnalyzing}>
                  {bulkProgress ?? "Analyze all →"}
                </Button>
              </div>

              {captured.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Captured ({captured.length})</p>
                  <div className="border rounded-md overflow-hidden divide-y">
                    {captured.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm bg-background/50 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <span className="truncate text-muted-foreground text-xs">
                          {lead.source_url ? new URL(lead.source_url).hostname : "captured job"}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                          className={`text-xs shrink-0 transition-colors ${
                            pendingDelete === lead.id
                              ? "text-red-600 font-medium"
                              : "text-muted-foreground hover:text-red-500"
                          }`}
                        >
                          {pendingDelete === lead.id ? "Confirm?" : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
            ${!tab
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/40 text-muted-foreground border-transparent hover:border-border"}`}
        >
          All ({leads.length})
        </button>
        {STATUS_TABS.filter((s) => counts[s] > 0).map((s) => (
          <button
            key={s}
            onClick={() => setTab(tab === s ? null : s)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors
              ${tab === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`}
          >
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-muted/40 h-12 rounded-md" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No captured jobs yet. Use the browser extension to capture job postings.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 font-medium">Company</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Lang</th>
                <th className="text-left px-4 py-2 font-medium">Fit</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium">
                    {lead.company || (
                      <span className="text-muted-foreground italic text-xs">pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.job_title || (lead.source_url ? (
                      <span className="text-xs truncate max-w-[200px] block" title={lead.source_url}>
                        {new URL(lead.source_url).hostname}
                      </span>
                    ) : "—")}
                  </td>
                  <td className="px-4 py-3">
                    {lead.language ? (
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-muted">
                        {lead.language.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.fit_score !== null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.fit_score}</span>
                        {lead.fit_verdict && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${VERDICT_CLASSES[lead.fit_verdict] ?? ""}`}>
                            {lead.fit_verdict}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {lead.status === "analyzing" ? "Analyzing…" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[lead.status] ?? "bg-muted text-muted-foreground"}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(lead.id)}
                      className={`text-xs transition-colors ${
                        pendingDelete === lead.id
                          ? "text-red-600 font-medium"
                          : "text-muted-foreground hover:text-red-500"
                      }`}
                    >
                      {pendingDelete === lead.id ? "Confirm?" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

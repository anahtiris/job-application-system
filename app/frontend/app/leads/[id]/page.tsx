"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

type SkillEntry = {
  skill: string;
  status: "STRONG" | "HONEST" | "GAP" | "UNKNOWN";
  tier: number | null;
  evidence: string;
};

type FitAnalysis = {
  core_theme: string;
  must_haves: SkillEntry[];
  nice_to_haves: SkillEntry[];
  ats_keywords: string[];
  match_score: number;
  strongest_angle: string;
  weakest_point: string;
  is_poor_match: boolean;
  goal_alignment?: "aligns" | "neutral" | "detours";
  goal_alignment_note?: string;
};

type Lead = {
  id: string;
  company: string;
  job_title: string;
  language: string;
  job_description: string;
  raw_text: string | null;
  source_url: string | null;
  status: string;
  fit_score: number | null;
  fit_verdict: string | null;
  fit_analysis_json: string | null;
  company_tone: string | null;
  company_research: string | null;
  application_id: string | null;
};

const STATUS_CLASSES: Record<string, string> = {
  STRONG: "bg-green-100 text-green-800",
  HONEST: "bg-yellow-100 text-yellow-800",
  GAP: "bg-red-100 text-red-800",
  UNKNOWN: "bg-muted text-muted-foreground",
};

const VERDICT_CLASSES: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  maybe: "bg-yellow-100 text-yellow-800",
  skip: "bg-red-100 text-red-800",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [approving, setApproving] = useState(false);

  const load = () => {
    api.get(`/api/leads/${id}`).then((data) => { setLead(data); setLoading(false); });
  };
  useEffect(() => { load(); }, [id]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    const result = await api.post(`/api/leads/${id}/analyze`, {});
    if (result?.detail) {
      toast.error(result.detail);
    } else {
      setLead(result);
    }
    setAnalyzing(false);
  };

  const approve = async () => {
    setApproving(true);
    const result = await api.post(`/api/leads/${id}/approve`, {});
    if (result?.detail) {
      toast.error(result.detail);
      setApproving(false);
    } else {
      toast.success("Application created");
      router.push(`/apply/${result.application_id}`);
    }
  };

  const reject = async () => {
    await api.post(`/api/leads/${id}/reject`, {});
    toast.success("Lead rejected");
    router.push("/leads");
  };

  if (loading) {
    return (
      <main className="w-full max-w-4xl mx-auto px-4 py-10">
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-muted/40 h-16 rounded-md" />)}</div>
      </main>
    );
  }

  if (!lead) return <main className="p-10 text-muted-foreground">Lead not found.</main>;

  if (lead.status === "captured") {
    return (
      <main className="w-full max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-muted-foreground">Pending extraction</h1>
          {lead.source_url && (
            <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 block">
              {lead.source_url}
            </a>
          )}
        </div>
        <div className="border rounded-lg p-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Raw page text is saved. Tell Claude Code <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">"process my captured leads"</span> to extract job details.
          </p>
        </div>
        {lead.raw_text && (
          <details className="border rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium select-none">Raw page text</summary>
            <div className="px-4 pb-4">
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed">{lead.raw_text.slice(0, 3000)}…</pre>
            </div>
          </details>
        )}
      </main>
    );
  }

  const fit: FitAnalysis | null = lead.fit_analysis_json ? JSON.parse(lead.fit_analysis_json) : null;

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{lead.company}</h1>
            <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-muted">{lead.language.toUpperCase()}</span>
          </div>
          <p className="text-muted-foreground">{lead.job_title}</p>
          {lead.source_url && (
            <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 block">
              Source ↗
            </a>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {lead.status === "approved" && lead.application_id ? (
            <Button variant="outline" onClick={() => router.push(`/apply/${lead.application_id}`)}>
              View Application →
            </Button>
          ) : lead.status === "rejected" ? (
            <span className="text-sm text-muted-foreground">Rejected</span>
          ) : fit ? (
            <>
              <Button variant="outline" onClick={reject}>Reject</Button>
              <Button onClick={approve} disabled={approving}>
                {approving ? "Creating…" : "Approve & Create Application"}
              </Button>
            </>
          ) : (
            <Button onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? "Analyzing…" : "Analyze"}
            </Button>
          )}
        </div>
      </div>

      {/* Fit analysis */}
      {fit ? (
        <div className="space-y-4">
          {/* Score card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-bold">{fit.match_score}</span>
              <span className="text-muted-foreground text-sm">/100</span>
              {lead.fit_verdict && (
                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${VERDICT_CLASSES[lead.fit_verdict] ?? ""}`}>
                  {lead.fit_verdict}
                </span>
              )}
              {fit.goal_alignment && (
                <span
                  title={fit.goal_alignment_note ?? ""}
                  className={`px-2 py-1 rounded text-xs font-medium cursor-default ${
                    fit.goal_alignment === "aligns"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : fit.goal_alignment === "detours"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {fit.goal_alignment === "aligns" ? "→ aligns" : fit.goal_alignment === "detours" ? "← detours" : "⟳ neutral"}
                </span>
              )}
              {lead.company_tone && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground capitalize ml-auto">
                  {lead.company_tone}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{fit.core_theme}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Strongest angle</p>
                <p>{fit.strongest_angle}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Watch out for</p>
                <p>{fit.weakest_point}</p>
              </div>
            </div>
            {lead.company_research && (
              <p className="text-xs text-muted-foreground border-t pt-2">{lead.company_research}</p>
            )}
          </div>

          {/* Must-haves */}
          {(fit.must_haves ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Must-haves</h3>
              <div className="flex flex-wrap gap-2">
                {(fit.must_haves ?? []).map((s) => (
                  <span key={s.skill} className={`px-2 py-1 rounded text-xs font-medium ${STATUS_CLASSES[s.status]}`}>
                    {s.skill}
                    {s.status === "GAP" && " ✗"}
                    {s.status === "STRONG" && " ✓"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Nice-to-haves */}
          {(fit.nice_to_haves ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Nice-to-haves</h3>
              <div className="flex flex-wrap gap-2">
                {(fit.nice_to_haves ?? []).map((s) => (
                  <span key={s.skill} className={`px-2 py-1 rounded text-xs font-medium ${STATUS_CLASSES[s.status]}`}>
                    {s.skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ATS keywords */}
          {(fit.ats_keywords ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">ATS keywords</h3>
              <div className="flex flex-wrap gap-1.5">
                {(fit.ats_keywords ?? []).map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-muted text-xs font-mono">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Not yet analyzed */
        <div className="border rounded-lg p-8 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Run analysis to see fit score, skill gaps, and company tone before deciding to apply.
          </p>
          {lead.status === "analyzing" && (
            <p className="text-xs text-muted-foreground animate-pulse">Analysis in progress…</p>
          )}
        </div>
      )}

      {/* Job description */}
      <details className="border rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium select-none">
          Job Description
        </summary>
        <div className="px-4 pb-4">
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed">
            {lead.job_description}
          </pre>
        </div>
      </details>
    </main>
  );
}

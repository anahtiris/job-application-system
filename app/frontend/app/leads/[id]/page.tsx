"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  chipCls,
  pillBtnCls,
  skillStatusStyleCls,
  verdictStyleCls,
  goalAlignStyleCls,
  statusChipStyleCls,
  sectionLabelCls,
  CopyButton,
  SectionCard,
} from "@/components/ui-kit";

const PROCESS_PROMPT = "process my captured jobs";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Style helpers ────────────────────────────────────────────────────────────

const pageShell = "flex flex-col h-full overflow-hidden font-shell";

const pageHeader =
  "px-6 py-3 border-b-[0.5px] border-(--color-border-tertiary) shrink-0 flex justify-between gap-4";

const contentWrapper = "flex-1 overflow-auto px-6 py-5 flex flex-col gap-3.5";

const emptyStateBox =
  "border-[0.5px] border-(--color-border-tertiary) rounded-[8px] px-6 py-8 text-center";

const mutedParagraph = "text-[13px] text-(--color-text-tertiary) leading-[1.7]";

const inlineCode =
  "text-[11px] font-mono bg-(--color-background-secondary) px-1.5 py-px rounded-[4px]";

const sourceLink = "block mt-[3px] text-[11px] text-(--color-text-tertiary) no-underline";

const angleText = "text-[12px] text-(--color-text-secondary) leading-[1.55]";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api.get(`/api/leads/${id}`).then((data) => { setLead(data); setLoading(false); });
  }, [id]);

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
    toast.success("Job rejected");
    router.push("/leads");
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await api.delete(`/api/leads/${id}`);
    toast.success("Job deleted");
    router.push("/leads");
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className={pageShell}>
        <div className="px-6 py-3.5 border-b-[0.5px] border-(--color-border-tertiary)">
          <div className="h-4 w-[140px] rounded-[6px] bg-(--color-background-secondary)" />
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[60px] rounded-[8px] bg-(--color-background-secondary)" />
          ))}
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="px-6 py-10 text-[13px] text-(--color-text-tertiary) font-shell">
        Job not found.
      </div>
    );
  }

  // ── Captured (not yet extracted) ──
  if (lead.status === "captured") {
    return (
      <div className={pageShell}>
        <div className={`${pageHeader} items-center`}>
          <div>
            <span className="text-[13px] font-semibold text-(--color-text-tertiary)">
              Pending extraction
            </span>
            {lead.source_url && (
              <a
                href={lead.source_url}
                target="_blank"
                rel="noreferrer"
                className={sourceLink}
              >
                {lead.source_url}
              </a>
            )}
          </div>
          <button onClick={handleDelete} className={pillBtnCls(false, confirmDelete)}>
            {confirmDelete ? "Confirm delete?" : "Delete"}
          </button>
        </div>

        <div className={contentWrapper}>
          <div className={emptyStateBox}>
            <p className={mutedParagraph}>
              Raw page text saved. Tell Claude Code{" "}
              <code className={inlineCode}>
                &quot;process my captured jobs&quot;
              </code>
              {" "}to extract job details.
            </p>
          </div>

          {lead.raw_text && (
            <SectionCard variant="labeled" title="Raw page text">
              <pre className="text-[11px] font-mono whitespace-pre-wrap text-(--color-text-tertiary) leading-[1.6]">
                {lead.raw_text.slice(0, 3000)}…
              </pre>
            </SectionCard>
          )}
        </div>
      </div>
    );
  }

  const fit: FitAnalysis | null = lead.fit_analysis_json ? JSON.parse(lead.fit_analysis_json) : null;

  return (
    <div className={pageShell}>
      {/* ── Header ── */}
      <div className={`${pageHeader} items-start`}>
        <div>
          <div className="flex items-center gap-2 mb-[3px] flex-wrap">
            <span className="text-[16px] font-bold text-(--color-text-primary)">{lead.company}</span>
            <span className="inline-flex items-center text-[10px] font-medium px-[9px] py-[3px] rounded-[99px] font-mono bg-(--color-background-secondary) text-(--color-text-tertiary)">
              {lead.language.toUpperCase()}
            </span>
            <span className={`${chipCls(statusChipStyleCls(lead.status))} capitalize`}>{lead.status}</span>
            {lead.fit_verdict && (
              <span className={`${chipCls(verdictStyleCls(lead.fit_verdict))} capitalize`}>{lead.fit_verdict}</span>
            )}
          </div>
          <span className="text-[12px] text-(--color-text-secondary)">{lead.job_title}</span>
          {lead.source_url && (
            <a
              href={lead.source_url}
              target="_blank"
              rel="noreferrer"
              className={sourceLink}
            >
              {lead.source_url} ↗
            </a>
          )}
        </div>

        <div className="flex gap-1.5 shrink-0 items-center flex-wrap justify-end">
          <button onClick={handleDelete} className={pillBtnCls(false, confirmDelete)}>
            {confirmDelete ? "Confirm delete?" : "Delete"}
          </button>
          {lead.status === "approved" && lead.application_id ? (
            <button onClick={() => router.push(`/apply/${lead.application_id!}`)} className={pillBtnCls()}>
              View Application →
            </button>
          ) : lead.status === "rejected" ? (
            <span className="text-[12px] text-(--color-text-tertiary)">Rejected</span>
          ) : fit ? (
            <>
              <button onClick={reject} className={pillBtnCls()}>Reject</button>
              <button onClick={approve} disabled={approving} className={`${pillBtnCls(true)} ${approving ? "opacity-60" : ""}`}>
                {approving ? "Creating…" : "Approve & Create Application"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Content ── */}
      <div className={contentWrapper}>

        {fit ? (
          <>
            {/* Fit score card */}
            <SectionCard variant="labeled" title="Fit Analysis">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[30px] font-bold text-(--color-text-primary) font-mono leading-none">
                    {fit.match_score}
                  </span>
                  <span className="text-[12px] text-(--color-text-tertiary)">/100</span>
                  {fit.goal_alignment && (
                    <span
                      title={fit.goal_alignment_note ?? ""}
                      className={chipCls(goalAlignStyleCls(fit.goal_alignment))}
                    >
                      {fit.goal_alignment === "aligns" ? "→ aligns" : fit.goal_alignment === "detours" ? "← detours" : "⟳ neutral"}
                    </span>
                  )}
                  {lead.company_tone && (
                    <span className="inline-flex items-center text-[11px] font-medium px-[9px] py-[3px] rounded-[99px] font-shell bg-(--color-background-secondary) text-(--color-text-tertiary) capitalize ml-auto">
                      {lead.company_tone}
                    </span>
                  )}
                </div>

                {fit.core_theme && (
                  <p className="text-[13px] text-(--color-text-secondary) leading-[1.65]">{fit.core_theme}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={sectionLabelCls}>Strongest angle</div>
                    <p className={angleText}>{fit.strongest_angle}</p>
                  </div>
                  <div>
                    <div className={sectionLabelCls}>Watch out for</div>
                    <p className={angleText}>{fit.weakest_point}</p>
                  </div>
                </div>

                {lead.company_research && (
                  <p className="text-[11px] text-(--color-text-tertiary) border-t-[0.5px] border-(--color-border-tertiary) pt-2.5">
                    {lead.company_research}
                  </p>
                )}
              </div>
            </SectionCard>

            {(fit.must_haves ?? []).length > 0 && (
              <SectionCard variant="labeled" title="Must-haves">
                <div className="flex flex-wrap gap-1.5">
                  {(fit.must_haves ?? []).map((s) => (
                    <span key={s.skill} className={chipCls(skillStatusStyleCls(s.status))}>
                      {s.skill}{s.status === "GAP" ? " ✗" : s.status === "STRONG" ? " ✓" : ""}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {(fit.nice_to_haves ?? []).length > 0 && (
              <SectionCard variant="labeled" title="Nice-to-haves">
                <div className="flex flex-wrap gap-1.5">
                  {(fit.nice_to_haves ?? []).map((s) => (
                    <span key={s.skill} className={chipCls(skillStatusStyleCls(s.status))}>{s.skill}</span>
                  ))}
                </div>
              </SectionCard>
            )}

            {(fit.ats_keywords ?? []).length > 0 && (
              <SectionCard variant="labeled" title="ATS Keywords">
                <div className="flex flex-wrap gap-[5px]">
                  {(fit.ats_keywords ?? []).map((k) => (
                    <span key={k} className="inline-flex items-center text-[11px] font-medium px-[9px] py-[3px] rounded-[99px] font-mono bg-(--color-background-secondary) text-(--color-text-secondary)">
                      {k}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        ) : (
          <div className={emptyStateBox}>
            <p className={mutedParagraph}>
              Not analyzed yet. Tell Claude Code{" "}
              <code className={inlineCode}>
                &quot;process my captured jobs&quot;
              </code>
              {" "}
              <button
                onClick={async () => { await navigator.clipboard.writeText(PROCESS_PROMPT); toast.success("Copied — paste into Claude Code"); }}
                title="Copy prompt"
                className="bg-transparent border-none cursor-pointer text-(--color-text-tertiary) px-0.5 py-0 inline-flex items-center align-middle"
              >
                <Copy size={12} />
              </button>
              {" "}to get fit score, skill gaps, and company tone.
            </p>
            {lead.status === "analyzing" && (
              <p className="text-[11px] text-(--color-text-tertiary) font-mono mt-2">
                Analysis in progress…
              </p>
            )}
          </div>
        )}

        {lead.job_description && (
          <SectionCard variant="labeled" title="Job Description" action={<CopyButton text={lead.job_description} title="Copy JD" />}>
            <pre className="text-[12px] font-mono whitespace-pre-wrap text-(--color-text-secondary) leading-[1.65]">
              {lead.job_description}
            </pre>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

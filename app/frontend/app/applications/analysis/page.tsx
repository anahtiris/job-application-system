"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SectionCard, pillBtnCls, mutedTextCls, goalAlignStyleCls, chipCls } from "@/components/ui-kit";

interface SkillGap {
  skill: string;
  gap_count: number;
  out_of: number;
}

interface ToneBucket {
  tone: string;
  count: number;
}

interface AnalysisResult {
  generated_at: string | null;
  total: number;
  narrative: string | null;
  skill_gaps: SkillGap[];
  by_company_type: ToneBucket[];
  score_distribution: { avg: number; low: number; mid: number; high: number };
  goal_alignment: { aligns: number; neutral: number; detours: number };
  outcome_stage: { before_interview: number; after_interview: number; ghosted: number };
}

const CLAUDE_PROMPT =
  "Analyze rejection patterns. Fetch stats from GET /api/tracker/analysis/rejected, " +
  "follow the \"Rejection analysis — Claude path\" steps in CLAUDE.md, then save with PUT /api/tracker/analysis/rejected.";

export default function RejectionAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [insufficientData, setInsufficientData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/tracker/analysis/rejected");
      if (data.insufficient_data) {
        setInsufficientData(true);
        setResult(null);
      } else {
        setResult(data);
        setInsufficientData(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch; the loading/error flags inside load() are intentional
    load();
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await api.post("/api/tracker/analysis/rejected/generate", {});
      if (data.insufficient_data) {
        setInsufficientData(true);
        setResult(null);
      } else {
        setResult(data);
        setInsufficientData(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  const copyClaudePrompt = async () => {
    await navigator.clipboard.writeText(CLAUDE_PROMPT);
    toast.success("Copied");
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  };

  const hasNarrative = !!result?.narrative;

  return (
    <div className="flex flex-col overflow-hidden h-full bg-background-primary">
      {/* Topbar — matches /applications and /leads */}
      <div className="flex items-center py-2.5 px-4 border-b-[0.5px] border-border-tertiary gap-2 shrink-0">
        <Link href="/applications" className={mutedTextCls("12px") + " hover:text-text-primary"}>
          ← Applications
        </Link>
        <span className="text-[15px] font-medium mr-1.5 font-shell">Rejection Analysis</span>
        {result && (
          <span className="text-[12px] font-medium bg-background-secondary text-text-tertiary py-0.5 px-2 rounded-full font-mono">
            {result.total}
          </span>
        )}

        <div className="ml-auto flex gap-1.5 items-center">
          <button className={pillBtnCls()} onClick={copyClaudePrompt} disabled={generating}>
            {copying ? "Copied" : "Copy prompt for Claude"}
          </button>
          <button className={pillBtnCls(true)} onClick={generate} disabled={generating}>
            {generating ? "Generating…" : hasNarrative ? "Regenerate with Ollama" : "Generate with Ollama"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <p className={`${mutedTextCls("12px")} text-badge-passed-fg mb-4`}>{error}</p>}

        {loading && (
          <div className={`text-center py-12 ${mutedTextCls()}`}>Loading…</div>
        )}

        {!loading && insufficientData && (
          <div className={`text-center py-12 px-5 ${mutedTextCls()}`}>
            Not enough data yet — come back once you have a few rejections to analyze.
          </div>
        )}

        {!loading && !insufficientData && result && (
          <div className="flex flex-col gap-3 max-w-4xl">
            <SectionCard title="Narrative">
              {generating ? (
                <div className={`text-center py-5 ${mutedTextCls()}`}>Generating… (this may take a minute)</div>
              ) : hasNarrative ? (
                <p className="text-[13px] leading-[1.7] text-text-secondary font-shell whitespace-pre-wrap">
                  {result.narrative}
                </p>
              ) : (
                <p className={mutedTextCls("12px")}>
                  No narrative yet — generate with Ollama or paste the Claude prompt above.
                </p>
              )}
            </SectionCard>

            <div className="grid grid-cols-2 gap-3">
              <SectionCard title="Skill Gaps">
                {result.skill_gaps.length === 0 ? (
                  <p className={mutedTextCls("12px")}>No recurring gaps found</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {result.skill_gaps.map((g) => (
                      <li key={g.skill} className="flex justify-between text-[13px] font-shell">
                        <span>{g.skill}</span>
                        <span className="text-text-tertiary tabular-nums font-mono">
                          {g.gap_count}/{g.out_of}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="By Company Type">
                <ul className="flex flex-col gap-1.5">
                  {result.by_company_type.map((t) => (
                    <li key={t.tone} className="flex justify-between text-[13px] font-shell">
                      <span className="capitalize">{t.tone}</span>
                      <span className="text-text-tertiary tabular-nums font-mono">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Match Score">
                <p className="text-[28px] font-semibold tabular-nums font-mono mb-2">
                  {result.score_distribution.avg}
                  <span className={`${mutedTextCls("12px")} font-shell`}> avg</span>
                </p>
                <div className={`flex gap-4 tabular-nums ${mutedTextCls("12px")}`}>
                  <span>Low &lt;50: {result.score_distribution.low}</span>
                  <span>Mid: {result.score_distribution.mid}</span>
                  <span>High &gt;70: {result.score_distribution.high}</span>
                </div>
              </SectionCard>

              <SectionCard title="Goal Alignment">
                <div className="flex gap-2 flex-wrap">
                  <span className={chipCls(goalAlignStyleCls("aligns"))}>{result.goal_alignment.aligns} align</span>
                  <span className={chipCls(goalAlignStyleCls("neutral"))}>{result.goal_alignment.neutral} neutral</span>
                  <span className={chipCls(goalAlignStyleCls("detours"))}>{result.goal_alignment.detours} detour</span>
                </div>
              </SectionCard>

              <div className="col-span-2">
                <SectionCard title="Outcome Stage">
                  <div className={`flex gap-8 tabular-nums font-shell text-[13px]`}>
                    <div>
                      <span className="font-semibold">{result.outcome_stage.before_interview}</span>
                      <span className="text-text-tertiary ml-1">before interview</span>
                    </div>
                    <div>
                      <span className="font-semibold">{result.outcome_stage.after_interview}</span>
                      <span className="text-text-tertiary ml-1">after interview</span>
                    </div>
                    <div>
                      <span className="font-semibold">{result.outcome_stage.ghosted}</span>
                      <span className="text-text-tertiary ml-1">ghosted</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            {result.generated_at && (
              <p className={mutedTextCls("11px")}>
                Generated {new Date(result.generated_at).toLocaleString()} · {result.total} applications
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

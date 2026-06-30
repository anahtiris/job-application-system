"use client";

import { useState } from "react";
import Link from "next/link";

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
  generated_at: string;
  total: number;
  narrative: string;
  skill_gaps: SkillGap[];
  by_company_type: ToneBucket[];
  score_distribution: { avg: number; low: number; mid: number; high: number };
  goal_alignment: { aligns: number; neutral: number; detours: number };
  outcome_stage: { before_interview: number; after_interview: number; ghosted: number };
}

export default function RejectionAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [insufficientData, setInsufficientData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/tracker/analysis/rejected");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
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
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/leads" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Leads
        </Link>
        <h1 className="text-xl font-semibold">Rejection Analysis</h1>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="ml-auto px-4 py-2 bg-zinc-800 text-white text-sm rounded-lg disabled:opacity-50 hover:bg-zinc-700"
        >
          {loading ? "Generating…" : result ? "Regenerate" : "Generate Analysis"}
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {insufficientData && (
        <p className="text-zinc-500 text-sm">
          Not enough data yet — come back once you have a few rejections to analyze.
        </p>
      )}

      {result && (
        <div className="space-y-6">
          <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {result.narrative}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Skill gaps */}
            <div className="border border-zinc-200 rounded-lg p-4">
              <h2 className="text-sm font-medium mb-3 text-zinc-800">Skill Gaps</h2>
              {result.skill_gaps.length === 0 ? (
                <p className="text-sm text-zinc-400">No recurring gaps found</p>
              ) : (
                <ul className="space-y-1.5">
                  {result.skill_gaps.map((g) => (
                    <li key={g.skill} className="flex justify-between text-sm">
                      <span>{g.skill}</span>
                      <span className="text-zinc-500 tabular-nums">
                        {g.gap_count}/{g.out_of}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Company type */}
            <div className="border border-zinc-200 rounded-lg p-4">
              <h2 className="text-sm font-medium mb-3 text-zinc-800">By Company Type</h2>
              <ul className="space-y-1.5">
                {result.by_company_type.map((t) => (
                  <li key={t.tone} className="flex justify-between text-sm">
                    <span className="capitalize">{t.tone}</span>
                    <span className="text-zinc-500 tabular-nums">{t.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Match score */}
            <div className="border border-zinc-200 rounded-lg p-4">
              <h2 className="text-sm font-medium mb-3 text-zinc-800">Match Score</h2>
              <p className="text-3xl font-semibold tabular-nums mb-2">
                {result.score_distribution.avg}
                <span className="text-sm font-normal text-zinc-500"> avg</span>
              </p>
              <div className="flex gap-4 text-sm text-zinc-600 tabular-nums">
                <span>Low &lt;50: {result.score_distribution.low}</span>
                <span>Mid: {result.score_distribution.mid}</span>
                <span>High &gt;70: {result.score_distribution.high}</span>
              </div>
            </div>

            {/* Goal alignment */}
            <div className="border border-zinc-200 rounded-lg p-4">
              <h2 className="text-sm font-medium mb-3 text-zinc-800">Goal Alignment</h2>
              <div className="flex gap-5 text-sm tabular-nums">
                <div>
                  <span className="text-green-600 font-semibold">{result.goal_alignment.aligns}</span>
                  <span className="text-zinc-500 ml-1">align</span>
                </div>
                <div>
                  <span className="font-semibold">{result.goal_alignment.neutral}</span>
                  <span className="text-zinc-500 ml-1">neutral</span>
                </div>
                <div>
                  <span className="text-red-500 font-semibold">{result.goal_alignment.detours}</span>
                  <span className="text-zinc-500 ml-1">detour</span>
                </div>
              </div>
            </div>

            {/* Outcome stage */}
            <div className="border border-zinc-200 rounded-lg p-4 col-span-2">
              <h2 className="text-sm font-medium mb-3 text-zinc-800">Outcome Stage</h2>
              <div className="flex gap-8 text-sm tabular-nums">
                <div>
                  <span className="font-semibold">{result.outcome_stage.before_interview}</span>
                  <span className="text-zinc-500 ml-1">before interview</span>
                </div>
                <div>
                  <span className="font-semibold">{result.outcome_stage.after_interview}</span>
                  <span className="text-zinc-500 ml-1">after interview</span>
                </div>
                <div>
                  <span className="font-semibold">{result.outcome_stage.ghosted}</span>
                  <span className="text-zinc-500 ml-1">ghosted</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            Generated {new Date(result.generated_at).toLocaleString()} · {result.total} applications
          </p>
        </div>
      )}
    </div>
  );
}

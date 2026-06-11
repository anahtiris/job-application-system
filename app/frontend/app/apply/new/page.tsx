"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { ReviewPanel } from "@/components/ReviewPanel";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/ui-kit";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ["Job Details", "Analysis", "Generate", "Review", "Finalize"] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const TONES = ["direct", "startup", "contractor", "agency"] as const;

const SKILL_STYLE: Record<string, string> = {
  STRONG:  "bg-badge-interview-bg text-badge-interview-fg",
  HONEST:  "bg-amb-l text-amb-d",
  GAP:     "bg-badge-passed-bg text-badge-passed-fg",
  UNKNOWN: "bg-background-secondary text-text-tertiary",
};
const TIER_LABELS: Record<number, string> = { 1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure" };

// ─── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = "w-full text-[13px] py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none";

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-[5px]">
      <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell">
        {children}
      </span>
      {hint && (
        <span className="ml-1.5 text-[11px] font-normal normal-case text-text-tertiary font-shell">
          {hint}
        </span>
      )}
    </div>
  );
}

function Btn({ onClick, disabled, primary, children, className = "" }: {
  onClick?: () => void; disabled?: boolean; primary?: boolean;
  children: React.ReactNode; className?: string;
}) {
  const border = primary ? "border-none" : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-amb" : "bg-transparent";
  const color = primary ? "text-white" : "text-text-secondary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-[5px] text-[12px] font-medium py-1.5 px-3.5 rounded-full font-shell transition-opacity duration-100 ${border} ${bg} ${color} ${
        disabled ? "opacity-50 cursor-default" : "opacity-100 cursor-pointer"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="py-2.5 px-[13px] rounded-card border-[0.5px] border-badge-passed-fg bg-badge-passed-bg text-[12px] text-badge-passed-fg font-shell whitespace-pre-wrap">
      {msg}
    </div>
  );
}

function InfoText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-text-tertiary font-shell">{children}</p>
  );
}

// Word count indicator for cover letter
function ClWordCount({ text }: { text: string }) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const colorCls = count >= 250 && count <= 350
    ? "text-badge-interview-fg"
    : count >= 200 && count <= 400
    ? "text-amb"
    : "text-badge-passed-fg";
  const msg = count < 250 ? "(target 250–350)" : count > 350 ? "(over 250–350)" : "✓";
  return (
    <span className={`text-[11px] font-mono ${colorCls}`}>
      {count} words {msg}
    </span>
  );
}

// Step indicator in topbar
function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-[5px]">
              <span
                className={`w-[18px] h-[18px] rounded-full shrink-0 inline-flex items-center justify-center text-[10px] font-bold font-mono ${
                  active ? "bg-amb text-white" : done ? "bg-amb-l text-amb-d" : "bg-background-secondary text-text-tertiary"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-[11px] font-shell ${active ? "font-semibold text-text-primary" : "font-normal text-text-tertiary"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-[0.5px] bg-border-tertiary mx-1.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Analysis skill row
function SkillRow({ skill, status, tier, evidence }: { skill: string; status: string; tier?: number | null; evidence?: string }) {
  const s = SKILL_STYLE[status] ?? SKILL_STYLE.UNKNOWN;
  const tierLabel = tier ? ` ${TIER_LABELS[tier] ?? ""}` : "";
  return (
    <div className="grid grid-cols-[160px_110px_1fr] gap-2 items-baseline py-[5px] border-b-[0.5px] border-border-tertiary">
      <span className="text-[12px] font-medium font-shell text-text-primary">{skill}</span>
      <span className={`inline-flex items-center text-[10px] font-medium py-0.5 px-2 rounded-full font-shell ${s}`}>
        {status}{tierLabel}
      </span>
      <span className="text-[11px] text-text-tertiary font-shell">{evidence}</span>
    </div>
  );
}

// ─── Page logic ────────────────────────────────────────────────────────────────

function inferStep(app: Record<string, string>): Step {
  if (app.resume_pdf_path) return 4;
  if (app.review_completed) return 4;
  if (app.resume_draft_md) return 3;
  return 2;
}

function NewApplicationPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get("id");
  const regen = params.get("regen") === "1";

  const [step, setStep] = useState<Step>(0);
  const [appId, setAppId] = useState<string | null>(existingId);
  const [loading, setLoading] = useState(!!existingId);

  // Step 0
  const [company, setCompany] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [language, setLanguage] = useState<"en" | "de">("en");
  const [jd, setJd] = useState("");
  const [clNotes, setClNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Step 1
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Step 2
  const [resumeMd, setResumeMd] = useState("");
  const [clMd, setClMd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog] = useState("");
  const [genError, setGenError] = useState("");
  const [researchResult, setResearchResult] = useState<{ tone: string; address: string; tone_reasoning: string } | null>(null);
  const [researchingCompany, setResearchingCompany] = useState(false);
  const [toneOverride, setToneOverride] = useState("");
  const savedMdRef = useRef({ resume: "", cl: "" });

  // Step 3
  const [reviewResult, setReviewResult] = useState<Record<string, unknown> | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Step 4
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  useEffect(() => {
    if (!existingId) return;
    api.get(`/api/tracker/${existingId}`).then((app) => {
      setCompany(app.company);
      setJobTitle(app.job_title);
      setLanguage(app.language);
      setJd(app.job_description ?? "");
      setResumeMd(app.resume_final_md ?? app.resume_draft_md ?? "");
      setClMd(app.cover_letter_final_md ?? app.cover_letter_draft_md ?? "");
      setCompanyAddress(app.company_address ?? "");
      setClNotes(app.cover_letter_notes ?? "");
      setSourceUrl(app.source_url ?? "");
      setStep(regen ? 2 : inferStep(app));
      setLoading(false);
    });
  }, [existingId, regen]);

  useEffect(() => {
    if (step !== 1 || analysisResult || analyzing || !appId) return;
    setAnalyzing(true);
    setAnalyzeError("");
    api.post("/api/application/analyze-jd", { application_id: appId })
      .then((res) => {
        if (res?.detail) throw new Error(res.detail);
        if (res?.core_theme) setAnalysisResult(res);
        else throw new Error("Unexpected response format");
      })
      .catch((e: unknown) => setAnalyzeError((e as Error)?.message ?? "Analysis failed — check backend logs."))
      .finally(() => setAnalyzing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== 2 || researchResult || researchingCompany || !company) return;
    setResearchingCompany(true);
    api.post("/api/application/research", { company, company_url: companyUrl })
      .then((res) => {
        if (res?.tone) setResearchResult(res);
        if (res?.address) setCompanyAddress(res.address);
      })
      .catch(() => {})
      .finally(() => setResearchingCompany(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    const isDirty = () =>
      (step === 2 || step === 4) &&
      (resumeMd !== savedMdRef.current.resume || clMd !== savedMdRef.current.cl);
    const handler = (e: BeforeUnloadEvent) => { if (isDirty()) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, resumeMd, clMd]);

  if (loading) {
    return (
      <div className="p-10 text-[12px] text-text-tertiary font-shell">
        Loading…
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleJobDetails = async () => {
    setSubmitting(true); setSubmitError("");
    let id = appId;
    if (id) {
      const res = await api.patch(`/api/tracker/${id}/details`, { company, job_title: jobTitle, language, job_description: jd, cover_letter_notes: clNotes, source_url: sourceUrl });
      if (res?.detail) { setSubmitError(res.detail); setSubmitting(false); return; }
    } else {
      const app = await api.post("/api/tracker/", { company, job_title: jobTitle, language, job_description: jd, cover_letter_notes: clNotes, source_url: sourceUrl });
      if (!app?.id) { setSubmitError(app?.detail ?? "Failed to create application."); setSubmitting(false); return; }
      id = app.id; setAppId(id);
    }
    setSubmitting(false); setStep(1);
  };

  const runAnalysis = () => {
    if (!appId) return;
    setAnalyzing(true); setAnalyzeError(""); setAnalysisResult(null);
    api.post("/api/application/analyze-jd", { application_id: appId })
      .then((res) => {
        if (res?.detail) throw new Error(res.detail);
        if (res?.core_theme) setAnalysisResult(res);
        else throw new Error("Unexpected response format");
      })
      .catch((e: unknown) => setAnalyzeError((e as Error)?.message ?? "Analysis failed."))
      .finally(() => setAnalyzing(false));
  };

  const handleGenerate = async () => {
    if (!appId) return;
    setGenerating(true); setGenLog(""); setGenError("");
    const tone = toneOverride || researchResult?.tone || "direct";
    const address = researchResult?.address || companyAddress || "";
    const resp = await api.stream("/api/application/generate", { application_id: appId, job_description: jd, company, company_tone: tone, company_address: address, language });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      let detail = text;
      try { detail = JSON.parse(text).detail ?? text; } catch {}
      setGenError(`HTTP ${resp.status}: ${detail || "Generation failed."}`);
      setGenerating(false); return;
    }
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = ""; let latestResume = ""; let latestCl = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "resume_done") { latestResume = data.markdown; setResumeMd(data.markdown); }
          if (data.type === "cl_done") { latestCl = data.markdown; setClMd(data.markdown); }
          if (data.type?.endsWith("_chunk")) setGenLog((p) => p + data.text);
        } catch {}
      }
    }
    savedMdRef.current = { resume: latestResume, cl: latestCl };
    setGenerating(false); setStep(3);
  };

  const saveEdits = async () => {
    await api.put("/api/application/drafts", { application_id: appId, resume_md: resumeMd, cover_letter_md: clMd });
    savedMdRef.current = { resume: resumeMd, cl: clMd };
  };

  const handleReview = async () => {
    await saveEdits(); setReviewing(true); setReviewError("");
    const result = await api.post("/api/application/review", { application_id: appId });
    if (result?.detail || result?.error || !result?.reviewers) {
      setReviewError(result?.detail ?? result?.error ?? "Review failed."); setReviewing(false); return;
    }
    setReviewResult(result); setReviewing(false);
  };

  const applyRewrites = async (newResume: string, newCl: string) => {
    const merged = { resume_md: newResume || resumeMd, cover_letter_md: newCl || clMd };
    setResumeMd(merged.resume_md); setClMd(merged.cover_letter_md);
    await api.put("/api/application/finals", { application_id: appId, ...merged });
    setStep(4);
  };

  const handlePdf = async () => {
    setGeneratingPdf(true); setPdfError("");
    await api.put("/api/application/finals", { application_id: appId, resume_md: resumeMd, cover_letter_md: clMd, company_address: companyAddress });
    const res = await api.post("/api/application/pdf", { application_id: appId }).catch((e: unknown) => ({ error: (e as Error).message }));
    if (res?.detail || res?.error) { setPdfError(res.detail ?? res.error); setGeneratingPdf(false); return; }
    router.push(`/apply/${appId}`);
  };

  const activeResult = analysisResult as {
    core_theme?: string; match_score?: number; is_poor_match?: boolean;
    strongest_angle?: string; weakest_point?: string;
    must_haves?: { skill: string; status: string; tier?: number; evidence?: string }[];
    nice_to_haves?: { skill: string; status: string; tier?: number; evidence?: string }[];
    ats_keywords?: string[];
  } | null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background-primary">

      {/* Topbar */}
      <div className="flex items-center gap-4 py-2.5 px-5 shrink-0 border-b-[0.5px] border-border-tertiary flex-wrap">
        <span className="text-[13px] font-semibold font-shell text-text-primary shrink-0">
          {existingId ? `${company} — ${jobTitle}` : "New Application"}
        </span>
        <StepBar current={step} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-6 px-5">
        <div className="max-w-[680px] mx-auto flex flex-col gap-3.5">

          {/* ── Step 0: Job Details ── */}
          {step === 0 && (
            <>
              <SectionCard title="Job Details">
                <div className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Company</Label>
                      <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} />
                    </div>
                    <div>
                      <Label>Job title</Label>
                      <input className={inputCls} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Company website</Label>
                    <input className={inputCls} type="url" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://www.example.com" />
                  </div>
                  <div>
                    <Label hint="optional">Job posting URL</Label>
                    <input className={inputCls} type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://jobs.example.com/postings/123" />
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[11px] text-amb font-shell no-underline">
                        Open posting →
                      </a>
                    )}
                  </div>
                  <div>
                    <Label>Language</Label>
                    <div className="flex border-[0.5px] border-border-tertiary rounded-[6px] overflow-hidden w-fit">
                      {(["en", "de"] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setLanguage(l)}
                          className={`text-[11px] font-medium py-1 px-3 cursor-pointer font-mono border-none ${
                            language === l ? "bg-amb text-white" : "bg-transparent text-text-secondary"
                          }`}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Job description</Label>
                    <textarea className={`${inputCls} resize-y min-h-[180px]`} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description here…" />
                  </div>
                  <div>
                    <Label hint="optional">Cover letter notes</Label>
                    <textarea className={`${inputCls} resize-y min-h-[70px]`} value={clNotes} onChange={(e) => setClNotes(e.target.value)} placeholder="e.g. mention relocating to Munich, emphasise Python over React…" />
                    <InfoText>Points to incorporate. Must not contradict your resume.</InfoText>
                  </div>
                </div>
              </SectionCard>
              {submitError && <ErrorBanner msg={submitError} />}
              <div>
                <Btn primary onClick={handleJobDetails} disabled={!company || !jobTitle || !jd || submitting}>
                  {submitting ? "Saving…" : "Continue →"}
                </Btn>
              </div>
            </>
          )}

          {/* ── Step 1: Analysis ── */}
          {step === 1 && (
            <>
              {analyzing && (
                <SectionCard>
                  <p className="text-[12px] text-text-tertiary font-shell">Analysing job description…</p>
                </SectionCard>
              )}
              {analyzeError && <ErrorBanner msg={analyzeError} />}
              {activeResult && (
                <SectionCard title="Job Analysis">
                  <div className="flex flex-col gap-3">
                    {activeResult.core_theme && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[13px] font-medium font-shell">{activeResult.core_theme}</span>
                        {activeResult.match_score != null && (
                          <span className="text-[12px] font-mono text-text-tertiary">{activeResult.match_score as number}/10</span>
                        )}
                      </div>
                    )}
                    {activeResult.is_poor_match && (
                      <div className="py-2 px-3 rounded-[6px] bg-badge-passed-bg text-[12px] text-badge-passed-fg font-shell">
                        Many must-have skills are gaps — consider carefully.
                      </div>
                    )}
                    {(activeResult.must_haves?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell mb-1.5">Must-haves</div>
                        <div>{activeResult.must_haves!.map((item, i) => <SkillRow key={i} {...item} />)}</div>
                      </div>
                    )}
                    {(activeResult.nice_to_haves?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell mb-1.5">Nice-to-haves</div>
                        <div>{activeResult.nice_to_haves!.map((item, i) => <SkillRow key={i} {...item} />)}</div>
                      </div>
                    )}
                    {(activeResult.ats_keywords?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell mb-1.5">ATS keywords</div>
                        <div className="flex flex-wrap gap-[5px]">
                          {activeResult.ats_keywords!.map((kw) => (
                            <span key={kw} className="text-[11px] py-0.5 px-2 rounded-full bg-background-secondary text-text-secondary font-mono">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(activeResult.strongest_angle || activeResult.weakest_point) && (
                      <div className="flex flex-col gap-1.5">
                        {activeResult.strongest_angle && (
                          <div className="flex gap-2 items-start">
                            <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-badge-interview-bg text-badge-interview-fg font-shell">Lead with</span>
                            <span className="text-[12px] text-text-secondary font-shell">{activeResult.strongest_angle as string}</span>
                          </div>
                        )}
                        {activeResult.weakest_point && (
                          <div className="flex gap-2 items-start">
                            <span className="shrink-0 text-[10px] font-medium py-0.5 px-2 rounded-full bg-amb-l text-amb-d font-shell">Watch out</span>
                            <span className="text-[12px] text-text-secondary font-shell">{activeResult.weakest_point as string}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
              <div className="flex gap-2 flex-wrap">
                <Btn onClick={() => { setAnalysisResult(null); setAnalyzeError(""); setStep(0); }}>← Back</Btn>
                {!analyzing && (
                  <Btn onClick={runAnalysis}>{activeResult ? "Analyse again" : "Retry"}</Btn>
                )}
                <Btn primary onClick={() => setStep(2)} disabled={analyzing} className="ml-auto">
                  {analyzing ? "Analysing…" : "Continue →"}
                </Btn>
              </div>
            </>
          )}

          {/* ── Step 2: Generate ── */}
          {step === 2 && (
            <>
              {genError && <ErrorBanner msg={genError} />}
              {!generating && !resumeMd && (
                <SectionCard title="Generate">
                  <div className="flex flex-col gap-3">
                    {researchingCompany && (
                      <p className="text-[12px] text-text-tertiary font-shell">Researching {company}…</p>
                    )}
                    {researchResult && (
                      <div className="py-2.5 px-3 rounded-card border-[0.5px] border-border-tertiary bg-background-secondary flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-text-tertiary font-shell">Tone:</span>
                          <span className="text-[11px] font-medium py-0.5 px-2 rounded-full border-[0.5px] border-border-tertiary font-shell text-text-secondary">
                            {toneOverride || researchResult.tone}
                          </span>
                          <select
                            value={toneOverride || researchResult.tone}
                            onChange={(e) => setToneOverride(e.target.value)}
                            className="text-[11px] py-0.5 px-1.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-background-primary text-text-secondary font-shell cursor-pointer outline-none"
                          >
                            {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        {researchResult.address && (
                          <span className="text-[11px] text-text-tertiary font-shell">Address: {researchResult.address}</span>
                        )}
                        {researchResult.tone_reasoning && (
                          <span className="text-[11px] text-text-tertiary font-shell">{researchResult.tone_reasoning}</span>
                        )}
                      </div>
                    )}
                    <Btn primary onClick={handleGenerate} disabled={researchingCompany} className="w-full justify-center">
                      Generate Resume & Cover Letter
                    </Btn>
                  </div>
                </SectionCard>
              )}
              {generating && (
                <SectionCard title="Generating…">
                  <pre className="text-[12px] font-mono text-text-tertiary whitespace-pre-wrap max-h-[200px] overflow-auto m-0">
                    {genLog || "Starting…"}
                  </pre>
                </SectionCard>
              )}
              {resumeMd && !generating && (
                <>
                  <MarkdownEditor label="Tailored Resume" value={resumeMd} onChange={setResumeMd} />
                  <MarkdownEditor label="Cover Letter" value={clMd} onChange={setClMd} />
                  <ClWordCount text={clMd} />
                </>
              )}
              <div className="flex gap-2 flex-wrap">
                <Btn onClick={() => setStep(1)}>← Back</Btn>
                {resumeMd && !generating && <Btn onClick={handleGenerate}>Regenerate</Btn>}
                {resumeMd && !generating && (
                  <Btn primary onClick={() => setStep(3)} className="ml-auto">Continue →</Btn>
                )}
              </div>
            </>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <>
              {!reviewResult && (
                <SectionCard title="Review">
                  <div className="flex flex-col gap-2.5">
                    <InfoText>3 reviewers evaluate your documents: your personal persona + 2 randomly selected expert reviewers.</InfoText>
                    <div className="flex gap-2 flex-wrap">
                      <Btn onClick={() => setStep(2)}>← Back</Btn>
                      <Btn onClick={() => setStep(4)} disabled={reviewing}>Skip</Btn>
                      <Btn primary onClick={handleReview} disabled={reviewing} className="ml-auto">
                        {reviewing ? "Reviewing… (may take a few minutes)" : "Run Review"}
                      </Btn>
                    </div>
                    {reviewError && <ErrorBanner msg={reviewError} />}
                  </div>
                </SectionCard>
              )}
              {reviewResult && (
                <>
                  <div className="flex gap-2">
                    <Btn onClick={() => setStep(2)}>← Back</Btn>
                    <Btn onClick={() => { setReviewResult(null); handleReview(); }}>Re-review</Btn>
                  </div>
                  <ReviewPanel
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result={reviewResult as any}
                    resumeDraft={resumeMd}
                    clDraft={clMd}
                    onApply={applyRewrites}
                  />
                </>
              )}
            </>
          )}

          {/* ── Step 4: Finalize ── */}
          {step === 4 && (
            <>
              <SectionCard title="Company address">
                <div className="flex flex-col gap-1.5">
                  <textarea
                    className="w-full text-[13px] py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary outline-none resize-y min-h-[56px] font-mono"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder={"Street\nPostcode City"}
                  />
                  <InfoText>Used in the cover letter header. Auto-filled from research; edit if incorrect.</InfoText>
                </div>
              </SectionCard>
              <div className="grid grid-cols-2 gap-3">
                <MarkdownEditor label="Final Resume" value={resumeMd} onChange={setResumeMd} />
                <div className="flex flex-col gap-1.5">
                  <MarkdownEditor label="Final Cover Letter" value={clMd} onChange={setClMd} />
                  <ClWordCount text={clMd} />
                </div>
              </div>
              {pdfError && <ErrorBanner msg={pdfError} />}
              <div className="flex gap-2">
                <Btn onClick={() => setStep(3)}>← Back</Btn>
                <Btn primary onClick={handlePdf} disabled={generatingPdf} className="ml-auto">
                  {generatingPdf ? "Finalizing…" : "Finalize & Generate PDFs"}
                </Btn>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <Suspense>
      <NewApplicationPageInner />
    </Suspense>
  );
}

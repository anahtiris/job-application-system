"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { ReviewPanel } from "@/components/ReviewPanel";
import { api } from "@/lib/api";

const STEPS = ["Job Details", "Job Analysis", "Generate", "Review", "Finalize"];

function ClWordCount({ text }: { text: string }) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const color = count >= 250 && count <= 350
    ? "text-green-600"
    : count >= 200 && count <= 400
    ? "text-amber-500"
    : "text-destructive";
  return (
    <p className={`text-xs ${color}`}>
      Cover letter: {count} words {count < 250 ? "(target: 250–350)" : count > 350 ? "(over limit: 250–350)" : "✓"}
    </p>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${i <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i + 1}
            </div>
            <span className={`text-sm ${i === current ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-3" />}
        </div>
      ))}
    </div>
  );
}

function inferStep(app: any): number {
  if (app.resume_pdf_path) return 4;
  if (app.review_completed) return 4;
  if (app.resume_draft_md) return 3;
  return 2;
}

const STATUS_COLORS: Record<string, string> = {
  STRONG:  "bg-green-100 text-green-800 border-green-200",
  HONEST:  "bg-amber-100 text-amber-800 border-amber-200",
  GAP:     "bg-red-100 text-red-800 border-red-200",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};
const TIER_LABELS: Record<number, string> = { 1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure" };

function StatusBadge({ status, tier }: { status: string; tier?: number | null }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.UNKNOWN;
  const tierStr = tier ? ` — ${TIER_LABELS[tier] ?? ""}` : "";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${color}`}>
      {status}{tierStr}
    </span>
  );
}

export default function NewApplicationPage() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get("id");
  const regen = params.get("regen") === "1";

  const [step, setStep] = useState(0);
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

  // Step 1 (analysis)
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Step 2 (generate)
  const [resumeMd, setResumeMd] = useState("");
  const [clMd, setClMd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog] = useState("");
  const [genError, setGenError] = useState("");
  const [researchResult, setResearchResult] = useState<{tone: string; address: string; tone_reasoning: string} | null>(null);
  const [researchingCompany, setResearchingCompany] = useState(false);
  const [toneOverride, setToneOverride] = useState("");
  const savedMdRef = useRef({ resume: "", cl: "" });

  // Step 3 (review)
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Step 4 (PDF)
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // Load existing application if resuming
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
  }, [existingId]);

  // Auto-run analysis when entering step 1 (only once per visit)
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
      .catch((e: any) => setAnalyzeError(e?.message ?? "Analysis failed — check backend logs."))
      .finally(() => setAnalyzing(false));
  }, [step]);

  // Auto-run research when entering step 2 (only once per company)
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
  }, [step]);

  // Warn before leaving with unsaved edits (steps 2 and 4 only)
  useEffect(() => {
    const isDirty = () =>
      (step === 2 || step === 4) &&
      (resumeMd !== savedMdRef.current.resume || clMd !== savedMdRef.current.cl);

    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, resumeMd, clMd]);

  if (loading) return <p className="p-10 text-muted-foreground">Loading application…</p>;

  // ── Step 0: create application ────────────────────────────────────────────
  const handleJobDetails = async () => {
    setSubmitting(true);
    setSubmitError("");
    let id = appId;
    if (id) {
      const res = await api.patch(`/api/tracker/${id}/details`, {
        company, job_title: jobTitle, language, job_description: jd, cover_letter_notes: clNotes, source_url: sourceUrl,
      });
      if (res?.detail) {
        setSubmitError(res.detail);
        setSubmitting(false);
        return;
      }
    } else {
      const app = await api.post("/api/tracker/", {
        company, job_title: jobTitle, language, job_description: jd, cover_letter_notes: clNotes, source_url: sourceUrl,
      });
      if (!app?.id) {
        setSubmitError(app?.detail ?? "Failed to create application — check backend logs.");
        setSubmitting(false);
        return;
      }
      id = app.id;
      setAppId(id);
    }

    setSubmitting(false);
    setStep(1);
  };

  // ── Step 1: re-run analysis ───────────────────────────────────────────────
  const runAnalysis = () => {
    if (!appId) return;
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalysisResult(null);
    api.post("/api/application/analyze-jd", { application_id: appId })
      .then((res) => {
        if (res?.detail) throw new Error(res.detail);
        if (res?.core_theme) setAnalysisResult(res);
        else throw new Error("Unexpected response format");
      })
      .catch((e: any) => setAnalyzeError(e?.message ?? "Analysis failed — check backend logs."))
      .finally(() => setAnalyzing(false));
  };

  // ── Step 2: generate ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!appId) return;
    setGenerating(true);
    setGenLog("");
    setGenError("");

    const tone = toneOverride || researchResult?.tone || "direct";
    const address = researchResult?.address || companyAddress || "";

    const resp = await api.stream("/api/application/generate", {
      application_id: appId,
      job_description: jd,
      company,
      company_tone: tone,
      company_address: address,
      language,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      let detail = text;
      try { detail = JSON.parse(text).detail ?? text; } catch {}
      setGenError(`HTTP ${resp.status}: ${detail || "Generation failed — check backend logs."}`);
      setGenerating(false);
      return;
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let latestResume = "";
    let latestCl = "";
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
    setGenerating(false);
    setStep(3);
  };

  const saveEdits = async () => {
    await api.put("/api/application/drafts", {
      application_id: appId, resume_md: resumeMd, cover_letter_md: clMd,
    });
    savedMdRef.current = { resume: resumeMd, cl: clMd };
  };

  // ── Step 3: review ────────────────────────────────────────────────────────
  const handleReview = async () => {
    await saveEdits();
    setReviewing(true);
    setReviewError("");
    const result = await api.post("/api/application/review", { application_id: appId });
    if (result?.detail || result?.error || !result?.reviewers) {
      setReviewError(result?.detail ?? result?.error ?? "Review failed — check backend logs.");
      setReviewing(false);
      return;
    }
    setReviewResult(result);
    setReviewing(false);
  };

  const applyRewrites = async (newResume: string, newCl: string) => {
    const merged = { resume_md: newResume || resumeMd, cover_letter_md: newCl || clMd };
    setResumeMd(merged.resume_md);
    setClMd(merged.cover_letter_md);
    await api.put("/api/application/finals", { application_id: appId, ...merged });
    setStep(4);
  };

  // ── Step 4: PDF ───────────────────────────────────────────────────────────
  const handlePdf = async () => {
    setGeneratingPdf(true);
    setPdfError("");
    await api.put("/api/application/finals", {
      application_id: appId,
      resume_md: resumeMd,
      cover_letter_md: clMd,
      company_address: companyAddress,
    });
    const res = await api.post("/api/application/pdf", { application_id: appId }).catch((e: any) => ({ error: e.message }));
    if (res?.detail || res?.error) {
      setPdfError(res.detail ?? res.error);
      setGeneratingPdf(false);
      return;
    }
    router.push(`/apply/${appId}`);
  };

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">
        {existingId ? `${jobTitle} — ${company}` : "New Application"}
      </h1>
      <StepIndicator current={step} />

      {/* Step 0: Job Details */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="company" className="text-sm font-medium">Company</label>
                <input id="company" className="w-full border rounded p-2 text-sm" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="job-title" className="text-sm font-medium">Job Title</label>
                <input id="job-title" className="w-full border rounded p-2 text-sm" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="company-url" className="text-sm font-medium">Company Website</label>
              <input
                id="company-url"
                className="w-full border rounded p-2 text-sm"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://www.example.com"
                type="url"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source-url" className="text-sm font-medium">Job Posting URL <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                id="source-url"
                className="w-full border rounded p-2 text-sm"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://jobs.example.com/postings/123"
                type="url"
              />
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-block mt-0.5">
                  Open posting →
                </a>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Language</label>
              <div className="flex gap-2">
                {(["en", "de"] as const).map((l) => (
                  <Button key={l} size="sm" variant={language === l ? "default" : "outline"} onClick={() => setLanguage(l)}>
                    {l.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="job-description" className="text-sm font-medium">Job Description</label>
              <textarea id="job-description" className="w-full border rounded p-2 text-sm min-h-[200px]" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description here…" />
            </div>
            <div className="space-y-1">
              <label htmlFor="cl-notes" className="text-sm font-medium">Cover Letter Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                id="cl-notes"
                className="w-full border rounded p-2 text-sm min-h-[80px]"
                value={clNotes}
                onChange={(e) => setClNotes(e.target.value)}
                placeholder="e.g. mention I'm relocating to Munich, emphasise Python over React, don't reference the gap year…"
              />
              <p className="text-xs text-muted-foreground">Points to incorporate in the cover letter. Must not contradict your resume.</p>
            </div>
            <Button onClick={handleJobDetails} disabled={!company || !jobTitle || !jd || submitting}>
              {submitting ? "Saving…" : "Continue"}
            </Button>
            {submitError && (
              <p className="text-sm text-destructive border border-destructive rounded p-3 whitespace-pre-wrap">{submitError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Job Analysis */}
      {step === 1 && (
        <div className="space-y-4">
          {analyzing && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Analysing job description…</p>
              </CardContent>
            </Card>
          )}
          {analyzeError && (
            <p className="text-sm text-destructive border border-destructive rounded p-3">{analyzeError}</p>
          )}
          {analysisResult && (
            <Card>
              <CardHeader><CardTitle>Job Analysis</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm"><span className="font-medium">Role: </span>{analysisResult.core_theme}</p>

                {analysisResult.must_haves?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Must-have Skills</p>
                    <table className="w-full text-sm">
                      <tbody>
                        {analysisResult.must_haves.map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="py-1.5 pr-4 font-medium w-40">{item.skill}</td>
                            <td className="py-1.5 pr-4 w-48">
                              <StatusBadge status={item.status} tier={item.tier} />
                            </td>
                            <td className="py-1.5 text-muted-foreground text-xs">{item.evidence || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {analysisResult.nice_to_haves?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Nice-to-have Skills</p>
                    <table className="w-full text-sm">
                      <tbody>
                        {analysisResult.nice_to_haves.map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="py-1.5 pr-4 font-medium w-40">{item.skill}</td>
                            <td className="py-1.5 pr-4 w-48">
                              <StatusBadge status={item.status} tier={item.tier} />
                            </td>
                            <td className="py-1.5 text-muted-foreground text-xs">{item.evidence || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {analysisResult.ats_keywords?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1.5">ATS Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.ats_keywords.map((kw: string) => (
                        <span key={kw} className="px-2 py-0.5 rounded bg-muted text-xs font-mono">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 text-sm">
                  <p><span className="font-medium">Match score: </span>{analysisResult.match_score}/10</p>
                  <p><span className="font-medium text-green-700">Strongest angle: </span>{analysisResult.strongest_angle}</p>
                  <p><span className="font-medium text-amber-600">Watch out: </span>{analysisResult.weakest_point}</p>
                </div>

                {analysisResult.is_poor_match && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                    Many must-have skills are gaps — consider carefully whether to proceed.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => { setAnalysisResult(null); setAnalyzeError(""); setStep(0); }}>← Back</Button>
            {!analyzing && (
              <Button variant="outline" onClick={runAnalysis}>
                {analysisResult ? "Analyse again" : "Retry"}
              </Button>
            )}
            <Button onClick={() => setStep(2)} disabled={analyzing} className="flex-1">
              {analyzing ? "Analysing…" : "Continue to Generate →"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Generate */}
      {step === 2 && (
        <div className="space-y-4">
          {genError && (
            <p className="text-sm text-destructive border border-destructive rounded p-3 whitespace-pre-wrap">{genError}</p>
          )}
          {!generating && !resumeMd && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {researchingCompany && (
                  <p className="text-sm text-muted-foreground">Researching {company}…</p>
                )}
                {researchResult && (
                  <div className="rounded-md border p-3 space-y-2 text-sm bg-muted/30">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-muted-foreground">Tone detected:</span>
                      <Badge variant="outline">{toneOverride || researchResult.tone}</Badge>
                      <Select value={toneOverride || researchResult.tone} onValueChange={setToneOverride}>
                        <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["direct", "startup", "contractor", "agency"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Address: {researchResult.address || <span className="italic">not found</span>}
                    </p>
                    {researchResult.tone_reasoning && (
                      <p className="text-xs text-muted-foreground">{researchResult.tone_reasoning}</p>
                    )}
                  </div>
                )}
                <Button onClick={handleGenerate} className="w-full" disabled={researchingCompany}>
                  Generate Resume & Cover Letter
                </Button>
              </CardContent>
            </Card>
          )}
          {generating && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                  {genLog || "Generating…"}
                </p>
              </CardContent>
            </Card>
          )}
          {resumeMd && !generating && (
            <>
              <MarkdownEditor label="Tailored Resume" value={resumeMd} onChange={setResumeMd} />
              <MarkdownEditor label="Cover Letter" value={clMd} onChange={setClMd} />
              <ClWordCount text={clMd} />
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                <Button variant="outline" onClick={handleGenerate}>Regenerate</Button>
                <Button onClick={() => setStep(3)} className="flex-1">Continue to Review</Button>
              </div>
            </>
          )}
          {!generating && !resumeMd && (
            <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          {!reviewResult && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  3 reviewers evaluate your documents: your personal persona + 2 randomly selected expert reviewers.
                </p>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
                  <Button onClick={handleReview} disabled={reviewing} className="flex-1">
                    {reviewing ? "Reviewing… (may take a few minutes)" : "Run Review"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep(4)} disabled={reviewing}>Skip</Button>
                </div>
                {reviewError && (
                  <p className="text-sm text-destructive border border-destructive rounded p-3">{reviewError}</p>
                )}
              </CardContent>
            </Card>
          )}
          {reviewResult && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</Button>
                <Button variant="outline" size="sm" onClick={() => { setReviewResult(null); handleReview(); }}>
                  Re-review
                </Button>
              </div>
              <ReviewPanel
                result={reviewResult}
                resumeDraft={resumeMd}
                clDraft={clMd}
                onApply={applyRewrites}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 4: Finalize */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Finalize</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="company-address" className="text-sm font-medium">Company Address</label>
              <textarea
                id="company-address"
                className="w-full border rounded p-2 text-sm min-h-[64px] font-mono"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Street\nPostcode City"
              />
              <p className="text-xs text-muted-foreground">Used in the cover letter header. Auto-filled from research; edit if incorrect.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MarkdownEditor label="Final Resume" value={resumeMd} onChange={setResumeMd} />
              <div className="space-y-1">
                <MarkdownEditor label="Final Cover Letter" value={clMd} onChange={setClMd} />
                <ClWordCount text={clMd} />
              </div>
            </div>
            {pdfError && (
              <p className="text-sm text-destructive border border-destructive rounded p-3">{pdfError}</p>
            )}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>
              <Button onClick={handlePdf} disabled={generatingPdf} className="flex-1">
                {generatingPdf ? "Finalizing…" : "Finalize & Generate PDFs"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { ReviewResult } from "@/components/ReviewPanel";

export const STEPS = ["Job Details", "Analysis", "Generate", "Review", "Finalize"] as const;
export type Step = 0 | 1 | 2 | 3 | 4;

export interface AnalysisActiveResult {
  core_theme?: string;
  match_score?: number;
  is_poor_match?: boolean;
  strongest_angle?: string;
  weakest_point?: string;
  must_haves?: { skill: string; status: string; tier?: number; evidence?: string }[];
  nice_to_haves?: { skill: string; status: string; tier?: number; evidence?: string }[];
  ats_keywords?: string[];
}

function inferStep(app: Record<string, string>): Step {
  if (app.resume_pdf_path) return 4;
  if (app.review_completed) return 4;
  if (app.resume_draft_md) return 3;
  return 2;
}

export type WizardState = ReturnType<typeof useApplicationWizard>;

export function useApplicationWizard() {
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
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Step 4
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const finalsBaselineRef = useRef<{ resume: string; cl: string; address: string } | null>(null);
  const hadExistingPdfRef = useRef(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

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
      hadExistingPdfRef.current = !!app.resume_pdf_path;
      setStep(regen ? 2 : inferStep(app));
      setLoading(false);
    });
  }, [existingId, regen]);

  useEffect(() => {
    if (step !== 1 || analysisResult || analyzing || !appId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs an async fetch on step entry; the loading flag is intentional
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs an async fetch on step entry; the loading flag is intentional
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

  // Step 4 — autosave resume/cover letter/company address edits
  useEffect(() => {
    if (step !== 4) {
      finalsBaselineRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets autosave status when leaving the finalize step
      setAutoSaveStatus("idle");
      return;
    }
    if (!finalsBaselineRef.current) {
      finalsBaselineRef.current = { resume: resumeMd, cl: clMd, address: companyAddress };
      return;
    }
    const baseline = finalsBaselineRef.current;
    if (resumeMd === baseline.resume && clMd === baseline.cl && companyAddress === baseline.address) {
      return;
    }
    setAutoSaveStatus("saving");
    const timer = setTimeout(async () => {
      await api.put("/api/application/finals", {
        application_id: appId,
        resume_md: resumeMd,
        cover_letter_md: clMd,
        company_address: companyAddress,
      });
      finalsBaselineRef.current = { resume: resumeMd, cl: clMd, address: companyAddress };
      setAutoSaveStatus("saved");
    }, 1500);
    return () => clearTimeout(timer);
  }, [step, resumeMd, clMd, companyAddress, appId]);

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

  const doGeneratePdf = async () => {
    setGeneratingPdf(true); setPdfError("");
    await api.put("/api/application/finals", { application_id: appId, resume_md: resumeMd, cover_letter_md: clMd, company_address: companyAddress });
    const res = await api.post("/api/application/pdf", { application_id: appId }).catch((e: unknown) => ({ error: (e as Error).message }));
    if (res?.detail || res?.error) { setPdfError(res.detail ?? res.error); setGeneratingPdf(false); return; }
    router.push(`/apply/${appId}`);
  };

  const handlePdf = () => {
    if (hadExistingPdfRef.current) { setShowOverwriteConfirm(true); return; }
    doGeneratePdf();
  };

  const confirmOverwrite = () => {
    setShowOverwriteConfirm(false);
    doGeneratePdf();
  };

  const activeResult = analysisResult as AnalysisActiveResult | null;

  return {
    existingId, step, setStep, loading,
    // Step 0
    company, setCompany, companyUrl, setCompanyUrl, sourceUrl, setSourceUrl,
    jobTitle, setJobTitle, language, setLanguage, jd, setJd, clNotes, setClNotes,
    submitting, submitError, handleJobDetails,
    // Step 1
    analyzing, analyzeError, activeResult, runAnalysis, setAnalysisResult, setAnalyzeError,
    // Step 2
    resumeMd, setResumeMd, clMd, setClMd, generating, genLog, genError,
    researchResult, researchingCompany, toneOverride, setToneOverride, handleGenerate,
    // Step 3
    reviewResult, setReviewResult, reviewing, reviewError, handleReview, applyRewrites,
    // Step 4
    companyAddress, setCompanyAddress, generatingPdf, pdfError, autoSaveStatus,
    showOverwriteConfirm, setShowOverwriteConfirm, handlePdf, confirmOverwrite,
  };
}

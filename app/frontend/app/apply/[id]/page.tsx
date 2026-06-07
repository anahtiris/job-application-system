"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { api, BASE } from "@/lib/api";

// ── Interview prep display ────────────────────────────────────────────────────

function InterviewQuestions({ sectionMd }: { sectionMd: string }) {
  const lines = sectionMd
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2));

  const [checked, setChecked] = useState<boolean[]>(() => lines.map(() => false));

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <ul className="space-y-2 mt-2">
      {lines.map((q, i) => (
        <li key={i}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked[i] ?? false}
              onChange={() => toggle(i)}
              className="mt-1 shrink-0 h-4 w-4 accent-primary"
            />
            <span className={`text-sm leading-snug ${checked[i] ? "line-through text-muted-foreground" : ""}`}>{q}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function InterviewPrepDisplay({ markdown }: { markdown: string }) {
  const raw = markdown.startsWith("## ") ? markdown : markdown.replace(/^[^#]*(?=## )/, "");
  const sections = raw.split(/(?=^## )/m).filter(Boolean);

  return (
    <div className="space-y-6 mt-3">
      {sections.map((sec) => {
        const firstNewline = sec.indexOf("\n");
        const header = firstNewline === -1 ? sec : sec.slice(0, firstNewline);
        const body = firstNewline === -1 ? "" : sec.slice(firstNewline + 1).trim();
        const title = header.replace(/^#+\s*/, "");

        return (
          <div key={title} className="border rounded-lg p-4 bg-muted/20">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">{title}</h3>
            {title === "Questions to Ask" ? (
              <InterviewQuestions sectionMd={body} />
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{body}</ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Parameter controls ────────────────────────────────────────────────────────

const ROUNDS = ["Screening", "Technical", "Final"];
const INTERVIEWERS = ["HR / Recruiter", "Hiring Manager", "Technical Peer"];

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors
            ${value === o
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:border-foreground/40"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Interview prep state
  const [interviewPrep, setInterviewPrep] = useState("");
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [showPrepControls, setShowPrepControls] = useState(false);
  const [prepRound, setPrepRound] = useState("Technical");
  const [prepInterviewer, setPrepInterviewer] = useState("Hiring Manager");
  const [prepFocus, setPrepFocus] = useState("");

  // Skills debrief state
  const [interviewDebrief, setInterviewDebrief] = useState("");
  const [generatingDebrief, setGeneratingDebrief] = useState(false);

  const copyJdForClaude = async () => {
    if (!app?.job_description) return;
    const header = `I'm preparing my application for ${app.job_title || "this role"} at ${app.company || "this company"}.${app.cover_letter_notes ? `\n\nNotes on what to emphasise:\n${app.cover_letter_notes}` : ""}\n\nHere's the job description:\n\n`;
    await navigator.clipboard.writeText(header + app.job_description);
    toast.success("Copied — paste into Claude");
  };

  useEffect(() => {
    api.get(`/api/tracker/${id}`).then((a) => {
      setApp(a);
      setNotes(a.notes ?? "");
      setInterviewPrep(a.interview_prep_md ?? "");
      setInterviewDebrief(a.interview_debrief_md ?? "");
    });
  }, [id]);

  const saveNotes = async () => {
    setSaving(true);
    await api.patch(`/api/tracker/${id}/notes`, { notes });
    setSaving(false);
    toast.success("Notes saved.");
  };

  const handleGeneratePrep = async () => {
    setGeneratingPrep(true);
    setShowPrepControls(false);
    const result = await api
      .post("/api/application/interview-prep", {
        application_id: id,
        interview_round: prepRound,
        interviewer_type: prepInterviewer,
        focus_skills: prepFocus,
      })
      .catch(() => null);
    if (!result?.markdown) {
      toast.error("Interview prep generation failed — check backend logs.");
    } else {
      setInterviewPrep(result.markdown);
    }
    setGeneratingPrep(false);
  };

  const handleGenerateDebrief = async () => {
    setGeneratingDebrief(true);
    const result = await api
      .post("/api/application/interview-debrief", { application_id: id })
      .catch(() => null);
    if (!result?.markdown) {
      toast.error("Skills debrief generation failed — check backend logs.");
    } else {
      setInterviewDebrief(result.markdown);
    }
    setGeneratingDebrief(false);
  };

  if (!app) return <p className="p-10 text-muted-foreground">Loading…</p>;

  const isIncomplete = !app.resume_pdf_path;
  const isInterview = app.status === "Interview";

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Dashboard</Link>
        <div className="flex items-start justify-between mt-1 gap-4">
          <h1 className="text-2xl font-bold">{app.company} — {app.job_title}</h1>
          <Link href={`/apply/new?id=${id}&regen=1`} className="shrink-0">
            <Button size="sm" variant="outline">Regenerate</Button>
          </Link>
        </div>
        {isIncomplete && (
          <div className="mt-3">
            <Link href={`/apply/new?id=${id}`}>
              <Button size="sm">Continue</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Downloads */}
      {(app.resume_pdf_path || app.cover_letter_pdf_path) && (
        <div className="flex flex-wrap gap-3">
          {app.resume_pdf_path && (
            <a href={`${BASE}/files/${app.resume_pdf_path.split("/applications/")[1]}`} target="_blank" rel="noreferrer">
              <Button variant="outline">Resume (PDF)</Button>
            </a>
          )}
          {app.resume_docx_path && (
            <a href={`${BASE}/files/${app.resume_docx_path.split("/applications/")[1]}`} download>
              <Button variant="outline">Resume (DOCX)</Button>
            </a>
          )}
          {app.cover_letter_pdf_path && (
            <a href={`${BASE}/files/${app.cover_letter_pdf_path.split("/applications/")[1]}`} target="_blank" rel="noreferrer">
              <Button variant="outline">Cover Letter (PDF)</Button>
            </a>
          )}
          {app.cover_letter_docx_path && (
            <a href={`${BASE}/files/${app.cover_letter_docx_path.split("/applications/")[1]}`} download>
              <Button variant="outline">Cover Letter (DOCX)</Button>
            </a>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="jd">
        <TabsList className="w-full">
          <TabsTrigger value="jd" className="flex-1">Job Description</TabsTrigger>
          <TabsTrigger value="resume" className="flex-1" disabled={!app.resume_final_md}>Resume</TabsTrigger>
          <TabsTrigger value="cl" className="flex-1" disabled={!app.cover_letter_final_md}>Cover Letter</TabsTrigger>
          <TabsTrigger value="prep" className="flex-1" disabled={!isInterview}>Interview Prep</TabsTrigger>
        </TabsList>

        <TabsContent value="jd">
          <div className="flex justify-end mt-3 mb-2">
            <Button variant="outline" size="sm" onClick={copyJdForClaude} disabled={!app.job_description}>
              Copy for Claude
            </Button>
          </div>
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed border rounded-lg p-4 bg-muted/20">{app.job_description}</pre>
        </TabsContent>

        <TabsContent value="resume">
          <div className="border rounded-lg p-4 prose prose-sm max-w-none bg-muted/20 mt-3">
            <ReactMarkdown>{app.resume_final_md}</ReactMarkdown>
          </div>
        </TabsContent>

        <TabsContent value="cl">
          <div className="border rounded-lg p-4 prose prose-sm max-w-none bg-muted/20 mt-3">
            <ReactMarkdown>{app.cover_letter_final_md}</ReactMarkdown>
          </div>
        </TabsContent>

        <TabsContent value="prep">
          <div className="mt-3 space-y-8">
            {/* General interview prep */}
            <div>
              {generatingPrep ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Generating interview prep… (this may take a minute)</p>
              ) : interviewPrep && !showPrepControls ? (
                <>
                  <div className="flex justify-end mb-2">
                    <Button size="sm" variant="outline" onClick={() => setShowPrepControls(true)}>Regenerate</Button>
                  </div>
                  <InterviewPrepDisplay markdown={interviewPrep} />
                </>
              ) : (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Interview Round</p>
                    <ToggleGroup options={ROUNDS} value={prepRound} onChange={setPrepRound} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Interviewer</p>
                    <ToggleGroup options={INTERVIEWERS} value={prepInterviewer} onChange={setPrepInterviewer} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Focus Skills <span className="normal-case font-normal">(optional)</span></p>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm bg-background"
                      value={prepFocus}
                      onChange={(e) => setPrepFocus(e.target.value)}
                      placeholder="e.g. Python, system design, Kubernetes"
                    />
                  </div>
                  <div className="flex gap-2">
                    {showPrepControls && (
                      <Button variant="ghost" size="sm" onClick={() => setShowPrepControls(false)}>Cancel</Button>
                    )}
                    <Button onClick={handleGeneratePrep} className="flex-1">
                      {interviewPrep ? "Regenerate Interview Prep" : "Generate Interview Prep"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Skills debrief */}
            <div>
              <hr className="mb-6" />
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold">Skills Debrief</h3>
                {interviewDebrief && !generatingDebrief && (
                  <Button size="sm" variant="outline" onClick={handleGenerateDebrief}>Regenerate</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Tier-aware coaching for every skill you claimed — STAR prompts for your strongest skills, honest answer templates for weaker ones, and flags for any overclaims.
              </p>
              {generatingDebrief ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Generating skills debrief… (this may take a minute)</p>
              ) : interviewDebrief ? (
                <InterviewPrepDisplay markdown={interviewDebrief} />
              ) : (
                <Button onClick={handleGenerateDebrief} className="w-full">
                  Generate Skills Debrief
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Notes</h2>
        <textarea
          className="w-full border rounded-lg p-3 text-sm min-h-[120px] bg-background"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Follow-up dates, recruiter contact, interview notes…"
        />
        <Button className="mt-2" onClick={saveNotes} disabled={saving}>
          {saving ? "Saving…" : "Save Notes"}
        </Button>
      </section>
    </main>
  );
}

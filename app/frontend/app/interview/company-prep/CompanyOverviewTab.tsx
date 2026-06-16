"use client";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  SectionCard, cardBoxCls, sectionLabelCls, iconBtnCls, mutedTextCls, GrowTextarea,
} from "@/components/ui-kit";
import { type Interview, type InterviewPrep } from "../types";
import { PrepQAList } from "../shared";

// ─── Prep generation constants ─────────────────────────────────────────────────

const PREP_ROUNDS = ["Screening", "Technical", "Final"] as const;
const PREP_INTERVIEWERS = ["HR / Recruiter", "Hiring Manager", "Technical Peer"] as const;

const pillBtnCls = (primary = false): string => {
  const border = primary ? "border-none" : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-custom" : "bg-transparent";
  const color = primary ? "text-white" : "text-text-secondary";
  return `inline-flex items-center gap-[5px] text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell ${border} ${bg} ${color}`;
};

// ─── Overview tab ───────────────────────────────────────────────────────────────

export function CompanyOverviewTab({
  app,
  prep,
  updatePrep,
  hasPrep,
  generatingPrep,
  showPrepOptions,
  setShowPrepOptions,
  round,
  setRound,
  interviewer,
  setInterviewer,
  focus,
  setFocus,
  copying,
  copyClaudePrompt,
  generatePrep,
}: {
  app: Interview;
  prep: InterviewPrep;
  updatePrep: (patch: Partial<InterviewPrep>) => void;
  hasPrep: boolean;
  generatingPrep: boolean;
  showPrepOptions: boolean;
  setShowPrepOptions: (v: boolean) => void;
  round: string;
  setRound: (v: string) => void;
  interviewer: string;
  setInterviewer: (v: string) => void;
  focus: string;
  setFocus: (v: string) => void;
  copying: boolean;
  copyClaudePrompt: () => void;
  generatePrep: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">

      {/* Role at a Glance — JD */}
      {app.job_description && (
        <RoleGlanceCard company={app.company} jobTitle={app.job_title} jd={app.job_description} />
      )}

      {/* Generate / regenerate controls */}
      {!showPrepOptions && !generatingPrep && (
        <div className="flex gap-1.5 justify-end">
          {hasPrep && <button className={pillBtnCls()} onClick={copyClaudePrompt}>{copying ? "Copied" : "Copy prompt"}</button>}
          <button className={pillBtnCls(!hasPrep)} onClick={() => setShowPrepOptions(true)}>
            {hasPrep ? "Regenerate" : "Generate prep"}
          </button>
        </div>
      )}
      {showPrepOptions && (
        <SectionCard title="Generate prep">
          <div className="flex flex-col gap-3">
            <div>
              <div className={sectionLabelCls}>Round</div>
              <div className="flex gap-1 flex-wrap">
                {PREP_ROUNDS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRound(r)}
                    className={`text-[11px] font-medium py-1 px-2.5 rounded-[6px] cursor-pointer font-shell ${
                      round === r ? "border-none bg-custom text-white" : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={sectionLabelCls}>Interviewer</div>
              <div className="flex gap-1 flex-wrap">
                {PREP_INTERVIEWERS.map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setInterviewer(iv)}
                    className={`text-[11px] font-medium py-1 px-2.5 rounded-[6px] cursor-pointer font-shell ${
                      interviewer === iv ? "border-none bg-custom text-white" : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={sectionLabelCls}>Focus skills <span className="normal-case font-normal">(optional)</span></div>
              <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Python, system design, Kubernetes" className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none" />
            </div>
            <div className="flex gap-1.5 items-center flex-wrap">
              {hasPrep && <button className={pillBtnCls()} onClick={() => setShowPrepOptions(false)}>Cancel</button>}
              <button className={pillBtnCls()} onClick={copyClaudePrompt}>{copying ? "Copied" : "Copy prompt for Claude"}</button>
              <button className={`${pillBtnCls(true)} flex-1 justify-center`} onClick={generatePrep}>
                {hasPrep ? "Regenerate with Ollama" : "Generate with Ollama"}
              </button>
            </div>
            <span className={mutedTextCls("11px")}>
              <strong>Claude</strong> web-researches the company; <strong>Ollama</strong> runs offline from the JD.
            </span>
          </div>
        </SectionCard>
      )}

      {generatingPrep && (
        <div className={`text-center py-5 ${mutedTextCls()}`}>
          Generating… (this may take a minute)
        </div>
      )}

      {!generatingPrep && hasPrep && (
        <>
          <SectionCard title="Introduction Script">
            <GrowTextarea
              value={prep.introduction_script}
              onChange={(v) => updatePrep({ introduction_script: v })}
              placeholder="60-90 second intro…"
              className="leading-[1.75]"
            />
          </SectionCard>

          <SectionCard title="Common Questions">
            <PrepQAList
              items={prep.common_questions}
              onChange={(items) => updatePrep({ common_questions: items })}
              aPlaceholder="Sample answer…"
            />
          </SectionCard>

          <SectionCard title="Job-Specific Questions">
            <PrepQAList
              items={prep.job_specific_questions}
              onChange={(items) => updatePrep({ job_specific_questions: items })}
              aPlaceholder="Talking-point bullets…"
            />
          </SectionCard>
        </>
      )}

      {!generatingPrep && !hasPrep && !showPrepOptions && (
        <div className={`text-center py-12 px-5 ${mutedTextCls()}`}>
          No prep yet — generate one above.
        </div>
      )}
    </div>
  );
}

// ─── Role at a Glance ───────────────────────────────────────────────────────────

function RoleGlanceCard({ company, jobTitle, jd }: { company: string; jobTitle: string; jd: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(`${company} - ${jobTitle}\n\n${jd}`);
    toast.success("Copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`${cardBoxCls} bg-background-primary`}>
      <div
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center justify-between py-[9px] px-[13px] cursor-pointer select-none ${
          expanded ? "border-b-[0.5px] border-border-tertiary" : ""
        }`}
      >
        <span className="text-[12px] font-medium font-shell">Role at a Glance</span>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopy}
            title="Copy company, job title and description"
            className={`${iconBtnCls} hover:text-text-primary ${copied ? "text-text-primary" : ""}`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <span className="text-[10px] text-text-tertiary">{expanded ? "▲ collapse" : "▼ expand"}</span>
        </div>
      </div>
      {expanded && (
        <div className="py-2.5 px-[13px] text-[13px] leading-[1.7] text-text-secondary font-shell max-h-[320px] overflow-y-auto">
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong className="text-text-primary font-semibold">{children}</strong>,
              li: ({ children }) => <li className="mb-[3px]">{children}</li>,
              p: ({ children }) => <p className="mb-1.5">{children}</p>,
              h1: ({ children }) => <div className="text-[12px] font-semibold text-text-primary mt-2.5 mb-1 font-shell">{children}</div>,
              h2: ({ children }) => <div className="text-[12px] font-semibold text-text-primary mt-2.5 mb-1 font-shell">{children}</div>,
              h3: ({ children }) => <div className="text-[11px] font-semibold text-text-secondary mt-2 mb-[3px] font-shell">{children}</div>,
            }}
          >
            {jd}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

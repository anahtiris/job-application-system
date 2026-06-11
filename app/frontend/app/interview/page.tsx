"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { mutedTextCls, monoMutedCls, sectionLabelCls } from "@/components/ui-kit";
import type { Interview } from "./types";
import { formatDate } from "./helpers";
import { GeneralPrepPanel } from "./GeneralPrepPanel";
import { TechnicalQuestionsPanel } from "./TechnicalQuestionsPanel";
import { CompanyPrepPanel } from "./CompanyPrepPanel";

// ─── Page ──────────────────────────────────────────────────────────────────────

function InterviewCard({
  app,
  active,
  onSelect,
  past = false,
}: {
  app: Interview;
  active: boolean;
  onSelect: (id: string) => void;
  past?: boolean;
}) {
  const { label, isToday } = formatDate(app.interview_date);
  return (
    <button
      onClick={() => onSelect(app.id)}
      className={`block w-full text-left py-[9px] px-2.5 rounded-[7px] border-[0.5px] cursor-pointer mb-1.5 font-shell transition-colors ${
        active
          ? "border-amb bg-amb-l"
          : "border-border-tertiary bg-background-primary hover:border-[#FAC775]"
      } ${past && !active ? "opacity-60" : ""}`}
    >
      <div className={`text-[12px] font-medium ${active ? "text-amb-d" : "text-text-primary"}`}>
        {app.company}
      </div>
      <div className="text-[11px] text-text-tertiary mt-px">
        {app.job_title}
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        {isToday && (
          <span className="text-[9px] font-medium py-0.5 px-1.5 rounded-full bg-badge-interview-bg text-badge-interview-fg">
            Today
          </span>
        )}
        <span className={monoMutedCls("10px")}>
          {label}
        </span>
      </div>
    </button>
  );
}

export default function InterviewPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selected, setSelected] = useState<"general" | string>("general");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const loadInterviews = useCallback(() => {
    api.get("/api/tracker/").then((data) => {
      const all = data as Interview[];
      setInterviews(all.filter((a) => a.status === "Interview"));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadInterviews(); }, [loadInterviews]);

  const handleDateChange = (id: string, iso: string | null) => {
    setInterviews((prev) => prev.map((a) => (a.id === id ? { ...a, interview_date: iso } : a)));
  };

  const selectedApp = interviews.find((a) => a.id === selected) ?? null;

  const now = new Date();
  const upcomingInterviews = interviews
    .filter((a) => !a.interview_date || new Date(a.interview_date) >= now)
    .sort((a, b) => {
      if (!a.interview_date) return 1;
      if (!b.interview_date) return -1;
      return new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime();
    });
  const pastInterviews = interviews
    .filter((a) => !!a.interview_date && new Date(a.interview_date) < now)
    .sort((a, b) => new Date(b.interview_date!).getTime() - new Date(a.interview_date!).getTime());

  const leftPanelContent = panelCollapsed ? (
    <button
      onClick={() => setPanelCollapsed(false)}
      title="Expand panel"
      className="w-9 flex-1 flex items-start justify-center pt-3.5 bg-transparent border-none cursor-pointer text-text-tertiary text-[11px]"
    >
      ›
    </button>
  ) : (
    <>
      <div className="pt-2.5 px-3 pb-1.5 border-b-[0.5px] border-border-tertiary flex items-center gap-1.5">
        <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell flex-1">
          General
        </div>
        <button
          onClick={() => setPanelCollapsed(true)}
          title="Collapse panel"
          className="bg-transparent border-none cursor-pointer text-text-tertiary text-[14px] leading-none px-0.5 shrink-0"
        >
          ‹
        </button>
      </div>
      <div className="py-1.5 px-3">
        <button
          onClick={() => setSelected("general")}
          className={`flex items-center gap-2 w-full py-[7px] px-2 rounded-[6px] cursor-pointer text-[12px] font-medium font-shell border-none text-left transition-colors ${
            selected === "general"
              ? "bg-amb-l text-amb-d"
              : "bg-transparent text-text-secondary hover:bg-background-secondary"
          }`}
        >
          General prep
        </button>
      </div>
      <div className="px-3 pb-1.5">
        <button
          onClick={() => setSelected("technical")}
          className={`flex items-center gap-2 w-full py-[7px] px-2 rounded-[6px] cursor-pointer text-[12px] font-medium font-shell border-none text-left transition-colors ${
            selected === "technical"
              ? "bg-amb-l text-amb-d"
              : "bg-transparent text-text-secondary hover:bg-background-secondary"
          }`}
        >
          Technical questions
        </button>
      </div>
      <div className="h-[0.5px] bg-border-tertiary" />

      <div className="flex-1 overflow-auto py-2.5 px-3 min-h-0">
        <div className={sectionLabelCls}>
          Scheduled
        </div>
        {upcomingInterviews.length === 0 && pastInterviews.length === 0 && (
          <p className={mutedTextCls("11px")}>
            No interviews yet
          </p>
        )}
        {upcomingInterviews.length === 0 && pastInterviews.length > 0 && (
          <p className={mutedTextCls("11px")}>
            None upcoming
          </p>
        )}
        {upcomingInterviews.map((app) => (
          <InterviewCard key={app.id} app={app} active={selected === app.id} onSelect={setSelected} />
        ))}

        {pastInterviews.length > 0 && (
          <>
            <div className={`${sectionLabelCls} mt-3.5`}>
              Interviewed
            </div>
            {pastInterviews.map((app) => (
              <InterviewCard key={app.id} app={app} active={selected === app.id} onSelect={setSelected} past />
            ))}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-46px)] overflow-hidden">
      {/* ── Left panel ── */}
      <div
        className={`${
          panelCollapsed ? "w-9" : "w-[200px]"
        } shrink-0 border-r-[0.5px] border-border-tertiary bg-background-primary flex flex-col overflow-hidden transition-[width] duration-[180ms] ease-[ease]`}
      >
        {leftPanelContent}
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
        {selected === "general" ? (
          <GeneralPrepPanel />
        ) : selected === "technical" ? (
          <TechnicalQuestionsPanel />
        ) : selectedApp ? (
          <CompanyPrepPanel app={selectedApp} isDark={isDark} onDateChange={handleDateChange} />
        ) : null}
      </div>
    </div>
  );
}

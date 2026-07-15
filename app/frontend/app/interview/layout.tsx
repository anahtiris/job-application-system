"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useIsDark } from "@/hooks/useIsDark";
import { mutedTextCls, monoMutedCls, sectionLabelCls } from "@/components/ui-kit";
import type { Interview } from "./types";
import { formatDate } from "./helpers";
import { InterviewListProvider } from "./InterviewListContext";
import { useInterviews } from "./useInterviews";

// ─── Interview list card ─────────────────────────────────────────────────────────

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
          ? "border-custom bg-custom-l"
          : "border-border-tertiary bg-background-primary hover:border-custom-hover"
      } ${past && !active ? "opacity-60" : ""}`}
    >
      <div className={`text-[12px] font-medium ${active ? "text-custom-d" : "text-text-primary"}`}>
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

// ─── Layout ────────────────────────────────────────────────────────────────────

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDark = useIsDark();
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const {
    interviews,
    loaded,
    upcoming: upcomingInterviews,
    past: pastInterviews,
    onDateChange,
    onPrepChange,
    onNotesChange,
  } = useInterviews();

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
          onClick={() => router.push("/interview")}
          className={`flex items-center gap-2 w-full py-[7px] px-2 rounded-[6px] cursor-pointer text-[12px] font-medium font-shell border-none text-left transition-colors ${
            pathname === "/interview"
              ? "bg-custom-l text-custom-d"
              : "bg-transparent text-text-secondary hover:bg-background-secondary"
          }`}
        >
          General prep
        </button>
      </div>
      <div className="px-3 pb-1.5">
        <button
          onClick={() => router.push("/interview/technical")}
          className={`flex items-center gap-2 w-full py-[7px] px-2 rounded-[6px] cursor-pointer text-[12px] font-medium font-shell border-none text-left transition-colors ${
            pathname === "/interview/technical"
              ? "bg-custom-l text-custom-d"
              : "bg-transparent text-text-secondary hover:bg-background-secondary"
          }`}
        >
          Technical questions
        </button>
      </div>
      <div className="px-3 pb-1.5">
        <button
          onClick={() => router.push("/interview/leetcode")}
          className={`flex items-center gap-2 w-full py-[7px] px-2 rounded-[6px] cursor-pointer text-[12px] font-medium font-shell border-none text-left transition-colors ${
            pathname === "/interview/leetcode"
              ? "bg-custom-l text-custom-d"
              : "bg-transparent text-text-secondary hover:bg-background-secondary"
          }`}
        >
          LeetCode
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
          <InterviewCard
            key={app.id}
            app={app}
            active={pathname === `/interview/${app.id}`}
            onSelect={(id) => router.push(`/interview/${id}`)}
          />
        ))}

        {pastInterviews.length > 0 && (
          <>
            <div className={`${sectionLabelCls} mt-3.5`}>
              Interviewed
            </div>
            {pastInterviews.map((app) => (
              <InterviewCard
                key={app.id}
                app={app}
                active={pathname === `/interview/${app.id}`}
                onSelect={(id) => router.push(`/interview/${id}`)}
                past
              />
            ))}
          </>
        )}
      </div>
    </>
  );

  return (
    <InterviewListProvider
      value={{ interviews, loaded, isDark, onDateChange, onPrepChange, onNotesChange }}
    >
      <div className="flex h-full overflow-hidden">
        {/* ── Left panel ── */}
        <div
          className={`${
            panelCollapsed ? "w-9" : "w-[200px]"
          } shrink-0 border-r-[0.5px] border-border-tertiary bg-background-primary flex flex-col overflow-hidden transition-[width] duration-[180ms] ease-[ease]`}
        >
          {leftPanelContent}
        </div>

        {/* ── Right content (route segment) ── */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </InterviewListProvider>
  );
}

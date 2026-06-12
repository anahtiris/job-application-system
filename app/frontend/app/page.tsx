"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Send, Calendar } from "lucide-react";
import { api } from "@/lib/api";

interface Application {
  id: string;
  company: string;
  job_title: string;
  status: string;
  date_applied: string | null;
  interview_date: string | null;
  language: string;
}

interface Lead {
  id: string;
  status: string;
}

const PENDING_LEAD_STATUSES = new Set(["captured", "new", "analyzing", "analyzed"]);

function shortDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(d + "T00:00:00")
  );
}

function shortInterviewDate(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

export default function Dashboard() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [capturedCount, setCapturedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/api/tracker/"), api.get("/api/leads/")])
      .then(([appData, leadData]) => {
        setApps(appData as Application[]);
        setCapturedCount(
          (leadData as Lead[]).filter((l) => PENDING_LEAD_STATUSES.has(l.status)).length
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const todoApps = apps.filter((a) => a.status === "New" || a.status === "Draft");
  const appliedApps = apps.filter((a) => a.status === "Applied");
  const interviewApps = apps.filter((a) => a.status === "Interview");

  // Same ordering as /interview: upcoming (soonest first, undated last), then past (most recent first)
  const now = new Date();
  const upcomingInterviewApps = interviewApps
    .filter((a) => !a.interview_date || new Date(a.interview_date) >= now)
    .sort((a, b) => {
      if (!a.interview_date) return 1;
      if (!b.interview_date) return -1;
      return new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime();
    });
  const pastInterviewApps = interviewApps
    .filter((a) => !!a.interview_date && new Date(a.interview_date) < now)
    .sort((a, b) => new Date(b.interview_date!).getTime() - new Date(a.interview_date!).getTime());
  const sortedInterviewApps = [...upcomingInterviewApps, ...pastInterviewApps];

  const stats = [
    {
      icon: <Inbox size={15} />,
      value: capturedCount,
      label: "Captured jobs",
      iconCls: "bg-custom-l text-custom",
    },
    {
      icon: <Send size={15} />,
      value: appliedApps.length,
      label: "Awaiting response",
      iconCls: "bg-background-secondary text-text-secondary",
    },
    {
      icon: <Calendar size={15} />,
      value: interviewApps.length,
      label: "Interviews",
      iconCls: "bg-[#E1F5EE] text-[#1D9E75]",
    },
  ];

  const columns = [
    { label: "Todo", dot: "bg-text-tertiary", apps: todoApps },
    { label: "Applied", dot: "bg-custom", apps: appliedApps },
    { label: "Interview", dot: "bg-[#1D9E75]", apps: sortedInterviewApps },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-text-tertiary">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 gap-3.5 h-full box-border overflow-hidden">
      {/* Stat row */}
      <div className="flex gap-2.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex-1 bg-background-primary border-[0.5px] border-border-tertiary rounded-card py-3 px-3.5 flex items-center gap-2.5"
          >
            <div className={`w-[30px] h-[30px] rounded-[6px] flex items-center justify-center shrink-0 ${stat.iconCls}`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-[28px] font-bold tracking-[-0.04em] font-mono leading-none">
                {stat.value}
              </div>
              <div className="text-[11px] text-text-tertiary mt-px">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-3 gap-2.5 flex-1 min-h-0">
        {columns.map((col) => (
          <div
            key={col.label}
            className="flex flex-col bg-background-primary border-[0.5px] border-border-tertiary rounded-card overflow-hidden"
          >
            {/* Column header */}
            <div className="py-[9px] px-[11px] border-b-[0.5px] border-border-tertiary flex items-center justify-between shrink-0">
              <div className="flex items-center gap-[7px]">
                <span
                  aria-hidden
                  className={`w-1.5 h-1.5 rounded-full shrink-0 inline-block ${col.dot}`}
                />
                <span className="text-[11px] font-medium tracking-[0.05em] uppercase text-text-tertiary">
                  {col.label}
                </span>
              </div>
              <span className="text-[10px] font-medium bg-background-secondary text-text-tertiary py-px px-1.5 rounded-full font-mono">
                {col.apps.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 flex flex-col gap-1.5 overflow-y-auto flex-1">
              {col.apps.length === 0 ? (
                <p className="text-[11px] text-text-tertiary text-center py-4">
                  —
                </p>
              ) : (
                col.apps.map((app) => (
                  <button
                    key={app.id}
                    className="kanban-card"
                    onClick={() => router.push(`/apply/${app.id}`)}
                  >
                    {app.status === "Interview" && (
                      <span className="text-[9px] font-medium py-0.5 px-[5px] rounded-[4px] mb-[5px] inline-block bg-[#E1F5EE] text-[#0F6E56]">
                        Interview
                      </span>
                    )}
                    {app.status === "Draft" && (
                      <span className="text-[9px] font-medium py-0.5 px-[5px] rounded-[4px] mb-[5px] inline-block bg-background-secondary text-text-tertiary">
                        Draft
                      </span>
                    )}
                    <div className="text-[12px] font-medium mb-0.5">
                      {app.company}
                    </div>
                    <div className="text-[11px] text-text-tertiary leading-[1.4] mb-1.5">
                      {app.job_title}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-tertiary font-mono">
                        {app.status === "Interview" ? shortInterviewDate(app.interview_date) : shortDate(app.date_applied)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

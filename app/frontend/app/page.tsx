"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApplicationTable } from "@/components/ApplicationTable";
import { api } from "@/lib/api";
import { STATUS_ORDER, STATUS_CLASSES } from "@/lib/status";

export default function Dashboard() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("dashboard.statusFilter");
  });

  const setFilter = (s: string | null) => {
    setStatusFilter(s);
    if (s) localStorage.setItem("dashboard.statusFilter", s);
    else localStorage.removeItem("dashboard.statusFilter");
  };

  // Auto-clear saved filter if it no longer matches any app
  useEffect(() => {
    if (statusFilter && !(apps as any[]).some((a) => a.status === statusFilter)) {
      setFilter(null);
    }
  }, [apps]);

  const load = () => {
    setLoading(true);
    api.get("/api/tracker/").then((data) => { setApps(data); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    if (!apps.length) return;
    const headers = ["Company", "Role", "Language", "Status", "Date Applied"];
    const rows = apps.map((a: any) =>
      [a.company, a.job_title, a.language.toUpperCase(), a.status, a.date_applied]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (apps as any[]).filter((a) => a.status === s).length;
    return acc;
  }, {});
  const visibleApps = statusFilter ? (apps as any[]).filter((a) => a.status === statusFilter) : apps;

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-muted-foreground text-sm">Track and manage your job applications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!apps.length}>Export CSV</Button>
          <Link href="/apply/new"><Button>+ New Application</Button></Link>
        </div>
      </div>
      {!loading && apps.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${!statusFilter
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 text-muted-foreground border-transparent hover:border-border"}`}
          >
            All ({(apps as any[]).length})
          </button>
          {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(statusFilter === s ? null : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${statusFilter === s
                  ? STATUS_CLASSES[s]
                  : "bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-muted/40 h-12 rounded-md" />
          ))}
        </div>
      ) : (
        <ApplicationTable applications={visibleApps} onRefresh={load} />
      )}
    </main>
  );
}

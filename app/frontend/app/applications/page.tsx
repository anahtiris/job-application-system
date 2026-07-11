"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Search, Download, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { FlipClock } from "@anahtiris/flipclock";
import "@anahtiris/flipclock/dist/flipclock.css";
import { api } from "@/lib/api";
import { useIsDark } from "@/hooks/useIsDark";
import { isoToDateValue, dateValueToISO, shortDate } from "@/lib/utils";
import { StatusBadge, useClickOutside, appLabelStyleCls } from "@/components/ui-kit";
import { STATUS_DISPLAY } from "@/lib/status";

const APPS_CLAUDE_PROMPT = "generate CVs and cover letters for all new applications in a batch";

interface Application {
  id: string;
  company: string;
  job_title: string;
  status: string;
  date_applied: string | null;
  created_at: string;
  language: string;
}

// Which backend statuses each filter option covers
const FILTER_MAP: Record<string, string[]> = {
  Analyzed: ["New"],
  Draft: ["Draft"],
  Finalized: ["Finalized"],
  Applied: ["Applied"],
  Interview: ["Interview"],
  Offer: ["Offer"],
  Rejected: ["Rejected", "Rejected after interview"],
  Ghosted: ["Ghosted", "Ghosted after interview"],
};

const FILTER_LABELS = ["Analyzed", "Draft", "Finalized", "Applied", "Interview", "Offer", "Rejected", "Ghosted"] as const;

// Backend statuses where the company chip is amber (active)
const ACTIVE_STATUSES = new Set(["Applied", "Interview", "Offer"]);

// Shared column grid for both header and rows
const COL_GRID_CLS = "grid-cols-[2fr_2fr_130px_90px_66px]";

type FilterLabel = (typeof FILTER_LABELS)[number];

// List sort order: Finalized → Draft → Analyzed (New) → Applied, then the rest.
// Within a status, most recent first (date_applied, falling back to created_at).
const STATUS_RANK: Record<string, number> = {
  Finalized: 0,
  Draft: 1,
  New: 2,
  Applied: 3,
  Interview: 4,
  Offer: 5,
  Rejected: 6,
  Ghosted: 7,
};

function companyChip(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return "??";
  const first = words[0];
  if (first.length <= 4 && first === first.toUpperCase() && /^[A-Z0-9]+$/.test(first)) {
    return first.slice(0, 3);
  }
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Multiselect dropdown for filtering by status
function FilterDropdown({
  activeFilters,
  onToggle,
  onClear,
}: {
  activeFilters: Set<FilterLabel>;
  onToggle: (label: FilterLabel) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = activeFilters.size;
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-[12px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell border-[0.5px] border-border-tertiary ${
          count > 0 ? "bg-background-secondary text-text-primary" : "bg-transparent text-text-secondary"
        }`}
      >
        Status{count > 0 ? ` (${count})` : ""}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 z-30 bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-1.5 min-w-[150px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex flex-col gap-0.5">
          {FILTER_LABELS.map((label) => (
            <label
              key={label}
              className="flex items-center gap-2 text-[12px] font-shell py-1 px-2 rounded-[5px] cursor-pointer hover:bg-background-secondary"
            >
              <input
                type="checkbox"
                checked={activeFilters.has(label)}
                onChange={() => onToggle(label)}
                className="cursor-pointer accent-custom"
              />
              <span className={`inline-flex items-center text-[11px] font-medium py-0.5 px-2 rounded-full font-shell ${appLabelStyleCls(label)}`}>
                {label}
              </span>
            </label>
          ))}
          {count > 0 && (
            <button
              onClick={onClear}
              className="text-left text-[11px] text-text-tertiary font-shell py-1 px-2 mt-0.5 border-t-[0.5px] border-border-tertiary border-x-0 border-b-0 bg-transparent cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // Pending "Applied" date confirmation
  const [pendingApply, setPendingApply] = useState<{ id: string; date: string } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [copyingApps, setCopyingApps] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // Dark mode detection (for FlipClock theme)
  const isDark = useIsDark();

  // Filter state — empty set means "All"; persisted in localStorage
  const [activeFilters, setActiveFilters] = useState<Set<FilterLabel>>(new Set());

  // Load saved filters after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("applications.filters");
      if (stored) {
        const parsed: FilterLabel[] = JSON.parse(stored);
        const valid = parsed.filter((l) => (FILTER_LABELS as readonly string[]).includes(l));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only hydration from localStorage (cannot run during SSR)
        if (valid.length) setActiveFilters(new Set(valid));
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem("applications.filters", JSON.stringify([...activeFilters]));
  }, [activeFilters]);

  const toggleFilter = (label: FilterLabel) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const clearFilters = () => setActiveFilters(new Set());

  const exportCsv = () => {
    const headers = ["Company", "Job Title", "Status", "Date Applied", "Language"];
    const rows = apps.map((a) => [
      a.company,
      a.job_title,
      STATUS_DISPLAY[a.status] ?? a.status,
      a.date_applied ?? "",
      a.language,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAppsPrompt = async () => {
    setCopyingApps(true);
    await navigator.clipboard.writeText(appsPrompt);
    toast.success("Copied");
    setCopyingApps(false);
  };

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/api/tracker/")
      .then((data) => setApps(data as Application[]))
      .finally(() => setLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch; the loading flag inside load() is intentional
  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (newStatus === "Applied") {
      const app = apps.find((a) => a.id === id);
      setPendingApply({
        id,
        date: app?.date_applied ?? new Date().toISOString().slice(0, 10),
      });
      return;
    }
    try {
      await api.patch(`/api/tracker/${id}/status`, { status: newStatus });
      toast.success("Status updated");
      load();
    } catch {
      toast.error("Status update failed");
    }
  };

  const confirmApply = async () => {
    if (!pendingApply) return;
    try {
      await api.patch(`/api/tracker/${pendingApply.id}/status`, { status: "Applied" });
      await api.patch(`/api/tracker/${pendingApply.id}/date`, { date_applied: pendingApply.date });
      toast.success("Status updated");
    } catch {
      toast.error("Update failed");
    }
    setPendingApply(null);
    load();
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      await api.delete(`/api/tracker/${id}`);
      load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const newApps = apps.filter((a) => a.status === "New");
  const appsPrompt = `${APPS_CLAUDE_PROMPT}${newApps.length > 4 ? " of 3-4" : ""}`;

  const q = search.trim().toLowerCase();
  const visible = apps.filter((a) => {
    if (activeFilters.size > 0) {
      const matchesFilter = [...activeFilters].some((label) =>
        (FILTER_MAP[label] ?? []).includes(a.status)
      );
      if (!matchesFilter) return false;
    }
    if (q) {
      return (
        a.company.toLowerCase().includes(q) ||
        a.job_title.toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 99;
    const rb = STATUS_RANK[b.status] ?? 99;
    if (ra !== rb) return ra - rb;
    const da = a.date_applied ?? a.created_at ?? "";
    const db = b.date_applied ?? b.created_at ?? "";
    return db.localeCompare(da);
  });

  const colHeader = (label: string) => (
    <span className="flex items-center text-[11px] font-medium tracking-[0.06em] uppercase text-text-tertiary py-[9px] font-shell">
      {label}
    </span>
  );

  return (
    <div className="flex flex-col overflow-hidden h-full bg-background-primary">
      {/* Applied-date confirmation banner */}
      {pendingApply && (
        <div className="flex items-center gap-2.5 py-2 px-4 border-b-[0.5px] border-border-tertiary text-[12px] bg-background-secondary shrink-0 font-shell">
          <span className="text-text-tertiary">Date applied:</span>
          <FlipClock
            mode="date" theme={isDark ? "dark" : "light"} size="xs"
            defaultValue={isoToDateValue(pendingApply.date)}
            onChange={(v) => setPendingApply({ ...pendingApply, date: dateValueToISO(v) })}
          />
          <button
            onClick={confirmApply}
            className="text-[12px] font-medium py-1 px-2.5 rounded-[6px] bg-custom text-white border-none cursor-pointer font-shell"
          >
            Confirm
          </button>
          <button
            onClick={() => setPendingApply(null)}
            className="text-[12px] font-medium py-1 px-2.5 rounded-[6px] bg-transparent text-text-secondary border-[0.5px] border-border-tertiary cursor-pointer font-shell"
          >
            Cancel
          </button>
        </div>
      )}

      {/* List topbar */}
      <div className="flex items-center py-2.5 px-4 border-b-[0.5px] border-border-tertiary gap-2 shrink-0">
        <span className="text-[15px] font-medium mr-1.5 font-shell">
          Applications
        </span>
        <span className="text-[12px] font-medium bg-background-secondary text-text-tertiary py-0.5 px-2 rounded-full font-mono">
          {visible.length}
        </span>

        {/* Search */}
        <div className="relative ml-2">
          <Search
            size={13}
            className="absolute left-[9px] top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="text-[12px] py-1 pr-2.5 pl-7 rounded-full border-[0.5px] border-border-tertiary bg-background-secondary text-text-primary font-shell outline-none w-[180px]"
          />
        </div>

        {/* Export CSV */}
        <button
          onClick={exportCsv}
          disabled={apps.length === 0}
          title="Export all applications as CSV"
          className={`inline-flex items-center gap-1 text-[12px] font-medium py-1 px-2.5 rounded-full font-shell border-[0.5px] border-border-tertiary bg-transparent text-text-secondary ${
            apps.length === 0 ? "opacity-40 cursor-default" : "opacity-100 cursor-pointer"
          }`}
        >
          <Download size={12} />
          CSV
        </button>

        {/* Status filter — multiselect dropdown */}
        <div className="ml-auto flex gap-[5px] items-center">
          <Link
            href="/applications/analysis"
            className="text-[12px] font-medium py-1 px-2.5 rounded-full border-[0.5px] border-border-tertiary text-text-secondary hover:bg-background-secondary font-shell"
          >
            Analysis
          </Link>
          <FilterDropdown activeFilters={activeFilters} onToggle={toggleFilter} onClear={clearFilters} />
        </div>
      </div>

      {/* Hint row — shown when New-status apps exist */}
      {newApps.length > 0 && (
        <div className="flex items-center gap-2.5 py-2 px-4 border-b-[0.5px] border-border-tertiary bg-background-secondary shrink-0">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-custom text-white text-[11px] font-mono font-bold shrink-0">
            {newApps.length}
          </span>
          <span className="text-[12px] text-text-tertiary font-shell">
            new {newApps.length === 1 ? "application" : "applications"} ready
          </span>
          <code className="py-1 px-2 rounded-[5px] bg-background-tertiary text-[11px] font-mono text-text-secondary border-[0.5px] border-border-tertiary">
            {appsPrompt}
          </code>
          <button
            onClick={copyAppsPrompt}
            disabled={copyingApps}
            className="text-[11px] font-medium py-[3px] px-[9px] rounded-full border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell shrink-0"
          >
            {copyingApps ? "Copied" : "Copy"}
          </button>
          <span className="text-[10px] text-text-tertiary font-shell ml-auto">add /clear after pasting</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        {/* Sticky header */}
        <div className={`grid ${COL_GRID_CLS} px-4 border-b-[0.5px] border-border-tertiary bg-background-secondary sticky top-0 z-[2]`}>
          {colHeader("Company")}
          {colHeader("Role")}
          {colHeader("Status")}
          {colHeader("Date")}
          <div />
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-text-tertiary">
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-text-tertiary">
            No applications
          </div>
        ) : (
          visible.map((app) => {
            const initials = companyChip(app.company);
            const isActive = ACTIVE_STATUSES.has(app.status);
            const chipCls = `w-[26px] h-[26px] rounded-[6px] shrink-0 flex items-center justify-center text-[9px] font-bold font-mono ${
              isActive ? "bg-custom-l text-custom-d" : "bg-background-secondary text-text-tertiary"
            }`;

            return (
              <div
                key={app.id}
                onClick={() => router.push(`/apply/${app.id}`)}
                className={`app-row grid ${COL_GRID_CLS} py-2.5 px-4 border-b-[0.5px] border-border-tertiary items-center cursor-pointer relative`}
              >
                {/* Company */}
                <div className="flex items-center gap-[9px] min-w-0">
                  <div className={chipCls}>{initials}</div>
                  <span className="text-[14px] font-medium min-w-0 line-clamp-2 break-words">{app.company}</span>
                </div>

                {/* Role */}
                <div className="text-[13px] text-text-secondary min-w-0 line-clamp-2 break-words">
                  {app.job_title}
                </div>

                {/* Status badge */}
                <div onClick={(e) => e.stopPropagation()}>
                  <StatusBadge status={app.status} onSelect={(s) => handleStatusChange(app.id, s)} stopPropagation />
                </div>

                {/* Date */}
                <div className="text-[13px] text-text-tertiary font-mono">
                  {shortDate(app.date_applied)}
                </div>

                {/* Delete */}
                <div onClick={(e) => e.stopPropagation()} className="app-row-del justify-self-end flex items-center">
                  {pendingDeleteId === app.id ? (
                    <div className="flex flex-col items-center gap-1 text-[11px]">
                      <span className="text-text-tertiary whitespace-nowrap">Delete?</span>
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Confirm delete"
                          onClick={() => handleDelete(app.id)}
                          className="text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-badge-passed-bg text-badge-passed-fg border-none cursor-pointer font-shell"
                        >
                          Yes
                        </button>
                        <button
                          aria-label="Cancel delete"
                          onClick={() => setPendingDeleteId(null)}
                          className="text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-transparent text-text-tertiary border-[0.5px] border-border-tertiary cursor-pointer font-shell"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      aria-label="Delete"
                      disabled={deletingId === app.id}
                      onClick={() => setPendingDeleteId(app.id)}
                      className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center border-none bg-transparent cursor-pointer text-text-tertiary transition-colors hover:text-badge-passed-fg hover:bg-badge-passed-bg"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

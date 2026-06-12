"use client";
import { useEffect, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface RawTrashedItem {
  id: string;
  company: string;
  job_title: string;
  deleted_at: string;
}

interface TrashItem extends RawTrashedItem {
  type: "application" | "lead";
}

const COL_GRID_CLS = "grid-cols-[110px_2fr_2fr_110px_220px]";

function formatDeletedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
}

function typePill(type: TrashItem["type"]) {
  const cls =
    type === "application"
      ? "bg-badge-analyzed-bg text-badge-analyzed-fg"
      : "bg-custom-l text-custom-d";
  return (
    <span className={`text-[11px] font-medium py-0.5 px-2 rounded-full font-shell ${cls}`}>
      {type === "application" ? "Application" : "Captured Job"}
    </span>
  );
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get("/api/trash/")
      .then((data: { applications: RawTrashedItem[]; leads: RawTrashedItem[] }) => {
        const apps: TrashItem[] = data.applications.map((a) => ({ ...a, type: "application" as const }));
        const leads: TrashItem[] = data.leads.map((l) => ({ ...l, type: "lead" as const }));
        const merged = [...apps, ...leads].sort((a, b) =>
          a.deleted_at < b.deleted_at ? 1 : a.deleted_at > b.deleted_at ? -1 : 0
        );
        setItems(merged);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    const path =
      item.type === "application"
        ? `/api/trash/applications/${item.id}/restore`
        : `/api/trash/leads/${item.id}/restore`;
    await api.post(path, {});
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success(item.type === "application" ? "Restored to Applications" : "Restored to Captured Jobs");
  };

  const handleDeleteForever = async (item: TrashItem) => {
    setPendingDeleteId(null);
    const path =
      item.type === "application" ? `/api/trash/applications/${item.id}` : `/api/trash/leads/${item.id}`;
    await api.delete(path);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success("Deleted forever");
  };

  const colHeader = (label: string) => (
    <span className="flex items-center text-[11px] font-medium tracking-[0.06em] uppercase text-text-tertiary py-[9px] font-shell">
      {label}
    </span>
  );

  return (
    <div className="flex flex-col overflow-hidden h-full bg-background-primary">
      {/* Topbar */}
      <div className="flex items-center py-2.5 px-4 border-b-[0.5px] border-border-tertiary gap-2 shrink-0">
        <span className="text-[15px] font-medium mr-1.5 font-shell">Trash</span>
        <span className="text-[12px] font-medium bg-background-secondary text-text-tertiary py-0.5 px-2 rounded-full font-mono">
          {items.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        {/* Sticky header */}
        <div className={`grid ${COL_GRID_CLS} px-4 border-b-[0.5px] border-border-tertiary bg-background-secondary sticky top-0 z-[2]`}>
          {colHeader("Type")}
          {colHeader("Company")}
          {colHeader("Role")}
          {colHeader("Deleted")}
          <div />
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-text-tertiary">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-text-tertiary">Trash is empty</div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className={`app-row grid ${COL_GRID_CLS} py-2.5 px-4 border-b-[0.5px] border-border-tertiary items-center relative`}
            >
              {/* Type */}
              <div>{typePill(item.type)}</div>

              {/* Company */}
              <div className="text-[14px] font-medium min-w-0 line-clamp-2 break-words">
                {item.company || "(unprocessed capture)"}
              </div>

              {/* Role */}
              <div className="text-[13px] text-text-secondary min-w-0 line-clamp-2 break-words">
                {item.job_title || "—"}
              </div>

              {/* Deleted */}
              <div className="text-[13px] text-text-tertiary font-mono">{formatDeletedAt(item.deleted_at)}</div>

              {/* Actions */}
              <div className="justify-self-end flex items-center gap-1.5">
                <button
                  aria-label="Restore"
                  onClick={() => handleRestore(item)}
                  className="flex items-center gap-1 text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-transparent text-text-secondary border-[0.5px] border-border-tertiary cursor-pointer font-shell hover:text-text-primary"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>

                {pendingDeleteId === item.id ? (
                  <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                    <span className="text-text-tertiary">Delete forever?</span>
                    <button
                      aria-label="Confirm permanent delete"
                      onClick={() => handleDeleteForever(item)}
                      className="text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-badge-passed-bg text-badge-passed-fg border-none cursor-pointer font-shell"
                    >
                      Yes
                    </button>
                    <button
                      aria-label="Cancel permanent delete"
                      onClick={() => setPendingDeleteId(null)}
                      className="text-[11px] font-medium py-[3px] px-[7px] rounded-[5px] bg-transparent text-text-tertiary border-[0.5px] border-border-tertiary cursor-pointer font-shell"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label="Delete forever"
                    onClick={() => setPendingDeleteId(item.id)}
                    className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center border-none bg-transparent cursor-pointer text-text-tertiary transition-colors hover:text-badge-passed-fg hover:bg-badge-passed-bg"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

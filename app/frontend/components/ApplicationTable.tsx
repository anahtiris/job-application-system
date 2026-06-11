"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { STATUS_CLASSES, formatDate } from "@/lib/status";


// Statuses available from each current status — Draft is a one-way gate
const NEXT_STATUSES: Record<string, string[]> = {
  Draft:     ["Applied"],
  Applied:   ["Interview", "Offer", "Rejected"],
  Interview: ["Applied", "Offer", "Rejected"],
  Offer:     ["Rejected"],
  Rejected:  ["Applied", "Interview"],
};

interface Application {
  id: string;
  company: string;
  job_title: string;
  status: string;
  date_applied: string;
  language: string;
}

interface PendingApply { id: string; date: string; }

export function ApplicationTable({
  applications,
  onRefresh,
}: {
  applications: Application[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      await api.delete(`/api/tracker/${id}`);
      onRefresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/api/tracker/${id}/status`, { status });
      toast.success("Status updated");
      onRefresh();
    } catch {
      toast.error("Status update failed");
    }
  };

  const handleStatusChange = (app: Application, newStatus: string | null) => {
    if (!newStatus || newStatus === app.status) return;
    if (newStatus === "Applied") {
      setPendingApply({ id: app.id, date: app.date_applied ?? new Date().toISOString().slice(0, 10) });
    } else {
      updateStatus(app.id, newStatus);
    }
  };

  const confirmApply = async () => {
    if (!pendingApply) return;
    await updateStatus(pendingApply.id, "Applied");
    try {
      await api.patch(`/api/tracker/${pendingApply.id}/date`, { date_applied: pendingApply.date });
      toast.success("Date saved");
    } catch {
      toast.error("Date save failed");
    }
    setPendingApply(null);
    onRefresh();
  };

  if (applications.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No applications yet. Start a new one above.
      </p>
    );
  }

  return (
    <>
      {/* Applied-date confirmation */}
      {pendingApply && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-primary/30 bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Date applied:</span>
          <input
            type="date"
            className="border rounded px-2 py-0.5 text-sm"
            value={pendingApply.date}
            onChange={(e) => setPendingApply({ ...pendingApply, date: e.target.value })}
          />
          <Button size="sm" onClick={confirmApply}>Confirm</Button>
          <Button size="sm" variant="outline" onClick={() => setPendingApply(null)}>Cancel</Button>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Language</th>
              <th className="text-left p-3 font-medium">Applied</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const nextOptions = NEXT_STATUSES[app.status] ?? [];
              return (
                <tr
                  key={app.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => router.push(`/apply/${app.id}`)}
                >
                  <td className="p-3 font-medium">{app.company}</td>
                  <td className="p-3 text-muted-foreground">{app.job_title}</td>
                  <td className="p-3">
                    <Badge variant="outline">{app.language.toUpperCase()}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(app.date_applied)}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={app.status}
                      onValueChange={(v) => handleStatusChange(app, v)}
                      disabled={nextOptions.length === 0}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[app.status] ?? ""}`}>
                            {app.status}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {nextOptions.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {pendingDeleteId === app.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-muted-foreground">Delete?</span>
                        <Button size="sm" variant="destructive" className="h-7 text-xs px-2"
                          onClick={(e) => confirmDelete(app.id, e)}>Yes</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                          onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}>No</Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === app.id}
                        onClick={(e) => { e.stopPropagation(); setPendingDeleteId(app.id); }}
                      >
                        {deletingId === app.id ? "…" : "Delete"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

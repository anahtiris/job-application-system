"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Interview } from "./types";

export interface UseInterviewsResult {
  interviews: Interview[];
  loaded: boolean;
  upcoming: Interview[];
  past: Interview[];
  onDateChange: (id: string, iso: string | null) => void;
}

// Owns the Interview-status tracker list for the /interview segment: the fetch,
// the split into upcoming/past, and the handler that keeps the in-memory list in
// sync with round date edits so the sidebar re-sorts without a full refetch.
export function useInterviews(): UseInterviewsResult {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api.get("/api/tracker/")
      .then((data) => {
        const all = data as Interview[];
        setInterviews(all.filter((a) => a.status === "Interview"));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDateChange = useCallback(
    (id: string, iso: string | null) =>
      setInterviews((prev) => prev.map((a) => (a.id === id ? { ...a, interview_date: iso } : a))),
    [],
  );

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const upcoming = interviews
      .filter((a) => !a.interview_date || new Date(a.interview_date) >= now)
      .sort((a, b) => {
        if (!a.interview_date) return 1;
        if (!b.interview_date) return -1;
        return new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime();
      });
    const past = interviews
      .filter((a) => !!a.interview_date && new Date(a.interview_date) < now)
      .sort((a, b) => new Date(b.interview_date!).getTime() - new Date(a.interview_date!).getTime());
    return { upcoming, past };
  }, [interviews]);

  return { interviews, loaded, upcoming, past, onDateChange };
}

"use client";
import { createContext, useContext } from "react";
import type { Interview } from "./types";

// Shared state for the /interview segment. The layout owns the fetched
// interview list and the handlers that keep it in sync with edits; the
// /interview/[id] page consumes this to find its app and wire CompanyPrepPanel.
export interface InterviewListContextValue {
  interviews: Interview[];
  loaded: boolean;
  isDark: boolean;
  onDateChange: (id: string, iso: string | null) => void;
  onPrepChange: (id: string, json: string) => void;
  onNotesChange: (id: string, json: string) => void;
}

const InterviewListContext = createContext<InterviewListContextValue | null>(null);

export const InterviewListProvider = InterviewListContext.Provider;

export function useInterviewList(): InterviewListContextValue {
  const ctx = useContext(InterviewListContext);
  if (!ctx) {
    throw new Error("useInterviewList must be used within the /interview layout");
  }
  return ctx;
}

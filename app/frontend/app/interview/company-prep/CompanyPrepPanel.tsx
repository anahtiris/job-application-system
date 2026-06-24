"use client";
import "@anahtiris/flipclock/dist/flipclock.css";
import React, { useCallback, useRef, useState } from "react";
import { FlipClock } from "@anahtiris/flipclock";
import { api } from "@/lib/api";
import {
  type SaveState, SaveIndicator, useAutoSave, GrowTextarea, SectionCard,
} from "@/components/ui-kit";
import {
  type Interview, type InterviewNotes, type InterviewPrep, type DateTimeValue, DEFAULT_NOTES,
} from "../types";
import {
  parsePrepJson, parseDate, toISO, formatDate,
} from "../helpers";
import { TabBar } from "../shared";
import { CompanyOverviewTab } from "./CompanyOverviewTab";
import { CompanyQuestionsTab } from "./CompanyQuestionsTab";
import { CompanyAnticipateTab } from "./CompanyAnticipateTab";
import { CompanyBackgroundTab } from "./CompanyBackgroundTab";

// ─── Company Prep Panel ─────────────────────────────────────────────────────────

const COMPANY_TABS = ["Overview", "Questions", "Anticipate", "Background", "Salary", "Notes"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

export function CompanyPrepPanel({
  app,
  isDark,
  onDateChange,
  onPrepChange,
  onNotesChange,
}: {
  app: Interview;
  isDark: boolean;
  onDateChange: (id: string, iso: string | null) => void;
  onPrepChange: (id: string, md: string) => void;
  onNotesChange: (id: string, json: string) => void;
}) {
  const [notes, setNotes] = useState<InterviewNotes>(() => {
    let parsed: Partial<InterviewNotes> = {};
    if (app.interview_notes_json) {
      try { parsed = JSON.parse(app.interview_notes_json); } catch {}
    }
    return { ...DEFAULT_NOTES, ...parsed };
  });
  const [tab, setTab] = useState<CompanyTab>("Overview");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<DateTimeValue | undefined>(undefined);

  // Prep generation state
  const [prep, setPrep] = useState<InterviewPrep>(parsePrepJson(app.interview_prep_json));
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [showPrepOptions, setShowPrepOptions] = useState(false);
  const [round, setRound] = useState<string>("Technical");
  const [interviewer, setInterviewer] = useState<string>("Hiring Manager");
  const [focus, setFocus] = useState("");
  const [copying, setCopying] = useState(false);

  // Reset all local editing state when a different application is selected.
  // Derived from the `app` prop during render (keyed on app.id) instead of in
  // an effect — React's recommended pattern for resetting state on prop change.
  const [lastAppId, setLastAppId] = useState(app.id);
  if (app.id !== lastAppId) {
    setLastAppId(app.id);
    let parsed: Partial<InterviewNotes> = {};
    if (app.interview_notes_json) {
      try { parsed = JSON.parse(app.interview_notes_json); } catch {}
    }
    setNotes({ ...DEFAULT_NOTES, ...parsed });
    setPrep(parsePrepJson(app.interview_prep_json));
    setPendingDate(parseDate(app.interview_date));
    setShowDatePicker(false);
  }

  const saveFn = useCallback(async (n: InterviewNotes) => {
    const json = JSON.stringify(n);
    await api.patch(`/api/tracker/${app.id}/interview-notes`, { notes_json: json });
    onNotesChange(app.id, json);
  }, [app.id, onNotesChange]);

  const saveState = useAutoSave(notes, saveFn);
  const update = (patch: Partial<InterviewNotes>) => setNotes((n) => ({ ...n, ...patch }));

  // Debounced prep save
  const prepSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prepSaveState, setPrepSaveState] = useState<SaveState>("idle");
  const savePrep = useCallback((next: InterviewPrep) => {
    if (prepSaveTimer.current) clearTimeout(prepSaveTimer.current);
    setPrepSaveState("saving");
    prepSaveTimer.current = setTimeout(async () => {
      await api.put(`/api/application/${app.id}/interview-prep`, next);
      onPrepChange(app.id, JSON.stringify(next));
      setPrepSaveState("saved");
      setTimeout(() => setPrepSaveState("idle"), 2000);
    }, 1000);
  }, [app.id, onPrepChange]);

  const updatePrep = (patch: Partial<InterviewPrep>) => {
    setPrep((prev) => {
      const next = { ...prev, ...patch };
      savePrep(next);
      return next;
    });
  };

  const confirmDate = async () => {
    if (!pendingDate) return;
    const iso = toISO(pendingDate);
    await api.patch(`/api/tracker/${app.id}/interview-date`, { interview_date: iso });
    onDateChange(app.id, iso);
    setShowDatePicker(false);
  };

  const clearDate = async () => {
    await api.patch(`/api/tracker/${app.id}/interview-date`, { interview_date: null });
    onDateChange(app.id, null);
    setPendingDate(undefined);
    setShowDatePicker(false);
  };

  const generatePrep = async () => {
    setGeneratingPrep(true);
    setShowPrepOptions(false);
    const result = await api.post("/api/application/interview-prep", {
      application_id: app.id,
      interview_round: round,
      interviewer_type: interviewer,
      focus_skills: focus,
    }).catch(() => null);
    if (result) {
      setPrep(result as InterviewPrep);
      onPrepChange(app.id, JSON.stringify(result));
    }
    setGeneratingPrep(false);
  };

  const copyClaudePrompt = async () => {
    const prompt =
      `Prepare interview prep for application ${app.id} ` +
      `(Round: ${round}, Interviewer: ${interviewer}${focus.trim() ? `, Focus: ${focus.trim()}` : ""}).\n` +
      `Fetch details from http://localhost:8000/api/tracker/${app.id}, follow the "Interview prep — Claude path" steps in CLAUDE.md ` +
      `(web-research the company, draft all sections), then save with PUT /api/application/${app.id}/interview-prep.`;
    await navigator.clipboard.writeText(prompt);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  };

  const hasPrep =
    !!prep.company_analysis ||
    !!prep.introduction_script ||
    prep.common_questions.length > 0 ||
    prep.job_specific_questions.length > 0 ||
    prep.weak_spots.length > 0 ||
    prep.questions_to_ask.length > 0 ||
    !!prep.salary;

  const { label: dateLabel, isToday } = formatDate(app.interview_date);

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center py-[11px] px-4 border-b-[0.5px] border-border-tertiary gap-2.5 shrink-0 flex-wrap relative">
        <span className="text-[14px] font-medium font-shell">{app.company}</span>

        <button
          onClick={() => setShowDatePicker((v) => !v)}
          className={`inline-flex items-center gap-[5px] text-[11px] font-medium py-[3px] px-[9px] rounded-full border-[0.5px] border-border-tertiary cursor-pointer font-mono ${
            isToday ? "bg-badge-interview-bg text-badge-interview-fg" : "bg-transparent text-text-secondary"
          }`}
        >
          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-badge-interview-fg shrink-0" />}
          {dateLabel}
        </button>

        <TabBar tabs={[...COMPANY_TABS]} active={tab} onChange={(t) => setTab(t as CompanyTab)} />
        <SaveIndicator state={saveState} />

        {showDatePicker && (
          <div className="absolute top-[calc(100%+6px)] left-4 z-40 bg-background-primary border-[0.5px] border-border-tertiary rounded-[12px] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col gap-2">
            <div className="flipclock-compact">
              <FlipClock
                mode="datetime" theme={isDark ? "dark" : "light"} size="xs"
                hour12={false} showSeconds={false}
                defaultValue={pendingDate ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate(), hour: 10, minute: 0 }}
                onChange={(v) => setPendingDate(v as DateTimeValue)}
              />
            </div>
            <div className="flex gap-1.5 justify-end">
              {app.interview_date && (
                <button onClick={clearDate} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell">Clear</button>
              )}
              <button onClick={() => setShowDatePicker(false)} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell">Cancel</button>
              <button onClick={confirmDate} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-none bg-custom text-white cursor-pointer font-shell">Confirm</button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-3.5 px-4 flex flex-col gap-3 min-h-0">

        {tab === "Overview" && (
          <CompanyOverviewTab
            app={app}
            prep={prep}
            updatePrep={updatePrep}
            hasPrep={hasPrep}
            generatingPrep={generatingPrep}
            showPrepOptions={showPrepOptions}
            setShowPrepOptions={setShowPrepOptions}
            round={round}
            setRound={setRound}
            interviewer={interviewer}
            setInterviewer={setInterviewer}
            focus={focus}
            setFocus={setFocus}
            copying={copying}
            copyClaudePrompt={copyClaudePrompt}
            generatePrep={generatePrep}
          />
        )}

        {tab === "Questions" && (
          <CompanyQuestionsTab notes={notes} update={update} prep={prep} updatePrep={updatePrep} />
        )}

        {tab === "Anticipate" && (
          <CompanyAnticipateTab notes={notes} update={update} />
        )}

        {tab === "Background" && (
          <CompanyBackgroundTab
            prep={prep}
            updatePrep={updatePrep}
            hasPrep={hasPrep}
            generatingPrep={generatingPrep}
            prepSaveState={prepSaveState}
          />
        )}

        {/* Salary */}
        {tab === "Salary" && (
          <SectionCard title="Salary & negotiation">
            <div className="grid grid-cols-3 gap-2.5 mb-3.5">
              {(["ask", "market", "floor"] as const).map((key) => (
                <div key={key}>
                  <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary mb-1 font-shell">
                    {key === "ask" ? "My ask" : key === "market" ? "Market rate" : "Floor"}
                  </div>
                  <input
                    value={notes.salary[key]}
                    onChange={(e) => update({ salary: { ...notes.salary, [key]: e.target.value } })}
                    placeholder="€ …"
                    className="w-full text-[14px] font-medium font-mono bg-transparent border-[0.5px] border-border-tertiary rounded-[6px] py-1.5 px-2 text-text-primary outline-none"
                  />
                </div>
              ))}
            </div>
            <GrowTextarea
              value={notes.salary.notes}
              onChange={(v) => update({ salary: { ...notes.salary, notes: v } })}
              placeholder="Negotiation notes…"
              className="min-h-[80px]"
            />
          </SectionCard>
        )}

        {/* Notes */}
        {tab === "Notes" && (
          <SectionCard title="Notes">
            <GrowTextarea
              value={notes.notes}
              onChange={(v) => update({ notes: v })}
              placeholder="Free-form notes…"
              className="min-h-[200px]"
            />
          </SectionCard>
        )}
      </div>
    </>
  );
}

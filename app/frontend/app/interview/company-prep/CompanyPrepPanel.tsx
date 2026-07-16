"use client";
import "@anahtiris/flipclock/dist/flipclock.css";
import React, { useCallback, useRef, useState } from "react";
import { FlipClock } from "@anahtiris/flipclock";
import { api, BASE } from "@/lib/api";
import {
  type SaveState, SaveIndicator, GrowTextarea, SectionCard,
} from "@/components/ui-kit";
import {
  type Interview, type InterviewNotes, type InterviewPrep, type InterviewRound,
  type DateTimeValue, DEFAULT_NOTES,
} from "../types";
import { parseRounds, parseDate, toISO, formatDate } from "../helpers";
import { TabBar } from "../shared";
import { CompanyOverviewTab } from "./CompanyOverviewTab";
import { CompanyQuestionsTab } from "./CompanyQuestionsTab";
import { CompanyBackgroundTab } from "./CompanyBackgroundTab";

// ─── Company Prep Panel ─────────────────────────────────────────────────────────

const COMPANY_TABS = ["Overview", "Questions", "Background", "Salary", "Notes"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

function pickDefaultRound(rounds: InterviewRound[]): InterviewRound | null {
  if (rounds.length === 0) return null;
  const now = new Date();
  const upcoming = rounds
    .filter((r) => r.date && new Date(r.date) >= now)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  if (upcoming.length > 0) return upcoming[0];
  const past = rounds
    .filter((r) => r.date && new Date(r.date) < now)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
  if (past.length > 0) return past[0];
  return rounds[rounds.length - 1];
}

export function CompanyPrepPanel({
  app,
  isDark,
  onDateChange,
}: {
  app: Interview;
  isDark: boolean;
  onDateChange: (id: string, iso: string | null) => void;
}) {
  const [rounds, setRounds] = useState<InterviewRound[]>(() => parseRounds(app.interview_rounds_json));
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(() => pickDefaultRound(parseRounds(app.interview_rounds_json))?.id ?? null);
  const [tab, setTab] = useState<CompanyTab>("Overview");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<DateTimeValue | undefined>(undefined);
  const [showAddRound, setShowAddRound] = useState(false);
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [showPrepOptions, setShowPrepOptions] = useState(false);
  const [interviewer, setInterviewer] = useState<string>("Hiring Manager");
  const [focus, setFocus] = useState("");
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [prepSaveState, setPrepSaveState] = useState<SaveState>("idle");

  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

  // Reset all local editing state when a different application is selected —
  // derived from the `app` prop during render (keyed on app.id), mirroring the
  // pre-rounds reset pattern this component already used.
  const [lastAppId, setLastAppId] = useState(app.id);
  if (app.id !== lastAppId) {
    setLastAppId(app.id);
    const freshRounds = parseRounds(app.interview_rounds_json);
    setRounds(freshRounds);
    setSelectedRoundId(pickDefaultRound(freshRounds)?.id ?? null);
    setShowDatePicker(false);
    setShowAddRound(false);
    setTab("Overview");
  }

  const addRound = async (roundType: string, iso: string | null) => {
    const result = await api.post(`/api/tracker/${app.id}/interview-rounds`, {
      round_type: roundType, date: iso,
    }) as { rounds: InterviewRound[]; interview_date: string | null };
    setRounds(result.rounds);
    setSelectedRoundId(result.rounds[result.rounds.length - 1].id);
    onDateChange(app.id, result.interview_date);
    setShowAddRound(false);
  };

  const deleteRound = async (roundId: string) => {
    const result = await api.delete(`/api/tracker/${app.id}/interview-rounds/${roundId}`) as { rounds: InterviewRound[]; interview_date: string | null };
    setRounds(result.rounds);
    onDateChange(app.id, result.interview_date);
    if (selectedRoundId === roundId) {
      setSelectedRoundId(pickDefaultRound(result.rounds)?.id ?? null);
    }
  };

  const notes = selectedRound?.notes ?? DEFAULT_NOTES;

  // Debounced notes save — keyed per round so switching rounds mid-edit
  // doesn't cancel another round's still-pending save.
  const [notesSaveState, setNotesSaveState] = useState<SaveState>("idle");
  const notesSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveNotes = useCallback((roundId: string, next: InterviewNotes) => {
    if (notesSaveTimers.current[roundId]) clearTimeout(notesSaveTimers.current[roundId]);
    setNotesSaveState("saving");
    notesSaveTimers.current[roundId] = setTimeout(async () => {
      await api.patch(`/api/tracker/${app.id}/interview-rounds/${roundId}/notes`, { notes: next });
      delete notesSaveTimers.current[roundId];
      setNotesSaveState("saved");
      setTimeout(() => setNotesSaveState("idle"), 2000);
    }, 800);
  }, [app.id]);

  const update = (patch: Partial<InterviewNotes>) => {
    if (!selectedRoundId) return;
    setRounds((prev) => prev.map((r) => {
      if (r.id !== selectedRoundId) return r;
      const next = { ...r.notes, ...patch };
      saveNotes(selectedRoundId, next);
      return { ...r, notes: next };
    }));
  };

  // Debounced prep save — keyed per round so switching rounds mid-edit
  // doesn't cancel another round's still-pending save.
  const prepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savePrep = useCallback((roundId: string, next: InterviewPrep) => {
    if (prepSaveTimers.current[roundId]) clearTimeout(prepSaveTimers.current[roundId]);
    setPrepSaveState("saving");
    prepSaveTimers.current[roundId] = setTimeout(async () => {
      await api.put(`/api/application/${app.id}/interview-prep`, { round_id: roundId, prep: next });
      delete prepSaveTimers.current[roundId];
      setPrepSaveState("saved");
      setTimeout(() => setPrepSaveState("idle"), 2000);
    }, 1000);
  }, [app.id]);

  const updatePrep = (patch: Partial<InterviewPrep>) => {
    if (!selectedRoundId) return;
    setRounds((prev) => prev.map((r) => {
      if (r.id !== selectedRoundId) return r;
      const next = { ...r.prep, ...patch };
      savePrep(selectedRoundId, next);
      return { ...r, prep: next };
    }));
  };

  const confirmDate = async () => {
    if (!pendingDate || !selectedRoundId) return;
    const iso = toISO(pendingDate);
    const result = await api.patch(`/api/tracker/${app.id}/interview-rounds/${selectedRoundId}`, { date: iso }) as { rounds: InterviewRound[]; interview_date: string | null };
    setRounds(result.rounds);
    onDateChange(app.id, result.interview_date);
    setShowDatePicker(false);
  };

  const clearDate = async () => {
    if (!selectedRoundId) return;
    const result = await api.patch(`/api/tracker/${app.id}/interview-rounds/${selectedRoundId}`, { date: null }) as { rounds: InterviewRound[]; interview_date: string | null };
    setRounds(result.rounds);
    onDateChange(app.id, result.interview_date);
    setPendingDate(undefined);
    setShowDatePicker(false);
  };

  const generatePrep = async () => {
    if (!selectedRoundId || !selectedRound) return;
    setGeneratingPrep(true);
    setShowPrepOptions(false);
    const result = await api.post("/api/application/interview-prep", {
      application_id: app.id,
      round_id: selectedRoundId,
      interview_round: selectedRound.round_type,
      interviewer_type: interviewer,
      focus_skills: focus,
    }).catch(() => null);
    if (result) {
      setRounds((prev) => prev.map((r) => (r.id === selectedRoundId ? { ...r, prep: result as InterviewPrep } : r)));
    }
    setGeneratingPrep(false);
  };

  const copyClaudePrompt = async () => {
    if (!selectedRound) return;
    const prompt =
      `Prepare interview prep for application ${app.id}, round ${selectedRoundId} ` +
      `(Round type: ${selectedRound.round_type}, Interviewer: ${interviewer}${focus.trim() ? `, Focus: ${focus.trim()}` : ""}).\n` +
      `Fetch details from http://localhost:8000/api/tracker/${app.id}, follow the "Interview prep — Claude path" steps in CLAUDE.md ` +
      `(web-research the company, draft all sections), then save with PUT /api/application/${app.id}/interview-prep using body {"round_id": "${selectedRoundId}", "prep": {...}}.`;
    await navigator.clipboard.writeText(prompt);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  };

  const exportPdf = async () => {
    if (!selectedRoundId) return;
    setExporting(true);
    try {
      const res = await fetch(`${BASE}/api/application/${app.id}/interview-export.pdf?round_id=${selectedRoundId}`);
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${app.company.replace(/[^\w]+/g, "_")}_Interview_Prep.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const prep = selectedRound?.prep;
  const hasPrep = !!prep && (
    !!prep.company_analysis ||
    !!prep.introduction_script ||
    prep.common_questions.length > 0 ||
    prep.job_specific_questions.length > 0 ||
    prep.weak_spots.length > 0 ||
    prep.questions_to_ask.length > 0 ||
    !!prep.salary
  );

  const { label: dateLabel, isToday } = formatDate(selectedRound?.date ?? null);

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center py-[11px] px-4 border-b-[0.5px] border-border-tertiary gap-2.5 shrink-0 flex-wrap relative">
        <span className="text-[14px] font-medium font-shell">{app.company}</span>

        <RoundSwitcher
          rounds={rounds}
          selectedRoundId={selectedRoundId}
          onSelect={(id) => { setSelectedRoundId(id); setShowDatePicker(false); }}
          onDelete={deleteRound}
          onAddClick={() => setShowAddRound(true)}
        />

        {selectedRound && (
          <button
            onClick={() => { setPendingDate(parseDate(selectedRound.date)); setShowDatePicker((v) => !v); }}
            className={`inline-flex items-center gap-[5px] text-[11px] font-medium py-[3px] px-[9px] rounded-full border-[0.5px] border-border-tertiary cursor-pointer font-mono ${
              isToday ? "bg-badge-interview-bg text-badge-interview-fg" : "bg-transparent text-text-secondary"
            }`}
          >
            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-badge-interview-fg shrink-0" />}
            {dateLabel}
          </button>
        )}

        <TabBar tabs={[...COMPANY_TABS]} active={tab} onChange={(t) => setTab(t as CompanyTab)} />
        <SaveIndicator state={notesSaveState} />
        <button
          onClick={exportPdf}
          disabled={exporting || !selectedRoundId}
          className="ml-auto text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export PDF"}
        </button>

        {showDatePicker && selectedRound && (
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
              {selectedRound.date && (
                <button onClick={clearDate} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell">Clear</button>
              )}
              <button onClick={() => setShowDatePicker(false)} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell">Cancel</button>
              <button onClick={confirmDate} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-none bg-custom text-white cursor-pointer font-shell">Confirm</button>
            </div>
          </div>
        )}

        {showAddRound && (
          <AddRoundPopover onCancel={() => setShowAddRound(false)} onAdd={addRound} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-3.5 px-4 flex flex-col gap-3 min-h-0">
        {!selectedRound && (
          <div className="text-center py-12 px-5 text-text-tertiary text-[12px] font-shell">
            No interview rounds yet — click "+ Add Round" above to create one.
          </div>
        )}

        {selectedRound && tab === "Overview" && (
          <CompanyOverviewTab
            app={app}
            prep={selectedRound.prep}
            updatePrep={updatePrep}
            hasPrep={hasPrep}
            generatingPrep={generatingPrep}
            showPrepOptions={showPrepOptions}
            setShowPrepOptions={setShowPrepOptions}
            roundType={selectedRound.round_type}
            interviewer={interviewer}
            setInterviewer={setInterviewer}
            focus={focus}
            setFocus={setFocus}
            copying={copying}
            copyClaudePrompt={copyClaudePrompt}
            generatePrep={generatePrep}
          />
        )}

        {selectedRound && tab === "Questions" && (
          <CompanyQuestionsTab notes={notes} update={update} prep={selectedRound.prep} updatePrep={updatePrep} />
        )}

        {selectedRound && tab === "Background" && (
          <CompanyBackgroundTab
            prep={selectedRound.prep}
            updatePrep={updatePrep}
            hasPrep={hasPrep}
            generatingPrep={generatingPrep}
            prepSaveState={prepSaveState}
          />
        )}

        {selectedRound && tab === "Salary" && (
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

        {selectedRound && tab === "Notes" && (
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

// ─── Round switcher ──────────────────────────────────────────────────────────

function RoundSwitcher({
  rounds, selectedRoundId, onSelect, onDelete, onAddClick,
}: {
  rounds: InterviewRound[];
  selectedRoundId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {rounds.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          onDoubleClick={() => { if (confirm(`Delete the ${r.round_type} round?`)) onDelete(r.id); }}
          title="Double-click to delete"
          className={`text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell ${
            r.id === selectedRoundId
              ? "border-none bg-custom text-white"
              : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
          }`}
        >
          {r.round_type}
        </button>
      ))}
      <button
        onClick={onAddClick}
        className="text-[11px] font-medium py-1 px-2.5 rounded-full border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell"
      >
        + Add Round
      </button>
    </div>
  );
}

const ADD_ROUND_TYPES = ["Screening", "Technical", "Final"] as const;

function AddRoundPopover({
  onCancel, onAdd,
}: {
  onCancel: () => void;
  onAdd: (roundType: string, iso: string | null) => void;
}) {
  const [roundType, setRoundType] = useState<string>("Technical");
  return (
    <div className="absolute top-[calc(100%+6px)] left-4 z-40 bg-background-primary border-[0.5px] border-border-tertiary rounded-[12px] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col gap-2 w-[240px]">
      <div className="flex gap-1 flex-wrap">
        {ADD_ROUND_TYPES.map((r) => (
          <button
            key={r}
            onClick={() => setRoundType(r)}
            className={`text-[11px] font-medium py-1 px-2.5 rounded-[6px] cursor-pointer font-shell ${
              roundType === r ? "border-none bg-custom text-white" : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        value={roundType}
        onChange={(e) => setRoundType(e.target.value)}
        placeholder="Custom round name…"
        className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none"
      />
      <div className="flex gap-1.5 justify-end">
        <button onClick={onCancel} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-secondary cursor-pointer font-shell">Cancel</button>
        <button onClick={() => onAdd(roundType, null)} className="text-[11px] font-medium py-[5px] px-2.5 rounded-[6px] border-none bg-custom text-white cursor-pointer font-shell">Add</button>
      </div>
    </div>
  );
}

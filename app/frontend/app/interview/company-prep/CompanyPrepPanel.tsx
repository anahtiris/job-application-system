"use client";
import "@anahtiris/flipclock/dist/flipclock.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlipClock } from "@anahtiris/flipclock";
import ReactMarkdown from "react-markdown";
import { Check, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  type SaveState, SaveIndicator, useAutoSave, GrowTextarea, MdStrong, SectionCard,
  cardBoxCls, cardHeaderBarCls, sectionLabelCls, iconBtnCls, mutedTextCls, monoMutedCls,
} from "@/components/ui-kit";
import {
  type Interview, type GeneralPrep, type InterviewNotes, type DateTimeValue, DEFAULT_PREP, DEFAULT_NOTES,
} from "./types";
import {
  uid, parsePrepSection, updatePrepSection, importNotesFromPrep, parseDate, toISO, formatDate,
} from "./helpers";
import { TabBar, SortableItem } from "./shared";

// ─── Company Prep Panel ─────────────────────────────────────────────────────────

const COMPANY_TABS = ["Overview", "Questions", "Anticipate", "Background", "Salary", "Notes"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

const SEVERITY_NEXT: Record<string, "red" | "amber" | "green"> = {
  red: "amber", amber: "green", green: "red",
};

const SEVERITY_DOT_CLS: Record<string, string> = {
  red: "bg-badge-passed-fg",
  amber: "bg-custom",
  green: "bg-badge-interview-fg",
};

export function CompanyPrepPanel({
  app,
  isDark,
  onDateChange,
}: {
  app: Interview;
  isDark: boolean;
  onDateChange: (id: string, iso: string | null) => void;
}) {
  const [notes, setNotes] = useState<InterviewNotes>(DEFAULT_NOTES);
  const [tab, setTab] = useState<CompanyTab>("Overview");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<DateTimeValue | undefined>(undefined);
  const [newGapSkill, setNewGapSkill] = useState("");
  const [newExpectedQ, setNewExpectedQ] = useState("");
  const [catCollapsed, setCatCollapsed] = useState<Record<string, boolean>>({});
  const [prepAskCollapsed, setPrepAskCollapsed] = useState(false);

  // Prep generation state
  const [prepMd, setPrepMd] = useState(app.interview_prep_md ?? "");
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [showPrepOptions, setShowPrepOptions] = useState(false);
  const [round, setRound] = useState<string>("Technical");
  const [interviewer, setInterviewer] = useState<string>("Hiring Manager");
  const [focus, setFocus] = useState("");
  const [copying, setCopying] = useState(false);

  // General prep questions (for Questions tab)
  const [generalPrep, setGeneralPrep] = useState<GeneralPrep>(DEFAULT_PREP);

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
    const isEmpty =
      !parsed.overview &&
      !parsed.questions?.length &&
      !parsed.gaps?.length &&
      !parsed.salary?.notes;
    const base = isEmpty && app.interview_prep_md
      ? { ...DEFAULT_NOTES, ...importNotesFromPrep(app.interview_prep_md) }
      : { ...DEFAULT_NOTES, ...parsed };
    setNotes(base);
    setPrepMd(app.interview_prep_md ?? "");
    setPendingDate(parseDate(app.interview_date));
    setShowDatePicker(false);
  }

  useEffect(() => {
    api.get("/api/settings/general-prep").then((data) => {
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        setGeneralPrep({ ...DEFAULT_PREP, ...(data as Partial<GeneralPrep>) });
      }
    }).catch(() => {});
  }, []);

  const saveFn = useCallback(async (n: InterviewNotes) => {
    await api.patch(`/api/tracker/${app.id}/interview-notes`, { notes_json: JSON.stringify(n) });
  }, [app.id]);

  const saveState = useAutoSave(notes, saveFn);
  const update = (patch: Partial<InterviewNotes>) => setNotes((n) => ({ ...n, ...patch }));

  // Debounced prep section save
  const prepSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prepSaveState, setPrepSaveState] = useState<SaveState>("idle");
  const savePrepMd = useCallback((md: string) => {
    if (prepSaveTimer.current) clearTimeout(prepSaveTimer.current);
    setPrepSaveState("saving");
    prepSaveTimer.current = setTimeout(async () => {
      await api.put(`/api/application/${app.id}/interview-prep`, { markdown: md });
      setPrepSaveState("saved");
      setTimeout(() => setPrepSaveState("idle"), 2000);
    }, 1000);
  }, [app.id]);

  const editSection = (section: string, body: string) => {
    setPrepMd((prev) => {
      const updated = updatePrepSection(prev, section, body);
      savePrepMd(updated);
      return updated;
    });
  };

  // Per-interview question state
  const toggleMyQ = (qId: string) => {
    const cur = (notes.my_q_state ?? {})[qId] ?? { asked: false, note: "" };
    update({ my_q_state: { ...(notes.my_q_state ?? {}), [qId]: { ...cur, asked: !cur.asked } } });
  };
  const setMyQNote = (qId: string, note: string) => {
    const cur = (notes.my_q_state ?? {})[qId] ?? { asked: false, note: "" };
    update({ my_q_state: { ...(notes.my_q_state ?? {}), [qId]: { ...cur, note } } });
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
    if (result?.markdown) setPrepMd(result.markdown);
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

  const pillBtnCls = (primary = false): string => {
    const border = primary ? "border-none" : "border-[0.5px] border-border-tertiary";
    const bg = primary ? "bg-custom" : "bg-transparent";
    const color = primary ? "text-white" : "text-text-secondary";
    return `inline-flex items-center gap-[5px] text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell ${border} ${bg} ${color}`;
  };

  const { label: dateLabel, isToday } = formatDate(app.interview_date);

  const cats = generalPrep.question_categories ?? [];
  const allQs = cats.flatMap((c) => c.questions);

  const compCatSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorderCompCats = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.id === active.id);
    const newIdx = cats.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(cats, oldIdx, newIdx);
    const next = { ...generalPrep, question_categories: reordered };
    setGeneralPrep(next);
    api.put("/api/settings/general-prep", next).catch(() => {});
  };
  const askedCount = allQs.filter((q) => (notes.my_q_state ?? {})[q.id]?.asked).length;

  // "Questions to Ask" parsed from prep markdown
  const prepAskText = prepMd ? parsePrepSection(prepMd, "Questions to Ask") : "";
  const prepAskItems = prepAskText
    .split("\n")
    .map((l) => l.replace(/^\d+\.\s+/, "").replace(/^[-*]\s+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
  const prepAskAsked = prepAskItems.filter((_, i) => (notes.my_q_state ?? {})[`prep-ask-${i}`]?.asked).length;

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

        {/* Overview */}
        {tab === "Overview" && (
          <div className="flex flex-col gap-3">

            {/* Role at a Glance — JD */}
            {app.job_description && (
              <RoleGlanceCard company={app.company} jobTitle={app.job_title} jd={app.job_description} />
            )}

            {/* Generate / regenerate controls */}
            {!showPrepOptions && !generatingPrep && (
              <div className="flex gap-1.5 justify-end">
                {prepMd && <button className={pillBtnCls()} onClick={copyClaudePrompt}>{copying ? "Copied" : "Copy prompt"}</button>}
                <button className={pillBtnCls(!prepMd)} onClick={() => setShowPrepOptions(true)}>
                  {prepMd ? "Regenerate" : "Generate prep"}
                </button>
              </div>
            )}
            {showPrepOptions && (
              <SectionCard title="Generate prep">
                <div className="flex flex-col gap-3">
                  <div>
                    <div className={sectionLabelCls}>Round</div>
                    <div className="flex gap-1 flex-wrap">
                      {PREP_ROUNDS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRound(r)}
                          className={`text-[11px] font-medium py-1 px-2.5 rounded-[6px] cursor-pointer font-shell ${
                            round === r ? "border-none bg-custom text-white" : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className={sectionLabelCls}>Interviewer</div>
                    <div className="flex gap-1 flex-wrap">
                      {PREP_INTERVIEWERS.map((iv) => (
                        <button
                          key={iv}
                          onClick={() => setInterviewer(iv)}
                          className={`text-[11px] font-medium py-1 px-2.5 rounded-[6px] cursor-pointer font-shell ${
                            interviewer === iv ? "border-none bg-custom text-white" : "border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
                          }`}
                        >
                          {iv}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className={sectionLabelCls}>Focus skills <span className="normal-case font-normal">(optional)</span></div>
                    <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Python, system design, Kubernetes" className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none" />
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    {prepMd && <button className={pillBtnCls()} onClick={() => setShowPrepOptions(false)}>Cancel</button>}
                    <button className={pillBtnCls()} onClick={copyClaudePrompt}>{copying ? "Copied" : "Copy prompt for Claude"}</button>
                    <button className={`${pillBtnCls(true)} flex-1 justify-center`} onClick={generatePrep}>
                      {prepMd ? "Regenerate with Ollama" : "Generate with Ollama"}
                    </button>
                  </div>
                  <span className={mutedTextCls("11px")}>
                    <strong>Claude</strong> web-researches the company; <strong>Ollama</strong> runs offline from the JD.
                  </span>
                </div>
              </SectionCard>
            )}

            {generatingPrep && (
              <div className={`text-center py-5 ${mutedTextCls()}`}>
                Generating… (this may take a minute)
              </div>
            )}

            {!generatingPrep && prepMd && (
              <>
                {/* Editable prep sections — talking points for during the interview */}
                {(["Introduction Script", "Common Questions", "Job-Specific Questions"] as const).map((section) => (
                  <EditablePrepSection
                    key={section}
                    title={section}
                    value={parsePrepSection(prepMd, section)}
                    onChange={(v) => editSection(section, v)}
                    saveState={prepSaveState}
                  />
                ))}
              </>
            )}

            {!generatingPrep && !prepMd && !showPrepOptions && (
              <div className={`text-center py-12 px-5 ${mutedTextCls()}`}>
                No prep yet — generate one above.
              </div>
            )}
          </div>
        )}

        {/* Questions — "to ask them" from prep + general prep categories */}
        {tab === "Questions" && (
          <div className="flex flex-col gap-2.5">
            {/* Total asked counter */}
            {(allQs.length > 0 || prepAskItems.length > 0) && (
              <div className={monoMutedCls("11px")}>
                {askedCount + prepAskAsked}/{allQs.length + prepAskItems.length} asked
              </div>
            )}

            {/* "Questions to Ask" from prep — collapsible */}
            {prepAskItems.length > 0 && (() => {
              const isCollapsed = prepAskCollapsed;
              return (
                <div className={cardBoxCls}>
                  <div
                    className={`${cardHeaderBarCls(isCollapsed, "bg-custom-l")} cursor-pointer`}
                    onClick={() => setPrepAskCollapsed((v) => !v)}
                  >
                    <span className="text-[10px] text-custom leading-none">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="flex-1 text-[12px] font-semibold text-custom-d font-shell">
                      Specific questions for this interview
                    </span>
                    <span className="text-[10px] font-mono text-custom-d">
                      {prepAskAsked}/{prepAskItems.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="py-1 px-3">
                      {prepAskItems.map((q, i) => {
                        const key = `prep-ask-${i}`;
                        const state = (notes.my_q_state ?? {})[key] ?? { asked: false, note: "" };
                        const isLast = i === prepAskItems.length - 1;
                        return (
                          <div key={key} className={`py-[7px] ${isLast ? "" : "border-b-[0.5px] border-border-tertiary"}`}>
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => {
                                  const cur = (notes.my_q_state ?? {})[key] ?? { asked: false, note: "" };
                                  update({ my_q_state: { ...(notes.my_q_state ?? {}), [key]: { ...cur, asked: !cur.asked } } });
                                }}
                                className={`w-[15px] h-[15px] rounded-[4px] shrink-0 mt-0.5 cursor-pointer flex items-center justify-center ${
                                  state.asked ? "border-none bg-badge-interview-fg" : "border-[0.5px] border-border-tertiary bg-transparent"
                                }`}
                              >
                                {state.asked && <Check size={9} color="#fff" />}
                              </button>
                              <span className={`flex-1 text-[12px] font-shell ${state.asked ? "text-text-tertiary line-through" : "text-text-secondary"}`}>
                                {q}
                              </span>
                            </div>
                            <GrowTextarea
                              value={state.note}
                              onChange={(v) => {
                                const cur = (notes.my_q_state ?? {})[key] ?? { asked: false, note: "" };
                                update({ my_q_state: { ...(notes.my_q_state ?? {}), [key]: { ...cur, note: v } } });
                              }}
                              placeholder="Their answer…"
                              className="ml-[23px] mt-0.5 !text-[12px]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* General prep categories — each collapsible, sortable */}
            <DndContext sensors={compCatSensors} collisionDetection={closestCenter} onDragEnd={reorderCompCats}>
              <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {cats.map((cat) => {
                  const isCollapsed = catCollapsed[cat.id] === true;
                  const catAsked = cat.questions.filter((q) => (notes.my_q_state ?? {})[q.id]?.asked).length;
                  return (
                    <SortableItem key={cat.id} id={cat.id}>
                      {(grip) => (
                        <div className={cardBoxCls}>
                          <div className={cardHeaderBarCls(isCollapsed)}>
                            {grip}
                            <button
                              onClick={() => setCatCollapsed((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                              className="bg-transparent border-none cursor-pointer text-text-tertiary pr-0.5 shrink-0 text-[10px] leading-none"
                            >
                              {isCollapsed ? "▶" : "▼"}
                            </button>
                            <span className="flex-1 text-[12px] font-medium font-shell">{cat.name}</span>
                            {cat.questions.length > 0 && (
                              <span className={monoMutedCls("10px")}>
                                {catAsked}/{cat.questions.length}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && (
                            <div className="py-1 px-3">
                              {cat.questions.map((q, qi) => {
                                const state = (notes.my_q_state ?? {})[q.id] ?? { asked: false, note: "" };
                                const isLast = qi === cat.questions.length - 1;
                                return (
                                  <div key={q.id} className={`py-[7px] ${isLast ? "" : "border-b-[0.5px] border-border-tertiary"}`}>
                                    <div className="flex items-start gap-2">
                                      <button
                                        onClick={() => toggleMyQ(q.id)}
                                        className={`w-[15px] h-[15px] rounded-[4px] shrink-0 mt-0.5 cursor-pointer flex items-center justify-center ${
                                          state.asked ? "border-none bg-badge-interview-fg" : "border-[0.5px] border-border-tertiary bg-transparent"
                                        }`}
                                      >
                                        {state.asked && <Check size={9} color="#fff" />}
                                      </button>
                                      <span className={`flex-1 text-[12px] font-shell ${state.asked ? "text-text-tertiary line-through" : "text-text-secondary"}`}>
                                        {q.text}
                                      </span>
                                    </div>
                                    <GrowTextarea
                                      value={state.note}
                                      onChange={(v) => setMyQNote(q.id, v)}
                                      placeholder="Their answer…"
                                      className="ml-[23px] mt-0.5 !text-[12px]"
                                    />
                                  </div>
                                );
                              })}
                              {cat.questions.length === 0 && (
                                <div className={`py-2 ${mutedTextCls("11px")}`}>
                                  No questions in this category.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
            {cats.length === 0 && prepAskItems.length === 0 && (
              <div className={`text-center p-8 ${mutedTextCls()}`}>
                No questions — generate prep to get role-specific questions, or add categories in General prep.
              </div>
            )}
          </div>
        )}

        {/* Anticipate — expected questions they'll ask + skill gaps */}
        {tab === "Anticipate" && (
          <div className="flex flex-col gap-3">
            {/* Expected questions from them + prepared answers */}
            <SectionCard title="Questions they might ask">
              {notes.questions.map((item, i) => (
                <div key={item.id} className="pb-2.5 border-b-[0.5px] border-border-tertiary mb-2.5">
                  <div className="flex gap-2 items-start">
                    <span className={`${monoMutedCls("11px")} mt-0.5 shrink-0 min-w-[16px]`}>{i + 1}.</span>
                    <GrowTextarea
                      value={item.q}
                      onChange={(v) => update({ questions: notes.questions.map((q) => (q.id === item.id ? { ...q, q: v } : q)) })}
                      placeholder="Question…"
                      className="font-medium !text-text-primary flex-1"
                    />
                    <button
                      onClick={() => update({ questions: notes.questions.filter((q) => q.id !== item.id) })}
                      className={`${iconBtnCls} hover:text-badge-passed-fg`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <GrowTextarea
                    value={item.a}
                    onChange={(v) => update({ questions: notes.questions.map((q) => (q.id === item.id ? { ...q, a: v } : q)) })}
                    placeholder="My prepared answer…"
                    className="ml-6 mt-1"
                  />
                </div>
              ))}
              <input
                value={newExpectedQ}
                onChange={(e) => setNewExpectedQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newExpectedQ.trim()) {
                    update({ questions: [...notes.questions, { id: uid(), q: newExpectedQ.trim(), a: "" }] });
                    setNewExpectedQ("");
                  }
                }}
                placeholder="Add expected question… (Enter)"
                className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none"
              />
            </SectionCard>

            {/* Skill gaps */}
            <SectionCard title="Skill gaps">
              {notes.gaps.map((gap) => (
                <div key={gap.id} className="flex items-start gap-2 pb-2 border-b-[0.5px] border-border-tertiary mb-2">
                  <button
                    title="Click to change severity"
                    onClick={() => update({ gaps: notes.gaps.map((g) => (g.id === gap.id ? { ...g, severity: SEVERITY_NEXT[g.severity] } : g)) })}
                    className={`w-2.5 h-2.5 rounded-full border-none cursor-pointer shrink-0 mt-1 ${SEVERITY_DOT_CLS[gap.severity]}`}
                  />
                  <div className="flex-1 flex flex-col gap-0.5">
                    <input
                      value={gap.skill}
                      onChange={(e) => update({ gaps: notes.gaps.map((g) => (g.id === gap.id ? { ...g, skill: e.target.value } : g)) })}
                      placeholder="Skill…"
                      className="text-[12px] font-medium bg-transparent border-none outline-none text-text-primary font-shell w-full"
                    />
                    <GrowTextarea
                      value={gap.note}
                      onChange={(v) => update({ gaps: notes.gaps.map((g) => (g.id === gap.id ? { ...g, note: v } : g)) })}
                      placeholder="Notes on this gap…"
                    />
                  </div>
                  <button
                    onClick={() => update({ gaps: notes.gaps.filter((g) => g.id !== gap.id) })}
                    className={`${iconBtnCls} hover:text-badge-passed-fg`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <input
                value={newGapSkill}
                onChange={(e) => setNewGapSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGapSkill.trim()) {
                    update({ gaps: [...notes.gaps, { id: uid(), skill: newGapSkill.trim(), severity: "amber", note: "" }] });
                    setNewGapSkill("");
                  }
                }}
                placeholder="Add skill gap… (Enter, starts amber)"
                className="w-full text-[12px] py-[5px] px-2 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-shell outline-none"
              />
            </SectionCard>
          </div>
        )}

        {/* Background — company research, weak spots, salary prep notes */}
        {tab === "Background" && (
          <div className="flex flex-col gap-3">
            {!generatingPrep && prepMd && (
              <>
                {/* Company Analysis — read-only rendered markdown */}
                <PrepDisplay
                  markdown={prepMd}
                  exclude={["Questions to Ask", "Introduction Script", "Common Questions", "Technical Questions", "Job-Specific Questions", "Weak Spots", "Salary & Negotiation"]}
                />

                {/* Editable prep sections */}
                {(["Weak Spots", "Salary & Negotiation"] as const).map((section) => (
                  <EditablePrepSection
                    key={section}
                    title={section}
                    value={parsePrepSection(prepMd, section)}
                    onChange={(v) => editSection(section, v)}
                    saveState={prepSaveState}
                  />
                ))}
              </>
            )}

            {!generatingPrep && !prepMd && (
              <div className={`text-center py-12 px-5 ${mutedTextCls()}`}>
                No prep yet — generate one from the Overview tab.
              </div>
            )}
          </div>
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

// ─── Prep generation constants ─────────────────────────────────────────────────

const PREP_ROUNDS = ["Screening", "Technical", "Final"] as const;
const PREP_INTERVIEWERS = ["HR / Recruiter", "Hiring Manager", "Technical Peer"] as const;

// ─── Shared small components ───────────────────────────────────────────────────

function RoleGlanceCard({ company, jobTitle, jd }: { company: string; jobTitle: string; jd: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(`${company} - ${jobTitle}\n\n${jd}`);
    toast.success("Copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`${cardBoxCls} bg-background-primary`}>
      <div
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center justify-between py-[9px] px-[13px] cursor-pointer select-none ${
          expanded ? "border-b-[0.5px] border-border-tertiary" : ""
        }`}
      >
        <span className="text-[12px] font-medium font-shell">Role at a Glance</span>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopy}
            title="Copy company, job title and description"
            className={`${iconBtnCls} hover:text-text-primary ${copied ? "text-text-primary" : ""}`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <span className="text-[10px] text-text-tertiary">{expanded ? "▲ collapse" : "▼ expand"}</span>
        </div>
      </div>
      {expanded && (
        <div className="py-2.5 px-[13px] text-[13px] leading-[1.7] text-text-secondary font-shell max-h-[320px] overflow-y-auto">
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong className="text-text-primary font-semibold">{children}</strong>,
              li: ({ children }) => <li className="mb-[3px]">{children}</li>,
              p: ({ children }) => <p className="mb-1.5">{children}</p>,
              h1: ({ children }) => <div className="text-[12px] font-semibold text-text-primary mt-2.5 mb-1 font-shell">{children}</div>,
              h2: ({ children }) => <div className="text-[12px] font-semibold text-text-primary mt-2.5 mb-1 font-shell">{children}</div>,
              h3: ({ children }) => <div className="text-[11px] font-semibold text-text-secondary mt-2 mb-[3px] font-shell">{children}</div>,
            }}
          >
            {jd}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function EditablePrepSection({
  title,
  value,
  onChange,
  saveState,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  saveState: SaveState;
}) {
  return (
    <div className={`${cardBoxCls} bg-background-primary`}>
      <div className="flex items-center justify-between py-[9px] px-[13px] border-b-[0.5px] border-border-tertiary">
        <span className="text-[12px] font-medium font-shell">{title}</span>
        <SaveIndicator state={saveState} />
      </div>
      <div className="pt-1 px-[13px] pb-3">
        <GrowTextarea
          value={value}
          onChange={onChange}
          placeholder="No content yet — generate prep to populate."
          className="leading-[1.75]"
        />
      </div>
    </div>
  );
}

// ─── Prep display (markdown → section cards) ───────────────────────────────────

function PrepDisplay({ markdown, exclude = [] }: { markdown: string; exclude?: string[] }) {
  const raw = markdown.startsWith("## ") ? markdown : markdown.replace(/^[^#]*(?=## )/, "");
  const sections = raw.split(/(?=^## )/m).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {sections.map((sec) => {
        const nl = sec.indexOf("\n");
        const header = nl === -1 ? sec : sec.slice(0, nl);
        const body = nl === -1 ? "" : sec.slice(nl + 1).trim();
        const title = header.replace(/^#+\s*/, "");
        if (exclude.some((ex) => title.toLowerCase().includes(ex.toLowerCase()))) return null;
        return (
          <div key={title} className="border-[0.5px] border-border-tertiary rounded-card overflow-hidden">
            {/* Section header with amber left bar */}
            <div className="flex items-center gap-2.5 py-[9px] px-3.5 border-b-[0.5px] border-border-tertiary bg-custom-l">
              <div className="w-[3px] h-[14px] rounded-[2px] bg-custom shrink-0" />
              <span className="text-[12px] font-semibold text-custom-d font-shell tracking-[0.01em]">
                {title}
              </span>
            </div>
            {/* Section body */}
            <div className="py-3 px-3.5 text-[13px] leading-[1.75] text-text-secondary font-shell">
              <ReactMarkdown
                components={{
                  strong: MdStrong,
                  h3: ({ children }: { children?: React.ReactNode }) => (
                    <div className="text-[12px] font-semibold text-text-primary mt-3 mb-1 font-shell">
                      {children}
                    </div>
                  ),
                  li: ({ children }) => {
                    const kids = React.Children.toArray(children);
                    const first = kids[0];
                    if (React.isValidElement<{ children?: React.ReactNode }>(first) && first.type === MdStrong && kids.length > 1) {
                      return (
                        <li className="mb-2">
                          <div className="font-semibold text-text-primary mb-[3px] font-shell">
                            {first.props.children}
                          </div>
                          <div>{kids.slice(1)}</div>
                        </li>
                      );
                    }
                    return <li className="mb-1">{children}</li>;
                  },
                  p: ({ children }) => {
                    const kids = React.Children.toArray(children);
                    const first = kids[0];
                    if (React.isValidElement<{ children?: React.ReactNode }>(first) && first.type === MdStrong && kids.length > 1) {
                      return (
                        <div className="mb-2">
                          <div className="font-semibold text-text-primary mb-[3px] font-shell">
                            {first.props.children}
                          </div>
                          <div>{kids.slice(1)}</div>
                        </div>
                      );
                    }
                    return <p className="mb-2">{children}</p>;
                  },
                }}
              >
                {body}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}

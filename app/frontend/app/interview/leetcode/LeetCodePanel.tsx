"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import {
  cardBoxCls, cardHeaderBarCls, mutedTextCls, monoMutedCls, sectionLabelCls,
} from "@/components/ui-kit";
import { TabBar } from "../shared";
import { CATEGORIES, PROBLEMS, type Category, type Difficulty, type LeetCodeProblem } from "./problems";

// ─── LeetCode reference panel ───────────────────────────────────────────────────
// Static, read-only bank of famous problems grouped by pattern, with Java / Python /
// TypeScript solutions per problem.

const LANGS = ["Java", "Python", "TypeScript"] as const;
type Lang = (typeof LANGS)[number];

const DIFFICULTY_FILTERS = ["All", "Easy", "Medium", "Hard"] as const;

const DONE_STORAGE_KEY = "leetcode.done";

function difficultyBadgeCls(d: Difficulty): string {
  switch (d) {
    case "Easy":   return "bg-badge-offer-bg text-badge-offer-fg";
    case "Medium": return "bg-badge-analyzed-bg text-badge-analyzed-fg";
    case "Hard":   return "bg-badge-passed-bg text-badge-passed-fg";
  }
}

function solutionFor(problem: LeetCodeProblem, lang: Lang): string {
  switch (lang) {
    case "Java":       return problem.solutions.java;
    case "Python":     return problem.solutions.python;
    case "TypeScript": return problem.solutions.typescript;
  }
}

export function LeetCodePanel() {
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());

  // Load saved progress after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DONE_STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only hydration from localStorage (cannot run during SSR)
        if (parsed.length) setDone(new Set(parsed));
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify([...done]));
  }, [done]);

  const toggleDone = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (difficulty !== "All" && p.difficulty !== difficulty) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.pattern.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [difficulty, query]);

  const byCategory = useMemo(() => {
    const map = new Map<Category, LeetCodeProblem[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const p of filtered) map.get(p.category)?.push(p);
    return map;
  }, [filtered]);

  const visibleCategories = CATEGORIES.filter((cat) => (byCategory.get(cat)?.length ?? 0) > 0);

  const toggleCategory = (cat: Category) =>
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const allCollapsed = visibleCategories.length > 0 && visibleCategories.every((c) => collapsedCategories.has(c));

  const toggleAll = () =>
    setCollapsedCategories(allCollapsed ? new Set() : new Set(visibleCategories));

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center justify-between py-[11px] px-4 border-b-[0.5px] border-border-tertiary gap-2.5 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[14px] font-medium font-shell">LeetCode</span>
          <span className={monoMutedCls("10px")}>{filtered.length}</span>
          <span className={monoMutedCls("10px")}>· {done.size}/{PROBLEMS.length} done</span>

          <div className="relative">
            <Search size={12} className="absolute left-[8px] top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="text-[11px] py-[5px] pr-2.5 pl-6 rounded-full border-[0.5px] border-border-tertiary bg-background-secondary text-text-primary font-shell outline-none w-[140px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <TabBar tabs={[...DIFFICULTY_FILTERS]} active={difficulty} onChange={(t) => setDifficulty(t as typeof difficulty)} />
          <button
            onClick={toggleAll}
            className="text-[11px] font-medium py-1 px-2.5 rounded-full cursor-pointer font-shell border-[0.5px] border-border-tertiary bg-transparent text-text-secondary"
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-3.5 px-4 flex flex-col gap-4 min-h-0">
        {visibleCategories.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            problems={byCategory.get(cat) ?? []}
            collapsed={collapsedCategories.has(cat)}
            onToggle={() => toggleCategory(cat)}
            done={done}
            onToggleDone={toggleDone}
          />
        ))}
        {visibleCategories.length === 0 && (
          <div className={`text-center p-8 ${mutedTextCls()}`}>No problems match this filter.</div>
        )}
      </div>
    </>
  );
}

// ─── Category section ───────────────────────────────────────────────────────────

function CategorySection({
  category, problems, collapsed, onToggle, done, onToggleDone,
}: {
  category: Category;
  problems: LeetCodeProblem[];
  collapsed: boolean;
  onToggle: () => void;
  done: Set<string>;
  onToggleDone: (id: string) => void;
}) {
  const doneCount = problems.filter((p) => done.has(p.id)).length;
  return (
    <div className="shrink-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full bg-transparent border-none cursor-pointer p-0 mb-2"
      >
        <span className="text-[10px] leading-none text-text-tertiary shrink-0">{collapsed ? "▶" : "▼"}</span>
        <span className={`${sectionLabelCls} !mb-0 leading-none`}>{category}</span>
        <span className={`${monoMutedCls("10px")} shrink-0 leading-none`}>{doneCount}/{problems.length}</span>
        <div className="flex-1 h-[0.5px] bg-border-tertiary ml-1" />
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-2.5">
          {problems.map((problem) => (
            <ProblemCard
              key={problem.id}
              problem={problem}
              done={done.has(problem.id)}
              onToggleDone={() => onToggleDone(problem.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Problem card ────────────────────────────────────────────────────────────────

function ProblemCard({
  problem, done, onToggleDone,
}: {
  problem: LeetCodeProblem;
  done: boolean;
  onToggleDone: () => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [lang, setLang] = useState<Lang>("Java");

  return (
    <div className={`${cardBoxCls} shrink-0`}>
      {/* Header */}
      <div className={cardHeaderBarCls(collapsed)}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="bg-transparent border-none cursor-pointer text-text-tertiary pr-0.5 shrink-0 text-[10px] leading-none"
        >
          {collapsed ? "▶" : "▼"}
        </button>
        <input
          type="checkbox"
          checked={done}
          onChange={onToggleDone}
          title="Mark as done"
          className="cursor-pointer accent-custom shrink-0"
        />
        <span className={`${monoMutedCls("11px")} shrink-0`}>#{problem.number}</span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={`flex-1 text-left text-[12px] font-medium bg-transparent border-none cursor-pointer font-shell p-0 ${
            done ? "text-text-tertiary line-through" : "text-text-primary"
          }`}
        >
          {problem.title}
        </button>
        <span className={`text-[9px] font-medium py-0.5 px-1.5 rounded-full shrink-0 ${difficultyBadgeCls(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
        <span className={`${monoMutedCls("10px")} shrink-0 hidden sm:inline`}>{problem.pattern}</span>
        <a
          href={problem.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on LeetCode"
          className="bg-transparent border-none cursor-pointer text-text-tertiary p-0.5 shrink-0 flex items-center hover:text-custom"
        >
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="py-3 px-3.5 flex flex-col gap-3">
          <Field label="Problem" body={problem.prompt} />
          <Field label="Approach" body={problem.approach} />

          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <TabBar tabs={[...LANGS]} active={lang} onChange={(t) => setLang(t as Lang)} />
              <span className={`${monoMutedCls("10px")} ml-auto`}>{problem.complexity}</span>
            </div>
            <pre className="m-0 p-3 rounded-card bg-background-secondary border-[0.5px] border-border-tertiary overflow-x-auto text-[12px] leading-[1.55] font-mono text-text-primary [font-variant-ligatures:none]">
              <code>{solutionFor(problem, lang)}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-text-tertiary font-shell mb-1">
        {label}
      </div>
      <p className="text-[12px] leading-[1.6] text-text-secondary font-shell m-0">{body}</p>
    </div>
  );
}

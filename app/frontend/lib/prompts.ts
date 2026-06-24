// app/frontend/lib/prompts.ts

/** Copied by the "Copy prompt for Claude" buttons on the Setup and Skills pages. */
export const SKILLS_PROMPT =
  'Build my skills inventory from my résumé — follow the "process my skills" steps in ' +
  "CLAUDE.md (read the master résumé, interview me on anything ambiguous, then POST " +
  "/api/resume/skills/merge).";

/** Copied by the parse-stage "Copy prompt for Claude" button on the Setup page.
 *  One combined parse + skills flow (see "process my profile" in CLAUDE.md). */
export function profilePrompt(language: "en" | "de"): string {
  const file = language === "de" ? "data/resume_raw_de.txt" : "data/resume_raw_en.txt";
  const master = language === "de" ? "resume_master_de.md" : "resume_master.md";
  return (
    `Process my profile — follow the "process my profile" steps in CLAUDE.md. ` +
    `Read ${file} (the raw text of my uploaded résumé), structure it into ${master} ` +
    `without inventing anything, PUT it to /api/resume/master, then build my skills ` +
    `inventory via the "process my skills" steps and PUT /api/resume/skills/merge.`
  );
}

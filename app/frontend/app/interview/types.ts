// ─── Types ────────────────────────────────────────────────────────────────────

export interface Interview {
  id: string;
  company: string;
  job_title: string;
  job_description: string | null;
  language: string;
  status: string;
  interview_date: string | null;
  interview_notes_json: string | null;
  interview_prep_md?: string | null;
}

export interface QAItem {
  id: string;
  q_en: string; q_de: string;
  a_en: string; a_de: string;
}

export interface MyQuestion {
  id: string;
  text: string;
  done: boolean;
}

export interface QuestionCategory {
  id: string;
  name: string;
  questions: MyQuestion[];
}

export interface TechQAGroup {
  id: string;
  name: string;
  questions: QAItem[];
}

export interface GeneralPrep {
  intro: { en: string; de: string };
  common_qa: QAItem[];
  behavioral_qa: QAItem[];
  my_questions: MyQuestion[];
  my_questions_notes: string;
  question_categories: QuestionCategory[];
  technical_qa_groups: TechQAGroup[];
}

export interface InterviewNotes {
  overview: string;
  red_flags: string[];
  questions: { id: string; q: string; a: string }[];
  gaps: { id: string; skill: string; severity: "red" | "amber" | "green"; note: string }[];
  salary: { ask: string; market: string; floor: string; notes: string };
  notes: string;
  my_q_state: Record<string, { asked: boolean; note: string }>;
}

export type DateTimeValue = { year: number; month: number; day: number; hour: number; minute: number };

// ─── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_PREP: GeneralPrep = {
  intro: { en: "", de: "" },
  common_qa: [],
  behavioral_qa: [],
  my_questions: [],
  my_questions_notes: "",
  question_categories: [
    {
      id: "cat-team",
      name: "Team & Process",
      questions: [
        { id: "q-tp-1", text: "How does the team currently use AI tools in daily development?", done: false },
        { id: "q-tp-2", text: "What does a typical sprint or work week look like for this team?", done: false },
        { id: "q-tp-3", text: "How is technical debt managed alongside feature delivery?", done: false },
        { id: "q-tp-4", text: "How are architecture decisions made — top-down or team-driven?", done: false },
        { id: "q-tp-5", text: "How much ownership does an engineer have over architecture decisions?", done: false },
        { id: "q-tp-6", text: "How does the team handle disagreements on technical direction?", done: false },
        { id: "q-tp-7", text: "What does the code review process look like?", done: false },
        { id: "q-tp-8", text: "How do you measure engineering productivity?", done: false },
      ],
    },
    {
      id: "cat-role",
      name: "Role & Onboarding",
      questions: [
        { id: "q-ro-1", text: "What does the first 3 months look like for someone in this role?", done: false },
        { id: "q-ro-2", text: "What would success look like at 6 months and 12 months?", done: false },
        { id: "q-ro-3", text: "Who would I be working most closely with day-to-day?", done: false },
        { id: "q-ro-4", text: "What are the biggest technical challenges the team is facing right now?", done: false },
        { id: "q-ro-5", text: "Is there a specific problem you're hoping this hire will solve?", done: false },
        { id: "q-ro-6", text: "How did this role come about — is it new or a replacement?", done: false },
      ],
    },
    {
      id: "cat-ai",
      name: "AI & Technology",
      questions: [
        { id: "q-ai-1", text: "What AI tools are part of the standard developer workflow here?", done: false },
        { id: "q-ai-2", text: "How does the team evaluate new AI tools or frameworks before adopting them?", done: false },
        { id: "q-ai-3", text: "What does the current AI/LLM stack look like, and what's on the roadmap?", done: false },
        { id: "q-ai-4", text: "How do you handle GDPR compliance with AI-generated outputs?", done: false },
      ],
    },
    {
      id: "cat-growth",
      name: "Growth & Culture",
      questions: [
        { id: "q-gc-1", text: "What does career growth look like here for a senior engineer?", done: false },
        { id: "q-gc-2", text: "How does the company support continued learning and upskilling?", done: false },
        { id: "q-gc-3", text: "What's the biggest challenge someone in this role typically faces in the first year?", done: false },
        { id: "q-gc-4", text: "What do people tend to enjoy most about working here?", done: false },
        { id: "q-gc-5", text: "What do people find most frustrating — if you're honest?", done: false },
        { id: "q-gc-6", text: "How has the team changed in the last 12 months?", done: false },
      ],
    },
    {
      id: "cat-practical",
      name: "Practical",
      questions: [
        { id: "q-pr-1", text: "What's the remote/office balance like in practice, not just on paper?", done: false },
        { id: "q-pr-2", text: "How are performance reviews structured?", done: false },
        { id: "q-pr-3", text: "What does the interview process look like from here?", done: false },
        { id: "q-pr-4", text: "When are you looking to make a decision?", done: false },
      ],
    },
  ],
  technical_qa_groups: [],
};

export const DEFAULT_NOTES: InterviewNotes = {
  overview: "",
  red_flags: [],
  questions: [],
  gaps: [],
  salary: { ask: "", market: "", floor: "", notes: "" },
  notes: "",
  my_q_state: {},
};

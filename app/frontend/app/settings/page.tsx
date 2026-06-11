"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/ui-kit";

const ROLE_LABELS: Record<string, { label: string; hint: string }> = {
  parser:   { label: "Parser",   hint: "Resume parsing — high context recommended" },
  writer:   { label: "Writer",   hint: "Resume tailoring, cover letter, interview prep" },
  reviewer: { label: "Reviewer", hint: "Multi-persona review — runs 3 calls in sequence" },
  research: { label: "Research", hint: "Company tone + JD analysis — web-grounded models work well here" },
};

type Theme    = "light" | "system" | "dark";
type FontSize = "normal" | "large" | "xl";

const FONT_ZOOM: Record<FontSize, string>   = { normal: "1", large: "1.15", xl: "1.3" };
const FONT_LABELS: Record<FontSize, string> = { normal: "Normal", large: "Large", xl: "XL" };

function applyFontSize(size: FontSize) {
  localStorage.setItem("fontSize", size);
  document.documentElement.style.zoom = FONT_ZOOM[size];
}

function applyTheme(t: Theme) {
  if (t === "dark") {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  } else if (t === "light") {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
  } else {
    localStorage.removeItem("theme");
    document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[5px] text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell">
      {children}
    </div>
  );
}

function InfoText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-text-tertiary font-shell mt-1">{children}</p>;
}

function SegmentGroup<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex border-[0.5px] border-border-tertiary rounded-[6px] overflow-hidden w-fit">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-[12px] font-medium py-[5px] px-3.5 cursor-pointer font-shell border-none ${
            value === o.value ? "bg-amb text-white" : "bg-transparent text-text-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SaveBtn({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center text-[12px] font-medium py-1.5 px-3.5 rounded-full border-none bg-amb text-white font-shell ${
        loading ? "opacity-60 cursor-default" : "opacity-100 cursor-pointer"
      }`}
    >
      {loading ? "Saving…" : label}
    </button>
  );
}

const inputCls = "w-full text-[13px] py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary font-mono outline-none";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [theme, setTheme]       = useState<Theme>("system");
  const [fontSize, setFontSize] = useState<FontSize>("normal");

  const [persona, setPersona]           = useState("");
  const [savingPersona, setSavingPersona] = useState(false);

  const [goal, setGoal]               = useState("");
  const [savingGoal, setSavingGoal]   = useState(false);

  const [models, setModels]               = useState<Record<string, string>>({});
  const [savingModels, setSavingModels]   = useState(false);

  const [apiKeys, setApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    setTheme(stored ?? "system");
    const storedFs = localStorage.getItem("fontSize") as FontSize | null;
    setFontSize(storedFs ?? "normal");
  }, []);

  useEffect(() => {
    api.get("/api/resume/persona").then((r) => { if (r?.content) setPersona(r.content); }).catch(() => {});
    api.get("/api/settings/goal").then((r) => { if (r?.content) setGoal(r.content); }).catch(() => {});
    api.get("/api/settings/models").then((r) => { if (r) setModels(r); }).catch(() => {});
    api.get("/api/settings/api-keys").then((r) => { if (r) setApiKeys(r); }).catch(() => {});
  }, []);

  const savePersona = async () => {
    setSavingPersona(true);
    await api.put("/api/resume/persona", { content: persona });
    toast.success("Persona saved.");
    setSavingPersona(false);
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    await api.put("/api/settings/goal", { content: goal });
    toast.success("Career goal saved.");
    setSavingGoal(false);
  };

  const saveModels = async () => {
    setSavingModels(true);
    const res = await api.put("/api/settings/models", models);
    if (res?.saved) toast.success("Model assignments saved.");
    else toast.error("Failed to save model assignments.");
    setSavingModels(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="py-2.5 px-5 border-b-[0.5px] border-border-tertiary shrink-0">
        <span className="text-[13px] font-semibold font-shell">Settings</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-6 px-5">
        <div className="max-w-[680px] mx-auto flex flex-col gap-3.5">

          {/* Appearance */}
          <SectionCard title="Appearance">
            <div className="flex flex-col gap-3.5">
              <div>
                <Label>Theme</Label>
                <SegmentGroup<Theme>
                  value={theme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "system", label: "System" },
                    { value: "dark", label: "Dark" },
                  ]}
                  onChange={(t) => { setTheme(t); applyTheme(t); }}
                />
              </div>
              <div>
                <Label>Font size</Label>
                <SegmentGroup<FontSize>
                  value={fontSize}
                  options={(["normal", "large", "xl"] as FontSize[]).map((s) => ({ value: s, label: FONT_LABELS[s] }))}
                  onChange={(s) => { setFontSize(s); applyFontSize(s); }}
                />
              </div>
            </div>
          </SectionCard>

          {/* Model assignments */}
          <SectionCard title="Model Assignments">
            <div className="flex flex-col gap-3.5">
              <InfoText>
                Use <code className="font-mono">provider/model</code> format. Examples:{" "}
                <code className="font-mono">anthropic/claude-sonnet-4-6</code>,{" "}
                <code className="font-mono">ollama/qwen3.6:latest</code>,{" "}
                <code className="font-mono">perplexity/sonar</code>
              </InfoText>
              <div className="grid grid-cols-2 gap-3.5">
                {Object.entries(ROLE_LABELS).map(([role, { label, hint }]) => (
                  <div key={role}>
                    <Label>{label}</Label>
                    <input
                      id={`model-${role}`}
                      value={models[role] ?? ""}
                      onChange={(e) => setModels((m) => ({ ...m, [role]: e.target.value }))}
                      placeholder="e.g. ollama/qwen3.6:latest"
                      className={inputCls}
                    />
                    <InfoText>{hint}</InfoText>
                  </div>
                ))}
              </div>
              <SaveBtn onClick={saveModels} loading={savingModels} label="Save Model Assignments" />
            </div>
          </SectionCard>

          {/* API Keys */}
          <SectionCard title="API Keys">
            <div className="flex flex-col gap-2.5">
              <InfoText>
                API keys are read from <code className="font-mono">.env</code> in the repo root.
                Copy <code className="font-mono">.env.example</code> to{" "}
                <code className="font-mono">.env</code> and fill in the keys you need, then restart the backend.
              </InfoText>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(apiKeys).map(([provider, isSet]) => (
                  <div key={provider} className="flex items-center gap-1.5">
                    <span className={`text-[12px] font-mono ${isSet ? "text-badge-interview-fg" : "text-text-tertiary"}`}>
                      {isSet ? "✓" : "○"}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium font-shell capitalize">{provider}</span>
                      <span className="text-[10px] text-text-tertiary font-shell">{isSet ? "set" : "not set"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Career goal */}
          <SectionCard title="Career Goal" hint="optional">
            <div className="flex flex-col gap-2.5">
              <InfoText>
                Describe where you want to take your career. Each job analysis will include a goal alignment signal —{" "}
                <strong className="text-badge-interview-fg">aligns</strong>,{" "}
                <strong className="text-text-tertiary">neutral</strong>, or{" "}
                <strong className="text-amb-d">detours</strong>{" "}
                — based on your stated direction and your recent approve/reject decisions.
              </InfoText>
              <textarea
                className="w-full py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary outline-none resize-y font-mono text-[12px] min-h-[160px]"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={`Example:\nMove from fullstack engineering toward AI/ML engineering roles.\nPrioritise: LLM-backed products, RAG systems, agentic tooling.\nDe-prioritise: pure frontend, e-commerce, Shopify, CMS work.\nOpen to: startup or scale-up, Munich or remote.`}
              />
              <SaveBtn onClick={saveGoal} loading={savingGoal} label="Save Career Goal" />
            </div>
          </SectionCard>

          {/* Reviewer persona */}
          <SectionCard title="Reviewer Persona">
            <div className="flex flex-col gap-2.5">
              <InfoText>
                Your personal standards, red lines, and tone preferences. This persona is always used as the
                obligated reviewer — it catches anything that does not sound like you or feels exaggerated
                compared to your actual resume.
              </InfoText>
              <textarea
                className="w-full py-[7px] px-2.5 rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary outline-none resize-y font-mono text-[12px] min-h-[280px]"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder={`Example:\n- I never claim to be a "leader" unless I had direct reports\n- I do not describe side projects as production systems\n- My writing is direct and never uses the word "passionate"\n- Flag any metric that isn't in my resume`}
              />
              <SaveBtn onClick={savePersona} loading={savingPersona} label="Save Persona" />
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}

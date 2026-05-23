"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/lib/api";

const ROLE_LABELS: Record<string, { label: string; hint: string }> = {
  parser: { label: "Parser", hint: "Resume parsing — high context recommended" },
  writer: { label: "Writer", hint: "Resume tailoring, cover letter, interview prep" },
  reviewer: { label: "Reviewer", hint: "Multi-persona review — runs 3 calls in sequence" },
  research: { label: "Research", hint: "Company tone + JD analysis — web-grounded models work well here" },
};

const PROVIDER_EXAMPLES: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  perplexity: "sonar",
  gemini: "gemini-2.5-flash",
  ollama: "qwen3.6:latest",
};

export default function SettingsPage() {
  const [persona, setPersona] = useState("");
  const [savingPersona, setSavingPersona] = useState(false);

  const [models, setModels] = useState<Record<string, string>>({});
  const [savingModels, setSavingModels] = useState(false);

  const [apiKeys, setApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get("/api/resume/persona").then((r) => { if (r?.content) setPersona(r.content); }).catch(() => {});
    api.get("/api/settings/models").then((r) => { if (r) setModels(r); }).catch(() => {});
    api.get("/api/settings/api-keys").then((r) => { if (r) setApiKeys(r); }).catch(() => {});
  }, []);

  const savePersona = async () => {
    setSavingPersona(true);
    await api.put("/api/resume/persona", { content: persona });
    toast.success("Persona saved.");
    setSavingPersona(false);
  };

  const saveModels = async () => {
    setSavingModels(true);
    const res = await api.put("/api/settings/models", models);
    if (res?.saved) toast.success("Model assignments saved.");
    else toast.error("Failed to save model assignments.");
    setSavingModels(false);
  };

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Model assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Model Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use <code className="text-xs bg-muted px-1 py-0.5 rounded">provider/model</code> format.
            Examples: <code className="text-xs bg-muted px-1 py-0.5 rounded">anthropic/claude-sonnet-4-6</code>,{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">ollama/qwen3.6:latest</code>,{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">perplexity/sonar</code>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(ROLE_LABELS).map(([role, { label, hint }]) => (
              <div key={role} className="space-y-1">
                <label htmlFor={`model-${role}`} className="text-sm font-medium">{label}</label>
                <input
                  id={`model-${role}`}
                  value={models[role] ?? ""}
                  onChange={(e) => setModels((m) => ({ ...m, [role]: e.target.value }))}
                  placeholder={`e.g. ollama/${PROVIDER_EXAMPLES.ollama}`}
                  className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
          <Button onClick={saveModels} disabled={savingModels}>
            {savingModels ? "Saving…" : "Save Model Assignments"}
          </Button>
        </CardContent>
      </Card>

      {/* API key status */}
      <Card>
        <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            API keys are read from <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> in the repo root.
            Copy <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.example</code> to{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> and fill in the keys you need, then restart the backend.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(apiKeys).map(([provider, isSet]) => (
              <div key={provider} className="flex items-center gap-2 text-sm">
                <span className={isSet ? "text-green-600" : "text-muted-foreground"}>
                  {isSet ? "✓" : "○"}
                </span>
                <span className="capitalize font-medium">{provider}</span>
                <span className="text-muted-foreground text-xs">{isSet ? "set" : "not set"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reviewer persona */}
      <Card>
        <CardHeader>
          <CardTitle>Your Reviewer Persona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Describe your personal standards, red lines, and tone preferences.
            This persona is always used as the obligated reviewer — it catches anything
            that does not sound like you or feels exaggerated compared to your actual resume.
          </p>
          <textarea
            className="w-full border rounded p-3 text-sm font-mono min-h-[300px] resize-y"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder={`Example:\n- I never claim to be a "leader" unless I had direct reports\n- I do not describe side projects as production systems\n- My writing is direct and never uses the word "passionate"\n- Flag any metric that isn't in my resume`}
          />
          <Button onClick={savePersona} disabled={savingPersona}>
            {savingPersona ? "Saving…" : "Save Persona"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

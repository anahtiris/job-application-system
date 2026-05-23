"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Skill {
  name: string;
  tier: number;
  evidence: string;
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIERS = [
  { value: 1, label: "Core",       color: "bg-green-100 text-green-800 border-green-200" },
  { value: 2, label: "Proficient", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: 3, label: "Familiar",   color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: 4, label: "Exposure",   color: "bg-muted text-muted-foreground border-border" },
];

function tierConfig(tier: number) {
  return TIERS.find((t) => t.value === tier) ?? TIERS[2];
}

// ── Skill row ─────────────────────────────────────────────────────────────────

function SkillRow({
  skill,
  onSave,
  onDelete,
  startEditing,
}: {
  skill: Skill;
  onSave: (updated: Skill) => void;
  onDelete: () => void;
  startEditing: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [name, setName] = useState(skill.name);
  const [tier, setTier] = useState(skill.tier);
  const [evidence, setEvidence] = useState(skill.evidence);

  const tc = tierConfig(tier);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), tier, evidence });
    setEditing(false);
  };

  const handleCancel = () => {
    setName(skill.name);
    setTier(skill.tier);
    setEvidence(skill.evidence);
    setEditing(false);
    if (startEditing && !skill.name) onDelete();
  };

  if (!editing) {
    return (
      <tr className="border-t hover:bg-muted/20">
        <td className="p-3 font-medium text-sm">{skill.name}</td>
        <td className="p-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tc.color}`}>
            {tc.label}
          </span>
        </td>
        <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">{skill.evidence || "—"}</td>
        <td className="p-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>Delete</Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-muted/20">
      <td className="p-3" colSpan={4}>
        <div className="space-y-3">
          <input
            autoFocus
            className="w-full border rounded px-3 py-1.5 text-sm bg-background font-medium"
            placeholder="Skill name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            {TIERS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTier(t.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors
                  ${tier === t.value ? t.color + " ring-1 ring-offset-1 ring-current" : "bg-background text-muted-foreground border-border hover:border-foreground/40"}`}
              >
                {t.value} — {t.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p><strong>Core:</strong> 3+ production projects, recent, owned end-to-end</p>
            <p><strong>Proficient:</strong> 2+ projects, contributed meaningfully, mostly independent</p>
            <p><strong>Familiar:</strong> 1 project or didn't own it, needs ramp-up</p>
            <p><strong>Exposure:</strong> tutorials only, never shipped, or 3+ years ago</p>
          </div>
          <textarea
            className="w-full border rounded px-3 py-1.5 text-sm bg-background min-h-[60px] resize-none"
            placeholder="Evidence — e.g. 5 years production at Deutsche Telekom, owned 3 microservices end-to-end"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>Save</Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/resume/skills").then((data) => {
      const raw = data?.skills ?? {};
      setSkills(Object.entries(raw).map(([name, s]: any) => ({ name, tier: s.tier, evidence: s.evidence ?? "" })));
      setLoading(false);
    });
  }, []);

  const persist = async (updated: Skill[]) => {
    const skillsObj = Object.fromEntries(updated.map((s) => [s.name, { tier: s.tier, evidence: s.evidence }]));
    await api.put("/api/resume/skills", { skills: skillsObj });
    toast.success("Skills saved.");
  };

  const handleSave = async (index: number, updated: Skill) => {
    const next = skills.map((s, i) => (i === index ? updated : s));
    setSkills(next);
    await persist(next);
  };

  const handleDelete = async (index: number) => {
    const next = skills.filter((_, i) => i !== index);
    setSkills(next);
    await persist(next);
  };

  const addSkill = () => {
    setSkills((prev) => [...prev, { name: "", tier: 2, evidence: "" }]);
  };

  if (loading) return <p className="p-10 text-muted-foreground">Loading…</p>;

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your honest skill tiers. The cover letter generator uses these to match proficiency language — never overclaiming.
          </p>
        </div>
        <Button onClick={addSkill}>+ Add Skill</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {skills.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">
              No skills yet. Add your first skill above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Skill</th>
                  <th className="text-left p-3 font-medium">Tier</th>
                  <th className="text-left p-3 font-medium">Evidence</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {skills.map((skill, i) => (
                  <SkillRow
                    key={`${skill.name}-${i}`}
                    skill={skill}
                    startEditing={!skill.name}
                    onSave={(updated) => handleSave(i, updated)}
                    onDelete={() => handleDelete(i)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1 border rounded-lg p-3 bg-muted/20">
        <p className="font-medium">How tiers affect generation:</p>
        <p><span className="text-green-700 font-medium">Core</span> → "shipped X across multiple projects", "owned end-to-end"</p>
        <p><span className="text-blue-700 font-medium">Proficient</span> → "worked with X across several projects", "comfortable independently"</p>
        <p><span className="text-amber-700 font-medium">Familiar</span> → "have worked with X", "gaining experience in"</p>
        <p><span className="text-muted-foreground font-medium">Exposure</span> → "exploring X", "in a side project", "recent interest in"</p>
      </div>
    </main>
  );
}

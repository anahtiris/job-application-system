"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SKILLS_PROMPT } from "@/lib/prompts";
import { inputCls as inputClsFn } from "@/components/ui-kit";

interface Skill { name: string; tier: number; evidence: string; needsReview?: boolean; }

function mapSkills(raw: Record<string, unknown>): Skill[] {
  return Object.entries(raw).map(([name, s]) => {
    const v = s as { tier: number; evidence?: string; needs_review?: boolean };
    return { name, tier: v.tier, evidence: v.evidence ?? "", needsReview: v.needs_review === true };
  });
}

const TIERS = [
  { value: 1, label: "Core",       cls: "bg-badge-interview-bg text-badge-interview-fg", outline: "outline-badge-interview-fg" },
  { value: 2, label: "Proficient", cls: "bg-badge-analyzed-bg text-badge-analyzed-fg",   outline: "outline-badge-analyzed-fg" },
  { value: 3, label: "Familiar",   cls: "bg-custom-l text-custom-d",                            outline: "outline-custom-d" },
  { value: 4, label: "Exposure",   cls: "bg-background-secondary text-text-tertiary",     outline: "outline-text-tertiary" },
];

function tierConf(tier: number) { return TIERS.find((t) => t.value === tier) ?? TIERS[2]; }

const inputCls = inputClsFn();

function btnCls(primary = true, disabled = false): string {
  const border = primary ? "border-none" : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-custom" : "bg-transparent";
  const color = primary ? "text-white" : "text-text-secondary";
  return `inline-flex items-center text-[12px] font-medium py-[5px] px-3 rounded-full font-shell ${border} ${bg} ${color} ${
    disabled ? "opacity-50 cursor-default" : "opacity-100 cursor-pointer"
  }`;
}

// ── Skill row ─────────────────────────────────────────────────────────────────

function SkillRow({
  skill, onSave, onDelete, startEditing,
}: {
  skill: Skill; onSave: (u: Skill) => void; onDelete: () => void; startEditing: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [name, setName]       = useState(skill.name);
  const [tier, setTier]       = useState(skill.tier);
  const [evidence, setEvidence] = useState(skill.evidence);
  const tc = tierConf(tier);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), tier, evidence });
    setEditing(false);
  };

  const handleCancel = () => {
    setName(skill.name); setTier(skill.tier); setEvidence(skill.evidence);
    setEditing(false);
    if (startEditing && !skill.name) onDelete();
  };

  const tierBadgeCls = (t: typeof TIERS[0], active: boolean): string =>
    `py-[3px] px-2.5 rounded-full text-[11px] font-medium cursor-pointer font-shell border-none outline-offset-1 ${
      active ? `${t.cls} outline outline-[1.5px] ${t.outline}` : "bg-background-secondary text-text-tertiary outline-none"
    }`;

  if (!editing) {
    return (
      <div className="grid grid-cols-[1fr_110px_1fr_88px] py-2 px-4 border-b-[0.5px] border-border-tertiary items-center gap-2.5 skill-row">
        <span className="text-[13px] font-medium font-shell flex items-center gap-1.5">
          {skill.name}
          {skill.needsReview && (
            <span className="text-[9px] font-medium py-px px-[6px] rounded-full bg-custom-l text-custom-d font-shell">
              review
            </span>
          )}
        </span>
        <span className={`inline-flex items-center text-[10px] font-medium py-0.5 px-[9px] rounded-full font-shell w-fit ${tc.cls}`}>
          {tc.label}
        </span>
        <span className="text-[12px] text-text-tertiary font-shell">
          {skill.evidence || "—"}
        </span>
        <div className="flex gap-1 justify-end">
          <button onClick={() => setEditing(true)} className={btnCls(false)}>Edit</button>
          <button
            aria-label="Delete"
            onClick={onDelete}
            className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center border-none bg-transparent cursor-pointer text-text-tertiary transition-colors hover:text-badge-passed-fg hover:bg-badge-passed-bg"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3.5 px-4 border-b-[0.5px] border-border-tertiary bg-background-secondary flex flex-col gap-2.5">
      <input autoFocus className={inputCls} placeholder="Skill name" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex gap-[5px] flex-wrap">
        {TIERS.map((t) => (
          <button key={t.value} onClick={() => setTier(t.value)} className={tierBadgeCls(t, tier === t.value)}>
            {t.value} — {t.label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-text-tertiary font-shell flex flex-col gap-0.5">
        <span><strong>Core:</strong> 3+ production projects, recent, owned end-to-end</span>
        <span><strong>Proficient:</strong> 2+ projects, contributed meaningfully, mostly independent</span>
        <span><strong>Familiar:</strong> 1 project or didn&apos;t own it, needs ramp-up</span>
        <span><strong>Exposure:</strong> tutorials only, never shipped, or 3+ years ago</span>
      </div>

      <textarea
        className="w-full py-1.5 px-[9px] rounded-[6px] border-[0.5px] border-border-tertiary bg-transparent text-text-primary outline-none min-h-[60px] resize-none font-mono text-[12px]"
        placeholder="Evidence — e.g. 5 years production at a previous employer, owned 3 microservices end-to-end"
        value={evidence}
        onChange={(e) => setEvidence(e.target.value)}
      />

      <div className="flex gap-1.5">
        <button onClick={handleCancel} className={btnCls(false)}>Cancel</button>
        <button onClick={handleSave} disabled={!name.trim()} className={btnCls(true, !name.trim())}>Save</button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/resume/skills").then((data) => {
      setSkills(mapSkills(data?.skills ?? {}));
      setLoading(false);
    });
  }, []);

  const persist = async (updated: Skill[]) => {
    const skillsObj = Object.fromEntries(
      updated.map((s) => [
        s.name,
        s.needsReview
          ? { tier: s.tier, evidence: s.evidence, needs_review: true }
          : { tier: s.tier, evidence: s.evidence },
      ])
    );
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

  const addSkill = () => setSkills((p) => [...p, { name: "", tier: 2, evidence: "" }]);

  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);

  const reload = () =>
    api.get("/api/resume/skills").then((data) => setSkills(mapSkills(data?.skills ?? {})));

  const extractOllama = async () => {
    setExtracting(true);
    const res = await api.post("/api/resume/skills/extract", {}).catch((err) => { toast.error(err.message); return null; });
    setExtracting(false);
    if (res?.skills) { await reload(); toast.success("Skills extracted — review the flagged rows."); }
  };

  const copyClaudePrompt = async () => {
    await navigator.clipboard.writeText(SKILLS_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="flex items-center gap-2 py-2.5 px-5 border-b-[0.5px] border-border-tertiary shrink-0">
        <span className="text-[13px] font-semibold font-shell">Skills Inventory</span>
        <span className="text-[12px] font-medium font-mono bg-background-secondary text-text-tertiary py-0.5 px-2 rounded-full">
          {skills.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={copyClaudePrompt} className={btnCls(false)}>
            {copied ? "Copied" : "Copy prompt for Claude"}
          </button>
          <button onClick={extractOllama} disabled={extracting} className={btnCls(false, extracting)}>
            {extracting ? "Extracting…" : "Extract with Ollama"}
          </button>
          <button onClick={addSkill} className={btnCls(true)}>+ Add Skill</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-10 text-[12px] text-text-tertiary font-shell">Loading…</div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_110px_1fr_88px] py-[7px] px-4 border-b-[0.5px] border-border-tertiary bg-background-secondary sticky top-0 z-[2]">
            {["Skill", "Tier", "Evidence", ""].map((h) => (
              <span key={h} className="text-[11px] font-medium tracking-[0.05em] uppercase text-text-tertiary font-shell">
                {h}
              </span>
            ))}
          </div>

          {skills.length === 0 ? (
            <div className="flex items-center justify-center py-[60px] px-5 text-[12px] text-text-tertiary font-shell">
              No skills yet — add your first one above.
            </div>
          ) : (
            skills
              .map((skill, index) => ({ skill, index }))
              .sort((a, b) => {
                // Keep freshly-added (unnamed) rows at the bottom; otherwise Core → Exposure.
                const an = !a.skill.name, bn = !b.skill.name;
                if (an !== bn) return an ? 1 : -1;
                return a.skill.tier - b.skill.tier;
              })
              .map(({ skill, index }) => (
                <SkillRow
                  key={`${skill.name}-${index}`}
                  skill={skill}
                  startEditing={!skill.name}
                  onSave={(u) => handleSave(index, u)}
                  onDelete={() => handleDelete(index)}
                />
              ))
          )}

          {/* Tier legend */}
          {skills.length > 0 && (
            <div className="m-4 py-3 px-3.5 border-[0.5px] border-border-tertiary rounded-card bg-background-secondary flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary font-shell mb-1">
                How tiers affect generation
              </span>
              {[
                { t: TIERS[0], text: '→ "shipped X across multiple projects", "owned end-to-end"' },
                { t: TIERS[1], text: '→ "worked with X across several projects", "comfortable independently"' },
                { t: TIERS[2], text: '→ "have worked with X", "gaining experience in"' },
                { t: TIERS[3], text: '→ "exploring X", "in a side project", "recent interest in"' },
              ].map(({ t, text }) => (
                <div key={t.value} className="flex items-baseline gap-[7px]">
                  <span className={`text-[10px] font-medium py-px px-[7px] rounded-full font-shell shrink-0 ${t.cls}`}>
                    {t.label}
                  </span>
                  <span className="text-[11px] text-text-tertiary font-shell">{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

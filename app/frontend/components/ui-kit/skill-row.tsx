"use client";
import { skillStatusStyleCls } from "./styles";

const TIER_NAMES: Record<number, string> = { 1: "Core", 2: "Proficient", 3: "Familiar", 4: "Exposure" };
const STATUS_LABELS: Record<string, string> = { STRONG: "Strong", HONEST: "Honest", GAP: "Gap", UNKNOWN: "Unknown" };

// Analysis skill row (JD requirement vs. inventory). Two layouts:
//  - "wizard": tier name folded into the status chip ("STRONG Core").
//  - "detail": tier shown as a "T2" suffix on the name, friendly status label.
export function SkillRow({
  skill,
  status,
  tier,
  evidence,
  variant = "wizard",
}: {
  skill: string;
  status: string;
  tier?: number | null;
  evidence?: string;
  variant?: "wizard" | "detail";
}) {
  const style = skillStatusStyleCls(status);

  if (variant === "detail") {
    return (
      <div className="grid grid-cols-[170px_72px_1fr] gap-2.5 items-baseline py-[5px] border-b-[0.5px] border-border-tertiary">
        <span className="text-[12px] font-medium font-shell text-text-primary">
          {skill}
          {tier ? <span className="ml-[5px] text-[10px] text-text-tertiary font-mono">T{tier}</span> : null}
        </span>
        <span className={`inline-flex items-center text-[10px] font-medium py-0.5 px-[7px] rounded-full font-shell ${style}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
        <span className="text-[11px] text-text-tertiary font-shell">{evidence}</span>
      </div>
    );
  }

  const tierLabel = tier ? ` ${TIER_NAMES[tier] ?? ""}` : "";
  return (
    <div className="grid grid-cols-[160px_110px_1fr] gap-2 items-baseline py-[5px] border-b-[0.5px] border-border-tertiary">
      <span className="text-[12px] font-medium font-shell text-text-primary">{skill}</span>
      <span className={`inline-flex items-center text-[10px] font-medium py-0.5 px-2 rounded-full font-shell ${style}`}>
        {status}{tierLabel}
      </span>
      <span className="text-[11px] text-text-tertiary font-shell">{evidence}</span>
    </div>
  );
}

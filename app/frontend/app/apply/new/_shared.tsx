"use client";
import { STEPS, type Step } from "./useApplicationWizard";

export function Btn({ onClick, disabled, primary, children, className = "" }: {
  onClick?: () => void; disabled?: boolean; primary?: boolean;
  children: React.ReactNode; className?: string;
}) {
  const border = primary ? "border-none" : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-custom" : "bg-transparent";
  const color = primary ? "text-white" : "text-text-secondary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-[5px] text-[12px] font-medium py-1.5 px-3.5 rounded-full font-shell transition-opacity duration-100 ${border} ${bg} ${color} ${
        disabled ? "opacity-50 cursor-default" : "opacity-100 cursor-pointer"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Word count indicator for cover letter
export function ClWordCount({ text }: { text: string }) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const colorCls = count >= 250 && count <= 350
    ? "text-badge-interview-fg"
    : count >= 200 && count <= 400
    ? "text-custom"
    : "text-badge-passed-fg";
  const msg = count < 250 ? "(target 250–350)" : count > 350 ? "(over 250–350)" : "✓";
  return (
    <span className={`text-[11px] font-mono ${colorCls}`}>
      {count} words {msg}
    </span>
  );
}

// Step indicator in topbar
export function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-[5px]">
              <span
                className={`w-[18px] h-[18px] rounded-full shrink-0 inline-flex items-center justify-center text-[10px] font-bold font-mono ${
                  active ? "bg-custom text-white" : done ? "bg-custom-l text-custom-d" : "bg-background-secondary text-text-tertiary"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-[11px] font-shell ${active ? "font-semibold text-text-primary" : "font-normal text-text-tertiary"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-[0.5px] bg-border-tertiary mx-1.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

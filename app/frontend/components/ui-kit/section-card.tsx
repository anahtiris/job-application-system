"use client";

export function SectionCard({
  title,
  hint,
  badge,
  action,
  variant = "plain",
  children,
}: {
  title?: string;
  hint?: string;
  badge?: string;
  action?: React.ReactNode;
  variant?: "plain" | "labeled";
  children: React.ReactNode;
}) {
  if (variant === "labeled") {
    return (
      <div className="border-[0.5px] border-border-tertiary rounded-card overflow-hidden shrink-0">
        <div className="flex items-center gap-2 py-2 px-[14px] border-b-[0.5px] border-border-tertiary bg-background-secondary">
          <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-text-tertiary font-shell">
            {title}
          </span>
          {action && <div className="ml-auto">{action}</div>}
        </div>
        <div className="py-3 px-[14px]">{children}</div>
      </div>
    );
  }

  return (
    <div className="bg-background-primary border-[0.5px] border-border-tertiary rounded-card overflow-hidden shrink-0">
      {(title || action || badge) && (
        <div className="flex items-center justify-between gap-2 py-[9px] px-[13px] border-b-[0.5px] border-border-tertiary">
          <span className="flex items-baseline gap-2">
            {title && <span className="text-[12px] font-medium font-shell">{title}</span>}
            {hint && <span className="text-[11px] text-text-tertiary font-shell">{hint}</span>}
          </span>
          {badge && <span className="text-[10px] font-medium font-mono text-text-tertiary">{badge}</span>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="py-3 px-[13px]">{children}</div>
    </div>
  );
}

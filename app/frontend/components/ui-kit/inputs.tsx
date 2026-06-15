"use client";
import { useLayoutEffect, useRef } from "react";

// ─── Field label ─────────────────────────────────────────────────────────────────

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-[5px]">
      <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-text-tertiary font-shell">
        {children}
      </span>
      {hint && (
        <span className="ml-1.5 text-[11px] font-normal normal-case text-text-tertiary font-shell">
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── Helper text ──────────────────────────────────────────────────────────────────

export function InfoText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-text-tertiary font-shell">{children}</p>;
}

// ─── Auto-growing textarea ─────────────────────────────────────────────────────────

export function GrowTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full text-[13px] leading-[1.7] text-text-secondary bg-transparent border-none outline-none resize-none font-shell overflow-hidden ${className}`}
      style={style}
    />
  );
}

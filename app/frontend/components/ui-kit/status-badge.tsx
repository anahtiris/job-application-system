"use client";
import { useRef, useState } from "react";
import { STATUS_DISPLAY, NEXT_STATUSES } from "@/lib/status";
import { appLabelStyleCls } from "./styles";
import { useClickOutside } from "./hooks";

function badgeCls(backendStatus: string): string {
  const label = STATUS_DISPLAY[backendStatus] ?? backendStatus;
  return `inline-flex items-center text-[12px] font-medium py-[3px] px-[9px] rounded-full border-none whitespace-nowrap font-shell ${appLabelStyleCls(label)}`;
}

// Status pill that opens a dropdown of allowed next statuses. The parent owns the
// transition logic via `onSelect` (e.g. intercepting "Applied" to confirm a date).
export function StatusBadge({
  status,
  onSelect,
  stopPropagation = false,
}: {
  status: string;
  onSelect: (newStatus: string) => void;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nextOptions = NEXT_STATUSES[status] ?? [];
  useClickOutside(ref, open, () => setOpen(false));

  const stop = (e: React.MouseEvent) => { if (stopPropagation) e.stopPropagation(); };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        className={`${badgeCls(status)} ${nextOptions.length ? "cursor-pointer" : "cursor-default"}`}
        onClick={(e) => { stop(e); if (nextOptions.length) setOpen((o) => !o); }}
      >
        {STATUS_DISPLAY[status] ?? status}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-30 bg-background-primary border-[0.5px] border-border-tertiary rounded-card p-1 min-w-[110px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {nextOptions.map((s) => (
            <button
              key={s}
              onClick={(e) => { stop(e); setOpen(false); onSelect(s); }}
              className="block w-full text-left text-[12px] font-medium py-1.5 px-2 rounded-[5px] border-none cursor-pointer bg-transparent font-shell text-text-secondary hover:bg-background-secondary"
            >
              {STATUS_DISPLAY[s] ?? s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

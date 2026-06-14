"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import { type SaveState, MdStrong, mutedTextCls } from "@/components/ui-kit";
import { parsePrepSection } from "../helpers";
import { EditablePrepSection } from "../shared";

// ─── Background tab — company research, weak spots, salary prep notes ──────────

export function CompanyBackgroundTab({
  prepMd,
  generatingPrep,
  editSection,
  prepSaveState,
}: {
  prepMd: string;
  generatingPrep: boolean;
  editSection: (section: string, body: string) => void;
  prepSaveState: SaveState;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!generatingPrep && prepMd && (
        <>
          {/* Company Analysis — read-only rendered markdown */}
          <PrepDisplay
            markdown={prepMd}
            exclude={["Questions to Ask", "Introduction Script", "Common Questions", "Technical Questions", "Job-Specific Questions", "Weak Spots", "Salary & Negotiation"]}
          />

          {/* Editable prep sections */}
          {(["Weak Spots", "Salary & Negotiation"] as const).map((section) => (
            <EditablePrepSection
              key={section}
              title={section}
              value={parsePrepSection(prepMd, section)}
              onChange={(v) => editSection(section, v)}
              saveState={prepSaveState}
            />
          ))}
        </>
      )}

      {!generatingPrep && !prepMd && (
        <div className={`text-center py-12 px-5 ${mutedTextCls()}`}>
          No prep yet — generate one from the Overview tab.
        </div>
      )}
    </div>
  );
}

// ─── Prep display (markdown → section cards) ───────────────────────────────────

function PrepDisplay({ markdown, exclude = [] }: { markdown: string; exclude?: string[] }) {
  const raw = markdown.startsWith("## ") ? markdown : markdown.replace(/^[^#]*(?=## )/, "");
  const sections = raw.split(/(?=^## )/m).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {sections.map((sec) => {
        const nl = sec.indexOf("\n");
        const header = nl === -1 ? sec : sec.slice(0, nl);
        const body = nl === -1 ? "" : sec.slice(nl + 1).trim();
        const title = header.replace(/^#+\s*/, "");
        if (exclude.some((ex) => title.toLowerCase().includes(ex.toLowerCase()))) return null;
        return (
          <div key={title} className="border-[0.5px] border-border-tertiary rounded-card overflow-hidden">
            {/* Section header with amber left bar */}
            <div className="flex items-center gap-2.5 py-[9px] px-3.5 border-b-[0.5px] border-border-tertiary bg-custom-l">
              <div className="w-[3px] h-[14px] rounded-[2px] bg-custom shrink-0" />
              <span className="text-[12px] font-semibold text-custom-d font-shell tracking-[0.01em]">
                {title}
              </span>
            </div>
            {/* Section body */}
            <div className="py-3 px-3.5 text-[13px] leading-[1.75] text-text-secondary font-shell">
              <ReactMarkdown
                components={{
                  strong: MdStrong,
                  h3: ({ children }: { children?: React.ReactNode }) => (
                    <div className="text-[12px] font-semibold text-text-primary mt-3 mb-1 font-shell">
                      {children}
                    </div>
                  ),
                  li: ({ children }) => {
                    const kids = React.Children.toArray(children);
                    const first = kids[0];
                    if (React.isValidElement<{ children?: React.ReactNode }>(first) && first.type === MdStrong && kids.length > 1) {
                      return (
                        <li className="mb-2">
                          <div className="font-semibold text-text-primary mb-[3px] font-shell">
                            {first.props.children}
                          </div>
                          <div>{kids.slice(1)}</div>
                        </li>
                      );
                    }
                    return <li className="mb-1">{children}</li>;
                  },
                  p: ({ children }) => {
                    const kids = React.Children.toArray(children);
                    const first = kids[0];
                    if (React.isValidElement<{ children?: React.ReactNode }>(first) && first.type === MdStrong && kids.length > 1) {
                      return (
                        <div className="mb-2">
                          <div className="font-semibold text-text-primary mb-[3px] font-shell">
                            {first.props.children}
                          </div>
                          <div>{kids.slice(1)}</div>
                        </div>
                      );
                    }
                    return <p className="mb-2">{children}</p>;
                  },
                }}
              >
                {body}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}

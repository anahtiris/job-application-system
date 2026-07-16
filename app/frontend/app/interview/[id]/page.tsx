"use client";
import { useParams } from "next/navigation";
import { mutedTextCls } from "@/components/ui-kit";
import { CompanyPrepPanel } from "../company-prep/CompanyPrepPanel";
import { useInterviewList } from "../InterviewListContext";

// /interview/[id] — company-specific prep for a single interview.
export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { interviews, loaded, isDark, onDateChange } = useInterviewList();
  const app = interviews.find((a) => a.id === id) ?? null;

  if (!app) {
    return (
      <div className="p-6">
        <p className={mutedTextCls("12px")}>
          {loaded ? "Interview not found." : "Loading…"}
        </p>
      </div>
    );
  }

  return (
    <CompanyPrepPanel
      app={app}
      isDark={isDark}
      onDateChange={onDateChange}
    />
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { toast } from "sonner";
import { api } from "@/lib/api";

function btnCls(primary = true, disabled = false): string {
  const border = primary ? "border-none" : "border-[0.5px] border-border-tertiary";
  const bg = primary ? "bg-custom" : "bg-transparent";
  const color = primary ? "text-white" : "text-text-secondary";
  return `inline-flex items-center gap-[5px] text-[12px] font-medium py-1.5 px-3.5 rounded-full font-shell transition-opacity duration-100 ${border} ${bg} ${color} ${
    disabled ? "opacity-50 cursor-default" : "opacity-100 cursor-pointer"
  }`;
}

export default function SetupPage() {
  const [language, setLanguage] = useState<"en" | "de">("en");
  const [markdown, setMarkdown] = useState("");
  const [parseStatus, setParseStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (lang: "en" | "de") => {
    const res = await api.get(`/api/resume/master?language=${lang}`).catch(() => null);
    setMarkdown(res?.markdown ?? "");
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches resume markdown on language change; setState is the point
  useEffect(() => { load(language); }, [language]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setParseStatus("Parsing with Ollama…");
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.upload(`/api/resume/parse?language=${language}`, fd).catch((err) => {
      toast.error(err.message);
      return null;
    });
    setUploading(false);
    setParseStatus("");
    if (res?.markdown) {
      setMarkdown(res.markdown);
      toast.success("Parsed. Review and save below.");
    }
  };

  const save = async () => {
    await api.put("/api/resume/master", { language, content: markdown });
    toast.success("Resume saved.");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="flex items-center gap-3 py-2.5 px-5 border-b-[0.5px] border-border-tertiary shrink-0">
        <span className="text-[13px] font-semibold font-shell">Resume Setup</span>

        {/* Language toggle */}
        <div className="flex border-[0.5px] border-border-tertiary rounded-[6px] overflow-hidden">
          {(["en", "de"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`text-[11px] font-medium py-1 px-3 cursor-pointer font-mono border-none ${
                language === l ? "bg-custom text-white" : "bg-transparent text-text-secondary"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {parseStatus && (
            <span className="text-[12px] text-text-tertiary font-shell">
              {parseStatus}
            </span>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={upload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnCls(false, uploading)}>
            {uploading ? "Parsing…" : "Upload PDF / DOCX"}
          </button>
          {markdown && (
            <button onClick={save} className={btnCls(true)}>Save</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-6 px-5">
        <div className="max-w-[680px] mx-auto">
          {markdown ? (
            <MarkdownEditor value={markdown} onChange={setMarkdown} />
          ) : (
            <div className="flex flex-col items-center justify-center py-[60px] px-5 gap-3 border-[0.5px] border-border-tertiary rounded-card bg-background-secondary">
              <span className="text-[13px] text-text-tertiary font-shell">
                No {language.toUpperCase()} resume yet.
              </span>
              <button onClick={() => fileRef.current?.click()} className={btnCls(true)}>
                Upload PDF / DOCX to parse
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

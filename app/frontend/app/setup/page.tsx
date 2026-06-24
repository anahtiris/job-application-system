"use client";
import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SKILLS_PROMPT, profilePrompt } from "@/lib/prompts";

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
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rawSaved, setRawSaved] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);

  const extractOllama = async () => {
    setExtracting(true);
    const res = await api
      .post("/api/resume/skills/extract", {})
      .catch((err) => { toast.error(err.message); return null; });
    setExtracting(false);
    if (res?.skills) {
      toast.success(`Extracted ${Object.keys(res.skills).length} skills — review on the Skills page.`);
    }
  };

  const copyClaudePrompt = async () => {
    await navigator.clipboard.writeText(SKILLS_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyProfilePrompt = async () => {
    await navigator.clipboard.writeText(profilePrompt(language));
    setProfileCopied(true);
    setTimeout(() => setProfileCopied(false), 1500);
  };

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
    if (!res) return; // network/HTTP error already toasted by api client
    setRawSaved(Boolean(res.raw_saved_to));
    if (res.parse_error) {
      setParseError(res.parse_error);
      toast.error(res.parse_error);
      return;
    }
    setParseError("");
    if (res.markdown) {
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
            <>
              <MarkdownEditor value={markdown} onChange={setMarkdown} />
              <div className="mt-5 py-3.5 px-4 border-[0.5px] border-border-tertiary rounded-card bg-background-secondary flex items-center gap-3 flex-wrap">
                <span className="text-[12px] text-text-secondary font-shell">
                  Generate your skills inventory from this resume:
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={copyClaudePrompt} className={btnCls(false)}>
                    {copied ? "Copied" : "Copy prompt for Claude"}
                  </button>
                  <button onClick={extractOllama} disabled={extracting} className={btnCls(true, extracting)}>
                    {extracting ? "Extracting…" : "Extract with Ollama"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-[60px] px-5 gap-3 border-[0.5px] border-border-tertiary rounded-card bg-background-secondary">
              {parseError ? (
                <span className="text-[12px] text-text-secondary font-shell max-w-[420px] text-center">
                  {parseError}
                </span>
              ) : (
                <span className="text-[13px] text-text-tertiary font-shell">
                  No {language.toUpperCase()} resume yet.
                </span>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()} className={btnCls(!rawSaved)}>
                  Upload PDF / DOCX to parse
                </button>
                {rawSaved && (
                  <button onClick={copyProfilePrompt} className={btnCls(true)}>
                    {profileCopied ? "Copied" : "Copy prompt for Claude"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function SetupPage() {
  const [language, setLanguage] = useState<"en" | "de">("en");
  const [markdown, setMarkdown] = useState("");
  const [parseStatus, setParseStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (lang: "en" | "de") => {
    const res = await api.get(`/api/resume/master?language=${lang}`).catch(() => null);
    if (res?.markdown) setMarkdown(res.markdown);
    else setMarkdown("");
  };

  useEffect(() => { load(language); }, [language]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setParseStatus("Parsing resume with Ollama…");
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
      toast.success("Parsed successfully. Review and save below.");
    }
  };

  const save = async () => {
    await api.put("/api/resume/master", { language, content: markdown });
    toast.success("Resume saved.");
  };

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resume Setup</h1>
        <p className="text-muted-foreground text-sm">
          Upload your resume to extract structured markdown, then review and edit it.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Language</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          {(["en", "de"] as const).map((l) => (
            <Button
              key={l}
              variant={language === l ? "default" : "outline"}
              onClick={() => setLanguage(l)}
            >
              {l.toUpperCase()}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upload Resume</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={upload} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Parsing…" : "Choose PDF or DOCX"}
          </Button>
          {parseStatus && <p className="text-sm text-muted-foreground">{parseStatus}</p>}
        </CardContent>
      </Card>

      {markdown && (
        <Card>
          <CardHeader><CardTitle>Resume Markdown ({language.toUpperCase()})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MarkdownEditor value={markdown} onChange={setMarkdown} />
            <Button onClick={save}>Save</Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

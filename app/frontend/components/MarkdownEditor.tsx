"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  label?: string;
}

export function MarkdownEditor({ value, onChange, readOnly = false, label }: Props) {
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  const handleChange = (v: string) => {
    setText(v);
    onChange?.(v);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      <Tabs defaultValue={readOnly ? "preview" : "edit"} className="w-full">
        <TabsList className="w-full">
          {!readOnly && <TabsTrigger value="edit" className="flex-1">Edit</TabsTrigger>}
          <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
        </TabsList>
        {!readOnly && (
          <TabsContent value="edit">
            <textarea
              className="w-full min-h-[420px] font-mono text-sm p-3 border rounded-md resize-y bg-background"
              value={text}
              onChange={(e) => handleChange(e.target.value)}
            />
          </TabsContent>
        )}
        <TabsContent value="preview">
          <div className="prose prose-sm max-w-none p-4 border rounded-md min-h-[420px] bg-background overflow-auto">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

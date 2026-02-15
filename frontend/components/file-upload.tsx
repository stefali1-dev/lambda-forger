"use client";

import { useRef } from "react";
import { Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface UploadedFile {
  name: string;
  s3Url: string;
}

interface FileUploadProps {
  uploadedFiles: UploadedFile[];
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
  workspace?: boolean;
}

export function FileUpload({ uploadedFiles, onUpload, disabled, workspace = false }: FileUploadProps) {
  const hasFiles = uploadedFiles.length > 0;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cardClass = workspace ? "border-slate-700 bg-slate-900/90 text-slate-100" : "border-border/70 bg-card/70";
  const dropzoneClass = workspace
    ? "rounded-lg border border-dashed border-cyan-500/40 bg-cyan-950/20 p-3 text-sm"
    : "rounded-lg border border-dashed border-cyan-700/50 bg-cyan-950/10 p-3 text-sm";
  const selectButtonClass = workspace
    ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-slate-100"
    : "border-slate-300 bg-white text-slate-900 hover:bg-slate-100";
  const fileItemClass = workspace
    ? "rounded-md border border-slate-700 bg-slate-950/80 p-2"
    : "rounded-md border border-border/70 bg-background/40 p-2";
  const fileMetaClass = workspace ? "truncate font-mono text-[11px] text-slate-300" : "truncate font-mono text-[11px] text-muted-foreground";

  return (
    <Card className={cardClass}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Context Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`flex items-center justify-between gap-3 ${dropzoneClass}`}>
          <span className={workspace ? "text-slate-300" : "text-muted-foreground"}>
            Upload .txt, .md, .json, or .csv files
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={selectButtonClass}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {disabled ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {disabled ? "Uploading" : "Select Files"}
          </Button>
        </div>

        <input
          ref={inputRef}
          id={workspace ? "workspace-context-files" : "context-files"}
          className="hidden"
          type="file"
          multiple
          accept=".txt,.md,.json,.csv,text/plain,application/json,text/csv"
          disabled={disabled}
          onChange={async (event) => {
            const selected = Array.from(event.target.files || []);
            if (selected.length === 0) {
              return;
            }
            await onUpload(selected);
            event.currentTarget.value = "";
          }}
        />

        {hasFiles ? (
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div key={file.s3Url} className={fileItemClass}>
                <p className="truncate text-xs font-medium">{file.name}</p>
                <p className={fileMetaClass}>{file.s3Url}</p>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertTitle>No context uploaded yet</AlertTitle>
            <AlertDescription>
              Optional: Upload files now. They will be added to Lambda env var `S3_CONTEXT_FILES`.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

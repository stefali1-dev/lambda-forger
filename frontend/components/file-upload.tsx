"use client";

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
}

export function FileUpload({ uploadedFiles, onUpload, disabled }: FileUploadProps) {
  const hasFiles = uploadedFiles.length > 0;

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Context Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label
          htmlFor="context-files"
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-cyan-700/50 bg-cyan-950/10 p-3 text-sm hover:bg-cyan-950/20"
        >
          <span className="text-muted-foreground">Upload .txt, .md, .json, or .csv files</span>
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            {disabled ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {disabled ? "Uploading" : "Select Files"}
          </Button>
        </label>

        <input
          id="context-files"
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
              <div key={file.s3Url} className="rounded-md border border-border/70 bg-background/40 p-2">
                <p className="truncate text-xs font-medium">{file.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{file.s3Url}</p>
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

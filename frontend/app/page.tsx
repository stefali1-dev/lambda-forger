"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Server,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DeployPanel } from "@/components/deploy-panel";
import { Editor } from "@/components/editor";
import { FileUpload, type UploadedFile } from "@/components/file-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { deployLambda, getBackendBaseUrl, getHealth, type DeployResponse, uploadFiles } from "@/lib/api";
import { ensureMocking } from "@/lib/msw";
import { templates } from "@/templates";

type HealthState = "checking" | "online" | "offline";

interface CodeFile {
  id: string;
  name: string;
  content: string;
  isEntry: boolean;
}

const INITIAL_FILE_NAME = "handler.ts";

function createFileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeFileName(rawName: string): string {
  const trimmed = rawName.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!safe) {
    return "untitled.ts";
  }
  if (!safe.includes(".")) {
    return `${safe}.ts`;
  }
  return safe;
}

function getUniqueFileName(existingFiles: CodeFile[], candidate: string): string {
  const safe = normalizeFileName(candidate);
  const dotIndex = safe.lastIndexOf(".");
  const base = dotIndex > 0 ? safe.slice(0, dotIndex) : safe;
  const extension = dotIndex > 0 ? safe.slice(dotIndex) : "";

  let next = safe;
  let counter = 1;

  const existingNames = new Set(existingFiles.map((file) => file.name.toLowerCase()));
  while (existingNames.has(next.toLowerCase())) {
    next = `${base}-${counter}${extension}`;
    counter += 1;
  }

  return next;
}

export default function Home() {
  const [files, setFiles] = useState<CodeFile[]>([
    {
      id: INITIAL_FILE_NAME,
      name: INITIAL_FILE_NAME,
      content: templates.chatCompletion,
      isEntry: true,
    },
  ]);
  const [activeFileId, setActiveFileId] = useState<string>(INITIAL_FILE_NAME);

  const [openaiKey, setOpenaiKey] = useState("");
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResponse | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<HealthState>("checking");

  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [isWorkspaceDeployPanelOpen, setIsWorkspaceDeployPanelOpen] = useState(true);

  const activeFile = useMemo(() => files.find((file) => file.id === activeFileId) ?? files[0], [activeFileId, files]);
  const entryFile = useMemo(() => files.find((file) => file.isEntry) ?? null, [files]);

  const canDeploy = useMemo(() => {
    return Boolean(entryFile?.content.trim()) && openaiKey.trim().length > 0 && !isUploading;
  }, [entryFile, isUploading, openaiKey]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await ensureMocking();
        await getHealth();
        if (active) {
          setHealthState("online");
        }
      } catch {
        if (active) {
          setHealthState("offline");
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isWorkspaceMode) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsWorkspaceMode(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isWorkspaceMode]);

  const updateActiveFileContent = (nextContent: string): void => {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === activeFile.id ? { ...file, content: nextContent } : file)),
    );
  };

  const handleAddFile = (): void => {
    const raw = window.prompt("New file name", "utils.ts");
    if (raw === null) {
      return;
    }

    const nextName = getUniqueFileName(files, raw);
    const nextFile: CodeFile = {
      id: createFileId(),
      name: nextName,
      content: "",
      isEntry: false,
    };

    setFiles((current) => [...current, nextFile]);
    setActiveFileId(nextFile.id);
    toast.success(`Added ${nextName}`);
  };

  const handleRenameFile = (fileId: string): void => {
    const file = files.find((item) => item.id === fileId);
    if (!file) {
      return;
    }

    const raw = window.prompt("Rename file", file.name);
    if (raw === null) {
      return;
    }

    const siblings = files.filter((item) => item.id !== fileId);
    const nextName = getUniqueFileName(siblings, raw);

    setFiles((currentFiles) =>
      currentFiles.map((item) => (item.id === fileId ? { ...item, name: nextName } : item)),
    );
    toast.success(`Renamed to ${nextName}`);
  };

  const handleDeleteFile = (fileId: string): void => {
    const file = files.find((item) => item.id === fileId);
    if (!file) {
      return;
    }

    if (files.length === 1) {
      toast.error("At least one file is required.");
      return;
    }

    const confirmed = window.confirm(`Delete ${file.name}?`);
    if (!confirmed) {
      return;
    }

    const remaining = files.filter((item) => item.id !== fileId).map((item) => ({ ...item }));
    if (!remaining.some((item) => item.isEntry)) {
      remaining[0].isEntry = true;
    }
    if (!remaining.some((item) => item.id === activeFileId)) {
      setActiveFileId(remaining[0].id);
    }
    setFiles(remaining);

    toast.success(`Deleted ${file.name}`);
  };

  const handleSetEntryFile = (fileId: string): void => {
    setFiles((currentFiles) => currentFiles.map((file) => ({ ...file, isEntry: file.id === fileId })));
  };

  const handleUpload = async (nextFiles: File[]): Promise<void> => {
    setIsUploading(true);
    setDeployError(null);

    try {
      const response = await uploadFiles(nextFiles);
      const nextEntries = response.s3Urls.map((s3Url, index) => ({
        s3Url,
        name: nextFiles[index]?.name || `context-${index + 1}.txt`,
      }));
      setUploadedFiles((previous) => [...previous, ...nextEntries]);
      toast.success(`Uploaded ${nextEntries.length} context file${nextEntries.length > 1 ? "s" : ""}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "File upload failed.";
      toast.error(message);
      setDeployError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeploy = async (): Promise<void> => {
    if (!entryFile) {
      const message = "No entry file selected.";
      setDeployError(message);
      toast.error(message);
      return;
    }

    setIsDeploying(true);
    setDeployError(null);
    setDeployResult(null);

    try {
      const result = await deployLambda({
        code: entryFile.content,
        template: "chatCompletion",
        openaiKey,
        s3ContextFiles: uploadedFiles.map((file) => file.s3Url),
      });
      setDeployResult(result);
      toast.success("Lambda deployed successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed.";
      setDeployError(message);
      toast.error(message);
    } finally {
      setIsDeploying(false);
    }
  };

  const renderDeploymentControls = () => (
    <>
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">OpenAI API Key</CardTitle>
          <CardDescription>Used only for the Lambda you deploy.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={openaiKey}
              type={showOpenAiKey ? "text" : "password"}
              placeholder="sk-..."
              onChange={(event) => setOpenaiKey(event.target.value)}
            />
            <button
              type="button"
              className="rounded-md border border-border/70 bg-background/70 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowOpenAiKey((current) => !current)}
              aria-label={showOpenAiKey ? "Hide API key" : "Show API key"}
            >
              {showOpenAiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Deploy uses entry file: <span className="font-mono">{entryFile?.name || "(none)"}</span>
          </p>
        </CardContent>
      </Card>

      <FileUpload uploadedFiles={uploadedFiles} onUpload={handleUpload} disabled={isUploading || isDeploying} />

      <DeployPanel
        isDeploying={isDeploying}
        canDeploy={canDeploy}
        errorMessage={deployError}
        result={deployResult}
        onDeploy={handleDeploy}
      />
    </>
  );

  if (isWorkspaceMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100">
        <header className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-wide">Workspace Mode</h2>
            <Badge className="bg-cyan-400 text-slate-900">AI Lambda Forger</Badge>
            <span className="text-xs text-slate-400">Esc to exit</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              onClick={() => setIsWorkspaceMode(false)}
            >
              <Minimize2 className="size-4" />
              Exit Workspace
            </Button>
          </div>
        </header>

        <div className="flex h-[calc(100vh-3.5rem)]">
          <aside className="w-72 border-r border-slate-800 bg-slate-900/80 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Files</p>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                onClick={handleAddFile}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>

            <div className="space-y-1">
              {files.map((file) => {
                const isActive = file.id === activeFile?.id;
                return (
                  <div
                    key={file.id}
                    className={`group flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${
                      isActive
                        ? "border-cyan-500/60 bg-cyan-500/15"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/80"
                    }`}
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => setActiveFileId(file.id)}>
                      <p className="truncate text-sm text-slate-100">{file.name}</p>
                      {file.isEntry ? <p className="text-[10px] uppercase tracking-wide text-cyan-300">Entry file</p> : null}
                    </button>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className={`rounded p-1 ${file.isEntry ? "text-amber-300" : "text-slate-400 hover:text-amber-200"}`}
                        onClick={() => handleSetEntryFile(file.id)}
                        aria-label="Set as entry file"
                      >
                        <Star className="size-3.5" fill={file.isEntry ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:text-slate-100"
                        onClick={() => handleRenameFile(file.id)}
                        aria-label="Rename file"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:text-rose-300"
                        onClick={() => handleDeleteFile(file.id)}
                        aria-label="Delete file"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/60 px-2 py-1">
              {files.map((file) => {
                const isActive = file.id === activeFile?.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={`rounded-md px-2 py-1 text-xs ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    {file.name}
                    {file.isEntry ? " *" : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex-1">
              <Editor value={activeFile?.content ?? ""} onChange={updateActiveFileContent} height="100%" />
            </div>
          </section>

          <aside
            className={`workspace-panel border-l border-slate-800 bg-slate-900/80 transition-all ${
              isWorkspaceDeployPanelOpen ? "w-[380px]" : "w-12"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-2 py-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
                onClick={() => setIsWorkspaceDeployPanelOpen((open) => !open)}
                aria-label={isWorkspaceDeployPanelOpen ? "Collapse deploy panel" : "Open deploy panel"}
              >
                {isWorkspaceDeployPanelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
              </button>
              {isWorkspaceDeployPanelOpen ? <p className="text-xs font-medium text-slate-300">Deploy Panel</p> : null}
            </div>

            {isWorkspaceDeployPanelOpen ? (
              <div className="h-[calc(100%-41px)] space-y-3 overflow-auto p-3">{renderDeploymentControls()}</div>
            ) : null}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_52%),radial-gradient(circle_at_80%_12%,_rgba(20,184,166,0.12),_transparent_48%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] px-4 py-8 md:px-8">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">AI Lambda Forger</h1>
            <Badge className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">MVP: Chat Completion with Context</Badge>
          </div>
          <p className="max-w-3xl text-sm text-slate-700">
            From static site to context-aware chatbot endpoint in minutes. Upload context, paste your OpenAI key,
            and deploy a working Lambda URL.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-700">
            <Server className="size-4" />
            <span>Backend:</span>
            {healthState === "online" ? <Badge className="bg-emerald-500 text-emerald-950">Connected</Badge> : null}
            {healthState === "checking" ? <Badge variant="secondary">Checking...</Badge> : null}
            {healthState === "offline" ? <Badge variant="destructive">Unavailable</Badge> : null}
            <span className="font-mono">{getBackendBaseUrl()}</span>
          </div>
        </header>

        {healthState === "offline" ? (
          <Alert variant="destructive" className="border-rose-500/60 bg-rose-950/5">
            <AlertTitle>Backend is not reachable</AlertTitle>
            <AlertDescription>
              Start SAM local (`sam local start-api`) or enable mocks with `NEXT_PUBLIC_USE_MOCKS=true`.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">{renderDeploymentControls()}</div>

          <Card className="overflow-hidden border-border/70 bg-card/80">
            <CardHeader className="border-b border-border/70 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-cyan-500" />
                    Lambda Handler Editor
                  </CardTitle>
                  <CardDescription>Default template is editable. Deploy uses your current entry file.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="border-cyan-700/60 bg-cyan-950/5 text-cyan-700 hover:bg-cyan-950/10"
                  onClick={() => setIsWorkspaceMode(true)}
                >
                  <Maximize2 className="size-4" />
                  Workspace Mode
                </Button>
              </div>

              <Separator className="my-2" />
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {files.map((file) => {
                  const isActive = file.id === activeFile?.id;
                  return (
                    <button
                      key={file.id}
                      onClick={() => setActiveFileId(file.id)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        isActive
                          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-700"
                          : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {file.name}
                      {file.isEntry ? " *" : ""}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Editor value={activeFile?.content ?? ""} onChange={updateActiveFileContent} />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

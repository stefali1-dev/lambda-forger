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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [targetFileId, setTargetFileId] = useState<string | null>(null);

  const activeFile = useMemo(() => files.find((file) => file.id === activeFileId) ?? files[0], [activeFileId, files]);
  const entryFile = useMemo(() => files.find((file) => file.isEntry) ?? null, [files]);
  const targetFile = useMemo(() => files.find((file) => file.id === targetFileId) ?? null, [files, targetFileId]);

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

  const openAddDialog = (): void => {
    setFileNameDraft("utils.ts");
    setIsAddDialogOpen(true);
  };

  const submitAddFile = (): void => {
    const nextName = getUniqueFileName(files, fileNameDraft);
    const nextFile: CodeFile = {
      id: createFileId(),
      name: nextName,
      content: "",
      isEntry: false,
    };

    setFiles((current) => [...current, nextFile]);
    setActiveFileId(nextFile.id);
    setIsAddDialogOpen(false);
    setFileNameDraft("");
    toast.success(`Added ${nextName}`);
  };

  const openRenameDialog = (fileId: string): void => {
    const file = files.find((item) => item.id === fileId);
    if (!file) {
      return;
    }

    setTargetFileId(fileId);
    setFileNameDraft(file.name);
    setIsRenameDialogOpen(true);
  };

  const submitRenameFile = (): void => {
    if (!targetFileId) {
      return;
    }

    const siblings = files.filter((item) => item.id !== targetFileId);
    const nextName = getUniqueFileName(siblings, fileNameDraft);

    setFiles((currentFiles) =>
      currentFiles.map((item) => (item.id === targetFileId ? { ...item, name: nextName } : item)),
    );

    setIsRenameDialogOpen(false);
    setTargetFileId(null);
    setFileNameDraft("");
    toast.success(`Renamed to ${nextName}`);
  };

  const openDeleteDialog = (fileId: string): void => {
    if (files.length === 1) {
      toast.error("At least one file is required.");
      return;
    }

    setTargetFileId(fileId);
    setIsDeleteDialogOpen(true);
  };

  const submitDeleteFile = (): void => {
    if (!targetFileId) {
      return;
    }

    const file = files.find((item) => item.id === targetFileId);
    if (!file) {
      setIsDeleteDialogOpen(false);
      setTargetFileId(null);
      return;
    }

    const remaining = files.filter((item) => item.id !== targetFileId).map((item) => ({ ...item }));
    if (!remaining.some((item) => item.isEntry)) {
      remaining[0].isEntry = true;
    }
    if (!remaining.some((item) => item.id === activeFileId)) {
      setActiveFileId(remaining[0].id);
    }
    setFiles(remaining);

    setIsDeleteDialogOpen(false);
    setTargetFileId(null);
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

  const renderDeploymentControls = (workspace = false) => (
    <>
      <Card className={workspace ? "border-slate-700 bg-slate-900/90 text-slate-100" : "border-border/70 bg-card/70"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">OpenAI API Key</CardTitle>
          <CardDescription className={workspace ? "text-slate-300" : undefined}>
            Used only for the Lambda you deploy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={openaiKey}
              type={showOpenAiKey ? "text" : "password"}
              placeholder="sk-..."
              className={workspace ? "border-slate-700 bg-slate-950/85 text-slate-100" : undefined}
              onChange={(event) => setOpenaiKey(event.target.value)}
            />
            <button
              type="button"
              className={
                workspace
                  ? "rounded-md border border-slate-700 bg-slate-800 px-2 text-slate-300 hover:text-slate-100"
                  : "rounded-md border border-border/70 bg-background/70 px-2 text-muted-foreground hover:text-foreground"
              }
              onClick={() => setShowOpenAiKey((current) => !current)}
              aria-label={showOpenAiKey ? "Hide API key" : "Show API key"}
            >
              {showOpenAiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className={`mt-2 text-xs ${workspace ? "text-slate-300" : "text-muted-foreground"}`}>
            Deploy uses entry file: <span className="font-mono">{entryFile?.name || "(none)"}</span>
          </p>
        </CardContent>
      </Card>

      <FileUpload
        uploadedFiles={uploadedFiles}
        onUpload={handleUpload}
        disabled={isUploading || isDeploying}
        workspace={workspace}
      />

      <DeployPanel
        isDeploying={isDeploying}
        canDeploy={canDeploy}
        errorMessage={deployError}
        result={deployResult}
        onDeploy={handleDeploy}
        workspace={workspace}
      />
    </>
  );

  const fileDialogs = (
    <>
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add File</DialogTitle>
            <DialogDescription>Create a new source file in this workspace.</DialogDescription>
          </DialogHeader>
          <Input
            value={fileNameDraft}
            placeholder="utils.ts"
            onChange={(event) => setFileNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitAddFile();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAddFile}>Add File</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRenameDialogOpen}
        onOpenChange={(open) => {
          setIsRenameDialogOpen(open);
          if (!open) {
            setTargetFileId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>Update the file name. Extensions are optional.</DialogDescription>
          </DialogHeader>
          <Input
            value={fileNameDraft}
            placeholder="handler.ts"
            onChange={(event) => setFileNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitRenameFile();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRenameFile}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setTargetFileId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-mono">{targetFile?.name || "selected file"}</span> from the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={submitDeleteFile}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isWorkspaceMode) {
    return (
      <>
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
                className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-slate-100"
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
                  className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-slate-100"
                  onClick={openAddDialog}
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
                          onClick={() => openRenameDialog(file.id)}
                          aria-label="Rename file"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:text-rose-300"
                          onClick={() => openDeleteDialog(file.id)}
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
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-100"
                          : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                      }`}
                    >
                      <span>{file.name}</span>
                      {file.isEntry ? <span className="text-[10px] uppercase tracking-wide text-cyan-300">entry</span> : null}
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
                <div className="h-[calc(100%-41px)] space-y-3 overflow-auto p-3">{renderDeploymentControls(true)}</div>
              ) : null}
            </aside>
          </div>
        </div>
        {fileDialogs}
      </>
    );
  }

  return (
    <>
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
            <div className="space-y-4">{renderDeploymentControls(false)}</div>

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
                    className="border-cyan-700/60 bg-cyan-950/5 text-cyan-700 hover:bg-cyan-950/10 hover:text-cyan-700"
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
                        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                          isActive
                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-700"
                            : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{file.name}</span>
                        {file.isEntry ? <span className="text-[10px] uppercase tracking-wide text-cyan-600">entry</span> : null}
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
      {fileDialogs}
    </>
  );
}

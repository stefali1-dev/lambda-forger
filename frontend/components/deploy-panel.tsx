"use client";

import { CheckCircle2, Copy, Loader2, Rocket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeployResponse } from "@/lib/api";

interface DeployPanelProps {
  isDeploying: boolean;
  canDeploy: boolean;
  errorMessage: string | null;
  result: DeployResponse | null;
  onDeploy: () => Promise<void>;
  workspace?: boolean;
}

function copyText(value: string, label: string): void {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Could not copy ${label.toLowerCase()}`),
  );
}

export function DeployPanel({
  isDeploying,
  canDeploy,
  errorMessage,
  result,
  onDeploy,
  workspace = false,
}: DeployPanelProps) {
  const baseCardClass = workspace
    ? "border-slate-700 bg-slate-900/90 text-slate-100"
    : "border-border/70 bg-card/70";
  const resultCardClass = workspace
    ? "border-emerald-500/40 bg-emerald-950/20 text-slate-100"
    : "border-emerald-500/40 bg-emerald-950/5";
  const mutedTextClass = workspace ? "text-slate-300" : "text-muted-foreground";
  const codeClass = workspace
    ? "block flex-1 truncate rounded-md border border-slate-700 bg-slate-950/90 px-2 py-1 text-xs text-slate-100"
    : "block flex-1 truncate rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs";

  return (
    <div className="space-y-3">
      <Card className={baseCardClass}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Deploy</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            disabled={!canDeploy || isDeploying}
            onClick={() => {
              void onDeploy();
            }}
          >
            {isDeploying ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {isDeploying ? "Deploying to AWS..." : "Deploy Chatbot Endpoint"}
          </Button>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Alert variant="destructive" className="border-rose-400/60">
          <TriangleAlert className="size-4" />
          <AlertTitle>Deploy failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Card className={resultCardClass}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Deployment Ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className={`mb-1 text-xs uppercase tracking-wide ${mutedTextClass}`}>Function Name</p>
              <Badge variant="secondary" className="font-mono text-xs">
                {result.functionName}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className={`text-xs uppercase tracking-wide ${mutedTextClass}`}>Function URL</p>
              <div className="flex gap-2">
                <code className={codeClass}>
                  {result.functionUrl}
                </code>
                <Button size="icon-sm" variant="outline" onClick={() => copyText(result.functionUrl, "Function URL")}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className={`text-xs uppercase tracking-wide ${mutedTextClass}`}>cURL</p>
              <div className="flex gap-2">
                <code
                  className={
                    workspace
                      ? "block flex-1 overflow-x-auto rounded-md border border-slate-700 bg-slate-950/90 px-2 py-1 text-xs text-slate-100"
                      : "block flex-1 overflow-x-auto rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs"
                  }
                >
                  {result.curlExample}
                </code>
                <Button size="icon-sm" variant="outline" onClick={() => copyText(result.curlExample, "cURL command")}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

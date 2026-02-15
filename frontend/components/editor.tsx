"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
let monacoConfigured = false;

interface EditorProps {
  value: string;
  onChange: (next: string) => void;
  height?: string;
}

export function Editor({ value, onChange, height = "58vh" }: EditorProps) {
  const handleMount: OnMount = (_, monaco) => {
    if (monacoConfigured) {
      return;
    }

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2022,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowJs: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: false,
      noEmit: true,
    });

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
declare module "openai" {
  const OpenAI: any;
  export default OpenAI;
}

declare const process: {
  env: Record<string, string | undefined>;
};
      `,
      "file:///types/lambda-forger.d.ts",
    );

    monacoConfigured = true;
  };

  return (
    <MonacoEditor
      height={height}
      language="typescript"
      theme="vs-dark"
      value={value}
      onMount={handleMount}
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        wordWrap: "on",
        tabSize: 2,
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
      onChange={(nextValue) => onChange(nextValue ?? "")}
    />
  );
}

import { delay, http, HttpResponse } from "msw";

interface DeployPayload {
  code?: string;
  template?: string;
  openaiKey?: string;
  systemPrompt?: string;
  files?: Array<{
    path?: string;
    content?: string;
  }>;
  entryFile?: string;
  s3ContextFiles?: string[];
}

export const handlers = [
  http.get("*/health", async () => {
    await delay(250);
    return HttpResponse.json({ ok: true, service: "ai-lambda-forger-backend" });
  }),

  http.post("*/upload", async ({ request }) => {
    await delay(800);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return HttpResponse.json({ error: "No files uploaded. Use multipart/form-data with field `files`." }, { status: 400 });
    }

    const s3Urls = files.map((file, index) =>
      `s3://ai-lambda-mvp-873550638583-euc1/ai-lambda-context-mock${index + 1}/${file.name}`,
    );

    return HttpResponse.json({ s3Urls });
  }),

  http.post("*/deploy", async ({ request }) => {
    await delay(1400);
    const body = (await request.json()) as DeployPayload;

    if (body.code !== undefined) {
      return HttpResponse.json(
        { error: "v1 `code` payload is no longer supported. Send v2 payload with `files[]` and `entryFile`." },
        { status: 400 },
      );
    }

    if (body.template !== "chatCompletion") {
      return HttpResponse.json({ error: "`template` must be exactly \"chatCompletion\" for MVP v2." }, { status: 400 });
    }

    if (!body.openaiKey || !body.openaiKey.trim()) {
      return HttpResponse.json({ error: "`openaiKey` is required and must be a non-empty string." }, { status: 400 });
    }

    if (body.systemPrompt !== undefined && typeof body.systemPrompt !== "string") {
      return HttpResponse.json({ error: "`systemPrompt` must be a string when provided." }, { status: 400 });
    }

    if (!Array.isArray(body.files) || body.files.length === 0) {
      return HttpResponse.json({ error: "`files` is required and must be a non-empty array." }, { status: 400 });
    }

    const seenPaths = new Set<string>();
    for (let index = 0; index < body.files.length; index += 1) {
      const file = body.files[index];
      if (!file || typeof file.path !== "string" || !file.path.trim()) {
        return HttpResponse.json({ error: `\`files[${index}].path\` is required and must be a string.` }, { status: 400 });
      }
      if (typeof file.content !== "string" || !file.content.trim()) {
        return HttpResponse.json({ error: `\`files[${index}].content\` cannot be empty.` }, { status: 400 });
      }

      const key = file.path.trim().toLowerCase();
      if (seenPaths.has(key)) {
        return HttpResponse.json({ error: `Duplicate file path detected: \`${file.path.trim()}\`.` }, { status: 400 });
      }
      seenPaths.add(key);
    }

    if (!body.entryFile || !body.entryFile.trim()) {
      return HttpResponse.json({ error: "`entryFile` is required and must be a string." }, { status: 400 });
    }

    if (!body.files.some((file) => file.path?.trim() === body.entryFile?.trim())) {
      return HttpResponse.json({ error: `\`entryFile\` was not found in files: \`${body.entryFile}\`.` }, { status: 400 });
    }

    if (body.s3ContextFiles && body.s3ContextFiles.some((value) => !value.trim())) {
      return HttpResponse.json({ error: "`s3ContextFiles` cannot include empty values." }, { status: 400 });
    }

    if (body.openaiKey.includes("fail")) {
      return HttpResponse.json({ error: "Mock deploy failure: simulated upstream provider error." }, { status: 500 });
    }

    return HttpResponse.json({
      functionName: "ai-lambda-user-mock1234",
      functionUrl: "https://mock123.lambda-url.eu-central-1.on.aws/",
      curlExample:
        "curl -X POST https://mock123.lambda-url.eu-central-1.on.aws/ -H 'Content-Type: application/json' -d '{\"message\":\"Hello\"}'",
    });
  }),
];

import { delay, http, HttpResponse } from "msw";

interface DeployPayload {
  code?: string;
  template?: string;
  openaiKey?: string;
  s3ContextFiles?: string[];
}

export const handlers = [
  http.get("*/health", async () => {
    await delay(250);
    return HttpResponse.json({ ok: true, service: "ai-lambda-builder-backend" });
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

    if (!body.code || !body.code.trim()) {
      return HttpResponse.json({ error: "`code` is required and must be a non-empty string." }, { status: 400 });
    }

    if (body.template !== "chatCompletion") {
      return HttpResponse.json({ error: "`template` must be exactly \"chatCompletion\" for MVP." }, { status: 400 });
    }

    if (!body.openaiKey || !body.openaiKey.trim()) {
      return HttpResponse.json({ error: "`openaiKey` is required and must be a non-empty string." }, { status: 400 });
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

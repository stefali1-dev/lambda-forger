# AI Lambda Forger

Frontend-first tool to deploy context-aware OpenAI Lambda endpoints quickly.

## Status
- MVP v1: completed.
- MVP v2: implemented and validated (multi-file deploy, system prompt env wiring, template roadmap affordance, real AWS/OpenAI E2E).

## Canonical Docs
- `README.md`: runbook
- `AGENTS.md`: scope + execution rules
- `PLAN.md`: active checklist
- `DECISIONS.md`: active decisions/blockers
- `DECISIONS_ARCHIVE.md`: historical decisions/blockers

## Current Stack
- Frontend: Next.js + TypeScript + Tailwind + shadcn/ui + Monaco + MSW
- Backend: AWS SAM Lambda (Node.js 22)
- APIs: `GET /health`, `POST /upload`, `POST /deploy`
- Deploy target: AWS Lambda Function URL

## MVP v2 Delivered
1. Multi-file deploy contract (`files[]`, `entryFile`) with strict backend validation.
2. Legacy v1 `code` deploy payload removed with clear `400` migration error.
3. System prompt field in UI, passed in deploy payload, injected as Lambda env var `SYSTEM_PROMPT`.
4. Template selector UI with `Chat Completion` enabled and disabled roadmap options labeled `Coming soon`.
5. Real AWS upload/deploy/invoke validation using runtime `OPENAI_API_KEY`, with cleanup.

## Deploy Contract (v2)
```json
{
  "template": "chatCompletion",
  "openaiKey": "sk-...",
  "systemPrompt": "You are a helpful assistant...",
  "files": [
    { "path": "handler.ts", "content": "..." },
    { "path": "utils/prompt.ts", "content": "..." }
  ],
  "entryFile": "handler.ts",
  "s3ContextFiles": ["s3://..."]
}
```

Notes:
- Backend accepts only `template: "chatCompletion"` in v2.
- `files[].path` must be relative and use `.ts`, `.js`, `.mjs`, `.cjs`, `.mts`, or `.cts`.
- Legacy v1 `code` payload is rejected with actionable migration error (`400`).

## Backend Runbook
```bash
cd backend
npm install
npm run typecheck
npm run build
sam validate --lint --template-file template.yaml
sam build
sam local start-api
```

Deploy backend:
```bash
cd backend
sam deploy --guided
```

## Frontend Runbook
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev -- --port 3001
```

Mock mode:
```bash
cd frontend
cat > .env.local <<'EOF2'
NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_USE_MOCKS=true
EOF2
npm run dev -- --port 3001
```

## Environment
Backend (`backend/.env.example`):
- `AWS_ACCESS_KEY_ID` (optional if already configured via AWS credential chain)
- `AWS_SECRET_ACCESS_KEY` (optional if already configured via AWS credential chain)
- `AWS_REGION`
- `DEPLOY_TARGET_REGION`
- `MVP_LAMBDA_ROLE_ARN` (optional override)
- `MVP_LAMBDA_ROLE_NAME`
- `S3_CONTEXT_BUCKET`

Frontend (`frontend/.env.local.example`):
- `NEXT_PUBLIC_BACKEND_BASE_URL`
- `NEXT_PUBLIC_USE_MOCKS`

E2E testing secret (local shell/runtime only):
- `OPENAI_API_KEY`

## Security
- Never commit API keys or cloud credentials.
- For real E2E testing, inject OpenAI key at runtime only (use local `OPENAI_API_KEY`).
- Redact secrets from logs and docs.

## Notes
- Root README is canonical; `frontend/README.md` is intentionally removed.
- Historical `builder` naming may exist in archived logs/resources; active defaults use `forger` naming.

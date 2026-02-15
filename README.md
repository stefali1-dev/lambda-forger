# AI Lambda Forger

Deploy context-aware chatbot Lambda endpoints from a frontend workflow.

## Current Scope (MVP v2)
- Multi-file Lambda deploy (`files[]` + `entryFile`).
- System prompt configured in UI and injected as `SYSTEM_PROMPT`.
- Context file upload to S3 (`S3_CONTEXT_FILES` env var on deployed Lambda).
- Template selector UI with `chatCompletion` as the only enabled backend template.

Out of scope for v2: streaming execution, image generation execution, auth, billing, history/log UI.

## Architecture
- `frontend/`: Next.js app (App Router, TS, Tailwind, Monaco editor).
- `backend/`: AWS SAM app exposing a control-plane HTTP API:
  - `GET /health`
  - `POST /upload`
  - `POST /deploy`
- Deployed user runtimes are AWS Lambda functions invoked via **Lambda Function URLs**.
- Backend control plane itself runs behind **API Gateway HTTP API**.

## Prerequisites
- Node.js 22+
- npm
- AWS CLI configured with credentials
- AWS SAM CLI
- Vercel CLI (for frontend hosting)

## Local Development

### 1. Backend (SAM local)
```bash
cd backend
npm install
cp .env.example .env
npm run typecheck
npm run build
npm run sam:validate
npm run sam:build
npm run sam:local
```

Default local backend URL: `http://127.0.0.1:3000`

### 2. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev -- --port 3001
```

Frontend runs on: `http://127.0.0.1:3001`

## Deploy Backend to AWS (eu-central-1)
```bash
cd backend
npm install
sam build
sam deploy \
  --stack-name ai-lambda-forger-backend \
  --region eu-central-1 \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides DeployTargetRegion=eu-central-1
```

Get deployed API URL:
```bash
aws cloudformation describe-stacks \
  --region eu-central-1 \
  --stack-name ai-lambda-forger-backend \
  --query "Stacks[0].Outputs[?OutputKey=='BackendApiUrl'].OutputValue" \
  --output text
```

Quick health check:
```bash
curl https://<backend-api-id>.execute-api.eu-central-1.amazonaws.com/health
```

## Deploy Frontend to Vercel (wired to backend)
Set the backend URL in Vercel deployment env:

```bash
cd frontend
vercel deploy --prod --yes \
  --build-env NEXT_PUBLIC_BACKEND_BASE_URL=https://<backend-api-id>.execute-api.eu-central-1.amazonaws.com \
  --build-env NEXT_PUBLIC_USE_MOCKS=false \
  --env NEXT_PUBLIC_BACKEND_BASE_URL=https://<backend-api-id>.execute-api.eu-central-1.amazonaws.com \
  --env NEXT_PUBLIC_USE_MOCKS=false
```

For persistent project env vars (recommended), configure them in Vercel project settings after first link/deploy.

## Deploy API Contract (v2)
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

Validation rules:
- `template` must be exactly `"chatCompletion"`.
- Legacy v1 `code` payload is rejected with `400`.
- `files[].path` must be a safe relative path with one of:
  - `.ts`, `.js`, `.mjs`, `.cjs`, `.mts`, `.cts`
- `entryFile` must match one of the provided file paths.

## Environment Variables

Backend (`backend/.env.example`):
- `AWS_REGION` (default `eu-central-1`)
- `DEPLOY_TARGET_REGION` (default `eu-central-1`)
- `MVP_LAMBDA_ROLE_ARN` (optional override)
- `MVP_LAMBDA_ROLE_NAME`
- `S3_CONTEXT_BUCKET`

Frontend:
- `NEXT_PUBLIC_BACKEND_BASE_URL`
- `NEXT_PUBLIC_USE_MOCKS`

## Security Notes
- Never commit secrets (`.env`, API keys, cloud credentials).
- Use runtime/local environment injection for real OpenAI key usage.

# AI Lambda Forger (MVP)

MVP for deploying context-aware OpenAI AWS Lambda endpoints from a frontend-first workflow.

## Current Scope

- Backend control plane implemented in `backend/` (AWS SAM + Lambda)
- Endpoints implemented:
  - `GET /health`
  - `POST /upload`
  - `POST /deploy`
- Frontend implemented in `frontend/` with:
  - Next.js (App Router + TypeScript)
  - Tailwind CSS + shadcn/ui
  - Monaco editor
  - Workspace Mode (fullscreen app overlay with file tree + tabs)
  - Entry-file deploy behavior for multi-file editing (`handler.ts` default)
  - MSW mock mode behind env toggle (`NEXT_PUBLIC_USE_MOCKS=true`)

## Backend Capabilities

- Accept user Lambda handler code and deploy it as AWS Lambda (`nodejs22.x`)
- Create public Lambda Function URL with CORS
- Add required public Function URL invoke permissions
- Pass runtime env vars (`OPENAI_API_KEY`, `S3_CONTEXT_FILES`)
- Upload context files to S3 and return `s3://...` URLs
- Auto-create execution IAM role (if missing)
- Auto-create context bucket (if missing)

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

Deploy backend API:

```bash
cd backend
sam deploy --guided
```

## Frontend Runbook

```bash
cd frontend
npm install
cat > .env.local <<'EOF'
NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_USE_MOCKS=false
EOF
npm run dev -- --port 3001
```

Mock mode (frontend-only, no backend required):

```bash
cd frontend
cat > .env.local <<'EOF'
NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_USE_MOCKS=true
EOF
npm run dev -- --port 3001
```

## Environment

`backend/.env.example` documents local variables. Key ones:

- `AWS_REGION`
- `DEPLOY_TARGET_REGION`
- `MVP_LAMBDA_ROLE_ARN` (optional override)
- `MVP_LAMBDA_ROLE_NAME`
- `S3_CONTEXT_BUCKET`

## Verification Status (2026-02-15)

Backend was re-verified with:

- `npm run typecheck` ✅
- `npm run build` ✅
- `sam validate --lint` ✅
- `sam build` ✅
- `sam local start-api` endpoint smoke tests (`/health`, `/upload`, `/deploy`) ✅
- Live AWS deploy/invoke/upload tests in `eu-central-1` ✅

Operational note:
- New Function URLs can return transient timeouts right after creation; retrying after a short delay succeeds.

# AGENTS.md - Context for AI Coding Agents

**Project:** AI Lambda Forger MVP  
**Goal:** Ship a working prototype TODAY (Feb 15, 2026)  
**Time Budget:** 8-10 hours

---

## 🎯 What We're Building

A web app where users can build and deploy OpenAI-powered AWS Lambda endpoints in one click.

**Core value:** "Write an OpenAI Lambda function → Deploy to AWS in one click"

## 🧲 Product Positioning (Canonical)

**Primary audience:** Frontend developers who need chatbot capability without backend/AWS setup work.

**Primary promise:** "From static site to context-aware chatbot endpoint in minutes."

**Selling point:** Frontend teams can upload context files, paste an OpenAI key, deploy, and call a working chatbot API from any frontend.

**Messaging guardrails for agents:**
- Emphasize "no backend/AWS complexity" and "fast time to value."
- Prefer "context-aware chatbot API" over generic "AI app builder."
- Keep copy practical and developer-first (endpoint, curl, integration).
- Do not position streaming/image as current MVP capability.

---

## 📋 Master Plan

See `PLAN.md` for the complete TODO list, spikes, and task breakdown.

**You should:**
- ✅ Check `PLAN.md` before starting work (understand what's already done)
- ✅ Update `PLAN.md` as you complete tasks (check off `[ ]` items)
- ✅ Update this file (`AGENTS.md`) if you discover important context
- ✅ Log blockers/decisions in `DECISIONS.md` (create if needed)

**Source of truth by file:**
- `AGENTS.md`: constraints, architecture context, operating rules
- `PLAN.md`: execution checklist, ordering, progress tracking
- `DECISIONS.md`: decisions, trade-offs, blockers, and recommendations

---

## 🏗️ Project Structure

```
ai-lambda-forger/
├── PLAN.md              # Master TODO list (READ THIS FIRST)
├── AGENTS.md            # This file (context for AI agents)
├── DECISIONS.md         # Architecture decisions & blockers (create as needed)
├── frontend/            # Next.js + TypeScript app (App Router)
│   ├── app/
│   │   ├── page.tsx                # Main UI layout + state wiring
│   │   ├── layout.tsx              # Root layout + fonts/theme
│   │   └── globals.css             # Tailwind base + theme variables
│   ├── components/
│   │   ├── editor.tsx              # Monaco editor wrapper (client component)
│   │   ├── file-upload.tsx
│   │   └── deploy-panel.tsx
│   ├── components/ui/              # shadcn/ui primitives
│   ├── lib/
│   │   ├── api.ts                  # typed fetch client
│   │   └── utils.ts
│   ├── templates/
│   │   ├── chatCompletion.ts
│   │   └── index.ts
│   ├── mocks/                      # MSW handlers + browser setup (dev only)
│   └── package.json
├── backend/             # AWS SAM backend (Lambda + TypeScript)
│   ├── src/
│   │   ├── handler.ts              # Lambda handler entry point (API routes)
│   │   ├── deploy.ts               # Lambda deployment logic (AWS SDK)
│   │   └── s3Upload.ts             # S3 file upload handler
│   ├── template.yaml               # SAM template
│   └── package.json
└── README.md
```

---

## 🔧 Tech Stack

**Frontend:**
- Next.js (App Router) + TypeScript
- Tailwind CSS
- shadcn/ui (selected component primitives only)
- `@monaco-editor/react` (VS Code editor in browser)
- native `fetch` with a thin typed API client wrapper
- MSW (mock backend mode in frontend dev/testing)

**Backend:**
- AWS Lambda (Node.js + TypeScript) deployed with AWS SAM
- `@aws-sdk/client-lambda` (create Lambda functions)
- `@aws-sdk/client-s3` (upload context files)
- `@aws-sdk/client-iam` (create execution role if needed)
- `busboy` (multipart/form-data parsing for `/upload`)

**AWS Resources We Create:**
- Lambda Function (Node.js 22.x runtime)
- Lambda Function URL (public HTTPS endpoint, CORS enabled)
- S3 Bucket (for user-uploaded context files)
- IAM Execution Role (for Lambda to access S3)

---

## 🎯 MVP Scope (What's IN / What's OUT)

### ✅ IN SCOPE (Must Have)
- 1 Lambda template: Chat Completion with Context
- VS Code editor in browser (Monaco)
- File upload (for Chat Completion context files)
- OpenAI API key input (user provides their own key)
- One-click deploy to AWS
- Return public function URL + curl example
- Basic error handling (deploy failures, missing API key)

### ❌ OUT OF SCOPE (Skip for MVP)
- User authentication (no login, no accounts)
- Database / persistence (no saving code or history)
- Lambda monitoring / logs viewer (users check CloudWatch manually)
- Environment variables editor (hardcode in Lambda)
- Multi-user / teams
- Billing / pricing
- Template marketplace
- Custom runtimes (only Node.js 22.x)
- Streaming Chat template (defer to post-MVP)
- Image Generation template (defer to post-MVP)

---

## 🚨 Critical Constraints

**0. Backend Hosting (MVP canonical)**
- Backend control-plane API must run as a Lambda deployed by AWS SAM
- Avoid long-running server process patterns as primary architecture
- Keep backend endpoints implemented inside Lambda route handler (`/health`, `/deploy`, `/upload`)

**1. AWS Lambda Function URLs (NEW AWS FEATURE)**
- Use `CreateFunctionUrlConfigCommand` to get public HTTPS endpoint
- **For user-deployed Lambdas, no API Gateway is needed** (simplifies MVP)
- Enable CORS in function URL config
- For public URLs (`AuthType: NONE`), add resource-policy permissions after URL creation:
  - `lambda:InvokeFunctionUrl` (with `FunctionUrlAuthType: NONE`)
  - `lambda:InvokeFunction` (with `InvokedViaFunctionUrl: true`)
- Research: https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html

**2. Lambda Deployment Package**
- Must zip: user code + required `node_modules` dependencies (`openai` when template/user code imports it)
- Use `archiver` npm package or `AdmZip`
- Include `package.json` with `"type": "module"` if using ES modules
- **Blocker:** Bundling dependencies — may need esbuild/webpack

**3. IAM Execution Role**
- Lambda needs an execution role to run
- Minimum permissions: `AWSLambdaBasicExecutionRole` + S3 read (if using context files)
- **Decision needed:** Create role programmatically OR require user to create manually?

**4. Future feature: Streaming Response (post-MVP)**
- Lambda Function URLs support response streaming (as of 2024)
- Requires `Invoke mode: RESPONSE_STREAM` in function config
- Defer implementation until chat-only MVP is shipped

**5. S3 File Upload**
- Store user context files in S3: `ai-lambda-context-{randomId}/file.txt`
- Pass S3 URLs as env vars to Lambda
- Lambda reads from S3 at runtime (use `@aws-sdk/client-s3`)

---

## 🧠 Key Architectural Decisions

Canonical decisions live in `DECISIONS.md`. Current MVP decisions:
- User-function bundle strategy: zip user code + required runtime `node_modules` (no esbuild for deployed user Lambdas in MVP)
- Backend control-plane bundle strategy: SAM `BuildMethod: esbuild` for `backend/src/handler.ts`
- Context storage: S3 (not Lambda `/tmp`)
- OpenAI key handling: user-provided key passed as Lambda env var
- Frontend stack: Next.js + Tailwind + shadcn/ui
- Frontend mock mode: MSW behind env toggle (env-only, no UI toggle)
- Agent mode: autonomous, proactive, clear/direct communication

---

## 🎨 Brand & UX Direction

**Brand name:** `AI Lambda Forger`  
**Tagline:** "From static site to context-aware chatbot endpoint in minutes."

**UI intent (MVP):**
- Developer-first, practical copy (`endpoint`, `curl`, `deploy`, `context files`)
- Desktop-first side-by-side layout:
  - Left panel: API key, file upload, deploy controls
  - Right panel: Monaco editor + deployment result card
- Mobile: stacked single-column layout

**UX flow (canonical):**
1. Load default chat template in Monaco.
2. Check backend health (`GET /health`) and show status.
3. User pastes OpenAI API key.
4. User selects context files; uploads start immediately (`POST /upload`).
5. User deploys (`POST /deploy`) with editor code + key + uploaded `s3Urls`.
6. On success show function URL + curl command with copy actions.
7. On failure show actionable, user-facing error text.

**Frontend environment defaults:**
- `NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:3000` (SAM local API)
- `NEXT_PUBLIC_USE_MOCKS=false` (set `true` to enable MSW)

---

## 📦 Lambda Template Structure

Each template is a **self-contained Lambda handler** (TypeScript/JavaScript code as a string).

Templates should live in:
- `frontend/templates/chatCompletion.ts`
- `frontend/templates/index.ts`

Deferred template files (post-MVP):
- `frontend/templates/streamingChat.ts`
- `frontend/templates/imageGeneration.ts`

**Key points:**
- OpenAI API key passed as `process.env.OPENAI_API_KEY`
- S3 context file URLs passed as `process.env.S3_CONTEXT_FILES` (comma-separated)
- Lambda handler signature: `async (event) => { ... return { statusCode, body } }`

---

## 🔗 API Endpoints (Backend)

### `POST /deploy`
**Purpose:** Deploy user code as AWS Lambda

**Request body:**
```json
{
  "code": "export const handler = async (event) => { ... }",
  "template": "chatCompletion",
  "openaiKey": "sk-...",
  "s3ContextFiles": ["s3://bucket/file1.txt"] // optional, only for chatCompletion
}
```

**Response:**
```json
{
  "functionUrl": "https://abc123.lambda-url.eu-central-1.on.aws/",
  "functionName": "ai-lambda-user-abc123",
  "curlExample": "curl -X POST https://... -d '{\"message\":\"Hello\"}'"
}
```

**Logic:**
1. Generate unique function name (`ai-lambda-user-{randomId}`)
2. Create temp directory
3. Write user code to `handler.js`
4. Create `package.json` with `openai` dependency
5. Run `npm install` (or use pre-cached node_modules)
6. Zip directory
7. Create IAM execution role (if not exists)
8. Call `CreateFunctionCommand` (runtime: nodejs22.x, handler: handler.handler)
9. Call `CreateFunctionUrlConfigCommand` (auth: NONE, CORS: enabled)
10. Call `AddPermission` for Function URL public invoke (`lambda:InvokeFunctionUrl` + `lambda:InvokeFunction`)
11. Return function URL

### `POST /upload`
**Purpose:** Upload context files to S3

**Request:** multipart/form-data (files)

**Response:**
```json
{
  "s3Urls": ["s3://bucket/context-abc123/file1.txt"]
}
```

**Logic:**
1. Generate unique folder ID
2. Upload files to `ai-lambda-context-{folderId}/`
3. Return S3 URLs

---

## 🐛 Known Issues / Gotchas

**1. Lambda Cold Start with `openai` package**
- First invocation may be slow (3-5s) due to cold start + openai SDK initialization
- **Fix:** Use provisioned concurrency (out of scope for MVP) or document it

**2. Lambda Timeout**
- Default timeout: 3 seconds (too short for OpenAI API calls)
- **Fix:** Set timeout to 30 seconds in `CreateFunctionCommand`

**3. Lambda Payload Size Limit**
- Max request body: 6 MB (synchronous), 256 KB (async)
- **Impact:** Large context files won't work in request body
- **Fix:** Already solved (we store files in S3, not in request)

**4. CORS Issues**
- Lambda Function URL needs CORS enabled for browser requests
- **Fix:** Include in `CreateFunctionUrlConfigCommand`:
  ```typescript
  Cors: {
    AllowOrigins: ['*'],
    AllowMethods: ['POST', 'GET'],
    AllowHeaders: ['Content-Type']
  }
  ```

**5. OpenAI Rate Limits**
- Users may hit rate limits on their OpenAI account
- **Fix:** Document it in UI ("Use your own OpenAI API key")

---

## 🧪 Testing Strategy

**Manual Testing (Priority for MVP):**
1. **Template Load:** Chat Completion template loads in editor
2. **File Upload:** Upload a .txt file → verify S3 upload succeeds
3. **Deploy:** Click deploy → verify Lambda created in AWS console
4. **Invoke:** Curl the function URL → verify OpenAI response
5. **Error Handling:** Deploy without API key → verify error message shown

**Automated Testing (Out of Scope for MVP)**
- Skip unit tests for now
- Focus on end-to-end manual testing

---

## 🚀 Deployment / Running Locally

### Backend
```bash
cd backend
npm install
# Create .env file (for local tools/spikes):
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
DEPLOY_TARGET_REGION=eu-central-1
# Type-check:
npm run typecheck
# Build TS:
npm run build
# Validate + build SAM artifacts:
sam validate --lint --template-file template.yaml
sam build
# Run backend locally with SAM:
sam local start-api
# Deploy backend Lambda/API:
sam deploy --guided
```

### Frontend
```bash
cd frontend
npm install
# .env.local defaults
NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_USE_MOCKS=false
# run Next.js frontend (use port 3001 to avoid SAM API conflict)
npm run dev -- --port 3001
```

---

## 📝 Code Style / Conventions

- **TypeScript:** Strict mode enabled
- **Naming:**
  - Components: PascalCase (`DeployButton.tsx`)
  - Functions: camelCase (`deployLambda()`)
  - Constants: UPPER_SNAKE_CASE (`AWS_REGION`)
- **Error Handling:** Try-catch blocks with user-friendly error messages
- **Comments:** Only where logic is non-obvious (avoid over-commenting)

---

## 🧭 Agent Operating Principles (Mandatory)

- Operate independently: do not wait for step-by-step instructions when the next action is clear.
- Act autonomously in the terminal: run commands, inspect code, implement, and validate changes end-to-end.
- Be proactive: propose and, when low-risk, execute additional improvements that increase MVP ship confidence.
- Communicate clearly and directly: concise status updates, explicit assumptions, concrete next steps.
- Default behavior: move work forward unless blocked by a true product/architecture decision.
- Commit regularly after completing meaningful slices, and push to remote to preserve progress.
- Treat SAM template + Lambda runtime as part of the source of truth; keep code and infra definitions aligned in each backend change.

---

## 🤖 Instructions for AI Agents

**When starting a task:**
1. Read `PLAN.md` → find your task
2. Check if prerequisites are done (e.g., backend setup before deploy endpoint)
3. Read relevant context above (e.g., "Lambda Template Structure" for template tasks)

**While working:**
- Ask questions if blocked (e.g., "Should I use archiver or AdmZip?")
- Log decisions in `DECISIONS.md` if you make architectural choices
- Update `PLAN.md` (check off completed tasks)

**Before finishing:**
- Test your code manually (run it, verify output)
- Update `AGENTS.md` if you discovered important context
- Mark task as ✅ in `PLAN.md`

**Communication style:**
- Be direct, technical, concise
- Focus on shipping, not perfection
- If stuck >20 min → ask for help or simplify scope

---

## ⚠️ Blockers / Open Questions

Track blockers in `DECISIONS.md` under **Open Questions / Blockers**.
Add new blockers there (with status, options, and recommendation).

---

## 📚 Useful Resources

- **AWS Lambda Function URLs:** https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html
- **AWS SDK v3 (Lambda):** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/lambda/
- **AWS SDK v3 (S3):** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
- **OpenAI Node SDK:** https://github.com/openai/openai-node
- **Monaco Editor React:** https://github.com/suren-atoyan/monaco-react

---

## 🎯 Success Criteria

Use this as the canonical Definition of Done:

| Check | Must Pass |
|---|---|
| Template load | Chat Completion template is loaded by default in the editor |
| Context upload | User can upload a `.txt` file and receive S3 URL(s) |
| OpenAI key input | User can provide key in UI and deploy request includes it |
| Deploy action | Clicking Deploy creates Lambda + Function URL |
| Context wiring | Deployed function receives `S3_CONTEXT_FILES` env var when applicable |
| Invocation | `curl -X POST <functionUrl> -d '{"message":"Hello"}'` returns model response |
| Error handling | Missing key / deploy failure surfaces clear user-facing error |

**If that works → ship it.** Everything else is bonus.

---

**Last Updated:** 2026-02-15 20:15 GMT+2  
**Status:** Chat-only MVP active. Backend implemented; frontend moving to Next.js + Tailwind + shadcn/ui + MSW.

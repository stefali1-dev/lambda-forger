# AGENTS.md - Context for AI Coding Agents

**Project:** AI Lambda Builder MVP  
**Goal:** Ship a working prototype TODAY (Feb 15, 2026)  
**Time Budget:** 8-10 hours

---

## 🎯 What We're Building

A web app where users can:
1. Select an AI Lambda template (Chat Completion, Streaming Chat, Image Generation)
2. Edit TypeScript code in a VS Code-style browser editor
3. Upload context files (for Chat Completion template)
4. Enter their OpenAI API key
5. Click "Deploy" → Backend creates AWS Lambda + S3 upload → Returns public function URL
6. User gets a working AI endpoint they can call immediately

**Core value:** "Write an OpenAI Lambda function → Deploy to AWS in one click"

---

## 📋 Master Plan

See `PLAN.md` for the complete TODO list, spikes, and task breakdown.

**You should:**
- ✅ Check `PLAN.md` before starting work (understand what's already done)
- ✅ Update `PLAN.md` as you complete tasks (check off `[ ]` items)
- ✅ Update this file (`AGENTS.md`) if you discover important context
- ✅ Log blockers/decisions in `DECISIONS.md` (create if needed)

---

## 🏗️ Project Structure

```
ai-lambda-builder/
├── PLAN.md              # Master TODO list (READ THIS FIRST)
├── AGENTS.md            # This file (context for AI agents)
├── DECISIONS.md         # Architecture decisions & blockers (create as needed)
├── frontend/            # React + TypeScript app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Editor.tsx          # Monaco editor wrapper
│   │   │   ├── TemplateSelector.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── DeployButton.tsx
│   │   ├── templates/              # Lambda code templates (as strings)
│   │   │   ├── chatCompletion.ts
│   │   │   ├── streamingChat.ts
│   │   │   └── imageGeneration.ts
│   │   └── App.tsx
│   └── package.json
├── backend/             # Node.js + Express API
│   ├── src/
│   │   ├── server.ts               # Express server entry point
│   │   ├── deploy.ts               # Lambda deployment logic (AWS SDK)
│   │   └── s3Upload.ts             # S3 file upload handler
│   └── package.json
└── README.md
```

---

## 🔧 Tech Stack

**Frontend:**
- React + TypeScript (created via `create-react-app`)
- `@monaco-editor/react` (VS Code editor in browser)
- `axios` (API calls to backend)

**Backend:**
- Node.js + Express + TypeScript
- `@aws-sdk/client-lambda` (create Lambda functions)
- `@aws-sdk/client-s3` (upload context files)
- `@aws-sdk/client-iam` (create execution role if needed)

**AWS Resources We Create:**
- Lambda Function (Node.js 20.x runtime)
- Lambda Function URL (public HTTPS endpoint, CORS enabled)
- S3 Bucket (for user-uploaded context files)
- IAM Execution Role (for Lambda to access S3)

---

## 🎯 MVP Scope (What's IN / What's OUT)

### ✅ IN SCOPE (Must Have)
- 3 Lambda templates: Chat Completion, Streaming Chat, Image Generation
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
- Custom runtimes (only Node.js 20.x)

---

## 🚨 Critical Constraints

**1. AWS Lambda Function URLs (NEW AWS FEATURE)**
- Use `CreateFunctionUrlConfigCommand` to get public HTTPS endpoint
- **No API Gateway needed** (simplifies MVP)
- Enable CORS in function URL config
- Research: https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html

**2. Lambda Deployment Package**
- Must zip: user code + `node_modules` (openai package)
- Use `archiver` npm package or `AdmZip`
- Include `package.json` with `"type": "module"` if using ES modules
- **Blocker:** Bundling dependencies — may need esbuild/webpack

**3. IAM Execution Role**
- Lambda needs an execution role to run
- Minimum permissions: `AWSLambdaBasicExecutionRole` + S3 read (if using context files)
- **Decision needed:** Create role programmatically OR require user to create manually?

**4. Streaming Response (Streaming Chat Template)**
- Lambda Function URLs support response streaming (as of 2024)
- Requires `Invoke mode: RESPONSE_STREAM` in function config
- Research: https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/

**5. S3 File Upload**
- Store user context files in S3: `ai-lambda-context-{randomId}/file.txt`
- Pass S3 URLs as env vars to Lambda
- Lambda reads from S3 at runtime (use `@aws-sdk/client-s3`)

---

## 🧠 Key Architectural Decisions

### **Decision 1: How to Bundle Lambda Code?**

**Options:**
1. **Zip user code + full `node_modules`** (simple, but large zip)
2. **Use esbuild to bundle** (faster, smaller, but adds complexity)
3. **Use Lambda Layers for dependencies** (cleaner, but MVP overkill)

**Recommendation for MVP:** Option 1 (zip with node_modules). We can optimize later.

**Implementation:**
```typescript
// backend/src/deploy.ts
import archiver from 'archiver';
import fs from 'fs';

// 1. Write user code to temp file (handler.js)
// 2. Create package.json with "openai" dependency
// 3. Run `npm install` in temp dir
// 4. Zip temp dir → upload to Lambda
```

### **Decision 2: Where to Store User Context Files?**

**Option 1:** S3 (persistent, user can reuse)  
**Option 2:** Lambda /tmp (ephemeral, lost after execution)

**Choice:** S3 (allows multi-invocation context, better UX)

### **Decision 3: How to Handle OpenAI API Key?**

**Options:**
1. User enters key in UI → passed as Lambda env var (CHOSEN for MVP)
2. User creates AWS Secrets Manager secret → Lambda reads it
3. We store keys in our backend DB (requires auth, out of scope)

**Choice:** Option 1 (simplest, no secrets management needed)

---

## 📦 Lambda Template Structure

Each template is a **self-contained Lambda handler** (TypeScript/JavaScript code as a string).

**Example: Chat Completion Template**

```typescript
// templates/chatCompletion.ts
export const chatCompletionTemplate = `
import OpenAI from 'openai';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const handler = async (event) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Read context files from S3 (env var S3_CONTEXT_FILES = "s3://bucket/file1.txt,s3://bucket/file2.txt")
  const s3 = new S3Client({ region: 'us-east-1' });
  const contextFilesUrls = (process.env.S3_CONTEXT_FILES || '').split(',');
  
  const contextFiles = await Promise.all(
    contextFilesUrls.map(async (url) => {
      const [bucket, key] = url.replace('s3://', '').split('/');
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3.send(command);
      return response.Body.transformToString();
    })
  );
  
  const context = contextFiles.join('\\\\n\\\\n');
  
  const body = JSON.parse(event.body);
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: context },
      { role: 'user', content: body.message }
    ]
  });
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: completion.choices[0].message.content })
  };
};
`;
```

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
  "template": "chatCompletion" | "streamingChat" | "imageGeneration",
  "openaiKey": "sk-...",
  "s3ContextFiles": ["s3://bucket/file1.txt"] // optional, only for chatCompletion
}
```

**Response:**
```json
{
  "functionUrl": "https://abc123.lambda-url.us-east-1.on.aws/",
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
8. Call `CreateFunctionCommand` (runtime: nodejs20.x, handler: handler.handler)
9. Call `CreateFunctionUrlConfigCommand` (auth: NONE, CORS: enabled)
10. Return function URL

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
1. **Template Selection:** Select each template → verify code loads in editor
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
# Create .env file:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
npm run dev  # starts Express server on http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
# Update API endpoint in src/config.ts (if needed)
npm start  # starts React app on http://localhost:3000
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

**Track blockers here as you encounter them:**

- [ ] **Blocker 1:** IAM role creation — should we create programmatically or require user to create manually?
  - **Decision:** TBD (document in DECISIONS.md when resolved)

- [ ] **Blocker 2:** Lambda dependency bundling — archiver vs esbuild?
  - **Decision:** TBD

*(Add more as you go)*

---

## 📚 Useful Resources

- **AWS Lambda Function URLs:** https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html
- **AWS SDK v3 (Lambda):** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/lambda/
- **AWS SDK v3 (S3):** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
- **OpenAI Node SDK:** https://github.com/openai/openai-node
- **Monaco Editor React:** https://github.com/suren-atoyan/monaco-react

---

## 🎯 Success Criteria

**We're DONE when:**
1. User can select "Chat Completion" template
2. User can upload a .txt file (context)
3. User enters OpenAI API key
4. User clicks "Deploy"
5. Backend creates Lambda + uploads file to S3
6. User gets function URL
7. User curls the URL with `{"message": "Hello"}` → gets AI response that references uploaded context

**If that works → ship it.** Everything else is bonus.

---

**Last Updated:** 2026-02-15 13:05 GMT+2  
**Status:** Ready to build. Start with SPIKE 1 in PLAN.md.

# PLAN.md - AI Lambda Builder MVP

**Time Budget:** 8-10 hours (ship today)  
**Status:** 🚀 Chat-only MVP scope  
**Last Updated:** 2026-02-15 17:55 EET

---

## ⚠️ Important: This is a GUIDELINE, not a prison

**You're a smart agent. If you see a better way, DO IT.**

- See a simpler implementation? Use it.
- Want to reorganize tasks? Go ahead.
- Found a better package/approach? Switch.
- Think a task is unnecessary? Skip it and explain why in `DECISIONS.md`.

**What matters:** Ship a working MVP by end of day. The path doesn't matter.

**Update this file as you go:** Check off tasks, reorder if needed, add notes.

### Agent Execution Expectations (Mandatory)
- Work independently and choose the next best action without waiting for micromanagement.
- Use full terminal access proactively to inspect, implement, and verify.
- Propose additional high-impact initiatives when they improve ship readiness.
- Communicate in clear, direct, concise technical language.
- If a task is blocked, document it in `DECISIONS.md` with options and a recommendation.
- Commit and push after each completed task slice to avoid losing working progress.

## 🚀 Runbook First

```bash
# Terminal 1
cd backend
npm install
npm run dev

# Terminal 2
cd frontend
npm install && npm start
```

---

## 🎯 Goal

Goal and scope are canonical in `AGENTS.md` under:
- `🧲 Product Positioning (Canonical)`
- `🎯 MVP Scope (What's IN / What's OUT)`
- `🎯 Success Criteria`

Execution framing for agents:
- Prioritize tasks that reduce time-to-first-chatbot for frontend developers.
- For UX/copy choices, prefer wording that highlights "context-aware chatbot endpoint in minutes."

---

## 📋 TODO LIST

### **PHASE 1: Backend - AWS Deployment Engine** (~3-4 hours)

#### SPIKE 1: Research AWS Lambda Function URLs ⚠️ **DO THIS FIRST**
- [x] Read AWS docs: https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html
- [x] Understand: `CreateFunctionCommand` + `CreateFunctionUrlConfigCommand`
- [x] Test: Create a "hello world" Lambda programmatically via AWS SDK
- [x] Verify: Function URL works (no API Gateway needed)
- [x] Check: CORS configuration options
- **Time estimate:** 30 min

Progress note (2026-02-15): added `backend/src/spikes/functionUrlSpike.ts`, validated creation + invocation + cleanup in `eu-central-1`; function URL requires explicit `AddPermission` calls for `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (invoked-via-url).

**Why this matters:** This determines if the whole MVP is feasible. If Function URLs don't work, we pivot.

---

#### Task 1.1: Set up backend project
- [x] `mkdir -p ~/your-project/backend && cd ~/your-project/backend`
- [x] `npm init -y`
- [x] Install deps:
  ```bash
  npm i express cors aws-sdk @aws-sdk/client-lambda @aws-sdk/client-s3 @aws-sdk/client-iam dotenv archiver
  npm i -D @types/node @types/express typescript ts-node nodemon
  ```
- [x] Create `tsconfig.json` (or use `npx tsc --init`)
- [x] Create `.env`:
  ```
  AWS_ACCESS_KEY_ID=your_key
  AWS_SECRET_ACCESS_KEY=your_secret
  AWS_REGION=eu-central-1
  PORT=3001
  ```
- [x] Create `src/server.ts` basic Express server (hello world endpoint)
- [x] Test: `npm run dev` → curl http://localhost:3001 → get response
- **Time estimate:** 15 min

Progress note (2026-02-15): dependencies installed, scripts added in `backend/package.json`, and `.env.example` created.

---

#### Task 1.2: Build Lambda deployment endpoint ⭐ **CORE FEATURE**
- [x] Create `POST /deploy` endpoint in `src/server.ts`
- [x] Validate request body: `code`, `template: "chatCompletion"`, `openaiKey`, optional `s3ContextFiles`
- [ ] Implement deploy flow checklist:
  1. [x] Generate function name (`ai-lambda-${randomId()}`)
  2. [x] Create temp dir and write `handler.js`
  3. [x] Write `package.json` with `openai` dependency
  4. [x] Install prod deps (`npm install --production`) or reuse cached deps
  5. [x] Zip package
  6. [x] Resolve IAM role ARN (manual for MVP or SDK-created)
  7. [x] Create Lambda (`nodejs22.x`, `handler.handler`, timeout `30s`)
  8. [x] Set env vars (`OPENAI_API_KEY`, `S3_CONTEXT_FILES`)
  9. [x] Create Function URL (`AuthType: NONE`, CORS enabled)
  10. [x] Return `functionUrl`, `functionName`, `curlExample`
- [x] Match endpoint contract from `AGENTS.md` (`POST /deploy` section)

Progress note (2026-02-15): implemented `backend/src/deploy.ts` + wired `POST /deploy` in `backend/src/server.ts`; manual deploy test returned URL and successful `200` invocation.

**Shortcuts if stuck:**
- IAM role: Create manually in AWS console, hardcode ARN in code
- Zip: If archiver is complicated, use `child_process.exec('zip -r ...')`
- node_modules: Pre-zip openai package, copy into temp dir (skip npm install)

**Time estimate:** 2-3 hours (this is the hardest part)

---

#### Task 1.3: Build S3 file upload handler
- [x] Create `POST /upload` endpoint
- [x] Accept multipart/form-data (use `multer` middleware or manual parsing)
- [x] Generate unique folder: `ai-lambda-context-${randomId()}`
- [x] Upload files to S3:
  - Bucket: `ai-lambda-mvp` (create manually if doesn't exist)
  - Key: `${folderId}/filename.txt`
- [x] Return S3 URLs:
  ```json
  {
    "s3Urls": ["s3://ai-lambda-mvp/context-abc123/file1.txt"]
  }
  ```
- **Time estimate:** 45 min

Progress note (2026-02-15): implemented `backend/src/s3Upload.ts` and wired `/upload` in `backend/src/server.ts`; manual multipart upload returned S3 URL and object existence verified via `aws s3 ls`.

**Shortcut:** If S3 upload is too slow, skip it for MVP. Hardcode one sample context file in Lambda.

---

#### Task 1.4: Test backend manually
- [ ] Use Postman/curl to test `/deploy` with sample Lambda code:
  ```javascript
  exports.handler = async (event) => {
    return { statusCode: 200, body: JSON.stringify({ message: "Hello from Lambda!" }) };
  };
  ```
- [ ] Verify Lambda created in AWS console
- [ ] Verify function URL works: `curl https://abc123.lambda-url.../ -X POST -d '{}'`
- [ ] Test `/upload` endpoint with a .txt file
- **Time estimate:** 30 min

---

### **PHASE 2: Frontend - Editor + Deploy UI** (~3-4 hours)

#### Task 2.1: Set up React project
- [ ] `cd ~/your-project && npx create-react-app frontend --template typescript`
- [ ] `cd frontend && npm i @monaco-editor/react axios`
- [ ] Clean up boilerplate (`App.tsx`, remove default content)
- [ ] Test: `npm start` → see blank page
- **Time estimate:** 15 min

---

#### Task 2.2: Build Monaco editor component
- [ ] Create `src/components/Editor.tsx`
- [ ] Use `@monaco-editor/react`:
  ```tsx
  import Editor from '@monaco-editor/react';
  
  export default function CodeEditor({ value, onChange }) {
    return (
      <Editor
        height="60vh"
        language="typescript"
        theme="vs-dark"
        value={value}
        onChange={onChange}
      />
    );
  }
  ```
- [ ] Test: Import in `App.tsx`, render editor, verify it works
- **Time estimate:** 30 min

---

#### Task 2.3: Chat-only template wiring
- [ ] Set default editor content to Chat Completion template on app load
- [ ] Remove selector dependency for MVP path (or hide it behind a feature flag)
- [ ] Show small UI label: "MVP: Chat Completion with Context"
- **Time estimate:** 15 min

---

#### Task 2.4: Create Lambda templates ⭐ **IMPORTANT**
Create files:
- [ ] `frontend/src/templates/chatCompletion.ts`
- [ ] `frontend/src/templates/index.ts` exports chat template

Template requirements checklist:
- [ ] Chat template is a string containing a Lambda handler
- [ ] Parse `event.body` safely (`{}` fallback)
- [ ] Return JSON `{ statusCode, headers, body }`
- [ ] Use `process.env.OPENAI_API_KEY`
- [ ] `chatCompletion`: optionally read `process.env.S3_CONTEXT_FILES` and include context in system prompt
- [ ] Catch errors and return status `500` with user-readable error message

- **Time estimate:** 45 min

**Note:** These templates are starter code. User can edit them in the Monaco editor before deploying.

---

#### Task 2.5: Build file upload component
- [ ] Create `src/components/FileUpload.tsx`
- [ ] Drag-and-drop or file input
- [ ] On file select → call backend `/upload` → store returned S3 URLs
- [ ] Show uploaded file names below input
- [ ] Show this component in MVP flow (chat-only mode)
- **Time estimate:** 30 min

**Shortcut:** Skip drag-and-drop, just use `<input type="file" />`.

---

#### Task 2.6: Build deploy button
- [ ] Create `src/components/DeployButton.tsx`
- [ ] On click:
  1. Get code from editor state
  2. Get OpenAI API key from input field
  3. Get S3 file URLs (if any)
  4. Call backend `POST /deploy`
  5. Show loading spinner
  6. On success → display function URL + curl example
  7. On error → show error message
- **Time estimate:** 30 min

---

#### Task 2.7: Build UI layout
- [ ] Wire everything in `src/App.tsx`:
  - Header: "AI Lambda Builder"
  - Chat-only MVP label ("Chat Completion with Context")
  - OpenAI API key input (text input, type="password")
  - File upload component
  - Monaco editor (60% height)
  - Deploy button
  - Result section (function URL + curl example, only shown after deploy)
  
- [ ] Basic CSS (can be minimal, just make it readable)
- **Time estimate:** 45 min

---

#### Task 2.8: Wire everything together ⭐ **INTEGRATION**
- [ ] Connect editor onChange → save code to state
- [ ] Connect deploy button → backend API call
- [ ] Test full flow:
  1. Chat template is loaded by default
  2. Upload a .txt file
  3. Enter OpenAI API key
  4. Click deploy
  5. Verify function URL returned
  6. Curl the URL → get AI response
- **Time estimate:** 30 min

---

### **PHASE 3: Testing & Polish** (~1-2 hours)

#### Task 3.1: End-to-end test
- [ ] Test chat template end-to-end
- [ ] Verify deployed Lambdas work
- [ ] Fix bugs
- **Time estimate:** 45 min

---

#### Task 3.2: Basic error handling
- [ ] Backend: Catch Lambda creation errors → return friendly message
- [ ] Frontend: Show error toast/message if deploy fails
- [ ] Handle: missing API key, invalid code, AWS quota limits
- **Time estimate:** 30 min

---

#### Task 3.3: Minimal styling
- [ ] Clean layout (flexbox or grid)
- [ ] Loading spinner for deploy button
- [ ] Success/error message styling
- [ ] Make it not look like total garbage (but perfection not needed)
- **Time estimate:** 15 min

---

#### Task 3.4: Write README
- [ ] Project description
- [ ] Include positioning language for frontend developers (chatbot endpoint without backend/AWS complexity)
- [ ] Setup instructions (AWS credentials, npm install)
- [ ] Screenshots or demo video (optional)
- [ ] Use cases
- **Time estimate:** 15 min

---

## 🚨 CRITICAL SPIKES (Research Before Building)

Spike tasks are defined in **PHASE 1** above (SPIKE 1 first, then backend critical path).
Use `DECISIONS.md` to log outcomes, trade-offs, and any pivots.

---

## ⚡ CRITICAL PATH (What Blocks What)

```
SPIKE 1 → Task 1.2 (Deploy endpoint) ← MUST FINISH FIRST
          ↓
Task 2.4 (Templates) → Task 2.2 (Editor) → Task 2.8 (Integration)
          ↓
Task 1.3 (S3 upload) → Task 2.5 (File upload) → Task 2.8
          ↓
Task 1.2 + Task 2.8 → Task 3.1 (E2E test)
```

**Start with:** SPIKE 1, then Task 1.1 → 1.2 (backend critical path)  
**Parallel work:** Once backend is started, can work on frontend (Tasks 2.1-2.4)

---

## 🎯 SUCCESS CRITERIA

Canonical Definition of Done lives in `AGENTS.md` (`🎯 Success Criteria`).
This plan is complete when all DoD checks pass in a manual end-to-end run.

---

## 🔥 TIPS FOR STAYING FOCUSED

1. **Timebox ruthlessly:** If stuck >30 min → simplify or ask for help
2. **Cut scope aggressively:** 
   - Keep scope chat-only for MVP.
   - S3 upload buggy? Hardcode one file.
   - Ugly UI? Fine, it's an MVP.
3. **Test incrementally:** After each task → manual test
4. **Ship ugly:** Perfect is the enemy of done
5. **Use AI agents:** You have Copilot/Cursor. Let them write boilerplate.

---

## 📊 TIME ESTIMATE SUMMARY

| Phase | Time |
|-------|------|
| Spikes | 1 hour |
| Backend | 3-4 hours |
| Frontend | 3-4 hours |
| Testing & Polish | 1-2 hours |
| **TOTAL** | **8-10 hours** |

**Realistic?** Yes, if you start NOW and stay focused.

---

## 🚀 START HERE

1. **Do SPIKE 1** (15 min) → Research Lambda Function URLs
2. **Task 1.1** (15 min) → Set up backend
3. **Task 1.2** (2-3 hours) → Build deploy endpoint (HARDEST PART)
4. **Task 2.1-2.4** (parallel if needed) → Frontend setup + templates
5. **Task 2.8** (30 min) → Wire frontend + backend together
6. **Task 3.1** (45 min) → Test end-to-end
7. **Ship it** 🚢

---

## 📝 NOTES SECTION (Add as you go)

**Use this space for:**
- Things that worked well
- Things that didn't work (so you don't repeat them)
- Shortcuts you discovered
- Blockers you hit (and how you solved them)
- Post-MVP ideas (streaming, image generation)

---

**Next:** Do SPIKE 1, then start Task 1.1

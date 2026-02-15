# PLAN.md - AI Lambda Builder MVP

**Time Budget:** 8-10 hours (ship today)  
**Status:** 🚀 Ready to build  
**Last Updated:** 2026-02-15 13:21 GMT+2

---

## ⚠️ Important: This is a GUIDELINE, not a prison

**You're a smart agent. If you see a better way, DO IT.**

- See a simpler implementation? Use it.
- Want to reorganize tasks? Go ahead.
- Found a better package/approach? Switch.
- Think a task is unnecessary? Skip it and explain why in `DECISIONS.md`.

**What matters:** Ship a working MVP by end of day. The path doesn't matter.

**Update this file as you go:** Check off tasks, reorder if needed, add notes.

---

## 🎯 Goal

Build a web app where users can:
1. Select an AI Lambda template (Chat Completion, Streaming Chat, Image Generation)
2. Edit TypeScript code in a browser editor (Monaco)
3. Upload context files (for Chat Completion)
4. Enter OpenAI API key
5. Click "Deploy" → AWS Lambda created → Get public URL
6. Call the URL → Get AI-powered response

**Success = This works end-to-end.** Everything else is optional.

---

## 📋 TODO LIST

### **PHASE 1: Backend - AWS Deployment Engine** (~3-4 hours)

#### SPIKE 1: Research AWS Lambda Function URLs ⚠️ **DO THIS FIRST**
- [ ] Read AWS docs: https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html
- [ ] Understand: `CreateFunctionCommand` + `CreateFunctionUrlConfigCommand`
- [ ] Test: Create a "hello world" Lambda programmatically via AWS SDK
- [ ] Verify: Function URL works (no API Gateway needed)
- [ ] Check: CORS configuration options
- **Time estimate:** 30 min

**Why this matters:** This determines if the whole MVP is feasible. If Function URLs don't work, we pivot.

---

#### Task 1.1: Set up backend project
- [ ] `mkdir -p ~/your-project/backend && cd ~/your-project/backend`
- [ ] `npm init -y`
- [ ] Install deps:
  ```bash
  npm i express cors aws-sdk @aws-sdk/client-lambda @aws-sdk/client-s3 @aws-sdk/client-iam dotenv archiver
  npm i -D @types/node @types/express typescript ts-node nodemon
  ```
- [ ] Create `tsconfig.json` (or use `npx tsc --init`)
- [ ] Create `.env`:
  ```
  AWS_ACCESS_KEY_ID=your_key
  AWS_SECRET_ACCESS_KEY=your_secret
  AWS_REGION=us-east-1
  PORT=3001
  ```
- [ ] Create `src/server.ts` basic Express server (hello world endpoint)
- [ ] Test: `npm run dev` → curl http://localhost:3001 → get response
- **Time estimate:** 15 min

---

#### Task 1.2: Build Lambda deployment endpoint ⭐ **CORE FEATURE**
- [ ] Create `POST /deploy` endpoint in `src/server.ts`
- [ ] Accept request body:
  ```json
  {
    "code": "string (user's Lambda code)",
    "template": "chatCompletion | streamingChat | imageGeneration",
    "openaiKey": "sk-...",
    "s3ContextFiles": ["s3://bucket/file1.txt"] // optional
  }
  ```

**Implementation steps:**
1. [ ] Generate unique function name: `ai-lambda-${randomId()}`
2. [ ] Create temp directory: `/tmp/${functionName}/`
3. [ ] Write user code to `handler.js` in temp dir
4. [ ] Create `package.json` with `openai` dependency
5. [ ] Run `npm install --production` in temp dir (or copy pre-cached node_modules)
6. [ ] Zip the directory (use `archiver` package)
7. [ ] Create/get IAM execution role (hardcode role ARN for MVP, or create programmatically)
8. [ ] Call `CreateFunctionCommand`:
   - Runtime: `nodejs20.x`
   - Handler: `handler.handler`
   - Timeout: 30 seconds
   - Environment: `{ OPENAI_API_KEY: openaiKey, S3_CONTEXT_FILES: s3Files.join(',') }`
   - Role: IAM execution role ARN
9. [ ] Call `CreateFunctionUrlConfigCommand`:
   - Auth: `NONE` (public)
   - CORS: `{ AllowOrigins: ['*'], AllowMethods: ['POST', 'GET'], AllowHeaders: ['Content-Type'] }`
10. [ ] Return response:
    ```json
    {
      "functionUrl": "https://abc123.lambda-url.us-east-1.on.aws/",
      "functionName": "ai-lambda-abc123",
      "curlExample": "curl -X POST https://... -H 'Content-Type: application/json' -d '{\"message\":\"Hello\"}'"
    }
    ```

**Shortcuts if stuck:**
- IAM role: Create manually in AWS console, hardcode ARN in code
- Zip: If archiver is complicated, use `child_process.exec('zip -r ...')`
- node_modules: Pre-zip openai package, copy into temp dir (skip npm install)

**Time estimate:** 2-3 hours (this is the hardest part)

---

#### Task 1.3: Build S3 file upload handler
- [ ] Create `POST /upload` endpoint
- [ ] Accept multipart/form-data (use `multer` middleware or manual parsing)
- [ ] Generate unique folder: `ai-lambda-context-${randomId()}`
- [ ] Upload files to S3:
  - Bucket: `ai-lambda-mvp` (create manually if doesn't exist)
  - Key: `${folderId}/filename.txt`
- [ ] Return S3 URLs:
  ```json
  {
    "s3Urls": ["s3://ai-lambda-mvp/context-abc123/file1.txt"]
  }
  ```
- **Time estimate:** 45 min

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

#### Task 2.3: Build template selector
- [ ] Create `src/components/TemplateSelector.tsx`
- [ ] Dropdown with options:
  - "Chat Completion with Context"
  - "Streaming Chat"
  - "Image Generation"
- [ ] On change → call `onSelectTemplate(templateName)`
- **Time estimate:** 15 min

---

#### Task 2.4: Create Lambda templates ⭐ **IMPORTANT**
Create 3 files in `src/templates/`:

**File: `chatCompletion.ts`**
```typescript
export const chatCompletionTemplate = `
import OpenAI from 'openai';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const handler = async (event) => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Read context files from S3 (if provided)
    const s3 = new S3Client({ region: 'us-east-1' });
    const contextFilesUrls = (process.env.S3_CONTEXT_FILES || '').split(',').filter(Boolean);
    
    const contextFiles = await Promise.all(
      contextFilesUrls.map(async (url) => {
        const match = url.match(/s3:\\/\\/([^\\/]+)\\/(.+)/);
        if (!match) return '';
        const [, bucket, key] = match;
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3.send(command);
        return response.Body.transformToString();
      })
    );
    
    const context = contextFiles.join('\\\\n\\\\n');
    
    const body = JSON.parse(event.body || '{}');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: context || 'You are a helpful assistant.' },
        { role: 'user', content: body.message || 'Hello' }
      ]
    });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        response: completion.choices[0].message.content 
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
`;
```

**File: `streamingChat.ts`**
```typescript
export const streamingChatTemplate = `
import OpenAI from 'openai';

export const handler = async (event) => {
  // Note: Lambda Function URLs support streaming as of 2024
  // If streaming doesn't work, return SSE-formatted response in body
  
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = JSON.parse(event.body || '{}');
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: body.message || 'Hello' }],
      stream: true
    });
    
    // Simplified: Return full response (streaming via Function URL is complex for MVP)
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk.choices[0]?.delta?.content || '';
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: fullResponse })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
`;
```

**File: `imageGeneration.ts`**
```typescript
export const imageGenerationTemplate = `
import OpenAI from 'openai';

export const handler = async (event) => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = JSON.parse(event.body || '{}');
    
    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: body.prompt || 'A cat wearing a space suit',
      n: 1,
      size: '1024x1024'
    });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageUrl: image.data[0].url 
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
`;
```

**Also create:** `src/templates/index.ts` to export all templates:
```typescript
export { chatCompletionTemplate } from './chatCompletion';
export { streamingChatTemplate } from './streamingChat';
export { imageGenerationTemplate } from './imageGeneration';
```

- **Time estimate:** 45 min

**Note:** These templates are starter code. User can edit them in the Monaco editor before deploying.

---

#### Task 2.5: Build file upload component
- [ ] Create `src/components/FileUpload.tsx`
- [ ] Drag-and-drop or file input
- [ ] On file select → call backend `/upload` → store returned S3 URLs
- [ ] Show uploaded file names below input
- [ ] Only show this component when "Chat Completion" template is selected
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
  - Template selector dropdown
  - OpenAI API key input (text input, type="password")
  - File upload component (conditional, only for Chat Completion)
  - Monaco editor (60% height)
  - Deploy button
  - Result section (function URL + curl example, only shown after deploy)
  
- [ ] Basic CSS (can be minimal, just make it readable)
- **Time estimate:** 45 min

---

#### Task 2.8: Wire everything together ⭐ **INTEGRATION**
- [ ] Connect template selector → load template code → editor
- [ ] Connect editor onChange → save code to state
- [ ] Connect deploy button → backend API call
- [ ] Test full flow:
  1. Select "Chat Completion"
  2. Upload a .txt file
  3. Enter OpenAI API key
  4. Click deploy
  5. Verify function URL returned
  6. Curl the URL → get AI response
- **Time estimate:** 30 min

---

### **PHASE 3: Testing & Polish** (~1-2 hours)

#### Task 3.1: End-to-end test
- [ ] Test all 3 templates (or at least 1-2 if time is tight)
- [ ] Verify deployed Lambdas work
- [ ] Fix bugs
- **Time estimate:** 45 min

**If tight on time:** Ship with just 1 working template. Can add others later.

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
- [ ] Setup instructions (AWS credentials, npm install)
- [ ] Screenshots or demo video (optional)
- [ ] Use cases
- **Time estimate:** 15 min

---

## 🚨 CRITICAL SPIKES (Research Before Building)

### SPIKE 1: AWS Lambda Function URLs (DO THIS FIRST) ⚠️
**Question:** Can we create public Lambda endpoints without API Gateway?

**Research:**
- AWS docs: https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html
- How to: `CreateFunctionUrlConfigCommand` in AWS SDK v3
- CORS configuration options
- Does streaming response work?

**Why critical:** If this doesn't work, we need API Gateway (adds complexity).

**Time:** 15 min

---

### SPIKE 2: Lambda Deployment Package
**Question:** How to zip Lambda code + node_modules efficiently?

**Research:**
- Use `archiver` npm package: https://www.npmjs.com/package/archiver
- Alternative: `child_process.exec('zip -r ...')`
- Can we pre-zip openai package and copy it?

**Time:** 20 min

---

### SPIKE 3: IAM Role for Lambda
**Question:** Can we create IAM execution role programmatically, or require manual setup?

**Options:**
1. Create role via `@aws-sdk/client-iam` (complex)
2. Hardcode existing role ARN (simple, requires user setup)
3. Use AWS-managed role (if exists)

**Recommendation:** Start with option 2 (hardcode ARN). Can automate later.

**Time:** 15 min

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

**We're DONE when this works:**

1. ✅ User selects "Chat Completion" template
2. ✅ User uploads a .txt file (e.g., "Product: We make AI tools. Features: Easy to use, fast, secure.")
3. ✅ User enters their OpenAI API key
4. ✅ User clicks "Deploy"
5. ✅ Backend creates Lambda + uploads file to S3
6. ✅ User gets function URL
7. ✅ User runs:
   ```bash
   curl -X POST https://abc123.lambda-url.us-east-1.on.aws/ \
     -H 'Content-Type: application/json' \
     -d '{"message": "What product do you offer?"}'
   ```
8. ✅ Gets response: `{"response": "We offer AI tools that are easy to use, fast, and secure."}`

**If that works → SHIP IT.** Everything else is bonus.

---

## 🔥 TIPS FOR STAYING FOCUSED

1. **Timebox ruthlessly:** If stuck >30 min → simplify or ask for help
2. **Cut scope aggressively:** 
   - Streaming chat too hard? Skip it.
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

---

**Last Updated:** 2026-02-15 13:21 GMT+2  
**Status:** 🚀 Ready to build  
**Next:** Do SPIKE 1, then start Task 1.1

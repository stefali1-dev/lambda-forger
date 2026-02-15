# DECISIONS.md - Architecture Decisions & Blockers

**Project:** AI Lambda Builder MVP  
**Started:** 2026-02-15  
**Purpose:** Track key decisions, blockers, and why we chose certain approaches

---

## Decision Log

### Decision 1: Use Lambda Function URLs (not API Gateway)
**Date:** 2026-02-15 13:00  
**Context:** Need public HTTPS endpoint for deployed Lambdas  
**Options:**
1. API Gateway + Lambda (traditional approach)
2. Lambda Function URLs (newer AWS feature)

**Chosen:** Lambda Function URLs  
**Why:**
- Simpler for MVP (one AWS resource vs two)
- Built-in CORS support
- No extra configuration needed
- Public URLs out of the box

**Trade-offs:**
- Less control over routing/auth (fine for MVP)
- Function URLs are newer (but stable as of 2024)

---

### Decision 2: Zip with node_modules (not bundling)
**Date:** 2026-02-15 13:00  
**Context:** How to package Lambda code + dependencies  
**Options:**
1. Zip user code + full node_modules
2. Use esbuild to bundle into single file
3. Use Lambda Layers for dependencies

**Chosen:** Option 1 (zip with node_modules)  
**Why:**
- Simplest implementation (archiver npm package)
- No build tool complexity
- Works for MVP size constraints

**Trade-offs:**
- Larger zip files (slower uploads)
- Cold start slightly slower
- Can optimize later with esbuild if needed

---

### Decision 3: S3 for context files (not Lambda /tmp)
**Date:** 2026-02-15 13:00  
**Context:** Where to store user-uploaded context files  
**Options:**
1. S3 bucket (persistent storage)
2. Lambda /tmp directory (ephemeral)

**Chosen:** S3  
**Why:**
- Persistent (files survive across invocations)
- User can update context without redeploying Lambda
- Better UX for "chatbot with knowledge base" use case

**Trade-offs:**
- Need S3 read permissions in Lambda execution role
- Slightly slower first read (S3 API call)

---

### Decision 4: User-provided OpenAI API key (not secrets management)
**Date:** 2026-02-15 13:00  
**Context:** How to handle OpenAI API keys securely  
**Options:**
1. User enters key in UI → passed as Lambda env var
2. User creates AWS Secrets Manager secret → Lambda reads it
3. We store keys in database (requires auth)

**Chosen:** Option 1 (env var)  
**Why:**
- No auth needed (MVP constraint)
- No secrets management complexity
- User owns their own key (no liability for us)

**Trade-offs:**
- Key stored in Lambda env vars (visible in AWS console)
- Not ideal for production, but acceptable for MVP/demo

---

### Decision 5: 3 Templates (Chat, Streaming, Image)
**Date:** 2026-02-15 13:00  
**Context:** Which AI use cases to support in MVP  
**Chosen:**
1. Chat Completion with Context (file upload → S3 → OpenAI)
2. Streaming Chat (token-by-token SSE response)
3. Image Generation (DALL-E prompt → image URL)

**Why:**
- Covers text + image AI use cases
- Shows file handling (S3 integration)
- Shows advanced feature (streaming)
- Easy to demo visually

**Skipped for MVP:**
- Text-to-speech (lower demand)
- Function calling (too complex)
- JSON mode (can add later)

**Status:** Superseded by Decision 7 (chat-only MVP scope)

---

### Decision 6: Agent Operating Mode = Autonomous + Proactive
**Date:** 2026-02-15 13:30  
**Context:** Define how AI agents should behave in this repo to maximize delivery speed

**Chosen:**
1. Agents operate independently and execute tasks end-to-end when requirements are clear
2. Agents use terminal access directly for implementation and verification
3. Agents proactively propose and execute low-risk, high-impact improvements
4. Agents communicate with clear, direct technical updates

**Why:**
- Reduces coordination overhead
- Increases delivery speed for same-day MVP target
- Improves quality by encouraging verification, not just code edits

**Trade-offs:**
- Higher chance of broader changes; mitigated by writing decisions/blockers in this file
- Requires disciplined communication and task tracking in `PLAN.md`

---

### Decision 7: Chat-only MVP scope (defer streaming + image)
**Date:** 2026-02-15 14:25  
**Context:** Reduce scope risk and ship a reliable MVP faster

**Chosen:**
1. MVP supports only Chat Completion with S3 context files
2. Streaming Chat and Image Generation are post-MVP features

**Why:**
- Shortest path to working end-to-end value
- Lower integration and debugging complexity
- Faster validation of core user need (context-aware chat endpoint deployment)

**Trade-offs:**
- Narrower initial demo surface
- Streaming and image use cases delayed to v2

---

### Decision 8: Product Positioning = Frontend-first chatbot endpoint
**Date:** 2026-02-15 14:40  
**Context:** Clarify go-to-market framing so product and UX decisions stay consistent

**Chosen positioning:**
1. Audience: frontend developers
2. Promise: "From static site to context-aware chatbot endpoint in minutes"
3. Value framing: upload context files + deploy API endpoint without backend/AWS complexity

**Why:**
- Aligns tightly with current chat-only MVP capabilities
- Speaks directly to a concrete pain point and user persona
- Improves clarity for copy, onboarding, and feature prioritization

**Trade-offs:**
- Narrower initial audience positioning
- Less emphasis on broader "AI Lambda builder" use cases until later versions

---

### Decision 9: IAM execution role creation = automatic
**Date:** 2026-02-15  
**Context:** Decide whether deployment should require a pre-created IAM role or create one programmatically

**Chosen:**
1. Backend creates/updates the Lambda execution role automatically via AWS SDK

**Why:**
- Better "one-click deploy" UX for frontend-first audience
- Removes a manual AWS prerequisite from MVP flow
- Current AWS identity has sufficient permissions, so delivery risk is low

**Trade-offs:**
- Slightly more backend complexity (role existence checks + policy attach)
- Must handle IAM eventual consistency (wait/retry before Lambda create)

---

### Decision 10: Default region and context bucket
**Date:** 2026-02-15  
**Context:** Align runtime defaults with available account setup and create a dedicated S3 bucket for context files

**Chosen:**
1. Default AWS region: `eu-central-1`
2. Dedicated context bucket: `ai-lambda-mvp-873550638583-euc1`

**Why:**
- Matches currently configured AWS CLI/account region
- Keeps MVP resources isolated from existing SAM/project buckets
- Reduces setup friction for local development and manual testing

**Trade-offs:**
- Public examples/docs now assume Frankfurt region unless overridden

---

### Decision 11: Function URL public invoke requires explicit resource-policy permissions
**Date:** 2026-02-15  
**Context:** SPIKE 1 showed `CreateFunctionUrlConfig(AuthType: NONE)` alone returned `403 Forbidden` on invoke

**Chosen:**
1. After creating Function URL, backend must call `AddPermission` for:
   - `lambda:InvokeFunctionUrl` with `FunctionUrlAuthType: NONE`
   - `lambda:InvokeFunction` with `InvokedViaFunctionUrl: true`

**Why:**
- AWS Function URL auth behavior changed (new URLs created after Oct 2025 require both permissions for public invoke)
- Without both statements, public URL invocation fails even when URL auth type is `NONE`

**Trade-offs:**
- Slightly more deployment logic and IAM policy operations
- Must generate unique statement IDs and handle idempotency on retries

---

### Decision 12: Backend upload endpoint ensures context bucket exists
**Date:** 2026-02-15  
**Context:** `POST /upload` should work even when the target context bucket has not been created manually yet

**Chosen:**
1. `/upload` first checks bucket existence with `HeadBucket`
2. If missing, backend creates it using `CreateBucket` in configured region

**Why:**
- Reduces setup friction for first run
- Keeps MVP closer to "works out of the box" behavior

**Trade-offs:**
- Requires bucket-creation permission in caller AWS identity
- First upload can be slightly slower on fresh setup

---

### Decision 13: Backend control plane runs on SAM-deployed Lambda (Node.js + TypeScript)
**Date:** 2026-02-15  
**Context:** Align MVP backend hosting with cheap, easy deployment and infrastructure-as-code requirements

**Chosen:**
1. Replace Express server backend with a Lambda route handler
2. Deploy backend using AWS SAM (`backend/template.yaml`)
3. Keep route contract unchanged (`GET /health`, `POST /deploy`, `POST /upload`)

**Why:**
- Lower ops overhead and closer production parity with app purpose
- One-command build/deploy path with SAM
- Keeps backend cost low for low-traffic MVP usage

**Trade-offs:**
- Multipart parsing is less ergonomic in Lambda than Express
- IAM permissions are now defined in SAM and need deliberate tightening after MVP

---

### Decision 14: Pin user-deployment region and make bucket errors explicit
**Date:** 2026-02-15  
**Context:** Local SAM testing showed user Lambdas could be created in an unintended region and `/upload` could fail with opaque bucket-create errors

**Chosen:**
1. Add explicit `DEPLOY_TARGET_REGION` env var for all user Lambda and S3 operations
2. Keep bucket auto-create behavior, but handle ownership/already-exists errors with deterministic messages

**Why:**
- Avoids accidental deployments to `us-east-1` during local/testing environments
- Preserves MVP ease-of-use while making failures easier to debug

**Trade-offs:**
- One more env var to manage in deployment config
- Slightly more branching in S3 setup path

---

## Open Questions / Blockers

### Blocker 1: IAM Role Creation Strategy
**Status:** ✅ RESOLVED by Decision 9  
**Resolution:** Role will be created programmatically by backend deployment flow.

---

### Blocker 2: Streaming Response Implementation
**Status:** 🕒 DEFERRED (Post-MVP)  
**Question:** Do Lambda Function URLs support response streaming natively?

**To research:**
- AWS Lambda streaming docs: https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/
- CreateFunctionCommand config for streaming
- Alternative: Return SSE-formatted response in body (hack)

**Next steps:** Revisit after chat-only MVP is shipped.

---

### Blocker 3: Lambda Deployment Package Size
**Status:** 📊 MONITOR  
**Concern:** node_modules with openai package might exceed Lambda size limits

**Lambda limits:**
- 50 MB zipped (direct upload)
- 250 MB unzipped

**Mitigation:**
- openai package is ~2-3 MB (should be fine)
- If exceeds: switch to S3 upload method or use esbuild bundling

---

### Blocker 4: SPIKE 1 execution missing IAM role ARN
**Status:** ✅ RESOLVED  
**Question:** Which role ARN should be used for the temporary Lambda URL spike run?

**Resolution (2026-02-15):**
1. Created IAM role `ai-lambda-builder-mvp-role`
2. Attached `AWSLambdaBasicExecutionRole` and `AmazonS3ReadOnlyAccess`
3. Set `MVP_LAMBDA_ROLE_ARN` in local backend `.env`
4. Re-ran spike successfully with HTTP 200 invocation response

---

### Blocker 5: SAM backend IAM scope is broad for MVP speed
**Status:** 📊 MONITOR  
**Concern:** `backend/template.yaml` currently uses broad managed policies to unblock fast deployment (`AWSLambda_FullAccess`, `IAMFullAccess`, `AmazonS3FullAccess`)

**Mitigation path:**
1. Keep broad policies for same-day MVP shipping
2. Tighten to least-privilege policy statements immediately after MVP validation

---

## Future Decisions (Post-MVP)

**1. Pricing Model**
- Per-function? Per-invocation? Subscription?
- Need to calculate AWS cost passthrough + margin

**2. Multi-Model Support**
- Add Anthropic, Gemini, Mistral?
- Requires template variations for each provider

**3. Monitoring & Logs**
- CloudWatch integration?
- Custom logs dashboard?

**4. Template Marketplace**
- Allow users to share templates?
- Community-contributed integrations?

---

## How to Use This File

**When you encounter a decision point:**
1. Document the context + options
2. Choose one and explain why
3. Note trade-offs
4. Mark date + decision number

**When you hit a blocker:**
1. Add to "Open Questions" section
2. Mark status (⚠️ needs decision, 🔍 needs research, 🕒 deferred, 📊 monitor)
3. List next steps to unblock

**Update this file as you work** — it's your architectural memory.

---

**Last Updated:** 2026-02-15

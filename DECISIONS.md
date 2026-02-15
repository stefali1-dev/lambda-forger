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

---

## Open Questions / Blockers

### Blocker 1: IAM Role Creation Strategy
**Status:** ⚠️ NEEDS DECISION  
**Question:** Should we create IAM execution role programmatically or require user to create manually?

**Option A:** Create role via AWS SDK
- Pros: Fully automated, better UX
- Cons: Requires IAM permissions, more complex error handling

**Option B:** Require user to create role manually (provide instructions)
- Pros: Simpler MVP implementation
- Cons: Extra setup step, worse UX

**Recommendation:** Start with Option B (manual), add Option A post-MVP if needed.

---

### Blocker 2: Streaming Response Implementation
**Status:** ⚠️ NEEDS RESEARCH  
**Question:** Do Lambda Function URLs support response streaming natively?

**To research:**
- AWS Lambda streaming docs: https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/
- CreateFunctionCommand config for streaming
- Alternative: Return SSE-formatted response in body (hack)

**Next steps:** Run SPIKE 1 to validate streaming support.

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
2. Mark status (⚠️ needs decision, 🔍 needs research, 📊 monitor)
3. List next steps to unblock

**Update this file as you work** — it's your architectural memory.

---

**Last Updated:** 2026-02-15 13:12 GMT+2

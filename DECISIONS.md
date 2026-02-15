# DECISIONS.md - Active Decisions & Blockers

**Project:** AI Lambda Forger MVP v2  
**Purpose:** Keep only active/current decisions and blockers.  
**History:** `DECISIONS_ARCHIVE.md`

## Active Decisions

### D1: v2 remains chat-focused (no streaming/image execution yet)
**Date:** 2026-02-15  
**Decision:** Keep backend and runtime strict to `template: "chatCompletion"` while exposing roadmap affordance in UI.

Why:
- Preserves delivery focus and reliability for current core value.
- Avoids partial support for deferred capabilities.

---

### D2: Deploy API cutover is hard and explicit
**Date:** 2026-02-15  
**Decision:** Remove v1 `code` payload support; require `files[]` + `entryFile` with actionable migration `400`.

Why:
- Avoids dual behavior ambiguity.
- Aligns frontend workspace model with backend packaging model.

---

### D3: Entry file contract is fixed handler symbol in v2
**Date:** 2026-02-15  
**Decision:** Require entry file to export ESM `handler`; backend bundles selected entry to `handler.mjs` and deploys with `Handler: "handler.handler"`.

Why:
- Deterministic runtime target.
- Clear validation errors for misconfigured entry files.

---

### D4: System prompt is deployment configuration, not template constant
**Date:** 2026-02-15  
**Decision:** UI sends `systemPrompt`, backend injects `SYSTEM_PROMPT`, runtime template reads env var with fallback.

Why:
- Faster per-deployment customization.
- No template source edits required for prompt tuning.

---

### D5: v2 release gate requires real AWS/OpenAI evidence
**Date:** 2026-02-15  
**Decision:** Run real upload/deploy/invoke and negative-path tests using runtime `OPENAI_API_KEY`; record concise evidence in `PLAN.md`.

Why:
- Mock-only validation is insufficient for deployment/runtime risks.
- Ensures end-to-end behavior is verified before closure.

---

### D6: Validation strictness applies to file paths and extensions
**Date:** 2026-02-15  
**Decision:** Reject unsafe/ambiguous paths and unsupported extensions; support `.ts`, `.js`, `.mjs`, `.cjs`, `.mts`, `.cts`.

Why:
- Prevents path traversal and ambiguous packaging behavior.
- Keeps runtime expectations explicit and user-facing.

## Active Blockers / Open Questions
- None.

## Maintenance Rules
- Keep only current-state decisions in this file.
- Move superseded or historical detail to `DECISIONS_ARCHIVE.md`.

**Last Updated:** 2026-02-15

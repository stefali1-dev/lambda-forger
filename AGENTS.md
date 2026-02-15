# AGENTS.md - AI Lambda Forger Agent Guide

**Project:** AI Lambda Forger MVP  
**Current Date Context:** 2026-02-15  
**Status:** MVP v2 implemented and validated

## Product Positioning (Canonical)
- Audience: frontend developers who want chatbot endpoints without backend/AWS setup overhead.
- Promise: "From static site to context-aware chatbot endpoint in minutes."
- Core value: upload context, provide OpenAI key, deploy a callable endpoint quickly.
- Messaging guardrails:
  - Emphasize speed to value and low AWS complexity.
  - Prefer "context-aware chatbot API" wording.
  - Do not position streaming/image generation as current MVP capability.

## Current Architecture (v2)
- Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Monaco + MSW.
- Backend control plane: AWS SAM Lambda (`backend/src/handler.ts`) with routes:
  - `GET /health`
  - `POST /upload`
  - `POST /deploy`
- Deploy flow provisions user Lambdas with Function URLs (public invoke permissions added).
- Deploy contract uses `files[]` + `entryFile` (v1 `code` removed and rejected with migration `400`).
- Context files stored in S3 and passed through `S3_CONTEXT_FILES` env var.
- System prompt is passed in deploy payload and injected via `SYSTEM_PROMPT` env var.
- Backend validation is strict for file content/path safety, duplicate paths, entry resolution, and template (`chatCompletion` only).

## MVP v2 Delivered

### 1) Full Multi-file Lambda Deploy Support
Frontend and backend support multi-file deploy end-to-end.

Implemented behavior:
- Deploy payload supports multiple code files plus explicit entry file.
- Legacy v1 payload (`code`) is unsupported and returns a clear migration client error.
- Backend writes all files into build workspace before zipping.
- Entry file resolves deterministic handler target (for example `handler.ts` -> compiled/packaged handler mapping).
- Validation errors are user-facing and specific (missing entry file, duplicate paths, invalid extensions).

### 2) System Prompt as First-class UI Field
- System prompt input exists in frontend deploy controls (clear, visible, editable).
- Deployed runtime reads system prompt from env var (`SYSTEM_PROMPT`) with fallback behavior.
- Deploy request includes system prompt value; backend sets env var for deployed Lambda.

### 3) Template Roadmap Affordance in UI
v2 ships chat-only, with clear roadmap affordance.

Implemented UI behavior:
- Add a template selector control with one enabled option (`Chat Completion`) and disabled future options (`Image Generation`, `Streaming Chat`) labeled `Coming soon`.
- Add helper copy under selector: `More templates are planned in upcoming releases.`
- Backend validation remains strict to `chatCompletion`.

### 4) Intensive Real End-to-End Validation with Real User Key
- Run true E2E flow with real AWS and real OpenAI call path.
- Use the user-provided OpenAI key only from local runtime context; never commit secrets to files, logs, or docs.
- Test with realistic code snippets and context files.
- Findings and fixes documented in `PLAN.md` and `DECISIONS.md`.

## Out of Scope (Still Deferred)
- Auth/accounts/teams.
- Persistence/history.
- Logs UI.
- Billing.
- Streaming implementation.
- Image generation implementation.

## API Contract Snapshot

Current v2 deploy payload:
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

v2 compatibility rule:
- v1 `code` payload is removed.
- Backend should return `400` with actionable migration error when `code` is sent.

## Security and Secrets
- Never commit secrets (`.env`, keys, credentials) to repository files.
- Never paste real API keys into docs.
- Real-key E2E tests must use local env/runtime injection only.
- For v2 E2E, use local `OPENAI_API_KEY` environment variable as the key source.

## Runbook (Canonical)
- Root `README.md` is the canonical runbook.
- `frontend/README.md` is intentionally removed.

## Source of Truth by File
- `AGENTS.md`: constraints, scope, agent behavior, current iteration goals.
- `PLAN.md`: execution checklist and progress for current iteration.
- `DECISIONS.md`: active decisions, active blockers, and recommendations.
- `DECISIONS_ARCHIVE.md`: historical/superseded decisions and closed blockers.
- `README.md`: setup/runbook for humans.

## Documentation Hygiene (Mandatory)
Agents must keep docs concise and current.

Rules:
- Remove stale and repetitive content during normal work.
- Keep only actionable, current-state guidance in primary docs.
- Move historical details into archive files.
- Keep docs aligned with implementation in the same change.

Prune cadence:
- At the end of each meaningful slice, quickly prune outdated lines.
- Before handoff, do a mismatch scan (`rg`) and update docs accordingly.

Suggested size targets:
- `AGENTS.md`: <= 280 lines
- `PLAN.md`: <= 260 lines
- `DECISIONS.md`: <= 320 lines

## Agent Operating Principles
- Operate independently and execute clear next steps without waiting.
- Prefer implementation + validation over speculative planning.
- If blocked by product ambiguity, ask one direct question with recommendation.
- Keep SAM infra and backend runtime behavior aligned.

## MVP v2 Release Status
- Multi-file deploy contract implemented and validated end-to-end.
- System prompt field wired from UI -> deploy API -> Lambda env -> runtime behavior.
- Template roadmap affordance visible in UI, with only chat enabled.
- Real E2E tests executed with real user key (handled securely), and issues fixed.
- Test findings documented clearly.
- Primary docs pruned, current, and consistent.

## Current Focus After v2
- Keep docs and runbook aligned with implementation.
- Address post-v2 hardening items when prioritized (for example IAM least-privilege tightening).

**Last Updated:** 2026-02-15

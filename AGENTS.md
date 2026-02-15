# AGENTS.md - AI Lambda Forger Agent Guide

**Project:** AI Lambda Forger MVP  
**Current Date Context:** 2026-02-15  
**Status:** MVP v1 complete; shipping MVP v2 iteration

## Product Positioning (Canonical)
- Audience: frontend developers who want chatbot endpoints without backend/AWS setup overhead.
- Promise: "From static site to context-aware chatbot endpoint in minutes."
- Core value: upload context, provide OpenAI key, deploy a callable endpoint quickly.
- Messaging guardrails:
  - Emphasize speed to value and low AWS complexity.
  - Prefer "context-aware chatbot API" wording.
  - Do not position streaming/image generation as current MVP capability.

## Current Architecture (v1)
- Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Monaco + MSW.
- Backend control plane: AWS SAM Lambda (`backend/src/handler.ts`) with routes:
  - `GET /health`
  - `POST /upload`
  - `POST /deploy`
- Deploy flow provisions user Lambdas with Function URLs (public invoke permissions added).
- Context files stored in S3 and passed through `S3_CONTEXT_FILES` env var.

## MVP v2 Scope (Now Active)

### 1) Full Multi-file Lambda Deploy Support (Must Have)
Frontend already supports multi-file editing UX. Backend and API contract must now support it end-to-end.

Target behavior:
- Deploy payload supports multiple code files plus explicit entry file.
- Legacy v1 payload (`code`) is unsupported in v2 and must return a clear client error.
- Backend writes all files into build workspace before zipping.
- Entry file resolves deterministic handler target (for example `handler.ts` -> compiled/packaged handler mapping).
- Validation errors are user-facing and specific (missing entry file, duplicate paths, invalid extensions).

### 2) System Prompt as First-class UI Field (Must Have)
- Add a system prompt input on frontend (clear, visible, editable).
- Deployed code must read system prompt from env var (for example `SYSTEM_PROMPT`) rather than hardcoded template text.
- Deploy request includes system prompt value; backend sets env var for deployed Lambda.

### 3) Template Roadmap Affordance in UI (Must Have)
v2 still ships chat-only, but UI should signal future template expansion.

Recommended approach:
- Add a template selector control with one enabled option (`Chat Completion`) and disabled future options (`Image Generation`, `Streaming Chat`) labeled `Coming soon`.
- Add helper copy under selector: `More templates are planned in upcoming releases.`
- Keep backend validation strict to `chatCompletion` for v2.

### 4) Intensive Real End-to-End Validation with Real User Key (Must Have)
- Run true E2E flow with real AWS and real OpenAI call path.
- Use the user-provided OpenAI key only from local runtime context; never commit secrets to files, logs, or docs.
- Test with realistic code snippets and context files.
- Fix discovered bugs before closing v2.
- Document findings and fixes in `PLAN.md` and `DECISIONS.md`.

## Out of Scope (Still Deferred)
- Auth/accounts/teams.
- Persistence/history.
- Logs UI.
- Billing.
- Streaming implementation.
- Image generation implementation.

## API Contract Snapshot

v2 target deploy payload (planned):
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

## Definition of Done (MVP v2)
- Multi-file deploy contract implemented and validated end-to-end.
- System prompt field wired from UI -> deploy API -> Lambda env -> runtime behavior.
- Template roadmap affordance visible in UI, with only chat enabled.
- Real E2E tests executed with real user key (handled securely), and issues fixed.
- Test findings documented clearly.
- Primary docs pruned, current, and consistent.

**Last Updated:** 2026-02-15 23:40 EET

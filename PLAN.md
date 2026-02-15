# PLAN.md - AI Lambda Forger MVP v2

**Status:** MVP v2 implemented and validated  
**Last Updated:** 2026-02-15

## Purpose
Track active iteration execution and release-gate validation evidence.

## MVP v2 Goals
1. Multi-file deploy contract and packaging parity.
2. System prompt UI -> deploy payload -> Lambda env var wiring.
3. Template roadmap affordance in UI (chat enabled, future templates disabled).
4. Real AWS/OpenAI end-to-end validation with fixes.

## Execution Checklist

### Phase A: Contract + Backend Multi-file
- [x] Define v2 deploy request schema (`files[]`, `entryFile`, `systemPrompt`, `template`, `openaiKey`, `s3ContextFiles`).
- [x] Remove v1 `code` payload support with migration `400`.
- [x] Add backend validation for missing/empty files, duplicate paths, unsafe paths, invalid extensions, missing `entryFile`.
- [x] Write full file tree into packaging workspace before zip.
- [x] Resolve deterministic handler target from explicit `entryFile` by bundling to `handler.mjs` + Lambda handler `handler.handler`.
- [x] Return explicit user-facing validation messages for multi-file issues.

### Phase B: System Prompt UX + Runtime Wiring
- [x] Add visible system prompt field in frontend deploy controls.
- [x] Include `systemPrompt` in deploy payload.
- [x] Inject `SYSTEM_PROMPT` env var in deployed Lambda.
- [x] Update default chat template to read `process.env.SYSTEM_PROMPT` with fallback.
- [x] Add UI copy clarifying system prompt is runtime-configured.

### Phase C: Template Roadmap Affordance
- [x] Add template selector control.
- [x] Keep `Chat Completion` as the only enabled option.
- [x] Show `Image Generation` and `Streaming Chat` as disabled `Coming soon`.
- [x] Add helper copy: `More templates are planned in upcoming releases.`
- [x] Keep backend validation strict to `template: "chatCompletion"`.

### Phase D: End-to-End Validation (Release Gate)
- [x] Run true E2E with real context upload, real multi-file deploy, real OpenAI key from runtime env, real invoke.
- [x] Run negative-path tests for missing entry file, malformed files array, legacy `code` payload, empty `systemPrompt` fallback behavior, backend unavailable.
- [x] Fix blocking issues found during E2E.
- [x] Document test evidence in this file.

### Phase E: Docs + Prune
- [x] Update `README.md` usage/contract to v2.
- [x] Update `PLAN.md` and `DECISIONS.md` to current state.
- [x] Keep docs concise and aligned with implementation.

## Validation Evidence

- **Date/Time:** 2026-02-15
- **Environment:** local backend runtime + real AWS resources
- **Scenario:** Backend and frontend quality gates
- **Input:** `backend` (`npm run typecheck`, `npm run build`, `npm run sam:validate`), `frontend` (`npm run lint`, `npm run build`)
- **Result:** pass
- **Fix/Follow-up:** none

- **Date/Time:** 2026-02-15
- **Environment:** backend handler local invocation (`dist/handler.js`)
- **Scenario:** Negative deploy payload validations
- **Input:** legacy `code`, missing entry file, unsafe path traversal, duplicate paths, invalid extension, malformed files array, empty `s3ContextFiles` value
- **Result:** pass (`400` with specific validation messages)
- **Fix/Follow-up:** none

- **Date/Time:** 2026-02-15
- **Environment:** real AWS + real OpenAI path (runtime `OPENAI_API_KEY`)
- **Scenario:** Full `/upload` -> `/deploy` (multi-file + system prompt) -> Function URL invoke
- **Input:** multipart context upload, multi-file TS payload (`handler.ts`, `utils/prompt.ts`), `entryFile: "handler.ts"`, real key from env
- **Result:** pass (deployment succeeded, response returned), cleanup pass (test Lambda deleted)
- **Fix/Follow-up:** none

- **Date/Time:** 2026-02-15
- **Environment:** real AWS + real OpenAI path (runtime `OPENAI_API_KEY`)
- **Scenario:** Empty `systemPrompt` fallback behavior
- **Input:** deploy with `systemPrompt: ""`, live prompt sentinel check via model response
- **Result:** pass (`FALLBACK_OK`), cleanup pass (test Lambda deleted)
- **Fix/Follow-up:** none

- **Date/Time:** 2026-02-15
- **Environment:** local network probe
- **Scenario:** Backend unavailable negative path
- **Input:** `curl --max-time 3 http://127.0.0.1:65530/health`
- **Result:** pass (connection failure detected, expected)
- **Fix/Follow-up:** none

## Security Rules (Enforced)
- Real OpenAI key used only from local runtime env (`OPENAI_API_KEY`).
- No secrets written to repository files.
- Test logs redact sensitive values.

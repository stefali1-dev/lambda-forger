# PLAN.md - AI Lambda Forger MVP v2

**Status:** MVP v1 complete, MVP v2 in progress  
**Last Updated:** 2026-02-15 23:40 EET

## Purpose
Track only active execution work for the current iteration. Historical execution details live in `DECISIONS_ARCHIVE.md`.

## MVP v1 Completion Snapshot
- Chat-only deploy flow implemented (`/health`, `/upload`, `/deploy`).
- Frontend Monaco editor + workspace mode implemented.
- Context upload and deploy result UX implemented.
- SAM-based backend flow validated previously.

## MVP v2 Goals (Active)
1. Full multi-file deploy support across frontend contract and backend packaging.
2. System prompt configurable from UI, passed as deploy input, and injected via Lambda env var.
3. Template roadmap affordance in UI (chat enabled, future templates visible as disabled/coming soon).
4. Intensive real E2E validation with real AWS + OpenAI path, followed by bug fixes.

## Execution Checklist

### Phase A: Contract + Backend Multi-file
- [ ] Define v2 deploy request schema:
  - `files: Array<{ path: string; content: string }>`
  - `entryFile: string`
  - `systemPrompt?: string`
  - keep `template`, `openaiKey`, `s3ContextFiles`
- [ ] Remove v1 `code` payload support and return clear `400` migration error when used.
- [ ] Backend validation for:
  - missing/empty files
  - duplicate paths
  - invalid or unsafe paths (`..`, absolute paths)
  - missing/invalid `entryFile`
- [ ] Backend packaging writes full file tree before zip.
- [ ] Handler resolution for chosen entry file is deterministic and documented.
- [ ] Update backend error responses to be explicit for multi-file issues.

### Phase B: System Prompt UX + Runtime Wiring
- [ ] Add visible system prompt field in frontend deploy controls.
- [ ] Include system prompt in deploy payload.
- [ ] Backend injects `SYSTEM_PROMPT` env var for deployed Lambda.
- [ ] Chat template reads `process.env.SYSTEM_PROMPT` and uses fallback only if empty.
- [ ] Ensure UI communicates that system prompt is runtime-configured, not hardcoded.

### Phase C: Template Roadmap Affordance
- [ ] Add template selector UI affordance (interactive control).
- [ ] Chat Completion is the only enabled option in v2.
- [ ] Future options shown as disabled with `Coming soon` label.
- [ ] Add helper copy under selector: `More templates are planned in upcoming releases.`
- [ ] Keep backend contract strict to `chatCompletion` for now.

### Phase D: End-to-End Real Validation (Release Gate)
- [ ] Execute true E2E run with:
  - real context file upload
  - realistic multi-file code sample
  - real OpenAI key from user (runtime only)
  - real deploy + invoke + response check
- [ ] Run negative-path tests:
  - missing entry file
  - malformed files array
  - legacy v1 `code` payload returns expected migration error
  - empty system prompt (fallback behavior)
  - backend unavailable
- [ ] Fix all blocking issues discovered during E2E.
- [ ] Document test evidence and findings in this file.

### Phase E: Documentation + Final Prune
- [ ] Update `README.md` usage examples to v2 contract.
- [ ] Keep `AGENTS.md`, `PLAN.md`, `DECISIONS.md` concise and current.
- [ ] Move superseded details to `DECISIONS_ARCHIVE.md`.

## Test Logging Template (Use During v2)
Use concise entries only:

- **Date/Time:**
- **Environment:** local SAM / deployed AWS
- **Scenario:**
- **Input:**
- **Result:** pass/fail
- **Fix/Follow-up:**

## Security Rules for v2 E2E
- Real OpenAI key must never be committed to repo files.
- Use local env variable injection during tests.
- Canonical local key source: `OPENAI_API_KEY`.
- Redact sensitive values in all logs and notes.

## Additional Recommended v2 Items (After Core 4)
- IAM least-privilege tightening for backend SAM role.
- Optional deploy cleanup helper (list/delete test lambdas) to reduce AWS clutter/cost.
- Basic request/response telemetry fields in deploy logs (without sensitive data).

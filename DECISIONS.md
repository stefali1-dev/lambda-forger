# DECISIONS.md - Active Decisions & Blockers

**Project:** AI Lambda Forger MVP v2  
**Purpose:** Keep only active/current decisions and blockers.  
**History:** See `DECISIONS_ARCHIVE.md` for superseded and historical entries.

## Active Decisions

### D1: v2 focus = complete chat workflow quality, not new model capabilities
**Date:** 2026-02-15  
**Decision:** v2 prioritizes production-grade chat deploy UX and reliability over adding streaming/image execution.

Why:
- Fastest path to a shippable second iteration.
- Reduces integration risk while improving real user value.

---

### D2: Deploy contract evolves to native multi-file payload
**Date:** 2026-02-15  
**Decision:** Add `files[]` + `entryFile` in deploy payload as first-class inputs.

Decision details:
- `files` contains path/content pairs.
- `entryFile` must point to one file in `files`.
- `template` remains `chatCompletion` in v2.
- v1 `code` payload is removed in v2; backend returns clear `400` migration error for legacy requests.

Why:
- Frontend already has multi-file UX.
- Backend must match user mental model and avoid hidden single-file behavior.
- Hard cutover reduces dual-path complexity and ambiguous behavior.

---

### D3: System prompt becomes deploy-time configuration, not hardcoded template text
**Date:** 2026-02-15  
**Decision:** UI sends `systemPrompt`; backend sets `SYSTEM_PROMPT`; runtime code reads env var.

Why:
- Better UX and faster iteration without direct code edits.
- Cleaner separation of template logic vs per-deployment customization.

---

### D4: Template roadmap affordance should be visible in UI (chat enabled, others disabled)
**Date:** 2026-02-15  
**Decision:** Use a real selector control with:
- `Chat Completion` enabled
- future templates shown disabled + `Coming soon`
- helper text: `More templates are planned in upcoming releases.`

Why chosen:
- Strongest signal that template expansion is planned.
- Minimal engineering overhead.
- Clear without promising unsupported behavior.

---

### D5: Real-key E2E validation is mandatory for v2 release
**Date:** 2026-02-15  
**Decision:** Run true E2E with user-provided OpenAI key and real AWS resources before v2 closure.

Security constraints:
- Never store key in repository files.
- Never print full key in logs/docs.
- Use runtime env injection only.
- Use local `OPENAI_API_KEY` as canonical source for E2E runs.

---

### D6: Documentation pruning is an ongoing responsibility
**Date:** 2026-02-15  
**Decision:** Keep primary docs short and implementation-aligned; archive historical narrative.

Practical rule:
- If a section no longer affects current decisions/execution, condense or move it to `DECISIONS_ARCHIVE.md`.

## Active Blockers / Open Questions

### B1: Multi-file entry strategy implementation detail
**Status:** OPEN  
**Question:** In v2, should deploy enforce a fixed exported handler symbol from `entryFile`?

Options:
1. Require `export const handler` in entry file (recommended).
2. Support configurable handler symbol in payload (defer).

Recommendation:
- Keep symbol fixed in v2 for simpler validation and fewer runtime errors.

---

### B2: E2E evidence format and storage
**Status:** OPEN  
**Question:** Where should detailed test evidence be stored?

Options:
1. `PLAN.md` short structured logs (recommended).
2. Separate `TEST_LOG.md` if logs grow beyond concise size.

Recommendation:
- Start in `PLAN.md`; split only if too large.

## Maintenance Rules
- Update this file when decisions change.
- Move closed/superseded items to `DECISIONS_ARCHIVE.md`.
- Keep this file focused on current execution only.

**Last Updated:** 2026-02-15 23:40 EET

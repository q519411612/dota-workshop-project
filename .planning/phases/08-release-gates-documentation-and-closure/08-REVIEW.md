---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T10:30:33Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - src/exported-candidate-native.ts
  - src/exported-candidate-remote-executor.ts
  - src/exported-candidate-remote-script.ts
  - src/exported-candidate-remote.ts
  - src/exported-candidate.ts
  - src/release-candidate-remote-script.ts
  - src/schemas.ts
  - src/server.ts
  - src/tools.ts
  - src/types.ts
  - tests/examples.test.ts
  - tests/exported-candidate-mcp.test.ts
  - tests/exported-candidate-remote.test.ts
  - tests/exported-candidate.test.ts
  - tests/packaged-release-candidate-runtime.test.ts
  - tests/plugin.test.ts
  - dist/exported-candidate-native.js
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-29T10:30:33Z
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The fix at `d475a46` correctly rejects every `not-started` failure when cleanup claims authorization or a parsed export handoff is present, while preserving legitimate unowned `not-started/unknown` evidence and the exact `EXPORT_DESTINATION_EXISTS` result. Prior remote-success validation, canonical early-failure paths, shared compiler selection across export and cleanup, and the approved practical filesystem threat boundary remain intact. One blocker-class closed-envelope defect remains in the promoted failure branch: authorization is still not correlated with the presence of the parsed export/handoff ownership object.

TypeScript typecheck passed. The full suite passed with 380 tests and one Windows-only test skipped. An isolated build matched tracked `dist`, and no `preflight_release_candidate` routing or behavior regression was found. The passing tests cover the not-started contradiction but not the promoted authorization/handoff mismatch below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Promoted failure authorization is not bound to handoff ownership evidence

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote.ts:156-182`
**Issue:** The target defines `exportCleanup.authorized` as whether `$result.export` exists. Therefore the closed contract is exact: `authorized: true` requires a valid parsed export/handoff object, while absence of that object requires `authorized: false`. The new invariant enforces this only for `not-started` states. In a `promoted/present` failure, the host still accepts `authorized: true` with the `export` field omitted, and it also has no rule rejecting `authorized: false` with a valid export object. A direct hostile reproduction supplied promoted/present cleanup with `authorized: true`, no export handoff, and `HANDOFF_MANIFEST_PUBLICATION_FAILED`; the host returned that exact code and labeled the state validated while returning `manifest: null` and `ownership: null`. This is contradictory ownership evidence from an untrusted remote payload.
**Fix:** Require `cleanup.authorized === (handoff !== undefined)` for every export failure state, then retain the existing state-specific promotion/candidate checks. Add hostile matrix tests for promoted/present with authorized-without-handoff and unauthorized-with-handoff, alongside the existing legitimate unauthorized pre-handoff and authorized post-handoff failures.

---

_Reviewed: 2026-07-29T10:30:33Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

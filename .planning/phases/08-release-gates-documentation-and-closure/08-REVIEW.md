---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T10:33:56Z
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

**Reviewed:** 2026-07-29T10:33:56Z
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The fix at `68b41a3` correctly enforces `cleanup.authorized === (parsed handoff exists)` for every export failure, rejects both promoted authorization mismatch directions, and preserves legitimate unowned unknown evidence. All prior remote success, early failure, compiler propagation, cleanup, and practical filesystem-boundary fixes remain correct. One blocker-class strict-envelope defect remains: a present but malformed optional `export` field is silently treated as if the field were omitted.

TypeScript typecheck passed. The full suite passed with 382 tests and one Windows-only test skipped. An isolated build matched tracked `dist`, and no `preflight_release_candidate` routing or behavior regression was found. The passing hostile matrices vary handoff presence but do not cover a present invalid handoff value.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Malformed optional export evidence is accepted as absent

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote.ts:152-184`
**Issue:** Failure parsing computes `handoff` as `undefined` both when the optional `export` key is omitted and when the key is present but `parseExportedCandidateHandoffManifest` rejects its value. The new authorization equivalence therefore cannot distinguish a valid absent handoff from malformed hostile evidence. A direct reproduction supplied a legitimate unowned `not-started/unknown` failure envelope but added `export: null`; with `authorized: false`, the host accepted the payload, preserved `EXPORT_DESTINATION_EXISTS`, and described it as validated evidence. The target script can only omit `export` or emit a valid handoff object, so accepting a present malformed value violates the closed remote contract and masks serialization corruption or hostile field injection.
**Fix:** Track raw field presence separately. If `parsed.export !== undefined`, require `parseExportedCandidateHandoffManifest(parsed.export)` to succeed before evaluating authorization/state; otherwise return `REMOTE_EXPORT_SEMANTIC_INVALID`. Add hostile tests for `export: null`, primitive values, incomplete objects, and invalid handoff fields with both authorization values.

---

_Reviewed: 2026-07-29T10:33:56Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

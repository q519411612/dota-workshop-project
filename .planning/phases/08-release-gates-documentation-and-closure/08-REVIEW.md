---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T10:26:52Z
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

**Reviewed:** 2026-07-29T10:26:52Z
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The fixes at `ffc994f` correctly preserve the ordinary `EXPORT_DESTINATION_EXISTS` result with canonical paths and an unowned `not-started/unknown` candidate state. Success remains restricted to `promoted/present` with matching cleanup evidence. The exact same resolved compiler is now passed to the prerequisite probe and every POSIX move in export and cleanup, and tests exercise the selected compiler path. One blocker-class hostile-evidence defect remains: the widened unknown-state branch does not require the cleanup evidence to be unauthorized, so it accepts an ownership/authorization combination that the target script cannot produce.

TypeScript typecheck passed. The full suite passed with 379 tests and one Windows-only test skipped. An isolated build matched tracked `dist`, and no `preflight_release_candidate` routing or behavior regression was found. The passing tests cover the legitimate unknown state but not the contradictory authorization case below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Failure normalization accepts an impossible authorized unknown state

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote.ts:156-182`
**Issue:** The target script can emit `promotionState: "not-started"` and `candidateState: "unknown"` only before it creates or promotes an export. In that state `$result.export` is null, so `exportCleanup.authorized` is necessarily `false` and no parsed handoff ownership can exist. The host's new unknown-state branch checks that candidate removal and absence are both unclaimed, but never checks `cleanup.authorized` or correlates authorization with the optional handoff. A direct hostile reproduction supplied `not-started/unknown`, no removal or absence claims, no handoff, and `authorized: true`; the host returned the exact target code with the contradictory cleanup object treated as validated evidence. This violates the closed remote evidence contract and can falsely tell an operator that an unowned pre-existing path was authorized.
**Fix:** Model the export failure states exhaustively. Both `not-started/absent` and `not-started/unknown` must require `cleanup.authorized === false` and no parsed export handoff. A promoted/present failure may be unauthorized before the handoff object is constructed or authorized only when a valid handoff is present; validate those alternatives explicitly. Add hostile tests that flip `authorized` and add/remove `export` for each promotion/candidate-state combination.

---

_Reviewed: 2026-07-29T10:26:52Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

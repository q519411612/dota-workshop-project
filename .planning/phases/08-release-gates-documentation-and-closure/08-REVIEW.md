---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T10:18:48Z
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
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-29T10:18:48Z
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The fixes at `08fd9ed` correctly close the prior remote-success validation defect: success now strictly parses canonical export paths and export state, requires `promoted/present`, and reconciles both values with cleanup evidence. Early failures also compute canonical paths before the ordinary root and destination checks. However, two blocker-class defects remain. The real target script emits a legitimate `unknown` candidate state when a destination already exists, but the host failure parser rejects that state and erases the exact `EXPORT_DESTINATION_EXISTS` result. The documented `CC` compiler selection is also honored only by the prerequisite probe; the actual atomic move still invokes `/usr/bin/cc`, so a probe can pass and export can begin before failing on the compiler path the documentation says is optional.

TypeScript typecheck passed. The full suite passed with 377 tests and one Windows-only test skipped. An isolated build matched tracked `dist`, and no `preflight_release_candidate` routing or behavior regression was found. The passing suite does not cover either mismatch below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Ordinary pre-existing-destination failures are still rejected as invalid evidence

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote-script.ts:109,122-124`; `src/exported-candidate-remote.ts:156-182,207-210`
**Issue:** When the remote destination already exists, the target correctly stops with `EXPORT_DESTINATION_EXISTS`. Its finalizer observes that the unowned destination exists and emits `exportState.candidateState: "unknown"`, `exportCleanup.candidateState: "unknown"`, and `candidateAbsent: false`. That is the only safe state claim because the operation did not create or authorize the pre-existing object. The host's `parseExportState` accepts only `absent` or `present`, and the failure state matrix likewise permits only `not-started/absent` or `promoted/present`. A direct reproduction of the target-generated envelope returned `REMOTE_EXPORT_SEMANTIC_INVALID`, empty paths, and discarded the exact `EXPORT_DESTINATION_EXISTS` code even though canonical paths and cleanup evidence were present. The new tests model early failures only with an absent destination, so they miss the real script branch. Protected-root or repository failures with an already-existing destination can lose their exact code for the same reason.
**Fix:** Extend the failure-only export-state contract to accept `candidateState: "unknown"` when promotion is `not-started`, cleanup reports no removal/absence claims, and no handoff is authorized. Preserve canonical paths and the exact target blocker while warning that the pre-existing candidate path is unowned. Keep success restricted to `promoted/present`. Add a host test for `EXPORT_DESTINATION_EXISTS` with `unknown`, plus a generated-script or real PowerShell test proving the emitted envelope normalizes without contradiction.

### CR-02: The documented `CC` selection is ignored by the actual atomic move

**Classification:** BLOCKER
**File:** `src/exported-candidate-native.ts:32-55,61-76`; `src/exported-candidate.ts:144-170`
**Issue:** `verifyAtomicMoveNoReplaceAvailable` compiles the probe with `process.env.CC` (or `/usr/bin/cc`), so a host without `/usr/bin/cc` can pass the pre-staging prerequisite by setting `CC` to another compiler. After staging begins, `atomicMoveNoReplace` compiles the actual helper with hardcoded `/usr/bin/cc`. On precisely the supported configuration documented in README and the runbook—compiler available through `CC`, not at `/usr/bin/cc`—the probe succeeds, candidate assembly proceeds, and promotion later fails with `ATOMIC_NO_REPLACE_UNAVAILABLE`. This contradicts the declared prerequisite behavior and defeats the guarantee that compiler absence is detected before staging. The added test injects a failing probe but never verifies that probe and operation use the same selected compiler.
**Fix:** Resolve the compiler once and pass the identical executable to both availability probing and every POSIX atomic move, or compile/cache the verified helper during the probe and execute that exact artifact for promotion and handoff publication. Add a test with a valid alternate compiler selected through `CC` and an unavailable `/usr/bin/cc`, asserting both moves use the selected compiler; also prove an unavailable selected compiler returns the stable failure before staging.

---

_Reviewed: 2026-07-29T10:18:48Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

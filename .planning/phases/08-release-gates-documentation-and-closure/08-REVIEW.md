---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T10:06:20Z
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
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-29T10:06:20Z
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The v1.15 release candidate is not ready to ship. Three blocker-class contract and runtime defects remain. Direct hostile-result reproductions proved that remote success normalization ignores contradictory export path/state evidence, while a normal early target failure such as `EXPORT_ROOT_MISSING` is degraded to `REMOTE_EXPORT_SEMANTIC_INVALID` with its canonical paths and proven state discarded. The Node implementation also introduces an undeclared C compiler dependency for every macOS/Linux atomic move, so otherwise valid packaged fixture and local operations fail on supported hosts that have Node but no compiler toolchain.

TypeScript typecheck passed. The full suite passed with 369 tests and one Windows-only test skipped. An isolated build matched tracked `dist`, including the native helper runtime. Those checks do not cover the three defects below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Remote success accepts contradictory or missing export path and state evidence

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote.ts:25-59`
**Issue:** The success branch requires the keys `exportPaths` and `exportState` to exist, but never calls the existing `parseExportPaths` or `parseExportState` validators. It instead returns paths derived from the handoff and validates success solely from the handoff and cleanup object. A direct reproduction supplied `exportPaths: null` and `exportState: { promotionState: "not-started", candidateState: "absent" }` alongside a promoted/present handoff and cleanup; `exportRemoteReleaseCandidate` still returned `ok: true`. Remote JSON is hostile evidence, so the host is certifying success while ignoring an explicit contradiction in the target's final-state envelope.
**Fix:** Parse both fields on the success path. Require canonical `exportPaths` to equal the input and handoff paths, require `exportState` to be exactly `promoted/present`, and require its promotion/candidate states to equal `exportCleanup`. Reject absent, malformed, or contradictory values with `REMOTE_EXPORT_SEMANTIC_INVALID`. Add hostile success tests for `null`, wrong paths, `not-started/absent`, and cleanup/state disagreement.

### CR-02: Early remote export failures lose their stable error and state evidence

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote-script.ts:101-124`; `src/exported-candidate-remote.ts:138-175`
**Issue:** The target computes `$handoffPath` only after export-root existence, protection, and destination-parent checks. Its `finally` emits `exportPaths` only when `$handoffPath` is non-null. Therefore common explicit failures before that assignment, including `EXPORT_ROOT_MISSING`, omit `exportPaths`. The host failure normalizer requires `parseExportPaths` to succeed, so it discards the target's stable blocker code and otherwise consistent `not-started/absent` cleanup evidence, returning generic `REMOTE_EXPORT_SEMANTIC_INVALID`, empty paths, and unknown cleanup instead. A direct host reproduction using the envelope produced by this control flow confirmed the loss. This violates the project requirement that remote failures remain explicit and include command/path/state evidence.
**Fix:** Derive canonical export root, destination, and handoff paths together before checks that can emit ordinary lifecycle failures, then always include them in the closed failure envelope. If canonicalization itself fails, define a separate strict pre-path failure envelope that preserves the stable code and safe requested paths without claiming canonical state. Add generated-script and host-normalization tests for `EXPORT_ROOT_MISSING`, protected roots, and destination-parent rejection.

### CR-03: POSIX atomic moves require an undeclared runtime C compiler

**Classification:** BLOCKER
**File:** `src/exported-candidate-native.ts:32-58`
**Issue:** Every macOS or Linux atomic move creates C source in a temporary directory and invokes hardcoded `/usr/bin/cc` at runtime. The package declares only Node as an engine/runtime prerequisite, the operator flow describes fixture checks without a Dota installation, and the release research explicitly states that no new runtime dependency is needed. On a normal packaged installation without Xcode Command Line Tools or a system C compiler, `execFile` resolves to exit `-1` and the core export path fails with `ATOMIC_NO_REPLACE_UNAVAILABLE`. Linux systems where `cc` exists outside `/usr/bin` fail the same way. Because promotion and handoff publication both use this helper, valid fixture/local exports cannot complete despite satisfying the documented prerequisites.
**Fix:** Ship an audited native helper for each supported host platform, use a maintained dependency that exposes `renamex_np`/`renameat2` without runtime compilation, or explicitly add and preflight a compiler toolchain as a supported runtime prerequisite. The preferred packaged path should not compile C during each operation. Add an install/runtime test with the compiler unavailable that either proves the bundled primitive works or produces a documented configuration failure before export work begins.

---

_Reviewed: 2026-07-29T10:06:20Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

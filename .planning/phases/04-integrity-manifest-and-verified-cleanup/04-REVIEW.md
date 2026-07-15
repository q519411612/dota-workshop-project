---
phase: 04-integrity-manifest-and-verified-cleanup
reviewed: 2026-07-15T17:14:09Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - src/release-candidate.ts
  - src/release-readiness.ts
  - tests/release-candidate.test.ts
  - tests/release-readiness.test.ts
findings:
  blocker: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-15T17:14:09Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The final integrity, manifest, ledger, coverage, callback, and cleanup call chains were traced across both production modules and their controlled adapters. Focused tests pass (59/59) and typecheck passes, but three confirmed defects remain: one stateful creation path leaves a real candidate directory behind, successful callback values can expose a stale deleted candidate path, and passed manifests can serialize credential-shaped path segments without the shared sanitizer. These defects violate the locked cleanup and evidence boundaries even though the current suite is green.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 (BLOCKER): A failed creation result can orphan an already-created candidate

**File:** `src/release-candidate.ts:661-697`

**Issue:** `createCandidateState` is allowed to perform the actual stateful creation and then return `unknown`. If it creates the temporary directory but throws, returns a malformed object, or exposes a hostile identity getter, `parseCreatedCandidateIdentity` yields no identity and the factory returns `creationContractFailure()` with zero cleanup attempts. There is no cleanup-capable state in the failure result and no adapter-owned rollback protocol. The test at `tests/release-candidate.test.ts:5025-5069` explicitly creates a directory, returns an unusable registration result, asserts `cleanupCandidateLease` was never called, and then asserts the directory still exists. This directly contradicts the Phase 4 decision that every outcome after candidate creation receives exactly one cleanup attempt and the phase goal that candidate absence is proved after every post-creation outcome.

**Fix:** Replace the `Promise<unknown>` creation primitive with an atomic, versioned outcome that cannot lose cleanup ownership. A post-create failure must carry an opaque cleanup identity/evidence and be normalized through exactly one cleanup path. Prefer registering the opaque identity synchronously at the creation boundary before any later operation can throw. Remove the test expectation that the directory remains and require verified absence for malformed, getter, proxy, and exceptional post-create results.

### CR-02 (BLOCKER): Successful results can return a stale deleted candidate path

**File:** `src/release-candidate.ts:1145-1200, 2285-2295`

**Issue:** The inspection callback receives the canonical candidate root and may return an arbitrary generic `T`. After verified cleanup, `finalizeCandidateLifecycle` returns that value verbatim. A valid callback such as `root => ({ candidateRoot: root })` therefore produces `ok: true` with an absolute path to a directory that has already been removed. The implementation only withholds callback values on failure; it does not enforce the locked rule that cleanup evidence must not present a stale path as a usable artifact. Existing tests cover path withholding for failed cleanup and failed artifact validation, but no successful-cleanup case returns the root.

**Fix:** Do not return an unconstrained callback value from the lifecycle. Make the callback side-effect-free and return only domain-owned, normalized evidence, or introduce a branded safe inspection result that cannot contain the candidate root, absolute paths, functions, handles, or other live candidate capabilities. Add a successful-cleanup regression where the callback attempts to return the root and require rejection or omission while preserving manifest and cleanup evidence.

### CR-03 (BLOCKER): Passed manifests leak credential-shaped filenames

**File:** `src/release-candidate.ts:1713-1749`

**Issue:** Manifest entries copy `accepted.path` directly into caller-visible evidence. Inventory blockers, public inventory output, ledger paths, and scan coverage use `sanitizeRelativeEvidenceIdentity`, but the manifest does not. A regular file whose name contains a GitHub-token-shaped value or another secret pattern can pass readiness when its content is clean, after which the full token-shaped filename appears in both `result.manifest.entries` and `artifactValidation.manifest.entries`. This violates the shared evidence boundary that matched secret values must not enter serialized evidence. The current redaction tests stop at inventory/readiness outcomes and never exercise a successful manifest containing a credential-shaped path.

**Fix:** Preserve raw paths only in the internal canonical digest input. Before exposing manifest evidence, either reject secret-shaped path identities with an explicit blocker or define a versioned public path-evidence representation that is sanitized without changing internal occurrence matching and digest calculation. Add a passing-content fixture with a runtime-generated token-shaped filename and assert the token is absent from the entire serialized lifecycle result.

## Verification Performed

- `npm test -- tests/release-candidate.test.ts tests/release-readiness.test.ts` — 59/59 passed.
- `npm run typecheck` — passed.
- `git diff --check` — passed.
- Only the pre-existing `.planning/graphs/` modifications remain outside this review artifact.

---

_Reviewed: 2026-07-15T17:14:09Z_
_Reviewer: generic-agent workaround for gsd-code-reviewer_
_Depth: deep_

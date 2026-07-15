---
phase: 05-unified-mcp-and-remote-target-parity
reviewed: 2026-07-15T21:05:47Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - README.md
  - docs/operator-runbook.md
  - examples/workflows/fixture-release-candidate-preflight.json
  - skills/dota2-workshop-tools/SKILL.md
  - skills/dota2-workshop-tools/references/remote-control.md
  - src/release-candidate-node.ts
  - src/release-candidate-remote-executor.ts
  - src/release-candidate-remote-script.ts
  - src/release-candidate-remote.ts
  - src/release-candidate-result.ts
  - src/release-candidate.ts
  - src/result.ts
  - src/schemas.ts
  - src/server.ts
  - src/tools.ts
  - src/types.ts
  - tests/examples.test.ts
  - tests/packaged-release-candidate-runtime.test.ts
  - tests/plugin.test.ts
  - tests/preflight-release-candidate.test.ts
  - tests/release-candidate-node.test.ts
  - tests/release-candidate-parity.test.ts
  - tests/release-candidate-remote-executor.test.ts
  - tests/release-candidate-remote-script.test.ts
  - tests/release-candidate-remote.test.ts
  - tests/release-candidate-result.test.ts
  - tests/release-candidate.test.ts
  - tests/result.test.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-15T21:05:47Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The remediation corrects root-path traversal, builds leaf-to-root target-native identity chains, detects same-volume namespace aliases such as `SUBST`, and makes cleanup lease observation side-effect-free. The prior artifact-blocker mutation is closed.

Two correctness defects remain. The identity chain treats an NTFS file ID as globally unique even though it is scoped to a volume, so it cannot prove physical equality or disjointness across volume namespaces. Separately, the cleanup lease failure branch emits `CANDIDATE_CLEANUP_RESULT_INVALID` together with identity/removal facts that the strict normalizer explicitly rejects, so the intended cleanup evidence still collapses to a normalization failure.

Focused release-candidate tests pass 87/87. The complete repository suite passes 302/302, `npm run typecheck` passes, and `git diff --check` passes. The generated-text tests assert helper presence and absence of blocker mutation, but do not exercise cross-volume identities or normalize the exact cleanup lease-failure document.

### Prior Finding Disposition

- Previous CR-01 (non-reparse alias isolation): partially closed. Leaf-to-root chains reject same-volume `SUBST` and alternate namespace containment, but the identity tuples omit volume identity. See CR-01 below.
- Previous CR-02 (cleanup lease side effects): the blocker mutation is closed. `Test-IsolationLease` now returns false without calling `Stop-ReleaseCandidate` or `Add-Blocker`. The resulting cleanup document remains invalid for a separate strict-schema reason described in CR-02 below.
- Candidate ownership and exact source topology findings from earlier reviews remain closed.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Ancestor identities omit the volume that scopes each file ID

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:70,72-76`
**Impact:** `fsutil file queryFileID` returns a file identifier that is unique only within its volume. Each chain entry stores only that identifier, and both equality and containment comparisons treat it as globally unique. Identical numeric file IDs on different volumes can therefore be mistaken for the same directory. This produces false containment failures for safe cross-volume layouts, and more importantly permits a remapped path to pass lease equality if another volume presents the same file-ID sequence, such as a cloned or deliberately constructed filesystem. The lease therefore does not establish a stable target-native physical identity across drive, volume-GUID, and remapping boundaries as RCFS-01 requires.
**Fix:** Store a stable volume identity with every file ID, such as the canonical volume GUID or volume serial acquired fail-closed from the same target-native observation. Compare `(volumeIdentity, fileId)` tuples in chain equality and containment checks. Add contract vectors proving same file IDs on different volumes are distinct while two namespace aliases into the same volume/path are equal.

### CR-02: Cleanup lease failure shape is rejected by the strict normalizer

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:126`
**Related contract:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-result.ts:707-719`
**Impact:** The cleanup branch initializes `identityMatched`, `removed`, and `absent` before lease validation. When `Test-IsolationLease` returns false, it changes only `code` to `CANDIDATE_CLEANUP_RESULT_INVALID`, leaving all three facts present and false. `normalizeCleanup` accepts this code only when those fields are absent. The generic failed-cleanup branch also rejects it because `cleanupFailureFactsAgree` does not accept this code with identity facts. Consequently, a cleanup-time alias, identity-chain, or observation failure still normalizes to `RELEASE_CANDIDATE_DETAIL_INVALID` instead of preserving the completed/blocked artifact facts plus one matching removal blocker.
**Fix:** When lease validation fails, replace the cleanup object with exactly `{ schemaVersion, attempted: true, attempts: 1, status: 'failed', verified: false, code: 'CANDIDATE_CLEANUP_RESULT_INVALID' }`, then add only the matching `removal` blocker. Add strict-normalizer regressions for this exact generated outcome after both passed and blocked artifact states.

---

_Reviewed: 2026-07-15T21:05:47Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

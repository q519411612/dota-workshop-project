---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T04:54:10Z
depth: deep
files_reviewed: 29
files_reviewed_list:
  - README.md
  - docs/operator-runbook.md
  - skills/dota2-workshop-tools/SKILL.md
  - skills/dota2-workshop-tools/references/remote-control.md
  - examples/workflows/fixture-exported-candidate-cleanup.json
  - examples/workflows/fixture-release-candidate-export.json
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
  - dist/exported-candidate-remote-executor.js
  - dist/exported-candidate-remote-script.js
  - dist/exported-candidate-remote.js
  - dist/exported-candidate.js
  - dist/release-candidate-remote-script.js
  - dist/schemas.js
  - dist/server.js
  - dist/tools.js
findings:
  critical: 5
  warning: 0
  info: 0
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-29T04:54:10Z
**Depth:** deep
**Files Reviewed:** 29
**Status:** issues_found

## Summary

The v1.15 release candidate is not safe to ship. A fresh deep review found five blocker-class correctness and safety defects after the previous fixes. Direct runtime reproductions proved that the host accepts contradictory remote export evidence as success, the handoff parser accepts a topology missing required parent directories, an unwritable export root rejects the MCP handler promise instead of returning a result, and partial remote cleanup discards the validated handoff and path evidence. Static target-script tracing also found that Windows cleanup reads the handoff through a path reopened after identity capture, allowing an identity-swap race to authorize deletion from unbound content.

The full suite passes (357 tests), TypeScript typecheck passes, and all eight reviewed `dist` files exactly match a fresh build. The reviewed routing keeps `preflight_release_candidate` on its existing schema and service path; no separate preflight regression was found. Protected-root checks, transport-uncertainty classification, Node handoff no-follow handling, and Node mutation-boundary identity checks were re-examined without an additional actionable defect beyond the findings below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Remote export success is trusted without recomputing preflight invariants

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote.ts:21-40`
**Issue:** The host checks only the top-level key names, `ok`, operation status, temporary cleanup status, and the exported handoff. It does not validate `artifactValidation`, require an empty `blockers` array, reconcile the base manifest with the handoff manifest, verify the inclusion ledger or scan coverage, or validate the release-candidate boundaries. A direct hostile payload with `artifactValidation.status = "blocked"`, a `SOURCE_ENTRY_UNSAFE` blocker, an unrelated empty base manifest, an impossible inclusion ledger, and `boundaries.upload = true` was normalized as `ok: true`. This violates the locked requirement that remote JSON is hostile input and host success must be recomputed.

**Fix:** Parse the entire remote release-candidate envelope with the same strict invariant checks used by `preflightRemoteReleaseCandidate`, then require passed artifact validation, zero blockers, verified temporary cleanup, exact manifest/ledger/coverage consistency, exact boundaries, and equality between the validated base manifest and exported handoff manifest before returning export success.

### CR-02: The strict handoff parser accepts an impossible incomplete topology

**Classification:** BLOCKER
**File:** `src/exported-candidate.ts:659-674`
**Issue:** `parseTopology` requires only the `game` and `content` root directory entries and exact equality between manifest file paths and topology file paths. It never requires every parent directory of each file to appear. The current test fixture itself is accepted with `game/dota_addons/demo/addoninfo.txt` while omitting `game/dota_addons` and `game/dota_addons/demo`. A direct call confirmed that this incomplete topology parses successfully. Consequently a hostile remote result can claim complete topology while omitting directories, defeating the external handoff's audit contract.

**Fix:** Derive every required parent directory from every topology entry and manifest file path, require each parent exactly once with `kind: "directory"`, reject files whose path is also a directory, and update remote fixtures to contain the actual complete directory ledger.

### CR-03: Windows cleanup reads handoff content from an identity-unbound reopened path

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote-script.ts:99-103`
**Issue:** The target script obtains `$handoffIdentity` from the handoff path and then calls `[IO.File]::ReadAllText($handoffPath)`, which opens the pathname again. There is no held no-follow handle and no identity comparison binding the bytes read to `$handoffIdentity`. A concurrent replacement between identity capture and `ReadAllText` can supply a forged but request-matching handoff that names the replacement candidate identity. Candidate deletion can then proceed using content that never belonged to the originally identified handoff; the later identity check only protects handoff removal, after candidate mutation has already occurred.

**Fix:** Open the handoff once using a handle that rejects reparse traversal, capture identity from that handle, read all bytes through the same handle, and keep the handle/lease bound through authorization. If PowerShell cannot provide the required no-follow identity binding, fail closed before candidate mutation. Add a target-native identity-swap test rather than checking only generated script substrings.

### CR-04: Export-root write failures escape the MCP result contract

**Classification:** BLOCKER
**File:** `src/exported-candidate.ts:128-132`
**Issue:** `mkdtemp` creates staging before entering the function's `try` block. An existing canonical export root can pass path validation but still be unwritable. A direct reproduction with a mode-0555 export root rejected the promise with `EACCES` instead of returning a complete `ToolResult` containing target, operation, failure code, evidence, paths, commands, logs, and cleanup state. Through `handleTool`, this becomes an MCP handler exception rather than the explicit fail-closed result required by project policy.

**Fix:** Move staging creation inside the guarded lifecycle, initialize staging as optional, and normalize creation failures to a stable result such as `EXPORT_STAGING_CREATION_FAILED` with the validated paths and `cleanup.status = "not-reached"`. Add a regression using an unwritable export root or an injectable staging creator.

### CR-05: Partial remote cleanup relocates the candidate and then discards its proven handoff evidence

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote-script.ts:103` and `src/exported-candidate-remote.ts:84-86,181-211`
**Issue:** After moving the candidate to a random tombstone, the PowerShell script swallows any identity, digest, or removal failure and does not restore an intact identity-matched tombstone to the requested destination or report the tombstone path. The host then routes every non-success payload through `evidenceFailure`, which forces `manifest` and `ownership` to `null` and `paths` to `{}` even when target evidence says authorization succeeded and includes the validated handoff. A direct partial-failure payload returned `cleanup.authorized = true` but erased the handoff, ownership, and all known paths. Operators can therefore receive an absent destination, an undisclosed retained tombstone, and no returned ownership artifact after a destructive attempt.

**Fix:** On target, restore the tombstone to the original destination when its identity and complete snapshot remain intact; otherwise report explicit tombstone and object states without guessing. On the host, strictly parse failure envelopes and preserve validated manifest, ownership, export root, destination, handoff path, authorization facts, and partial cleanup evidence. Add tests for pre-removal failure, partial removal, identity mismatch after move, and host normalization of each failure state.

---

_Reviewed: 2026-07-29T04:54:10Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

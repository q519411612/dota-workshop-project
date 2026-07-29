---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T04:25:59Z
depth: deep
files_reviewed: 29
files_reviewed_list:
  - README.md
  - dist/exported-candidate-remote-executor.js
  - dist/exported-candidate-remote-script.js
  - dist/exported-candidate-remote.js
  - dist/exported-candidate.js
  - dist/release-candidate-remote-script.js
  - dist/schemas.js
  - dist/server.js
  - dist/tools.js
  - docs/operator-runbook.md
  - examples/workflows/fixture-exported-candidate-cleanup.json
  - examples/workflows/fixture-release-candidate-export.json
  - skills/dota2-workshop-tools/SKILL.md
  - skills/dota2-workshop-tools/references/remote-control.md
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
findings:
  critical: 9
  warning: 0
  info: 0
  total: 9
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-29T04:25:59Z  
**Depth:** deep  
**Files Reviewed:** 29  
**Status:** issues_found

## Summary

The retained-candidate implementation is not safe to ship. The tracked runtime exactly mirrors the TypeScript source and the selected 30 tests plus typecheck pass, but adversarial tracing and direct runtime reproductions found nine blocker-class defects. The most serious failures allow hostile remote evidence to be normalized as success, authorize cleanup without complete candidate topology, follow a symbolic-link handoff on the Node path, lose the handoff after partial cleanup, and obscure whether a destructive remote execute actually ran.

No semantic change to `preflight_release_candidate` was found in the reviewed routing or packaged closure; the defects are in the new export/cleanup paths and their hostile-input boundaries.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Remote cleanup accepts unrelated and internally impossible success evidence

**Classification:** BLOCKER  
**File:** `src/exported-candidate-remote.ts:52-79`  
**Issue:** The cleanup normalizer accepts any parsed handoff plus any cleanup object whose `status` is `verified`. It never binds the returned handoff to the requested export root, destination, ownership ID, manifest version, digest, transport, or operation. It also does not enforce mode invariants. A reproduced hostile execute response with `authorized: false`, `attempted: false`, every removal flag false, `status: "verified"`, a wrong operation, extra keys, and a handoff for `D:\Other\unrelated` was returned as `ok: true` for a request targeting `C:\Exports\demo`. This makes remote cleanup results untrustworthy after a destructive operation.

**Fix:** Validate a closed top-level result schema, require `schemaVersion`, `operation`, and exact allowed keys, compare every returned authorization field to the request, require the handoff target kind to match the transport, and enforce exact mode states. Dry-run success must be authorized/unattempted/unremoved; execute success must be authorized/attempted with both removed and absent flags true.

### CR-02: Handoff and cleanup parsers are open-key, under-validated, and can throw on hostile input

**Classification:** BLOCKER  
**File:** `src/exported-candidate.ts:480-495`  
**Issue:** `parseExportedCandidateHandoffManifest` does not enforce closed keys or validate `targetKind`, `source`, UUID format, non-empty identity values, finite non-negative identity numbers, file-count integer bounds, manifest entry shapes, entry paths, entry ordering, or entry uniqueness. Direct reproduction showed it accepts an extra top-level key and `ownershipId: "not-even-a-uuid"` with empty Windows identities. A `null` manifest entry throws `TypeError` while computing the digest. The remote export path calls this parser outside a protective validation boundary, so hostile remote JSON can reject the MCP handler promise instead of returning a normalized failure. `parseCleanup` and `parseFramedObject` similarly accept unknown keys.

**Fix:** Replace the casts with strict recursive parsers that verify exact key sets at every object level, validate every scalar and manifest entry before digest computation, reject duplicates/non-ordinal order/unsafe paths, and wrap all hostile parsing in a non-throwing result. Add hostile tests for extra keys at every nesting level and malformed entry values.

### CR-03: Export and cleanup do not prove complete candidate topology

**Classification:** BLOCKER  
**File:** `src/exported-candidate.ts:434-474`  
**Issue:** The Node manifest records files only. Empty directories are traversed but never represented, so an unexpected empty directory injected after promotion is invisible to `manifestEqual` and remains cleanup-authorized. The remote export performs an even weaker post-promotion check: it verifies only listed manifest files and never enumerates the promoted tree. Remote cleanup also verifies only listed entries, so unexpected files, directories, junction-bearing subtrees, or other injected entries can remain undetected while deletion is authorized. This violates the complete-topology and unexpected-entry rejection contract.

**Fix:** Build a canonical topology ledger containing every expected directory and file. Before export success and before cleanup authorization, recursively enumerate the candidate with no filters, reject reparse/unknown types and case-fold collisions, and compare the sorted observed identities exactly against the expected ledger. Apply the same helper to Node staging, Node post-promotion, Node cleanup, remote post-promotion, and remote cleanup.

### CR-04: Node cleanup follows a symbolic-link handoff manifest

**Classification:** BLOCKER  
**File:** `src/exported-candidate.ts:326-353`  
**Issue:** Existing-state validation only checks that the handoff path exists. Authorization then calls `readFile` directly, which follows a symbolic link. A handoff symlink to an external valid JSON document can therefore authorize candidate deletion, after which `unlink` removes the symlink rather than a verified operation-owned regular manifest. This directly violates the explicit symbolic-link rejection requirement.

**Fix:** `lstat` the handoff before reading, require a regular non-symbolic-link file, open it with `O_NOFOLLOW`, capture its device/inode from the handle, read through that handle, and verify the same identity again before unlinking. Reject platforms that cannot prove this contract.

### CR-05: Remote path validation permits traversal spellings and protected roots

**Classification:** BLOCKER  
**File:** `src/exported-candidate-remote-script.ts:25-49`  
**Issue:** `validateRemotePath` accepts `..` segments. The target script canonicalizes them and may successfully retain a candidate, but the host compares the canonical returned path to the non-canonical request with string-only `windowsPathEqual`, then reports failure. That leaves a retained candidate whose successful ownership result was rejected. The target script also protects only the Dota/source trees; it does not reject a volume root, Windows/system root, user-profile root, repository root, or other protected location. Node validation likewise does not reject link-bearing ancestors and has no general user/system-root denylist.

**Fix:** Reject `.`/`..`, alternate-device, ADS, and ambiguous path components before remote execution. On target, capture and compare the full reparse-free identity chain, reject volume/system/user/temp/repository roots and overlaps, and return only canonical paths. Mirror the same ancestor-link and protected-root policy in the Node validator.

### CR-06: Partial cleanup destroys the handoff even when candidate removal fails

**Classification:** BLOCKER  
**File:** `src/exported-candidate.ts:289-323`  
**Issue:** Execute mode attempts to unlink the handoff regardless of whether candidate removal succeeded or absence was proven. The remote script does the same. The existing test explicitly accepts this state: candidate remains while its handoff is gone. This irreversibly removes the ownership/authorization artifact required by future cleanup, orphaning a retained candidate after a transient deletion failure.

**Fix:** Delete in evidence-preserving order: remove the candidate, prove it absent, and only then remove the handoff. If candidate removal or absence proof fails, retain the handoff untouched and report the partial failure. Add Node and remote tests asserting manifest preservation on candidate-removal failure.

### CR-07: Cleanup authorization is vulnerable to identity-swap races before deletion

**Classification:** BLOCKER  
**File:** `src/exported-candidate.ts:266-323`  
**Issue:** Candidate identity and digest are checked in `authorizeCleanup`, which returns, and later deletion operates on the path string. There is no identity or parent-chain revalidation immediately before `rm`; the handoff is likewise read and later unlinked by path without a bound identity. An attacker or concurrent process can replace either object between authorization and mutation, causing cleanup to delete state that was never authorized. The remote script has the same gap between identity/hash checks and `Remove-Item`.

**Fix:** Hold identity-bound handles/leases for the parent, candidate, and handoff through authorization and mutation. Revalidate the complete parent chain and exact object identities immediately at the mutation boundary, move the verified objects to operation-owned same-parent tombstone names without widening scope, verify the moved identities, then delete only those tombstones. Fail closed if the platform cannot provide an identity-bound mutation primitive.

### CR-08: Transport uncertainty is collapsed into ordinary failure and reports the wrong cleanup mode

**Classification:** BLOCKER  
**File:** `src/exported-candidate-remote.ts:112-146`  
**Issue:** The executor distinguishes `uncertain`, but `outcomeFailure` maps both definite failure and uncertainty to `REMOTE_EXPORTED_CANDIDATE_TRANSPORT_FAILED`. For cleanup, the default evidence always uses `mode: "dry-run"`, even when the uncertain request was destructive execute mode. Operators therefore cannot tell whether an execute may have removed one or both objects, which is exactly the state that must never be represented as a definite failure.

**Fix:** Preserve `outcome: "uncertain"` as a distinct stable error such as `REMOTE_EXPORTED_CANDIDATE_TRANSPORT_UNCERTAIN`, pass the requested cleanup mode into failure construction, and return explicit unknown candidate/manifest state without inferred removal or retry guidance. Add separate tests for SSH and PowerShell execute uncertainty.

### CR-09: Target-native remote cleanup trusts a hostile on-disk handoff before mutation

**Classification:** BLOCKER  
**File:** `src/exported-candidate-remote-script.ts:90-98`  
**Issue:** The PowerShell cleanup script checks only a few handoff fields and then iterates `handoff.manifest.entries` without a closed schema, safe relative-path validation, containment check, uniqueness/order check, or exact topology reconciliation. Entry paths can traverse outside the destination for authorization reads, and a handoff with an empty or partial manifest can authorize deletion of a candidate containing unmanifested content. Host-side parsing occurs after the target mutation and cannot make this safe.

**Fix:** Perform the full strict handoff parser on the Windows target before any mutation. Require exact keys and types, validate every entry path is canonical and contained under the destination, recompute the manifest from an exhaustive reparse-aware candidate enumeration, compare exact file and directory topology, and only then authorize deletion.

---

_Reviewed: 2026-07-29T04:25:59Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_

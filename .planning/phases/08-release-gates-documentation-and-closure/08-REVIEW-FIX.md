---
phase: 08-release-gates-documentation-and-closure
fixed_at: 2026-07-29T04:45:29Z
review_path: .planning/phases/08-release-gates-documentation-and-closure/08-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-07-29T04:45:29Z
**Source review:** `.planning/phases/08-release-gates-documentation-and-closure/08-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 9
- Fixed: 9
- Skipped: 0
- Verification: TypeScript typecheck, 39 focused tests, 357 full-suite tests, tracked runtime rebuild, and packaged runtime parity all passed.
- Windows limitation: PowerShell behavior is contract-tested on macOS and is not claimed as real Windows proof.

## Fixed Issues

### CR-01: Remote cleanup accepts unrelated and internally impossible success evidence

**Files modified:** `src/exported-candidate-remote.ts`, `tests/exported-candidate-remote.test.ts`, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** The host now accepts only a closed cleanup envelope, binds every returned handoff field to the request and transport, and enforces exact dry-run and execute state invariants. Hostile unrelated, impossible, and extra-key success payloads are rejected.
**Status:** fixed: requires human verification

### CR-02: Handoff and cleanup parsers are open-key, under-validated, and can throw on hostile input

**Files modified:** `src/exported-candidate.ts`, `src/exported-candidate-remote.ts`, `tests/exported-candidate-remote.test.ts`, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** Handoff parsing is now non-throwing and recursively closed. It validates scalar domains, UUIDs, identities, manifest entry shapes, safe paths, ordinal order, case-fold uniqueness, topology, source fields, ownership, and boundaries before digest computation. Cleanup parsing rejects unknown keys and contradictory verified evidence.

### CR-03: Export and cleanup do not prove complete candidate topology

**Files modified:** `src/exported-candidate.ts`, `src/exported-candidate-remote-script.ts`, `tests/exported-candidate.test.ts`, `tests/exported-candidate-remote.test.ts`, documentation, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** The handoff now carries a canonical ledger for every directory and file. Node staging, post-promotion, and cleanup compare exhaustive snapshots. Remote staging, post-promotion, and target-native cleanup exhaustively enumerate and reject unexpected, reparse, unknown-type, or case-colliding entries. Empty-directory injection is covered by regression tests.
**Status:** fixed: requires human verification

### CR-04: Node cleanup follows a symbolic-link handoff manifest

**Files modified:** `src/exported-candidate.ts`, `tests/exported-candidate.test.ts`, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** Cleanup requires a regular non-link handoff, opens it with `O_NOFOLLOW`, binds device and inode through the open handle, reads through that handle, and revalidates the same identity before tombstone mutation. Runtimes without `O_NOFOLLOW` fail closed.

### CR-05: Remote path validation permits traversal spellings and protected roots

**Files modified:** `src/exported-candidate.ts`, `src/exported-candidate-remote-script.ts`, `tests/exported-candidate-remote.test.ts`, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** Host validation rejects dot segments, alternate-device paths, ADS spellings, ambiguous trailing characters, and malformed UNC paths before execution. Node validates link-bearing ancestry and protected roots. Target scripts reject volume, system, user, temp, repository, Dota, and source overlaps after canonicalization and reparse checks.
**Status:** fixed: requires human verification

### CR-06: Partial cleanup destroys the handoff even when candidate removal fails

**Files modified:** `src/exported-candidate.ts`, `src/exported-candidate-remote-script.ts`, `tests/exported-candidate.test.ts`, documentation, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** Candidate deletion and absence proof now precede handoff mutation. Candidate-removal failure preserves the original handoff; Node also restores an identity-matched candidate tombstone to its original name when removal fails. Regression coverage verifies handoff preservation.
**Status:** fixed: requires human verification

### CR-07: Cleanup authorization is vulnerable to identity-swap races before deletion

**Files modified:** `src/exported-candidate.ts`, `src/exported-candidate-remote-script.ts`, `tests/exported-candidate.test.ts`, documentation, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** Cleanup repeats authorization at the mutation boundary, moves each object to a unique same-parent tombstone, verifies the moved identity and complete content before deletion, and never deletes an identity mismatch. A mutation-boundary swap regression proves the unauthorized replacement is not deleted.
**Status:** fixed: requires human verification

Node and PowerShell do not expose a cross-platform rename primitive that atomically predicates the rename on a previously opened object identity. The strongest supported contract is therefore revalidation immediately before rename plus identity verification immediately after same-parent rename; mismatched tombstones are retained rather than deleted. This prevents unauthorized deletion and fails closed when exact proof is unavailable, but real Windows behavior remains unverified.

### CR-08: Transport uncertainty is collapsed into ordinary failure and reports the wrong cleanup mode

**Files modified:** `src/exported-candidate-remote.ts`, `tests/exported-candidate-remote.test.ts`, documentation, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** Uncertain transport now returns `REMOTE_EXPORTED_CANDIDATE_TRANSPORT_UNCERTAIN`, preserves the requested cleanup mode, marks candidate and handoff states unknown, and gives explicit no-retry guidance. SSH and PowerShell execute uncertainty have separate regression cases.

### CR-09: Target-native remote cleanup trusts a hostile on-disk handoff before mutation

**Files modified:** `src/exported-candidate-remote-script.ts`, `tests/exported-candidate-remote.test.ts`, documentation, tracked runtime
**Commit:** 6ff54ca, 5adcc3e
**Applied fix:** The target script now validates exact handoff keys and types, safe contained paths, identity fields, manifest ordering and uniqueness, topology ordering and uniqueness, boundaries, transport, and request bindings before mutation. It recomputes the exhaustive candidate manifest and topology and requires exact equality before authorizing deletion.
**Status:** fixed: requires human verification

---

_Fixed: 2026-07-29T04:45:29Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_

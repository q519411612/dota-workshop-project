---
phase: 08-release-gates-documentation-and-closure
fixed_at: 2026-07-29T05:11:14Z
review_path: .planning/phases/08-release-gates-documentation-and-closure/08-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-07-29T05:11:14Z
**Source review:** `.planning/phases/08-release-gates-documentation-and-closure/08-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0
- Verification: embedded C# compilation, TypeScript typecheck, 26 focused tests, packaged runtime parity, 363 full-suite tests, and tracked runtime rebuild all passed.
- Windows limitation: the target-native handle replacement regression is skipped on macOS; no real Windows runtime proof is claimed.
- Scope review: archived v1.14 files and the `preflight_release_candidate` implementation were unchanged.

## Fixed Issues

### CR-01: Remote export success is trusted without recomputing preflight invariants

**Files modified:** `src/exported-candidate-remote.ts`, `tests/exported-candidate-remote.test.ts`, tracked runtime
**Commit:** b3ab834, ab080c4
**Applied fix:** Remote export now passes the complete base payload through the strict release-candidate normalizer, requires a valid successful preflight envelope, and requires exact equality between the validated base manifest and the exported handoff manifest. Contradictory blockers, boundaries, ledgers, coverage, validation state, or manifests are rejected.
**Status:** fixed: requires human verification

### CR-02: The strict handoff parser accepts an impossible incomplete topology

**Files modified:** `src/exported-candidate.ts`, `src/exported-candidate-remote-script.ts`, `tests/exported-candidate-remote.test.ts`, tracked runtime
**Commit:** b3ab834, ab080c4
**Applied fix:** Handoff parsing now derives every parent directory required by topology and manifest paths and requires each one to exist as a unique directory entry. Remote target authorization applies the same parent-closed topology rule, and fixtures now contain the complete directory ledger.
**Status:** fixed: requires human verification

### CR-03: Windows cleanup reads handoff content from an identity-unbound reopened path

**Files modified:** `src/exported-candidate-remote-script.ts`, `tests/exported-candidate-remote.test.ts`, documentation, tracked runtime
**Commit:** b3ab834, ab080c4
**Applied fix:** Windows cleanup opens the handoff once with `CreateFileW` and `FILE_FLAG_OPEN_REPARSE_POINT`, rejects directory and reparse handles, captures identity with `GetFileInformationByHandle`, reads UTF-8 bytes through the same handle, and holds the lease through candidate authorization and mutation. The embedded C# compiled with zero warnings and errors.
**Status:** fixed: requires human verification

### CR-04: Export-root write failures escape the MCP result contract

**Files modified:** `src/exported-candidate.ts`, `tests/exported-candidate.test.ts`, tracked runtime
**Commit:** b3ab834, ab080c4
**Applied fix:** Staging creation is now injectable and guarded. Creation failure returns `EXPORT_STAGING_CREATION_FAILED` with validated paths and `cleanup.status = "not-reached"` instead of rejecting the handler promise.

### CR-05: Partial remote cleanup relocates the candidate and then discards its proven handoff evidence

**Files modified:** `src/exported-candidate-remote-script.ts`, `src/exported-candidate-remote.ts`, `tests/exported-candidate-remote.test.ts`, documentation, tracked runtime
**Commit:** b3ab834, ab080c4
**Applied fix:** Target cleanup restores intact identity-matched tombstones when possible and otherwise reports explicit `present`, `tombstoned`, `absent`, or `unknown` states with validated tombstone paths. Host normalization strictly validates state/path consistency and preserves the manifest, ownership, canonical paths, authorization, and partial cleanup evidence for request-bound failures.
**Status:** fixed: requires human verification

---

_Fixed: 2026-07-29T05:11:14Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_

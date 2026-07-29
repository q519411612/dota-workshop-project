---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T05:24:22Z
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

**Reviewed:** 2026-07-29T05:24:22Z
**Depth:** deep
**Files Reviewed:** 29
**Status:** issues_found

## Summary

The v1.15 release candidate is not safe to ship. Five blocker-class correctness and filesystem-safety defects remain. Direct hostile reproductions proved that Node export can overwrite a destination or handoff created during the operation, Node cleanup can delete a substituted object and report success while the owned candidate survives elsewhere, and the remote host can accept contradictory tombstone evidence as successful cleanup. Static cross-module tracing also found that local Windows export does not reuse the mandatory reparse-aware classifier and that remote export failures silently discard staging cleanup and retained-state evidence.

TypeScript typecheck passed. The full suite passed with 363 tests and one Windows-only test skipped. The packaged runtime test compiled to an isolated directory and confirmed byte parity for the tracked `dist` closure. `preflight_release_candidate` remains routed through its existing schema and services; the only source change in its target script is the optional inspection hook used by export, and no preflight behavior regression was found.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Node export promotion and handoff publication are overwrite-capable

**Classification:** BLOCKER
**File:** `src/exported-candidate.ts:178-188,222-225`
**Issue:** The operation checks that `destination` and the handoff path are absent, then later calls ordinary Node `rename`. On POSIX, `rename` replaces an existing empty destination directory and replaces an existing file. The absence check and rename are not one no-replace operation. A direct reproduction created the destination inside the injected promotion rename; export still returned `ok: true`. A second reproduction created owner data at the handoff path immediately before publication; export returned `ok: true` after overwriting that file. This violates the explicit no-overwrite contract and can destroy state owned by another process.
**Fix:** Implement target-native no-replace promotion/publication. On Linux use a proven `renameat2(..., RENAME_NOREPLACE)` binding; on other Node platforms use an equivalent target-native primitive or fail closed if atomic no-replace cannot be proven. Do not emulate it with `exists` followed by `rename`. Apply the same guarantee to both candidate promotion and handoff publication, and add race tests that create each target immediately before mutation.

### CR-02: Cleanup validates a tombstone and then deletes whatever later occupies its pathname

**Classification:** BLOCKER
**File:** `src/exported-candidate.ts:321-327,339-349`; `src/exported-candidate-remote-script.ts:166`
**Issue:** Node and Windows cleanup both validate the moved candidate or handoff tombstone, release all identity binding for that object, and then remove it by pathname. An attacker with write access to the export root can rename the validated tombstone away and put a different object at the same name between validation and removal. A direct Node reproduction moved the owned candidate to another path, substituted an unrelated directory at the tombstone name, and let `rm` delete the substitute. Cleanup returned `ok: true`, removed the handoff manifest, and reported both owned objects absent even though the real candidate still existed at the attacker-selected path. The PowerShell lifecycle has the same gap between `Test-CandidateSnapshot` and `Remove-Item`, and between `GetIdentity` and final handoff removal.
**Fix:** Bind mutation to the validated object, not its pathname. Hold an identity-bearing, reparse-rejecting handle/lease for the candidate and handoff through the exact deletion primitive, or use a target-native deletion API that operates on the held handle. If the platform cannot delete the held identity safely, stop with an explicit tombstone state and preserve its path; never infer removal from pathname absence alone. Add substitution races for candidate and handoff tombstones on Node and real Windows.

### CR-03: Local Windows export does not reject all reparse points

**Classification:** BLOCKER
**File:** `src/exported-candidate.ts:467-472,501-506,527-535,559-570`
**Issue:** The v1.14 Node preflight correctly requires a target-native Windows reparse classifier, but the new export and cleanup boundary uses only `lstat().isSymbolicLink()` plus `realpath`. That detects ordinary symlinks and junctions but does not classify every Windows entry carrying `FILE_ATTRIBUTE_REPARSE_POINT`. Export-root ancestry, retained candidate paths, copied entries, and cleanup snapshots can therefore accept unsupported reparse tags that the locked requirements require to reject. The code already receives the preflight dependency surface needed for Windows classification but never applies it to these new paths.
**Fix:** Reuse the production Windows classifier for every existing export-root ancestor, destination/handoff object, staging entry, promoted entry, and cleanup entry. Require `reparsePointAware: true` on local Windows and fail with an explicit result before creation or mutation when classification is unavailable, malformed, unknown, or reports any reparse point. Add tests for non-symlink file and directory reparse tags across export and cleanup.

### CR-04: Remote export failures silently lose cleanup and retained-state evidence

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote-script.ts:101-122`; `src/exported-candidate-remote.ts:22-58`
**Issue:** The target script assigns `result.export` and `result.exportCleanup` only on success. On staging, promotion, post-promotion, or handoff publication failure, its `finally` blocks use `Remove-Item -ErrorAction SilentlyContinue` without checking removal or absence and emit no export cleanup object. The host requires both success-only keys, so every legitimate remote export failure is collapsed to generic rejected evidence with empty paths and null manifest/ownership. This hides the original blocker, cannot prove whether operation-owned staging or temporary handoff state remains, and cannot distinguish pre-promotion cleanup from a retained promoted candidate after finalization failure.
**Fix:** Define and strictly normalize closed success and failure envelopes. The target must always emit canonical export paths, the original stable failure code, promotion state, staging/temporary-handoff removal and absence facts, and any validated retained handoff/ownership facts. Verify cleanup rather than suppressing errors. The host must parse failure envelopes independently, preserve proven state, and reject contradictions without erasing valid evidence.

### CR-05: Host normalization accepts contradictory cleanup states, including success with a tombstone path

**Classification:** BLOCKER
**File:** `src/exported-candidate-remote.ts:137-165,190-199,227-253`
**Issue:** `cleanupSuccessState` validates cleanup booleans but never checks the parsed path set. A hostile execute payload can claim `candidateState: "absent"`, all removal booleans true, and still include a valid-looking `candidateTombstone`; the host returns `ok: true` and exposes that tombstone path. A direct reproduction confirmed this accepted success. Failure validation is also open for `unknown`: it accepts `candidateState: "unknown"` together with `candidateRemoved: true` and `candidateAbsent: true`, then describes the result as a "validated partial state." Remote JSON is explicitly hostile input, so these contradictions cannot be preserved as trusted evidence.
**Fix:** Validate cleanup as an exhaustive state machine over mode, authorization, attempt, removal/absence booleans, object states, error code, and optional tombstone paths. Verified success must forbid every tombstone path and require exact present/absent states for the selected mode. `unknown` must forbid claims of proven removal or absence unless the state is `absent`, and failure codes must be compatible with the reported transition. Add hostile success and partial-failure matrices for both candidate and handoff.

---

_Reviewed: 2026-07-29T05:24:22Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

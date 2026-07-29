---
phase: 08-release-gates-documentation-and-closure
reviewed: 2026-07-29T11:03:00Z
depth: deep
files_reviewed: 20
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
  - src/milestone.ts
  - tests/examples.test.ts
  - tests/exported-candidate-mcp.test.ts
  - tests/exported-candidate-remote.test.ts
  - tests/exported-candidate.test.ts
  - tests/packaged-release-candidate-runtime.test.ts
  - tests/plugin.test.ts
  - tests/milestone.test.ts
  - dist/exported-candidate.js
  - dist/milestone.js
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-29T11:03:00Z
**Depth:** deep
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The integration fixes at `148bdc4` correctly resolve discovered local Dota-root protection before staging and bind Node cleanup authorization to the handoff target kind. The temporary handoff path now reports removal and absence facts, but the surrounding external handoff state remains contradictory. The new v1.15 milestone gate also returns a false clean result because its claimed v1.2-v1.15 inventory omits seven shipped versions. Local discovery additionally erases explicit discovery errors.

TypeScript typecheck passed. The full suite passed with 387 tests and one Windows-only test skipped. `npm run verify:milestone` returned success, but its own output demonstrated the incomplete inventory finding below. An isolated build matched tracked `dist`, packaged runtime tests passed, and no `preflight_release_candidate` routing or lifecycle regression was found. The approved practical filesystem threat boundary remains intact.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The v1.15 milestone gate certifies an incomplete version inventory

**Classification:** BLOCKER
**File:** `src/milestone.ts:170-184,272-306,338-341`; `tests/milestone.test.ts:99-130`
**Issue:** The gate labels its result and evidence as a complete `v1.2-v1.15` inventory, but `VERSION_INVENTORY` and `expectedVersions` jump directly from v1.7 to v1.15. Versions v1.8 through v1.14 are absent. This is contradicted by live project authority: `PROJECT.md` records deliveries for v1.8-v1.13, and archived milestone records and repository tags exist for v1.13 and v1.14. The test hard-codes the same sparse list, so `npm run verify:milestone` returned `ok: true` and emitted `milestone version inventory complete: v1.2-v1.15` while its JSON visibly contained only v1.2-v1.7 and v1.15. A release gate that reports missing shipped milestones as complete cannot be used as closure evidence.
**Fix:** Add authoritative entries for every shipped version v1.8 through v1.14, including exact commits, goals, deliveries, verification status, documentation status, boundaries, and residual items. Make `expectedVersions` the complete ordered sequence and test that no gap, duplicate, or out-of-order entry can pass. If the intended report is deliberately sparse, rename the label and evidence so it does not claim a continuous v1.2-v1.15 inventory.

### CR-02: Publication failure reports contradictory external handoff absence state

**Classification:** BLOCKER
**File:** `src/exported-candidate.ts:242-257,849-868`; `tests/exported-candidate.test.ts:387-404`
**Issue:** The new catch path correctly computes `temporaryHandoffRemoved` and `temporaryHandoffAbsent`, but `retainedFailureCleanup` still always emits `manifestState: "absent"` together with `manifestAbsent: false`. In the covered write-failure case, the final handoff path was never created, so the result should prove `manifestAbsent: true`. More generally, publication failure must observe the final handoff path because a no-replace conflict can leave an unowned object present. The current result is internally contradictory and violates local/remote evidence parity: the remote normalizer explicitly requires `manifestState: "absent"` to agree with `manifestAbsent: true`. The added test asserts only temporary-path fields and therefore passes while the public external-handoff evidence remains false.
**Fix:** Observe the final handoff path after publication failure and derive a consistent external state. Emit `manifestState: "absent"` with `manifestAbsent: true` only when absence is proven; otherwise emit a truthful present or unknown state without ownership claims. Keep temporary handoff removal/absence as a separate pair. Add tests for write failure, temporary-file cleanup failure, no-replace conflict with a pre-existing final handoff, and contradictory state rejection.

## Warnings

### WR-01: Local export discovery discards explicit failure codes

**Classification:** WARNING
**File:** `src/exported-candidate.ts:541-558`
**Issue:** `resolveLocalExportInput` maps every unsuccessful discovery result to `DOTA_INSTALL_NOT_FOUND`. For example, the production discovery service returns `UNSUPPORTED_OS` for a local target on macOS or Linux, but export and cleanup now replace that explicit diagnosis with a false missing-install result and discard its evidence. This weakens the project's stable explicit-failure contract and makes configuration troubleshooting misleading.
**Fix:** Preserve the discovery result's stable error code and message when they are safe contract values, or define an exact mapping that distinguishes unsupported platform, missing install, invalid discovered paths, and discovery execution failure. Add export and cleanup tests for `UNSUPPORTED_OS` and `DOTA_INSTALL_NOT_FOUND`.

---

_Reviewed: 2026-07-29T11:03:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

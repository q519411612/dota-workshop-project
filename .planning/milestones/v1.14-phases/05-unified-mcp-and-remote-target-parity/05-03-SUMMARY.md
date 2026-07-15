---
phase: 05-unified-mcp-and-remote-target-parity
plan: 03
subsystem: release-candidate-filesystem
tags: [typescript, node-filesystem, immutable-boundaries, identity-bound-cleanup, tdd]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Complete two-root inventory, exclusive assembly, source stability, and readiness policy
  - phase: 04-integrity-manifest-and-verified-cleanup
    provides: Identity-bound lifecycle, manifest, inclusion ledger, exhaustive coverage, and cleanup evidence
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 02
    provides: Strict immutable public release-candidate detail normalizer
provides:
  - Exact two-field release-candidate preflight schema with closed nested target shapes
  - Mandatory fixed no-mutation, no-persistence, no-build, and no-transfer boundaries
  - One production Node lifecycle adapter shared by fixture and local target execution
  - Source immutability, exclusive materialization, integrity, cleanup, and Windows capability matrices
affects: [05-05, 05-06, fixture-parity, local-windows-parity, mcp-registration]

tech-stack:
  added: []
  patterns: [registered creation ownership, non-follow opened reads, exclusive candidate writes, durable evidence projection]

key-files:
  created: [src/release-candidate-node.ts, tests/release-candidate-node.test.ts]
  modified: [src/schemas.ts, src/release-candidate-result.ts, tests/release-candidate-result.test.ts]

key-decisions:
  - "Fixture and local targets execute the same production Node identity-bound lifecycle; only target roots and platform facts differ."
  - "Candidate creation is registered before post-create identity observation, while roots outside the owned temporary namespace are rejected before registration."
  - "Lifecycle scan identities are projected to complete durable addon-relative identities before strict public normalization."
  - "Every boundary field and the boundary object's exact key set are mandatory; contradictory, missing, or extra facts fail closed."

patterns-established:
  - "Public preflight results discard callback values and candidate roots, then expose only normalized manifest, ledger, coverage, operation, cleanup, and contract evidence."
  - "Windows local execution requires an explicit reparse-aware classifier capability; absent capability blocks before candidate creation."

requirements-completed: [RCOP-04]

duration: 20min
completed: 2026-07-16
status: complete
---

# Phase 5 Plan 03: Immutable Preflight Boundary and Node Lifecycle Summary

**Release-candidate preflight now uses an exact safe input and boundary contract around one production fixture/local Node lifecycle with identity-bound creation, immutable sources, and truthful cleanup evidence.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-15T19:14:00Z
- **Completed:** 2026-07-15T19:34:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added a strict preflight input whose only top-level keys are `target` and `addonName`, with closed fixture, local, and remote target variants and no credential, destination, retention, upload, archive, signing, encryption, build, repair, or temporary-path control.
- Made all 18 release boundaries exact mandatory constants and rejected missing, contradictory, extra, getter, and hostile-object evidence through the common normalizer.
- Added one production Node filesystem adapter for complete Phase 3-4 fixture/local execution: non-follow classification, canonical containment, bounded read-only scanning, streamed hashing, exclusive materialization, exact rewalk, registered creation, one-shot removal, and post-removal absence.
- Proved fixture/local substantive parity, positive and missing Windows reparse capability behavior, readiness precreation blocking, inspection/copy/hash/cleanup failures, source snapshots, cleanup attempt counts, and candidate-root/capability non-disclosure.
- Closed independent-review gaps around post-create registration, combined artifact/cleanup failure projection, and hostile adapter selection of a protected root.

## Task Commits

1. **Task 1: Commit failing boundary, schema, and production-adapter tests** - `f85855b` (test)
2. **Task 2: Implement the boundary authority and Node lifecycle adapter** - `41fd41f` (feat)
3. **Task 3: Independently review filesystem and boundary safety** - `0719d31`, `2001914` (test), `cb830c3` (fix)

## Files Created/Modified

- `src/schemas.ts` - Exact strict preflight input and inferred tool input type.
- `src/release-candidate-result.ts` - Fixed boundary authority and consistent independent operation, artifact, and cleanup validation.
- `src/release-candidate-node.ts` - Production identity-bound Node adapter and fixture/local preflight projection.
- `tests/release-candidate-result.test.ts` - Exact schema and mandatory-boundary matrices.
- `tests/release-candidate-node.test.ts` - Real macOS lifecycle fixtures, parity, capability, fault, source snapshot, and cleanup tests.

## Decisions Made

- Kept filesystem roots, repository root, and temporary parent out of the public operation input; fixture/local resolution remains internal to the service and adapter dependencies.
- Used the Phase 4 lifecycle as the only assembly/integrity/cleanup algorithm instead of creating a fixture-specific implementation.
- Treated post-create identity observation failure as a registered cleanup attempt that fails closed rather than deleting without a proven identity.
- Rejected adapter-returned roots unless they are strict children of the validated temporary parent and use the owned candidate namespace.
- Preserved cleanup blockers separately from artifact blockers so combined artifact and cleanup failures retain both evidence domains.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reconciled lifecycle coverage identities with the public manifest contract**
- **Found during:** Task 2
- **Issue:** Phase 4 readiness coverage uses root-relative identities while the Phase 5 public contract requires complete addon-relative identities matching the manifest.
- **Fix:** Projected every coverage category through one deterministic addon-relative identity mapping before normalization.
- **Files modified:** `src/release-candidate-node.ts`
- **Verification:** Fixture success and fixture/local parity tests, full suite, and all repository verifiers passed.
- **Committed in:** `41fd41f`

**2. [Rule 2 - Missing critical functionality] Closed nested schema and exact boundary shapes**
- **Found during:** Task 3 independent review
- **Issue:** Nested target objects and the boundary object could accept extra keys, weakening the exact no-credential/no-mutation trust boundary.
- **Fix:** Added strict target variants and exact own-key validation for the fixed boundary object.
- **Files modified:** `src/schemas.ts`, `src/release-candidate-result.ts`
- **Verification:** Atomic review RED and final focused/full gates passed.
- **Committed in:** `0719d31`, `cb830c3`

**3. [Rule 1 - Bug] Registered created candidates before later identity observation**
- **Found during:** Task 3 independent review
- **Issue:** A post-create identity observation error left a created directory with zero cleanup attempts.
- **Fix:** Registered opaque ownership immediately after validated namespace selection, then performed identity observation; uncertainty now produces one truthful failed cleanup attempt.
- **Files modified:** `src/release-candidate-node.ts`
- **Verification:** Fault-injected identity observation test proves one attempt, no source mutation, and explicit identity mismatch evidence.
- **Committed in:** `0719d31`, `cb830c3`

**4. [Rule 1 - Security] Prevented protected-root cleanup from hostile adapter output**
- **Found during:** Task 3 independent review
- **Issue:** An adapter-selected protected root could be registered and removed during cleanup.
- **Fix:** Required a strict owned temporary-parent child with the candidate namespace before creation registration; rejected roots receive no destructive cleanup authority.
- **Files modified:** `src/release-candidate-node.ts`
- **Verification:** Atomic RED reproduced the destructive attempt; GREEN preserves the source snapshot with zero cleanup attempts.
- **Committed in:** `2001914`, `cb830c3`

---

**Total deviations:** 4 auto-fixed (3 correctness/security bugs, 1 missing trust-boundary requirement).  
**Impact on plan:** All changes directly enforce the declared filesystem and public-input threat mitigations; no remote transport, MCP registration, persistence, publishing, or credential scope was added.

## Independent Review

- Confirmed exact top-level and nested input shapes and all fixed boundary values.
- Confirmed fixture and local targets call the same production Node adapter and Phase 4 lifecycle.
- Confirmed non-follow source classification, canonical containment, exclusive destination creation, exact candidate rewalk, streamed integrity, and source snapshot preservation.
- Confirmed missing Windows reparse classification blocks before creation and a positive injected capability exercises the same local contract without claiming real Windows evidence.
- Confirmed readiness, inspection, copy, hash, cleanup, post-create observation, and protected-root failures retain explicit operation/artifact/cleanup facts.
- Confirmed no successful or failed public detail contains a candidate root, live lease, callback capability, upload-ready artifact, credential value, or private absolute path.
- Final review result: no unresolved confirmed issue.

## Verification Evidence

- Final full suite: 237/237 passed across 22 test files.
- Focused final boundary/adapter/Phase 3-4 regression suite: 85/85 passed before the final expanded full run.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:plugin`: passed.
- `npm run verify:same-machine-smoke`: passed with runtime evidence explicitly pending.
- `npm run verify:source-snapshot`: passed.
- `npm run verify:install-simulation`: passed with cleanup proof.
- `npm run verify:rc`: passed, including repository forbidden-content scanning.
- `npm run verify:handoff`: passed.
- Historical `npm run verify:milestone`: passed.
- `git diff --check`, immutable graph baseline comparison, and cached graph exclusion guards passed.
- Generated release-candidate distribution outputs were removed after builds; user-owned graph changes remain untouched and unstaged.

## Issues Encountered

- The RC repository scanner correctly rejected a test literal shaped like a credential assignment. The test key is now assembled from inert fragments while preserving the strict unknown-key assertion.

## User Setup Required

None - no external service configuration, credentials, Steam login, remote connection, or real Windows evidence is required.

## Next Phase Readiness

- The shared fixture/local production execution path is ready for MCP routing and golden parity integration.
- Remote transport remains owned by later Phase 5 plans and was not implemented here.
- No blocker remains for dependent plans.

## Self-Check: PASSED

- All declared source, test, and summary artifacts exist.
- RED `f85855b` precedes GREEN `41fd41f`; review RED commits `0719d31` and `2001914` precede review fix `cb830c3`.
- `requirements-completed` contains only `RCOP-04`, with no competing owner introduced by this plan.
- The worktree contains only the preserved user-owned graph modifications after plan artifacts are committed.

---
*Phase: 05-unified-mcp-and-remote-target-parity*
*Completed: 2026-07-16*

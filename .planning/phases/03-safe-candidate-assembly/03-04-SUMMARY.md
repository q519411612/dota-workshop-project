---
phase: 03-safe-candidate-assembly
plan: 04
subsystem: release-candidate
tags: [typescript, vitest, filesystem, canonical-paths, temporary-lifecycle]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Opaque validated input and deterministic fail-closed source inventory from plans 03-02 and 03-03
provides:
  - Single target-local candidate creation after validation and inventory
  - Post-creation canonical isolation proof against the temporary parent and every protected root
  - Callback-scoped inspection with sanitized failure mapping and mandatory removal ownership
affects: [03-safe-candidate-assembly, candidate-layout, source-stability, cleanup-evidence]

tech-stack:
  added: []
  patterns: [opaque adapter capability, callback-scoped temporary ownership, canonical disjointness]

key-files:
  created: [.planning/phases/03-safe-candidate-assembly/03-04-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Require the validated filesystem capability to own both creation and removal; lifecycle execution fails before creation when removal ownership is absent."
  - "Return callback values only after successful candidate removal, so no usable candidate path can escape the owned lifetime."
  - "Treat candidate canonicalization, isolation, inspection, and removal errors as sanitized stable blockers without exposing target paths or exception text."

patterns-established:
  - "Candidate creation follows successful opaque input validation and complete safe inventory exactly once."
  - "The created root must be a strict canonical descendant of the validated temporary parent and canonically disjoint from Dota, both addon sources, and the repository."

requirements-completed: [RCFS-01]

duration: 6min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 04: Isolated Candidate Lifetime Summary

**One canonically isolated target-local candidate now exists only inside an owned inspection callback and is removed after callback success or failure.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-15T06:27:50Z
- **Completed:** 2026-07-15T06:33:30Z
- **Tasks:** 2 plus self-review
- **Files modified:** 3

## Accomplishments

- Added a lifecycle test covering exact one-time creation, callback-only existence, post-return absence, callback failure, a post-creation canonical alias attack, and explicit removal failure.
- Added `withAssembledReleaseCandidate`, which accepts only prepared and safely inventoried sources before reaching the bound creation capability.
- Canonicalized the created child and proved strict temporary-parent containment plus disjointness from the Dota root, both addon roots, and repository before invoking inspection.
- Mapped creation, canonicalization, isolation, callback, and removal failures to stable sanitized blockers without exception text, private paths, fallback, or retained success values.
- Preserved the fail-closed Windows adapter boundary; no lifecycle can create through an adapter that lacks removal ownership.

## Task Commits

1. **Specify canonical isolation and temporary lifetime** - `a0011e0` (test)
2. **Implement single-owner candidate creation and removal** - `beb92ac` (feat)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Lifecycle, alias attack, callback failure, removal failure, redaction, and post-return absence coverage.
- `src/release-candidate.ts` - Callback-scoped creation, post-create isolation, sanitized outcomes, and removal ownership.
- `.planning/phases/03-safe-candidate-assembly/03-04-SUMMARY.md` - Plan execution and verification record.

## Decisions Made

- Kept removal as an adapter-owned optional capability for validation/inventory compatibility, but made it mandatory at runtime before lifecycle creation; there is no host-filesystem fallback for supplied adapters.
- Returned only the inspection callback's value after removal succeeds. If removal is uncertain, the result contains only the explicit removal blocker and does not claim absence or expose the callback value.
- Deferred fixed-layout writes, byte copying, manifests, hashes, versioned cleanup evidence, precedence rules, MCP integration, and remote execution to their owning plans and phases.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED failed because `withAssembledReleaseCandidate` was absent.
- Test commit `a0011e0` precedes implementation commit `beb92ac`.
- GREEN passed the focused lifecycle test before typecheck, build, and the full repository gate.

## Verification Evidence

- Focused lifecycle test: 1/1 passed.
- Candidate validation and inventory suite: 10/10 passed.
- Full repository suite: 170/170 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Self-review: no confirmed blocker or warning across canonical containment, callback ownership, adapter binding, sanitized errors, and cleanup failure behavior.
- Build produced only the already-untracked `dist/release-candidate.js`; no untracked distribution artifact was staged.
- User-owned `.planning/graphs/` changes remained unstaged and were not modified by this plan.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-05 can add fixed two-root directory and file writes inside the proven canonical candidate lifetime.
- Plan 03-06 can extend the same owner with source-stability checkpoints without changing candidate lifetime semantics.
- Phase 4 remains the sole owner of formal cleanup evidence and precedence.

## Self-Check: PASSED

- Required source, test, and summary files exist.
- Both task commits are present in RED-before-GREEN order.
- RCFS-01 behavior is directly exercised on macOS fixtures.
- No graph file, persistent candidate, tracked archive, credential, MCP, or remote change is included.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

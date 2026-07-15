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
  - "Never recursively remove a create result until raw and canonical ownership checks produce a private immutable lease."
  - "Revalidate lease type, canonical identity, and containment immediately before removal; callback-driven replacement produces explicit cleanup uncertainty without deletion."

patterns-established:
  - "Candidate creation follows successful opaque input validation and complete safe inventory exactly once."
  - "The created root must be a strict canonical descendant of the validated temporary parent and canonically disjoint from Dota, both addon sources, and the repository."

requirements-completed: [RCFS-01]

duration: 22min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 04: Isolated Candidate Lifetime Summary

**One canonically isolated target-local candidate now exists only inside an owned inspection callback and is removed after callback success or failure.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-15T06:27:50Z
- **Completed:** 2026-07-15T06:49:30Z
- **Tasks:** 2 plus critical review remediation
- **Files modified:** 3

## Accomplishments

- Added a lifecycle test covering exact one-time creation, callback-only existence, post-return absence, callback failure, a post-creation canonical alias attack, and explicit removal failure.
- Added `withAssembledReleaseCandidate`, which accepts only prepared and safely inventoried sources before reaching the bound creation capability.
- Canonicalized the created child and proved strict temporary-parent containment plus disjointness from the Dota root, both addon roots, and repository before invoking inspection.
- Mapped creation, canonicalization, isolation, callback, and removal failures to stable sanitized blockers without exception text, private paths, fallback, or retained success values.
- Preserved the fail-closed Windows adapter boundary; no lifecycle can create through an adapter that lacks removal ownership.
- Replaced raw-path cleanup with a private frozen candidate lease created only after lexical strict-child, directory, canonical identity, and protected-root disjointness checks pass.
- Bound lifecycle adapter methods before creation, revalidated the lease immediately before cleanup, and verified post-removal absence.
- Proved repository, source, temporary-parent, and outside paths are never passed to recursive removal, while callback alias swaps preserve repository sentinels and return cleanup uncertainty.

## Task Commits

1. **Specify canonical isolation and temporary lifetime** - `a0011e0` (test)
2. **Implement single-owner candidate creation and removal** - `beb92ac` (feat)
3. **Expose unsafe cleanup ownership** - `772f65a` (test)
4. **Forbid cleanup before ownership proof** - `ceb2b49` (test)
5. **Bind cleanup ownership to an immutable lease** - `6904991` (fix)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Lifecycle, alias attack, callback failure, removal failure, redaction, and post-return absence coverage.
- `src/release-candidate.ts` - Callback-scoped creation, post-create isolation, sanitized outcomes, and removal ownership.
- `.planning/phases/03-safe-candidate-assembly/03-04-SUMMARY.md` - Plan execution and verification record.

## Decisions Made

- Kept removal as an adapter-owned optional capability for validation/inventory compatibility, but made it mandatory at runtime before lifecycle creation; there is no host-filesystem fallback for supplied adapters.
- Returned only the inspection callback's value after removal succeeds. If removal is uncertain, the result contains only the explicit removal blocker and does not claim absence or expose the callback value.
- Captured `lstat`, `realpath`, creation, and removal methods before creation so callback mutation of the filesystem adapter cannot change ownership behavior.
- Refused cleanup entirely until both lexical and canonical ownership proof succeeds; a protected or outside create result is treated as unowned even if an adapter claims it created that path.
- Accepted the ordinary external filesystem race between immediate pre-removal revalidation and Node removal as a documented TOCTOU limit; callback-driven path replacement is revalidated deterministically and fails closed before deletion.
- Deferred fixed-layout writes, byte copying, manifests, hashes, versioned cleanup evidence, precedence rules, MCP integration, and remote execution to their owning plans and phases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Unsafe cleanup ownership] Prevent recursive removal of untrusted create results**
- **Found during:** Critical independent review after initial plan completion.
- **Issue:** Isolation checked the canonical create result, but cleanup received the untrusted lexical result and could recursively remove the repository, a source root, the temporary parent, or another outside path.
- **Fix:** Added raw strict-child validation and canonical isolation before creating a private immutable lease; unowned results never reach cleanup.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** RED recorded `removeCandidateRoot(repositoryRoot)`; GREEN proves repository/source/outside/parent variants receive zero removal calls and retain sentinels.
- **Committed in:** `772f65a`, `ceb2b49`, `6904991`.

**2. [Rule 1 - Mutable cleanup capability] Bind adapter ownership before callback execution**
- **Found during:** Critical independent review after initial plan completion.
- **Issue:** Cleanup reread `filesystem.removeCandidateRoot` after awaiting inspection, allowing callback code to replace it with a no-op.
- **Fix:** Captured and bound all lifecycle methods before creation and stored a no-argument removal closure in the private frozen lease.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** Callback mutation cannot replace the captured removal; the original is called exactly once and candidate absence is proven.
- **Committed in:** `772f65a`, `6904991`.

**3. [Rule 2 - Cleanup revalidation] Detect callback-driven alias replacement before removal**
- **Found during:** Critical independent review after initial plan completion.
- **Issue:** The callback could replace the candidate path with an alias to a protected root before cleanup.
- **Fix:** Revalidate entry type, exact canonical identity, containment, and protected-root disjointness immediately before invoking the lease remover; verify absence afterward.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** A real fixture symlink swap to the repository returns `CANDIDATE_REMOVAL_UNVERIFIED`, never calls removal, preserves the repository sentinel, and leaves residue without claiming absence.
- **Committed in:** `772f65a`, `6904991`.

---

**Total deviations:** 3 critical review corrections (2 bugs, 1 missing critical safety check).
**Impact on plan:** Corrections strengthen RCFS-01 ownership and cleanup safety without adding formal cleanup evidence, manifests, copying, MCP, or remote scope.

## TDD Gate Compliance

- RED failed because `withAssembledReleaseCandidate` was absent.
- Test commit `a0011e0` precedes implementation commit `beb92ac`.
- GREEN passed the focused lifecycle test before typecheck, build, and the full repository gate.
- Review RED `772f65a` reproduced recursive removal of an unowned repository path and mutable cleanup capability behavior before fix `6904991`.
- Review RED refinement `ceb2b49` proved canonical isolation failure must not invoke cleanup before lease ownership exists.

## Verification Evidence

- Focused lifecycle test: 1/1 passed.
- Candidate validation, inventory, and ownership suite: 11/11 passed.
- Full repository suite: 171/171 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Critical review: all confirmed lexical cleanup, mutable capability, and callback replacement findings were reproduced and corrected; no confirmed issue remained after re-review.
- Build produced only the already-untracked `dist/release-candidate.js`; no untracked distribution artifact was staged.
- User-owned `.planning/graphs/` changes remained unstaged and were not modified by this plan.

## Issues Encountered

- Initial review exposed that canonical inspection safety did not establish lexical cleanup ownership. The unsafe call was reproduced directly, then corrected at the ownership boundary rather than patched at individual protected paths.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-05 can add fixed two-root directory and file writes inside the proven canonical candidate lifetime.
- Plan 03-06 can extend the same owner with source-stability checkpoints without changing candidate lifetime semantics.
- Phase 4 remains the sole owner of formal cleanup evidence and precedence.

## Self-Check: PASSED

- Required source, test, and summary files exist.
- Initial and review remediation commits are present in RED-before-GREEN order.
- RCFS-01 behavior is directly exercised on macOS fixtures.
- No graph file, persistent candidate, tracked archive, credential, MCP, or remote change is included.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

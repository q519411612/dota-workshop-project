---
phase: 03-safe-candidate-assembly
plan: 06
subsystem: release-candidate
tags: [typescript, vitest, filesystem, source-stability, immutable-assembly]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Accepted source inventory, identity-bound materialization, exact candidate reconciliation, and callback-scoped cleanup
provides:
  - Capability-bound source observations for kind, canonical identity, stable stats, and exact bytes
  - Immediate pre-use and post-use source revalidation without retry
  - Sorted final topology rewalks before inspection and after callback inspection
  - Source-immutability evidence across success and candidate failure paths
affects: [04-candidate-integrity-preflight, 05-workshop-addon-release-candidate-preflight-integration]

tech-stack:
  added: []
  patterns: [accepted observation comparison, deterministic source rewalk, source-change failure normalization]

key-files:
  created: [.planning/phases/03-safe-candidate-assembly/03-06-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Keep source-change detection inside the existing identity-bound adapter contract and require complete kind, canonical identity, stable-stat, containment, and byte observations."
  - "Return SOURCE_CHANGED_DURING_ASSEMBLY for accepted-entry drift while preserving the more specific unsafe-entry blockers produced by a final inventory rewalk."
  - "Run the final source rewalk after callback completion before returning its value, and still clean the candidate lease exactly once."

patterns-established:
  - "Every inventoried source entry is compared before and after materialization; complete sorted source trees are rewalked at lifecycle boundaries."
  - "Source observations are retained only in memory for change detection and are not exposed as hashes, digests, manifests, or integrity claims."

requirements-completed: [RCFS-05]

duration: 12min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 06: Immutable Source Assembly Summary

**Candidate assembly now fails explicitly on observable source topology, identity, stat, kind, or byte drift while all candidate writes and cleanup remain outside the two source roots.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T08:45:00Z
- **Completed:** 2026-07-15T08:57:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added accepted source observations for both source roots and every accepted entry, including exact bytes for regular files without producing a Phase 4 hash or manifest.
- Rewalked both source trees in deterministic order before candidate creation, before assembly, after assembly, before callback inspection, and after callback inspection.
- Revalidated each accepted entry immediately before and after materialization, normalized adapter-reported source drift to `SOURCE_CHANGED_DURING_ASSEMBLY`, and preserved specific unsafe-entry blockers from inventory.
- Proved add, remove, rename, retype, symbolic-link replacement, truncation, and same-length byte mutation failures across lifecycle checkpoints.
- Proved mutation checks do not retry, candidate cleanup executes exactly once, callbacks do not receive unstable assemblies, and no callback value escapes a final source change.
- Proved source topology and bytes remain identical across successful assembly, destination copy failure, callback failure, and removal failure; all recorded materialization and cleanup targets remain outside source roots.

## Task Commits

1. **Specify mutation detection and source immutability** - `92c6d71` (test)
2. **Implement fail-closed source stability checks** - `fa98693` (feat)
3. **Strengthen no-retry and cleanup-target evidence during review** - `d0d1f36` (test)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Deterministic mutation checkpoints, byte/topology snapshots, no-retry assertions, and write-target confinement evidence.
- `src/release-candidate.ts` - Accepted source observation contract, lifecycle comparisons, final sorted rewalks, and explicit source-change normalization.
- `.planning/phases/03-safe-candidate-assembly/03-06-SUMMARY.md` - TDD, review, verification, and baseline gate evidence.

## Decisions Made

- Observations carry raw in-memory bytes solely to distinguish same-length content changes; the result does not expose or persist a hash, digest, manifest, archive, or integrity assertion.
- Root directory observations supplement entry observations so replacing an otherwise empty source root cannot evade the topology comparison.
- A callback exception is recorded first, then the final source rewalk runs; source drift takes precedence over the callback failure so the operation cannot hide a mutation.
- Candidate cleanup remains in the existing `finally` path and executes once for every created lease without retry, repair, recopy, or source mutation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Root identity] Observe the two accepted source roots as well as their entries**
- **Found during:** Independent review after initial GREEN.
- **Issue:** Entry-only observations could not distinguish replacement of an empty source root with another empty directory.
- **Fix:** Added synthetic accepted directory identities for both source roots to baseline and lifecycle comparisons.
- **Files modified:** `src/release-candidate.ts`.
- **Verification:** Candidate suite and typecheck passed after root observations were included.
- **Committed in:** `fa98693`.

**2. [Rule 2 - Callback precedence] Rewalk after callback exceptions**
- **Found during:** Independent review after initial GREEN.
- **Issue:** Returning immediately from the callback catch would skip the final source rewalk when a callback both mutated source and threw.
- **Fix:** Record callback failure, run final stability verification, then return the callback blocker only when source remains stable.
- **Files modified:** `src/release-candidate.ts`.
- **Verification:** Full candidate suite passed with final callback mutation detection intact.
- **Committed in:** `fa98693`.

**3. [Rule 2 - Evidence strength] Count mutation attempts and cleanup removal targets**
- **Found during:** Independent test review.
- **Issue:** A one-shot mutation helper proved the final result but did not directly prove that the checkpoint was not retried, and cleanup deletion was not included in the recorded destination set.
- **Fix:** Assert one checkpoint attempt per scenario and record the leased candidate root before cleanup removal.
- **Files modified:** `tests/release-candidate.test.ts`.
- **Verification:** Focused mutation test passed 1/1 after the assertions were added.
- **Committed in:** `d0d1f36`.

---

**Total deviations:** 3 correctness and evidence-strength fixes.
**Impact on plan:** All fixes remain inside RCFS-05 source-stability and immutability scope. No Phase 4 manifest, formal cleanup evidence, Phase 5 integration, MCP, remote, archive, signing, encryption, compilation, source repair, Steam, Workshop, or credential behavior was added.

## TDD Gate Compliance

- RED command: `npm test -- tests/release-candidate.test.ts -t "fails on source mutation without writing source trees"`.
- RED result: the safe-add mutation returned `{ ok: true, value: ... }`, proving the test detected the missing final topology observation.
- GREEN command passed the focused mutation test after the source observation and rewalk implementation.
- The complete candidate suite passed 23/23, and the focused Phase 3 regression set passed 60/60.
- RED commit `92c6d71` precedes GREEN commit `fa98693`.

## Independent Review

- Reviewed source and destination containment, link/reparse rejection, mutation timing, strict adapter-result parsing, redaction, callback lifetime, cleanup count, dry-run compatibility, and Phase 4/5 exclusions.
- Confirmed production code adds no source write operation, retry, repair, recopy, compile, upload, login, archive, signing, encryption, manifest, digest, MCP, or remote path.
- Review found and corrected root-identity coverage, callback-exception rewalk ordering, and explicit no-retry/cleanup-target evidence.

## Verification Evidence

- Focused mutation test: 1/1 passed.
- Candidate lifecycle suite: 23/23 passed.
- Focused Phase 3 regression set: 60/60 passed across 6 files.
- Full repository suite: 183/183 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:plugin`: passed.
- `npm run verify:install-simulation`: passed with cleanup removed.
- `git diff --check`: passed.
- `npm run verify:source-snapshot`: blocked by pre-existing repository content: private absolute paths embedded in Phase 3 plan execution-context metadata and existing credential-detection fixtures.
- `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone`: their internal tests, typecheck, build, plugin, delivery, documentation, and boundary checks passed, but their aggregate status remained blocked by existing credential-assignment fixture strings in `tests/release-candidate.test.ts` and `tests/release-readiness.test.ts`.
- Baseline confirmation: the flagged plan paths and credential fixture strings are present at pre-plan commit `17d8c1e`; removing or exempting them would require historical planning/test or repository-scanner changes outside RCFS-05.
- User-owned `.planning/graphs/` modifications remained unstaged and unchanged; the pre-existing untracked `dist/release-candidate.js` remained unstaged.

## Issues Encountered

- Repository-level source-snapshot and RC hygiene verifiers currently reject their own historical planning metadata and security test fixtures. The implementation did not weaken those verifiers, rewrite history, suppress blockers, or expand into Phase 4 scan-coverage policy.

## User Setup Required

None.

## Next Phase Readiness

- RCFS-05 behavior and macOS fixture evidence are ready for Phase 4 candidate integrity work.
- The orchestrator must retain the explicit legacy hygiene-gate blockers until the owning repository-verification scope resolves them; they are not evidence of a candidate assembly test, type, build, containment, or source-immutability failure.

## Self-Check: IMPLEMENTATION PASSED; LEGACY REPOSITORY HYGIENE BLOCKERS RECORDED

- Source, test, and summary files exist.
- RED and GREEN commits are present in order.
- RCFS-05 mutation and immutability behavior passes on macOS fixtures without Dota or Windows.
- Graph changes and untracked distribution output remain excluded.
- Repository hygiene aggregate commands are not claimed as passing; their exact pre-existing blockers are recorded above.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

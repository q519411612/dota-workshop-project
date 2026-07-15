---
phase: 04-integrity-manifest-and-verified-cleanup
plan: 03
subsystem: release-candidate
tags: [typescript, integrity, occurrence-ledger, manifest, deterministic-evidence]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    plan: 02
    provides: Final integrity observations and canonical candidate manifest projection
provides:
  - Exact occurrence-first candidate inclusion ledger with file counts
  - Deterministic blockers for duplicate, missing, unexpected, wrong-root, wrong-kind, and unobserved entries
  - Manifest projection gated by both file bijection and independent tree reconciliation
affects: [04-integrity-manifest-and-verified-cleanup, scan-coverage, cleanup-evidence, artifact-validation]

tech-stack:
  added: []
  patterns: [occurrence-first reconciliation, post-comparison evidence sanitization, independent file-and-tree predicates]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-03-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Derive expected file identities directly from accepted inventory provenance and retain every candidate occurrence before constructing a unique lookup."
  - "Expose versioned expected, observed, and matched file counts on successful and blocked inclusion-ledger outcomes."
  - "Aggregate all deterministic ledger discrepancies before sanitizing emitted paths, while preserving structural reconciliation as an independent predicate for files and empty directories."

patterns-established:
  - "Candidate observation arrays are parsed into ordinal occurrence collections before any candidate identity map is created."
  - "A manifest is projected only from a fully bijective final post-inspection candidate ledger whose bytes also match source-before and source-after observations."

requirements-completed: [RCIN-04]

duration: 9min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 03: Exact Candidate Inclusion Ledger Summary

**Final candidate observations now prove a deterministic one-to-one mapping from every accepted source file to exactly one manifest entry without losing duplicate occurrences.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-15T13:31:09Z
- **Completed:** 2026-07-15T13:40:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a versioned inclusion ledger reporting exact expected, raw observed, and matched regular-file counts.
- Retained and sorted every final candidate occurrence before constructing the unique observation map.
- Added complete stable blockers for duplicate, missing, unexpected, wrong-root, wrong-kind, and unobserved facts with sanitized relative paths and exact occurrence counts.
- Used accepted inventory root provenance as the expected identity authority and kept source observations occurrence-first before their lookup map is constructed.
- Preserved `reconcileCandidateTree` as a separate mandatory predicate so fixed prefixes and empty directories cannot be inferred from hashes or manifest entries.
- Returned the final post-inspection inclusion ledger with successful manifests and withheld all manifest evidence when ledger or structural reconciliation fails.

## TDD Evidence

- RED: `npm test -- tests/release-candidate.test.ts -t "rejects non-bijective candidate integrity ledgers"` failed because the existing parser returned only `CANDIDATE_INTEGRITY_RESULT_INVALID` and exposed no occurrence counts or discrepancy categories.
- GREEN: The same focused command passed after occurrence-first reconciliation was implemented.
- Regression alignment separated newly classified ledger failures from malformed adapter-shape failures while preserving hostile getter, proxy, iterator, thenable, digest, count, and containment rejection.

## Task Commits

1. **Specify exact occurrence-ledger failures** - `929e782` (`test`)
2. **Normalize deterministic evidence order** - `9e7ea28` (`test`)
3. **Separate ledger discrepancies from malformed payloads** - `dc9906f` (`test`)
4. **Classify wrong-kind and unobserved facts** - `3b2ce77` (`test`)
5. **Type hostile ledger fixtures** - `0f83b45` (`test`)
6. **Implement occurrence-first inclusion reconciliation** - `94e5db9` (`feat`)

## Files Created/Modified

- `src/release-candidate.ts` - Adds the inclusion ledger contract, occurrence parsing, complete reconciliation, deterministic blockers, and success composition.
- `tests/release-candidate.test.ts` - Adds duplicate permutations, mixed discrepancy categories, exact counts, hostile facts, and empty-directory structural evidence.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-03-SUMMARY.md` - Records plan evidence and verification.

## Decisions Made

- Candidate occurrences are associated by raw validated path first so wrong-root facts remain distinguishable from unrelated unexpected paths.
- A file counts as matched only when exactly one occurrence has the accepted root/path and literal identity/kind facts; any additional or failed occurrence prevents a match.
- Ledger blockers use a fixed category priority followed by ordinal safe path and code ordering, independent of adapter enumeration order.
- Maps are constructed only after complete occurrence accounting passes; structural reconciliation continues to precede callback inspection and remains responsible for empty directories.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Existing malformed-observation cases for missing, duplicate, unexpected, wrong-kind, and identity-false facts overlapped the new required ledger classifications. Those cases were moved to the exact ledger matrix; genuinely malformed shapes remain covered by the original test.
- The hostile fixture initially used the successful observation type for literal false identity/kind facts. Its callback return type was widened to `unknown[]`, preserving the production parser as the contract boundary.

## Verification Evidence

- Focused occurrence-ledger matrix: 1/1 passed.
- Complete release-candidate suite: 35/35 passed.
- Full repository suite: 195/195 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; generated untracked `dist/release-candidate.js` was removed after verification.
- `git diff --check`: passed.
- Staged-path inspection included only the scoped source, test, or summary file for each atomic commit.

## Security and Scope Review

- Confirmed duplicate and hostile observations remain in raw occurrence collections until complete accounting finishes.
- Confirmed paths are compared internally before shared evidence sanitization, preventing redaction collisions from changing ledger identity.
- Confirmed no fallback, retry, recopy, repair, truncation, raw exception, absolute candidate path, source mutation, archive, signing, encryption, upload, credential, compile, remote, or MCP behavior was added.
- Confirmed source trees remain read-only and candidate cleanup remains lease-bound.
- Confirmed existing `.planning/graphs/` modifications remained unstaged and were neither changed nor committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-04 can compose exhaustive scan coverage with the successful manifest and inclusion ledger without changing inclusion semantics.
- Plan 04-06 can use the final inclusion ledger as one independent input to artifact-validation state.

## Self-Check: PASSED

- `src/release-candidate.ts`, `tests/release-candidate.test.ts`, and this summary exist.
- RED commits precede the production commit in history.
- Focused, candidate, full-suite, typecheck, build, diff, generated-artifact cleanup, and graph-exclusion checks passed.
- RCIN-04 has unique plan traceability and complete implementation/test evidence.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

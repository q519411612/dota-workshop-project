---
phase: 04-integrity-manifest-and-verified-cleanup
plan: 01
subsystem: release-candidate
tags: [typescript, vitest, sha256, streaming, identity-bound-lifecycle]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Opaque candidate lease, accepted source inventory, exact assembly, source stability checks, and single cleanup funnel
provides:
  - Versioned source and lease-bound candidate integrity observation contracts
  - Exact source-before, candidate, and source-after byte-count and SHA-256 validation
  - Fresh post-callback candidate and source observations before cleanup
  - Strict sanitized rejection of malformed, hostile, missing, duplicate, and unexpected integrity observations
affects: [04-integrity-manifest-and-verified-cleanup, manifest, inclusion-ledger, scan-coverage, verified-cleanup]

tech-stack:
  added: []
  patterns: [bounded-chunk SHA-256 fixture observations, guarded hostile-result normalization, final triple-integrity comparison]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-01-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Keep source integrity bound to validated accepted entries and candidate integrity bound to the opaque lease identity; orchestration receives no raw path or bytes."
  - "Validate candidate integrity once before callback inspection and freshly again after callback settlement, then obtain fresh source-after observations before cleanup."
  - "Give final integrity failure precedence over callback return or throw so mutation-before-throw cannot be misreported as only an inspection failure."
  - "Retain Phase 3 metadata/topology checks while removing whole-file byte retention from source stability observations."

patterns-established:
  - "Every integrity fact uses schema version 1.0, exact root/path identity, safe byte count, lowercase SHA-256, and literal identity/kind/containment proof."
  - "Foreign collections are read by guarded indexed access, retain occurrences until duplicate checks complete, and never depend on foreign iteration."
  - "Integrity observation failures and mismatches never retry, recopy, repair, compile, or write source files; cleanup remains exactly once."

requirements-completed: [RCIN-01]

duration: 17min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 01: Final Candidate Integrity Summary

**Every accepted regular file now requires identity-bound streamed source-before, candidate, and source-after byte-count and SHA-256 equality at the final pre-cleanup boundary.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-15T18:42:00+08:00
- **Completed:** 2026-07-15T18:58:51+08:00
- **Tasks:** 2 TDD tasks plus independent self-review
- **Files modified:** 3

## Accomplishments

- Replaced Phase 3 whole-file stability bytes with strict versioned integrity observations containing only safe root/path, byte count, lowercase SHA-256, and identity proof.
- Added bounded-chunk macOS fixture hashing for empty, binary, and 256 KiB-plus files across irregular chunk boundaries without returning raw file bytes.
- Captured source-before observations before candidate creation, verified a lease-bound candidate before callback use, then freshly reobserved candidate and source after callback success or throw.
- Made candidate mutation, source mutation, and mutation-before-throw return one stable integrity blocker while withholding callback values and sanitized exception text.
- Rejected malformed versions, roots, paths, counts, digests, identity facts, missing/duplicate/unexpected observations, getters, proxies, iterators, thenables, and thrown results without retry or repair.
- Preserved Phase 3 readiness, topology reconciliation, source-tree immutability, opaque lease ownership, and exactly-once cleanup behavior.

## Task Commits

1. **Specify identity-bound streamed triple observations** - `fb69267` (test)
2. **Implement strict streaming integrity validation** - `0ccd073` (feat)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Bounded-chunk hashing fixture, callback outcome/mutation matrix, hostile result matrix, ordering, cleanup, and no-repair assertions.
- `src/release-candidate.ts` - Versioned identity-bound observation methods, strict guarded normalization, triple comparison, and removal of whole-file source stability bytes.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-01-SUMMARY.md` - TDD, review, scope, and verification evidence.

## Decisions Made

- Candidate observation receives the opaque lease and trusted expected tree; the factory resolves the hidden candidate identity through its `WeakMap` and never exposes a candidate path to orchestration.
- Candidate observation order is not trusted. Each occurrence is matched by exact trusted path, normalized independently, sorted ordinally, duplicate-checked, and only then inserted into a lookup map.
- Callback failure remains `CANDIDATE_INSPECTION_FAILED` only when final bytes are still valid. Any final source or candidate mismatch takes integrity precedence.
- Formal manifest entries, combined digest, occurrence-ledger evidence, scan coverage, public artifact-validation state, MCP routing, and remote target behavior remain owned by later plans.

## Deviations from Plan

None - the implementation remained within RCIN-01 and the planned source/test files.

## TDD Gate Compliance

- RED command failed because candidate integrity was never observed (`candidateCalls` was `0`, expected `2`).
- Test commit `fb69267` precedes GREEN implementation commit `0ccd073`.
- GREEN focused tests prove callback success, callback throw, candidate mutation, source mutation, mutation-before-throw, fresh final observations, and cleanup ordering.
- Hostile-result tests prove malformed final observations fail with stable sanitized evidence, one callback invocation, two intentional candidate observations, no materialization retry, and one cleanup.

## Independent Review

- Reviewed opaque lease binding, guarded property access, foreign array handling, duplicate accounting, callback/integrity precedence, source immutability, and cleanup ownership.
- Corrected an order-dependent candidate parser found during self-review: trusted paths now select the expected identity before normalization, so adapter enumeration order cannot affect integrity validity while duplicates remain explicit failures.
- Re-review found no raw-path hashing in orchestration, callback value leakage, retry, recopy, source write, compilation, manifest, public MCP, remote, archive, signing, encryption, upload, or credential behavior.

## Verification Evidence

- Focused final triple-integrity test: 1/1 passed.
- Focused malformed-observation test: 1/1 passed.
- Candidate/readiness/preflight regression suites: 49/49 passed.
- Full repository suite: 190/190 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; generated `dist/release-candidate.js` was removed from the untracked workspace after verification.
- `npm run verify:rc`: passed all plugin, example, typecheck, test, build, and repository scan gates.
- `git diff --check`: passed.
- Existing user-owned `.planning/graphs/` modifications remained unstaged and were neither changed nor committed by this plan.

## Issues Encountered

- Initial GREEN parsing compared candidate observations positionally against trusted expected files. Self-review identified that strict integrity should accept any complete occurrence order, so parsing was changed to guarded path-based matching before ordinal sorting and duplicate detection.

## User Setup Required

None.

## Next Plan Readiness

- Later Phase 4 plans can consume strict normalized integrity facts for manifest entries, combined digest, occurrence-ledger evidence, scan coverage, and cleanup-domain reporting.
- No real Windows evidence is required; the approved macOS fixture and adapter-contract evidence boundary remains explicit.

## Self-Check: PASSED

- RED and GREEN commits exist in order and contain only scoped test/source changes.
- RCIN-01 is exercised across empty, binary, large, mismatched, malformed, callback mutation, and callback throw fixtures.
- Graph modifications remain unstaged; no generated build output, archive, credential, MCP, remote, manifest, signing, encryption, upload, source repair, or fallback behavior was committed.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

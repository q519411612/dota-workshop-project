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
  patterns: [production bounded-chunk SHA-256 primitive, guarded hostile-result normalization, final triple-integrity comparison]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-01-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Keep source integrity bound to validated accepted entries and candidate integrity bound to the opaque lease identity; orchestration receives no raw path or bytes."
  - "Validate candidate integrity once before callback inspection and freshly again after callback settlement, then obtain fresh source-after observations before cleanup."
  - "Give final integrity failure precedence over callback return or throw so mutation-before-throw cannot be misreported as only an inspection failure."
  - "Retain Phase 3 metadata/topology checks while removing whole-file byte retention from source stability observations."
  - "Consume only adapter-opened async byte iterables in the production hashing primitive; reject pathname APIs, whole-file buffers, oversized chunks, and hostile iterator results."

patterns-established:
  - "Every integrity fact uses schema version 1.0, exact root/path identity, safe byte count, lowercase SHA-256, and literal identity/kind/containment proof."
  - "Foreign collections are read by guarded indexed access, retain occurrences until duplicate checks complete, and never depend on foreign iteration."
  - "Integrity observation failures and mismatches never retry, recopy, repair, compile, or write source files; cleanup remains exactly once."

requirements-completed: [RCIN-01]

duration: 37min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 01: Final Candidate Integrity Summary

**Every accepted regular file now requires identity-bound streamed source-before, candidate, and source-after byte-count and SHA-256 equality at the final pre-cleanup boundary.**

## Performance

- **Duration:** 37 min
- **Started:** 2026-07-15T18:42:00+08:00
- **Completed:** 2026-07-15T19:18:54+08:00
- **Tasks:** 2 TDD tasks plus two review-remediation TDD cycles
- **Files modified:** 3

## Accomplishments

- Replaced Phase 3 whole-file stability bytes with strict versioned integrity observations containing only safe root/path, byte count, lowercase SHA-256, and identity proof.
- Added a production `createHash("sha256")` primitive that incrementally consumes only adapter-opened async `Uint8Array` chunks, enforces a 64 KiB chunk ceiling and safe total count, and retains no raw bytes.
- Wired the controlled macOS fixture through the production primitive for empty, binary, and 256 KiB-plus files across irregular chunk boundaries without passing absolute paths into production code.
- Captured source-before observations before candidate creation, verified a lease-bound candidate before callback use, then freshly reobserved candidate and source after callback success or throw.
- Made candidate mutation, source mutation, and mutation-before-throw return one stable integrity blocker while withholding callback values and sanitized exception text.
- Rejected malformed versions, roots, paths, counts, digests, identity facts, missing/duplicate/unexpected observations, getters, proxies, iterators, thenables, and thrown results without retry or repair.
- Preserved Phase 3 readiness, topology reconciliation, source-tree immutability, opaque lease ownership, and exactly-once cleanup behavior.

## Task Commits

1. **Specify identity-bound streamed triple observations** - `fb69267` (test)
2. **Implement strict streaming integrity validation** - `0ccd073` (feat)
3. **Require production stream hashing** - `b68d687` (test)
4. **Stream identity-bound hashes in production** - `629978b` (feat)
5. **Require final integrity boundary ordering** - `2a8fd22` (test)
6. **Keep triple comparison as the final artifact check** - `2fe26e8` (fix)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Bounded-chunk hashing fixture, callback outcome/mutation matrix, hostile result matrix, ordering, cleanup, and no-repair assertions.
- `src/release-candidate.ts` - Versioned identity-bound observation methods, strict guarded normalization, triple comparison, and removal of whole-file source stability bytes.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-01-SUMMARY.md` - TDD, review, scope, and verification evidence.

## Decisions Made

- Candidate observation receives the opaque lease and trusted expected tree; the factory resolves the hidden candidate identity through its `WeakMap` and never exposes a candidate path to orchestration.
- The production streaming primitive accepts only a safe candidate-relative identity plus a zero-argument adapter closure returning an async byte iterable. It cannot open or hash a raw path and rejects a Buffer returned as the whole stream.
- Candidate observation order is not trusted. Each occurrence is matched by exact trusted path, normalized independently, sorted ordinally, duplicate-checked, and only then inserted into a lookup map.
- Callback failure remains `CANDIDATE_INSPECTION_FAILED` only when final bytes are still valid. Any final source or candidate mismatch takes integrity precedence.
- Formal manifest entries, combined digest, occurrence-ledger evidence, scan coverage, public artifact-validation state, MCP routing, and remote target behavior remain owned by later plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Production integrity primitive] Move incremental SHA-256 into production code**
- **Found during:** Independent specification review.
- **Issue:** The controlled fixture streamed chunks through `createHash`, but production exposed only precomputed observation seams and therefore did not itself enforce bounded incremental hashing.
- **Fix:** Added a guarded production primitive over adapter-opened async byte iterables and wired the fixture through it; raw paths and whole-file Buffer results remain outside the API.
- **Verification:** RED reported the production helper export as `undefined`; GREEN covers binary multi-chunk, empty, oversized chunk, invalid chunk, whole-file Buffer, iterator throw, getter, thenable, and absolute-identity cases.
- **Committed in:** `b68d687`, `629978b`.

**2. [Rule 1 - Final validation ordering] Make triple integrity the last artifact-validation boundary**
- **Found during:** Independent specification review.
- **Issue:** Final metadata stability ran after fresh candidate/source integrity observations, leaving the triple comparison short of the immediate pre-cleanup artifact boundary.
- **Fix:** Capture final stability first, then freshly observe candidate and source-after and perform triple equality last; deferred stability failure is returned only after a successful triple comparison.
- **Verification:** RED recorded `candidate-after -> source-after -> stability`; GREEN records `stability -> candidate-after -> source-after -> cleanup` for callback success and throw paths.
- **Committed in:** `2a8fd22`, `2fe26e8`.

---

**Total deviations:** 2 auto-fixed review gaps.
**Impact on plan:** Both corrections implement explicit RCIN-01 requirements without adding manifest, ledger, coverage, public state, MCP, remote, or persistent artifact scope.

## TDD Gate Compliance

- RED command failed because candidate integrity was never observed (`candidateCalls` was `0`, expected `2`).
- Test commit `fb69267` precedes GREEN implementation commit `0ccd073`.
- Production-stream RED `b68d687` precedes GREEN helper commit `629978b`.
- Final-order RED `2a8fd22` precedes ordering fix commit `2fe26e8`.
- GREEN focused tests prove callback success, callback throw, candidate mutation, source mutation, mutation-before-throw, fresh final observations, and cleanup ordering.
- Hostile-result tests prove malformed final observations fail with stable sanitized evidence, one callback invocation, two intentional candidate observations, no materialization retry, and one cleanup.

## Independent Review

- Reviewed opaque lease binding, guarded property access, foreign array handling, duplicate accounting, callback/integrity precedence, source immutability, and cleanup ownership.
- Corrected an order-dependent candidate parser found during self-review: trusted paths now select the expected identity before normalization, so adapter enumeration order cannot affect integrity validity while duplicates remain explicit failures.
- Specification review found and corrected the missing production hashing primitive and the final-boundary ordering gap through separate observed RED/green cycles.
- Re-review found no raw-path hashing in orchestration, callback value leakage, retry, recopy, source write, compilation, manifest, public MCP, remote, archive, signing, encryption, upload, or credential behavior.

## Verification Evidence

- Focused final triple-integrity test: 1/1 passed.
- Focused malformed-observation test: 1/1 passed.
- Candidate/readiness/preflight regression suites: 50/50 passed.
- Full repository suite: 191/191 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; generated `dist/release-candidate.js` was removed from the untracked workspace after verification.
- `npm run verify:rc`: passed all plugin, example, typecheck, test, build, and repository scan gates.
- `git diff --check`: passed.
- Existing user-owned `.planning/graphs/` modifications remained unstaged and were neither changed nor committed by this plan.

## Issues Encountered

- Initial GREEN parsing compared candidate observations positionally against trusted expected files. Self-review identified that strict integrity should accept any complete occurrence order, so parsing was changed to guarded path-based matching before ordinal sorting and duplicate detection.
- Specification review correctly identified that fixture-only hashing did not satisfy the production primitive requirement and that metadata stability followed the final triple observations; both were reproduced before correction.

## User Setup Required

None.

## Next Plan Readiness

- Later Phase 4 plans can consume strict normalized integrity facts for manifest entries, combined digest, occurrence-ledger evidence, scan coverage, and cleanup-domain reporting.
- No real Windows evidence is required; the approved macOS fixture and adapter-contract evidence boundary remains explicit.

## Self-Check: PASSED

- RED and GREEN commits exist in order and contain only scoped test/source changes.
- RCIN-01 is exercised across production empty/binary/multi-chunk streams, large fixture files, mismatches, malformed iterators/chunks/results, callback mutation, and callback throw fixtures.
- Graph modifications remain unstaged; no generated build output, archive, credential, MCP, remote, manifest, signing, encryption, upload, source repair, or fallback behavior was committed.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

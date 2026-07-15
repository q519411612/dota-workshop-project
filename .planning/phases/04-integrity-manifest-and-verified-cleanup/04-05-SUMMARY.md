---
phase: 04-integrity-manifest-and-verified-cleanup
plan: 05
subsystem: release-candidate
tags: [typescript, cleanup, lease-acquisition, fault-injection, tdd]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    plan: 04
    provides: Exhaustive scan coverage and final integrity lifecycle inputs
provides:
  - Strict versioned acquired, not-created, and created-failure acquisition outcomes
  - Adapter-owned cleanup after post-create acquisition failure
  - Exactly-once cleanup evidence for every valid lease outcome
affects: [04-integrity-manifest-and-verified-cleanup, artifact-validation, cleanup-precedence, unified-mcp-result]

tech-stack:
  added: []
  patterns: [creation registration before lease exposure, guarded acquisition normalization, one finally cleanup funnel]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-05-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "A provider records the opaque created identity before any lease result is exposed, allowing the identity-bound adapter to clean once if later acquisition normalization fails."
  - "Acquisition distinguishes versioned acquired, not-created, and created-failure states; created failures always carry one strict cleanup evidence record."
  - "Every valid lease outcome merges one serialized cleanup record after a single finally call, without retry or raw-path fallback."

patterns-established:
  - "Post-create acquisition failure: retain the registered opaque identity, normalize hostile results, clean once internally, and return stable created-failure evidence."
  - "Valid lease lifecycle: no post-acquisition branch owns cleanup; one outer finally owns the sole attempt."

requirements-completed: [RCCL-01]

duration: 7min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 05: Exactly-Once Candidate Cleanup Summary

**Candidate creation now transfers cleanup ownership before lease exposure, and every stateful outcome records exactly one strict cleanup attempt.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-15T15:28:45Z
- **Completed:** 2026-07-15T15:35:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a strict schema-versioned acquisition union that distinguishes acquired leases, genuine not-created failures, and created failures with adapter-owned cleanup evidence.
- Added an immediate creation registrar so opaque identity ownership exists before a provider can return a malformed object, throw, reject through a thenable, or trigger hostile getters/proxies.
- Guaranteed one cleanup call for success, candidate-root inspection failure, copy/materialization failure, candidate hash failure, ledger/reconciliation failure, callback throw, and malformed cleanup results.
- Added serialized cleanup evidence with fixed attempt count and verified/failed states while preserving current blocker semantics for the following artifact-precedence plan.
- Proved true precreation rejection performs zero creation and zero cleanup attempts.
- Proved every removable macOS fixture candidate is absent after the operation and no private exception text or root enters result evidence.

## TDD Evidence

- RED: `npm test -- tests/release-candidate.test.ts -t "cleans every post-create outcome exactly once"` failed because a created candidate followed by a malformed acquisition was mislabeled `CANDIDATE_CREATION_FAILED`, returned no cleanup evidence, and was not removed.
- GREEN: The same focused command passed after adding creation registration, guarded versioned acquisition normalization, internal created-failure cleanup, and the one valid-lease cleanup funnel.
- Regression alignment changed exact legacy result assertions to partial structural assertions where explicit cleanup evidence is now an intentional additional field; blocker, ledger, manifest, and lifecycle expectations remain asserted.

## Task Commits

1. **Require cleanup after candidate creation** - `8545a89` (`test`, RED)
2. **Guarantee post-create cleanup** - `31c8082` (`feat`, GREEN)

## Files Created/Modified

- `src/release-candidate.ts` - Defines strict acquisition states, creation registration, created-failure cleanup, and versioned exactly-once cleanup evidence.
- `tests/release-candidate.test.ts` - Adds the post-create acquisition and valid-lease fault matrix with creation, cleanup, callback, sanitization, and filesystem-absence assertions.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-05-SUMMARY.md` - Records TDD and quality-gate evidence.

## Decisions Made

- Providers may continue returning the established internal created identity shape, but the identity-bound factory now normalizes it into a closed public acquisition union and records identity immediately when creation happens before provider settlement.
- A provider that signals creation and then returns inconsistent, malformed, exceptional, getter/proxy, or rejecting-thenable output cannot produce a lease; the registered identity is cleaned exactly once internally.
- Cleanup evidence is emitted after every valid lease outcome now; Plan 04-06 remains responsible for separating final artifact-validation, operation, and cleanup precedence domains.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Adding explicit cleanup evidence made exact-object legacy assertions reject the intentional extra field. Those assertions were updated to retain their blocker/ledger checks while accepting the new evidence domain.

## Verification Evidence

- Focused post-create cleanup matrix: 1/1 passed.
- Candidate and install-simulation regressions: 55/55 passed.
- Full repository suite: 206/206 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:rc`: passed with zero warnings and zero blockers; its nested full suite also passed 206/206.
- `git diff --check`: passed.
- Generated untracked `dist/release-candidate.js` was removed after build verification.
- Existing `.planning/graphs/` user modifications remained untouched and unstaged.

## Security and Scope Review

- Confirmed opaque identity is stored before lease exposure and never returned to callers.
- Confirmed cleanup is never retried and no raw `rm` fallback exists in production lifecycle code.
- Confirmed malformed acquisition and cleanup getters, proxies, thenables, and exceptions map to stable sanitized evidence.
- Confirmed true precreation failures perform no cleanup, while every recorded creation performs one attempt.
- Confirmed source trees are never written and candidates are not persisted.
- Confirmed no public MCP/schema/server/remote integration, Steam/Workshop mutation, upload, credentials, archive, signing, encryption, compilation, repair, retention, or real-Windows claim was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-06 can compose immutable artifact-validation and cleanup domains on top of the versioned exactly-once evidence established here.
- No blockers remain.

## Self-Check: PASSED

- RED commit `8545a89` precedes GREEN commit `31c8082`.
- Focused, candidate/install, full-suite, typecheck, build, RC, diff, generated-artifact, and graph-exclusion gates passed.
- RCCL-01 has unique Plan 04-05 traceability and complete implementation/test evidence.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

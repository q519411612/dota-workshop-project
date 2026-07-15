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
  - "The provider contract requires recording the opaque created identity before any later await or lease result, allowing the identity-bound adapter to clean once if acquisition normalization fails."
  - "Acquisition distinguishes versioned acquired, not-created, and created-failure states; created failures always carry one strict cleanup evidence record."
  - "A creation signal with an unusable identity remains a created failure with explicit cleanup-identity-unavailable evidence and no fabricated removal or absence fact."
  - "Every valid lease outcome merges one serialized cleanup record after a single finally call, without retry or raw-path fallback."

patterns-established:
  - "Post-create acquisition failure: retain the registered opaque identity, normalize hostile results, clean once internally, and return stable created-failure evidence."
  - "Valid lease lifecycle: no post-acquisition branch owns cleanup; one outer finally owns the sole attempt."

requirements-completed: [RCCL-01]

duration: 20min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 05: Exactly-Once Candidate Cleanup Summary

**Candidate creation now transfers cleanup ownership before lease exposure, and every stateful outcome records exactly one strict cleanup attempt.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-15T15:28:45Z
- **Completed:** 2026-07-15T15:48:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a strict schema-versioned acquisition union that distinguishes acquired leases, genuine not-created failures, and created failures with adapter-owned cleanup evidence.
- Added an immediate creation registrar so opaque identity ownership exists before a provider can return a malformed object, throw, reject through a thenable, or trigger hostile getters/proxies.
- Guaranteed one cleanup call for success, candidate-root inspection failure, copy/materialization failure, candidate hash failure, ledger/reconciliation failure, callback throw, and malformed cleanup results.
- Added serialized cleanup evidence with fixed attempt count and verified/failed states while preserving current blocker semantics for the following artifact-precedence plan.
- Proved true precreation rejection performs zero creation and zero cleanup attempts.
- Proved every removable macOS fixture candidate is absent after the operation and no private exception text or root enters result evidence.
- Preserved creation state independently from identity parsing so malformed, throwing-getter, and throwing-proxy registrations cannot regress to a not-created result.
- Restored exact equality checks for legacy blocker, ledger, manifest, and callback-value domains while comparing the intentional cleanup evidence separately.

## TDD Evidence

- RED: `npm test -- tests/release-candidate.test.ts -t "cleans every post-create outcome exactly once"` failed because a created candidate followed by a malformed acquisition was mislabeled `CANDIDATE_CREATION_FAILED`, returned no cleanup evidence, and was not removed.
- GREEN: The same focused command passed after adding creation registration, guarded versioned acquisition normalization, internal created-failure cleanup, and the one valid-lease cleanup funnel.
- Review RED: the focused command failed because malformed/getter/proxy registration set an invalid flag but lost the fact that creation had been signaled, returning `CANDIDATE_CREATION_FAILED` without cleanup-unknown evidence.
- Review GREEN: the same matrix passed after making the registrar mandatory, tracking creation signal independently, and returning `CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE` without calling cleanup or claiming removal/absence when no usable identity exists.
- Regression alignment now destructures only the intentional cleanup field and retains exact equality for every pre-existing blocker, ledger, manifest, scan, and callback-value domain.

## Task Commits

1. **Require cleanup after candidate creation** - `8545a89` (`test`, RED)
2. **Guarantee post-create cleanup** - `31c8082` (`feat`, GREEN)
3. **Expose unusable creation identity** - `48b165e` (`test`, review RED)
4. **Require atomic cleanup ownership** - `c2b39c8` (`fix`, review GREEN)

## Files Created/Modified

- `src/release-candidate.ts` - Defines strict acquisition states, creation registration, created-failure cleanup, and versioned exactly-once cleanup evidence.
- `tests/release-candidate.test.ts` - Adds the post-create acquisition and valid-lease fault matrix with creation, cleanup, callback, sanitization, and filesystem-absence assertions.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-05-SUMMARY.md` - Records TDD and quality-gate evidence.

## Decisions Made

- Providers receive a required registrar and must transfer cleanup ownership immediately after creation, before any later await or provider settlement; the factory normalizes the result into a closed public acquisition union.
- A provider that signals creation and then returns inconsistent, malformed, exceptional, getter/proxy, or rejecting-thenable output cannot produce a lease; the registered identity is cleaned exactly once internally.
- A signaled creation whose registration is itself malformed cannot safely invoke target cleanup; it therefore reports one failed logical attempt with `CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE`, omits identity/removal/absence facts, and never claims the candidate is absent.
- Cleanup evidence is emitted after every valid lease outcome now; Plan 04-06 remains responsible for separating final artifact-validation, operation, and cleanup precedence domains.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Preserve created state when identity registration is hostile**
- **Found during:** Independent specification and quality review
- **Issue:** Malformed/getter/proxy registration set an invalid flag but left no independent creation signal, so a later throw was mislabeled as not-created.
- **Fix:** Made registration mandatory, recorded the creation signal before parsing, and added an explicit cleanup-identity-unavailable created-failure outcome.
- **Files modified:** `src/release-candidate.ts`, `tests/release-candidate.test.ts`
- **Verification:** Focused hostile-registration matrix, lifecycle regressions, full suite, typecheck, build, and RC gate.
- **Committed in:** `c2b39c8`

**2. [Rule 1 - Test Quality] Restore exact legacy-domain assertions**
- **Found during:** Independent quality review
- **Issue:** Initial evidence integration changed several exact-object assertions to broad partial matching.
- **Fix:** Added a helper that removes only the intentional cleanup field, then restored exact equality for blocker, ledger, manifest, scan, and value domains.
- **Files modified:** `tests/release-candidate.test.ts`
- **Verification:** Candidate/install regressions and full suite passed with exact assertions.
- **Committed in:** `48b165e`

---

**Total deviations:** 2 auto-fixed correctness/test-quality issues. **Impact on plan:** Both changes strengthen the required ownership contract without expanding scope.

## Issues Encountered

- Adding explicit cleanup evidence made exact-object legacy assertions reject the intentional extra field; the final tests now remove only that field and preserve exact checks for all existing domains.
- A cleanup-capable identity cannot be recovered safely from a hostile registration. The lifecycle reports explicit uncertainty and leaves no false absence claim instead of attempting raw-path removal.

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
- Confirmed the creation signal is stored before hostile identity parsing and survives getter/proxy exceptions.
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

- RED commit `8545a89` precedes GREEN commit `31c8082`; review RED `48b165e` precedes review GREEN `c2b39c8`.
- Focused, candidate/install, full-suite, typecheck, build, RC, diff, generated-artifact, and graph-exclusion gates passed.
- RCCL-01 has unique Plan 04-05 traceability and complete implementation/test evidence.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

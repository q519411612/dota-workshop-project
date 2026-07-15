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
  - Strict versioned acquired, created-failure, and creation-contract-failure outcomes
  - Adapter-owned cleanup after post-create acquisition failure
  - Retained ownership of asynchronously in-flight candidate creation
  - Exactly-once cleanup evidence for every valid lease outcome
affects: [04-integrity-manifest-and-verified-cleanup, artifact-validation, cleanup-precedence, unified-mcp-result]

tech-stack:
  added: []
  patterns: [factory-owned one-shot creation primitive, synchronous in-flight promise registration, opaque registered token, guarded acquisition normalization, one finally cleanup funnel]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-05-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "The provider cannot create through the supported contract directly; it receives a factory-owned one-shot primitive that stores opaque identity before returning an unforgeable token."
  - "Acquisition distinguishes versioned acquired, created-failure, and contract-failure states; only the exact factory token can produce a lease."
  - "When no cleanup-capable identity exists, evidence records attempted false, zero attempts, verified false, and no removal or absence fact."
  - "Every valid lease outcome merges one serialized cleanup record after a single finally call, without retry or raw-path fallback."

patterns-established:
  - "Post-create acquisition failure: retain the registered opaque identity, normalize hostile results, clean once internally, and return stable created-failure evidence."
  - "Valid lease lifecycle: no post-acquisition branch owns cleanup; one outer finally owns the sole attempt."

requirements-completed: [RCCL-01]

duration: 44min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 05: Exactly-Once Candidate Cleanup Summary

**Factory-owned candidate creation transfers cleanup ownership before provider post-create work, with exact one-attempt or truthful zero-attempt evidence.**

## Performance

- **Duration:** 44 min
- **Started:** 2026-07-15T15:28:45Z
- **Completed:** 2026-07-15T16:12:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a strict schema-versioned acquisition union that distinguishes acquired leases, created failures, and explicit creation-contract failures.
- Replaced provider-owned creation/registration with a factory-owned one-shot primitive that stores opaque identity and returns an unforgeable token before provider post-create work resumes.
- Retained ownership when providers start creation without awaiting it, including immediate throw and malformed-return paths, by synchronously storing the single in-flight creation promise before provider control resumes.
- Closed the creation primitive when acquisition settles, rejected concurrent or retained late invocations, and proved only the first in-flight creation can reach the adapter.
- Guaranteed one cleanup call for success, candidate-root inspection failure, copy/materialization failure, candidate hash failure, ledger/reconciliation failure, callback throw, and malformed cleanup results.
- Added serialized cleanup evidence with fixed attempt count and verified/failed states while preserving current blocker semantics for the following artifact-precedence plan.
- Proved true precreation rejection performs zero creation and zero cleanup attempts.
- Proved every removable macOS fixture candidate is absent after the operation and no private exception text or root enters result evidence.
- Made cleanup evidence truthful when no usable identity exists: zero cleanup calls produce `attempted: false`, `attempts: 0`, and `verified: false` without removal or absence claims.
- Proved an out-of-contract provider mutation remains an explicit contract failure and is never represented as cleaned or absent.
- Restored exact equality checks for legacy blocker, ledger, manifest, and callback-value domains while comparing the intentional cleanup evidence separately.

## TDD Evidence

- RED: `npm test -- tests/release-candidate.test.ts -t "cleans every post-create outcome exactly once"` failed because a created candidate followed by a malformed acquisition was mislabeled `CANDIDATE_CREATION_FAILED`, returned no cleanup evidence, and was not removed.
- GREEN: The same focused command passed after adding creation registration, guarded versioned acquisition normalization, internal created-failure cleanup, and the one valid-lease cleanup funnel.
- Review RED: the focused command failed because malformed/getter/proxy registration set an invalid flag but lost the fact that creation had been signaled, returning `CANDIDATE_CREATION_FAILED` without cleanup-unknown evidence.
- Review GREEN: the same matrix passed after making the registrar mandatory, tracking creation signal independently, and returning `CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE` without calling cleanup or claiming removal/absence when no usable identity exists.
- Structural review RED: the focused matrix failed because the callback-based contract still allowed a provider to ignore registration, and identity-unavailable evidence claimed one attempt despite zero cleanup calls.
- Structural review GREEN: factory-owned creation now registers before returning a token; a later provider throw cleans once, while skipped/malformed primitives return contract-failure evidence with zero truthful attempts.
- Async ownership review RED: the focused matrix failed because a provider could start creation without awaiting it and settle acquisition first, producing zero-attempt contract failure while the candidate appeared later without cleanup.
- Async ownership review GREEN: the factory now registers the in-flight promise synchronously, waits for it before acquisition classification, cleans a valid asynchronously created identity once, rejects concurrent creation, and closes retained primitives before any late adapter invocation.
- Regression alignment now destructures only the intentional cleanup field and retains exact equality for every pre-existing blocker, ledger, manifest, scan, and callback-value domain.

## Task Commits

1. **Require cleanup after candidate creation** - `8545a89` (`test`, RED)
2. **Guarantee post-create cleanup** - `31c8082` (`feat`, GREEN)
3. **Expose unusable creation identity** - `48b165e` (`test`, review RED)
4. **Require atomic cleanup ownership** - `c2b39c8` (`fix`, review GREEN)
5. **Require factory-owned creation** - `c9507d5` (`test`, structural review RED)
6. **Own candidate creation atomically** - `e1d668a` (`fix`, structural review GREEN)
7. **Expose in-flight creation race** - `9fd0961` (`test`, async ownership review RED)
8. **Retain in-flight creation ownership** - `a0f16d1` (`fix`, async ownership review GREEN)

## Files Created/Modified

- `src/release-candidate.ts` - Defines the factory-owned creation primitive/token, strict acquisition states, created-failure cleanup, and truthful versioned cleanup evidence.
- `tests/release-candidate.test.ts` - Adds the post-create acquisition and valid-lease fault matrix with creation, cleanup, callback, sanitization, and filesystem-absence assertions.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-05-SUMMARY.md` - Records TDD and quality-gate evidence.

## Decisions Made

- The supported provider contract exposes only a one-shot `createRegisteredCandidate` primitive; the factory invokes the target-native state creator, validates/stores opaque identity, and returns an unforgeable token before provider control resumes.
- A provider must return the exact factory token to produce a lease. Throwing, returning malformed data, returning another object, or reusing the primitive after registered creation cleans the stored identity exactly once.
- The first primitive invocation synchronously owns one creation promise before any asynchronous adapter work. Acquisition settlement closes the primitive and waits for that promise before deciding acquired, created-failure, or contract-failure state.
- Concurrent second invocation is an explicit contract violation and never starts another adapter call; a retained primitive invoked after acquisition settlement rejects before candidate creation.
- Skipping the primitive or failing to return a cleanup-capable identity yields `CANDIDATE_CREATION_CONTRACT_FAILED` with `attempted: false`, zero attempts, `verified: false`, and no removal/absence facts.
- Host mutation performed independently of the primitive is explicitly outside the supported contract; the lifecycle fails without claiming cleanup or absence.
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

**3. [Rule 2 - Missing Critical] Move creation ownership into the factory**
- **Found during:** Converged independent quality review
- **Issue:** A required callback parameter still could not enforce invocation; a one-argument provider could create state directly and throw before registration.
- **Fix:** Replaced callback registration with a factory-owned one-shot creation primitive and opaque token. Only returning the exact token can expose a lease.
- **Files modified:** `src/release-candidate.ts`, `tests/release-candidate.test.ts`
- **Verification:** Supported create-then-throw cleans once; skipped primitive and independent host mutation return explicit contract failure without false absence.
- **Committed in:** `e1d668a`

**4. [Rule 1 - Evidence Accuracy] Report zero cleanup attempts when identity is unavailable**
- **Found during:** Converged independent quality review
- **Issue:** Identity-unavailable evidence claimed one attempt while the cleanup adapter call count was zero.
- **Fix:** Added the truthful zero-attempt cleanup evidence variant with `verified: false` and no identity/removal/absence fields.
- **Files modified:** `src/release-candidate.ts`, `tests/release-candidate.test.ts`
- **Verification:** Exact evidence and call-count regressions pass for malformed primitives and unsupported provider behavior.
- **Committed in:** `e1d668a`

**5. [Rule 1 - Correctness] Retain ownership across asynchronous provider races**
- **Found during:** Independent hostile-provider review
- **Issue:** A provider could start the factory primitive without awaiting it, then immediately throw or return malformed data. Acquisition classification completed before candidate identity became available, so the later-created fixture was orphaned behind false zero-attempt evidence.
- **Fix:** Stored the sole creation promise synchronously, represented its settlement as a non-rejecting internal state, closed the primitive at provider settlement, and awaited any started creation before classifying or cleaning the outcome.
- **Files modified:** `src/release-candidate.ts`, `tests/release-candidate.test.ts`
- **Verification:** Immediate throw, immediate malformed return, concurrent double invocation, and retained late invocation all pass with exact adapter call counts and filesystem absence evidence.
- **Committed in:** `a0f16d1`

---

**Total deviations:** 5 auto-fixed correctness/test-quality issues. **Impact on plan:** All changes strengthen the required ownership and evidence contract without expanding scope.

## Issues Encountered

- Adding explicit cleanup evidence made exact-object legacy assertions reject the intentional extra field; the final tests now remove only that field and preserve exact checks for all existing domains.
- A cleanup-capable identity cannot be recovered safely from a failed creation primitive. The lifecycle reports explicit zero-attempt uncertainty and leaves no false absence claim instead of attempting raw-path removal.
- Provider settlement can precede asynchronously started creation. The lifecycle now waits only for the already-owned creation promise, with no timeout, retry, fallback, or second creator invocation.

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

- Confirmed opaque identity is stored before the factory primitive returns and is never returned to providers or callers.
- Confirmed providers cannot obtain a lease by skipping the primitive, returning a forged token, or returning raw created state.
- Confirmed provider throw or malformed return cannot outrun an already-started creation; valid late identity is cleaned once before the lifecycle returns.
- Confirmed concurrent and post-settlement primitive calls reject explicitly and never invoke the creation adapter again.
- Confirmed cleanup is never retried and no raw `rm` fallback exists in production lifecycle code.
- Confirmed malformed acquisition and cleanup getters, proxies, thenables, and exceptions map to stable sanitized evidence.
- Confirmed identity-unavailable contract failures report zero attempts truthfully, while every successfully registered creation performs one cleanup attempt after acquisition failure.
- Confirmed source trees are never written and candidates are not persisted.
- Confirmed no public MCP/schema/server/remote integration, Steam/Workshop mutation, upload, credentials, archive, signing, encryption, compilation, repair, retention, or real-Windows claim was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-06 can compose immutable artifact-validation and cleanup domains on top of the versioned exactly-once evidence established here.
- No blockers remain.

## Self-Check: PASSED

- RED commit `8545a89` precedes GREEN commit `31c8082`; review RED/GREEN pairs are `48b165e` → `c2b39c8`, `c9507d5` → `e1d668a`, and `9fd0961` → `a0f16d1`.
- Focused, candidate/install, full-suite, typecheck, build, RC, diff, generated-artifact, and graph-exclusion gates passed.
- RCCL-01 has unique Plan 04-05 traceability and complete implementation/test evidence.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

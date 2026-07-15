---
phase: 03-safe-candidate-assembly
plan: 02
subsystem: release-candidate
tags: [typescript, vitest, filesystem, validation, redaction]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Shared release-readiness policy from plan 03-01
provides:
  - Fail-fast validation for addon, Dota, repository, temporary-parent, game-addon, and content-addon inputs
  - Canonical immutable validated state for later candidate inventory and lifecycle seams
  - Stable redacted input blockers with zero candidate creation for rejected requests
affects: [03-safe-candidate-assembly, candidate-inventory, candidate-lifecycle]

tech-stack:
  added: []
  patterns: [validated state transition, injectable filesystem boundary, category-only filesystem errors]

key-files:
  created: [src/release-candidate.ts, tests/release-candidate.test.ts]
  modified: []

key-decisions:
  - "Validate and canonicalize all trusted roots before returning the state accepted by later assembly seams."
  - "Normalize filesystem failures to stable code, field, and category triples without raw paths or exception messages."
  - "Keep candidate creation present only as an adapter contract; input preparation never calls it."

patterns-established:
  - "Precreation failures contain only stable code, field, and category evidence."
  - "Derived addon roots are validated independently beneath the canonical Dota root."
  - "Temporary-parent isolation uses canonical containment against Dota, repository, game-addon, and content-addon roots."

requirements-completed: [RCOP-02]

duration: 19min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 02: Candidate Input Gate Summary

**Invalid or unsafe candidate inputs now stop at a typed, canonical precreation gate without creating temporary state.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-07-15T05:10:24Z
- **Completed:** 2026-07-15T05:29:01Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Added a parameterized macOS fixture matrix covering invalid addon names; required, missing, non-directory, unsafe-isolation, and unreadable root states; and independent game/content addon-root failures.
- Proved every rejected case records zero `createCandidateRoot` calls and serializes neither fixture-private paths nor injected exception content.
- Added `prepareReleaseCandidateInput`, which validates the addon first, canonicalizes trusted directories, derives both fixed addon roots, proves temporary-parent isolation, and returns an immutable validated state.
- Rejected canonical game/content root escapes and canonical temporary-parent aliases with stable field-specific blockers before candidate creation.
- Kept inventory, traversal, copying, candidate lifetime, inspection, manifest generation, cleanup evidence, MCP registration, and remote behavior outside this plan.

## Task Commits

1. **Require precreation validation** - `cd744d3` (test)
2. **Validate assembly inputs** - `afb3ee5` (feat)
3. **Expose canonical root escapes** - `7b525f0` (test)
4. **Contain canonical addon roots** - `59d761d` (fix)

## Files Created

- `tests/release-candidate.test.ts` - Exhaustive rejected-input fixture matrix and zero-creation assertions.
- `src/release-candidate.ts` - Structured blocker contract, filesystem seam, canonical input validation, and immutable validated state.

## Decisions Made

- Root observations use `lstat` followed by `realpath`; absent entries are distinguished from unreadable observations, while all raw filesystem details remain private.
- The trusted repository root defaults to the current repository but remains injectable for fixture isolation.
- Temporary-parent equality or containment beneath any protected canonical root is rejected without selecting an alternative target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Canonical containment] Rejected derived addon-root escapes**
- **Found during:** Independent specification review
- **Issue:** A directory reached through an intermediate symlink or junction alias could canonicalize outside the Dota root while still passing the final directory classification.
- **Fix:** Added strict canonical containment checks for the derived game and content addon roots immediately after each root resolves; canonical temporary-parent aliases continue through the common isolation check.
- **Files modified:** `src/release-candidate.ts`, `tests/release-candidate.test.ts`
- **Verification:** Injected canonical-alias RED failed with an accepted validated state; GREEN returns field-specific sanitized blockers with zero creation calls.
- **Committed in:** `7b525f0`, `59d761d`

---

**Total deviations:** 1 auto-fixed canonical-containment issue
**Impact on plan:** The correction closes the required source-root trust boundary without adding traversal or candidate lifecycle behavior.

## TDD Gate Compliance

- RED was observed with the focused command failing because `src/release-candidate.ts` and its export were absent.
- The isolated RED commit `cd744d3` precedes the GREEN implementation commit `afb3ee5`.
- GREEN passed the exact focused test, typecheck, and build command before the implementation commit.
- Review RED commit `7b525f0` precedes containment fix commit `59d761d`; the injected alias test failed by returning `ok: true` before the fix.

## Verification Evidence

- Focused candidate-input tests: 2/2 passed.
- Candidate-domain focused suite: 39/39 passed across six test files.
- Full suite: 162/162 passed across 20 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed; the generated candidate module is not yet a packaged runtime dependency and remains untracked until integration owns it.
- `git diff --check`: passed.
- Staged-path inspections included only the task file for each code commit; `.planning/graphs/` remained unstaged and unmodified by this plan.

## Issues Encountered

Independent specification review identified a canonical source-root escape; it was reproduced, corrected, and verified as documented above.

## User Setup Required

None.

## Next Plan Readiness

- Plan 03-03 can accept only `ValidatedReleaseCandidateInput` when implementing deterministic entry inventory and unsafe-entry rejection.
- Candidate creation remains unreachable until later plans consume the validated state.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

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
  - "Require a factory-branded identity-bound lifecycle capability before creation; the default Node validation/inventory adapter deliberately does not claim cleanup safety."
  - "Keep deletion identity inside an adapter-owned opaque lease and accept cleanup success only from one bound operation returning complete identity, removal, and absence facts."

patterns-established:
  - "Candidate creation follows successful opaque input validation and complete safe inventory exactly once."
  - "The created root must be a strict canonical descendant of the validated temporary parent and canonically disjoint from Dota, both addon sources, and the repository."

requirements-completed: [RCFS-01]

duration: 43min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 04: Isolated Candidate Lifetime Summary

**One canonically isolated target-local candidate now exists only inside an owned inspection callback and is removed after callback success or failure.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-07-15T06:27:50Z
- **Completed:** 2026-07-15T07:10:30Z
- **Tasks:** 2 plus critical review remediation
- **Files modified:** 3

## Accomplishments

- Added a lifecycle test covering exact one-time creation, callback-only existence, post-return absence, callback failure, a post-creation canonical alias attack, and explicit removal failure.
- Added `withAssembledReleaseCandidate`, which accepts only prepared and safely inventoried sources before reaching the bound creation capability.
- Canonicalized the created child and proved strict temporary-parent containment plus disjointness from the Dota root, both addon roots, and repository before invoking inspection.
- Mapped creation, canonicalization, isolation, callback, and removal failures to stable sanitized blockers without exception text, private paths, fallback, or retained success values.
- Preserved the fail-closed Windows adapter boundary; no lifecycle can create through an adapter that lacks removal ownership.
- Replaced the raw removal seam with a factory-branded identity-bound lifecycle capability whose opaque lease stores deletion identity only in an adapter-private `WeakMap`.
- Bound lifecycle and underlying adapter operations before creation so callback mutation cannot substitute either cleanup layer.
- Delegated identity validation, removal, and absence determination to one adapter operation and recomputed success only from complete `identityMatched`, `removed`, and `absent` facts.
- Proved repository, source, temporary-parent, and outside paths never become lifecycle deletion targets, while callback alias swaps preserve repository sentinels and return identity mismatch.
- Kept the default Node adapter honest by rejecting lifecycle creation with `IDENTITY_BOUND_CLEANUP_REQUIRED`; controlled macOS fixture adapters prove contract composition, not hostile external race safety.

## Task Commits

1. **Specify canonical isolation and temporary lifetime** - `a0011e0` (test)
2. **Implement single-owner candidate creation and removal** - `beb92ac` (feat)
3. **Expose unsafe cleanup ownership** - `772f65a` (test)
4. **Forbid cleanup before ownership proof** - `ceb2b49` (test)
5. **Bind cleanup ownership to an immutable lease** - `6904991` (fix)
6. **Require identity-bound cleanup contract** - `1ed8b02` (test)
7. **Reject forged cleanup markers** - `45d0893` (test)
8. **Bind adapter cleanup operation** - `74a6734` (test)
9. **Replace pathname cleanup with opaque adapter lease** - `76c556e` (fix)
10. **Reject private or malformed cleanup failures** - `40c64fb` (test)
11. **Validate the cleanup result contract at runtime** - `38fce02` (fix)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Lifecycle, alias attack, callback failure, removal failure, redaction, and post-return absence coverage.
- `src/release-candidate.ts` - Callback-scoped creation, post-create isolation, sanitized outcomes, and removal ownership.
- `.planning/phases/03-safe-candidate-assembly/03-04-SUMMARY.md` - Plan execution and verification record.

## Decisions Made

- Removed `removeCandidateRoot(path)` from the lifecycle adapter API. Validation and inventory retain their existing filesystem operations, while candidate lifecycle requires a separate factory-branded identity-bound capability.
- Returned only the inspection callback's value after removal succeeds. If removal is uncertain, the result contains only the explicit removal blocker and does not claim absence or expose the callback value.
- Captured inspection operations plus branded lease creation and cleanup before creation; the factory also captures its underlying adapter operations when the capability is constructed.
- Made leases publicly opaque and non-constructible: deletion identity lives only in the factory's private lease-to-identity map, and unknown or reused leases return `CANDIDATE_LEASE_INVALID`.
- Required one adapter cleanup operation to validate identity, remove, and determine absence internally. The lifecycle never passes a path to cleanup and never infers absence with a separate post-cleanup `lstat`.
- Recomputed cleanup success from the strict complete result rather than trusting an `ok` claim in isolation.
- Recorded that controlled fixture adapters validate the contract and callback-driven swap behavior only; they do not establish safety against hostile external filesystem races. The default Node adapter fails closed instead of making that claim.
- Deferred fixed-layout writes, byte copying, manifests, hashes, versioned cleanup evidence, precedence rules, MCP integration, and remote execution to their owning plans and phases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Unsafe cleanup ownership] Remove lifecycle pathname deletion authority**
- **Found during:** Critical independent review after initial plan completion.
- **Issue:** Isolation checked the canonical create result, but cleanup received the untrusted lexical result and could recursively remove the repository, a source root, the temporary parent, or another outside path.
- **Fix:** Replaced raw removal with an opaque adapter-owned lease; the lifecycle receives no deletion target and invokes only the bound lease cleanup operation.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** Initial RED recorded `removeCandidateRoot(repositoryRoot)`; architectural RED then required the raw remover to disappear. GREEN proves repository/source/outside/parent sentinels survive and only opaque lease cleanup is invoked.
- **Committed in:** `772f65a`, `ceb2b49`, `6904991`, `1ed8b02`, `76c556e`.

**2. [Rule 1 - Mutable cleanup capability] Bind adapter ownership before callback execution**
- **Found during:** Critical independent review after initial plan completion.
- **Issue:** Cleanup reread `filesystem.removeCandidateRoot` after awaiting inspection, allowing callback code to replace it with a no-op.
- **Fix:** Captured the branded capability methods before creation and captured the factory's underlying create/cleanup operations at capability construction.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** Callback mutation cannot replace the captured removal; the original is called exactly once and candidate absence is proven.
- **Committed in:** `772f65a`, `74a6734`, `76c556e`.

**3. [Rule 2 - Identity-bound cleanup] Move replacement detection inside the adapter boundary**
- **Found during:** Critical independent review after initial plan completion.
- **Issue:** The callback could replace the candidate path with an alias to a protected root before cleanup.
- **Fix:** Made one adapter-owned lease operation responsible for identity validation, removal, and absence determination; the lifecycle consumes only its strict structured outcome.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** A real fixture symlink swap to the repository returns `CANDIDATE_IDENTITY_MISMATCH`, never reaches the adapter's raw deletion step, preserves the sentinel, and returns no callback value.
- **Committed in:** `1ed8b02`, `76c556e`.

**4. [Rule 2 - Capability authenticity] Reject default and forged cleanup markers before creation**
- **Found during:** Architectural re-review of the identity-bound contract.
- **Issue:** A marker-only object could claim identity-bound behavior without using the lease factory, and the default Node adapter could not honestly provide atomic identity-bound cleanup.
- **Fix:** Added a private capability brand produced only by `createIdentityBoundCandidateLifecycle`; unmarked, default, or forged objects return `IDENTITY_BOUND_CLEANUP_REQUIRED` before any create or cleanup call.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** Default and forged adapters record zero creation and cleanup calls; factory-created controlled adapters pass the same lifecycle contract.
- **Committed in:** `45d0893`, `76c556e`.

**5. [Rule 2 - Result contract validation] Sanitize malformed adapter cleanup outcomes**
- **Found during:** Architectural self-review after the identity-bound refactor.
- **Issue:** TypeScript constrained stable failure codes, but a malformed runtime adapter could return a private path or secret-bearing value as its cleanup code.
- **Fix:** Validate all cleanup booleans and allow only the closed stable failure-code set; normalize every malformed payload or thrown cleanup operation to `CANDIDATE_CLEANUP_RESULT_INVALID`.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** RED exposed the private injected code in the lifecycle blocker; GREEN returns only the stable invalid-result blocker and serializes neither fixture path nor secret value.
- **Committed in:** `40c64fb`, `38fce02`.

---

**Total deviations:** 5 critical review corrections (2 bugs, 3 missing critical safety boundaries).
**Impact on plan:** Corrections strengthen RCFS-01 ownership and cleanup safety without adding formal cleanup evidence, manifests, copying, MCP, or remote scope.

## TDD Gate Compliance

- RED failed because `withAssembledReleaseCandidate` was absent.
- Test commit `a0011e0` precedes implementation commit `beb92ac`.
- GREEN passed the focused lifecycle test before typecheck, build, and the full repository gate.
- Review RED `772f65a` reproduced recursive removal of an unowned repository path and mutable cleanup capability behavior before fix `6904991`.
- Review RED refinement `ceb2b49` proved canonical isolation failure must not invoke cleanup before lease ownership exists.
- Architectural RED `1ed8b02` removed the raw cleanup contract and required complete identity/removal/absence outcomes.
- Capability RED `45d0893` proved marker-only objects could otherwise reach creation.
- Adapter-binding RED `74a6734` proved the factory could otherwise reread a mutated cleanup property after callback execution.
- Result-contract RED `40c64fb` proved malformed runtime cleanup codes could otherwise cross the sanitized blocker boundary before fix `38fce02`.

## Verification Evidence

- Focused lifecycle test: 1/1 passed.
- Candidate validation, inventory, and ownership suite: 12/12 passed.
- Full repository suite: 172/172 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Critical re-review: the unsafe pathname check-plus-remove architecture was removed; no raw deletion seam remains in lifecycle composition.
- Build produced only the already-untracked `dist/release-candidate.js`; no untracked distribution artifact was staged.
- User-owned `.planning/graphs/` changes remained unstaged and were not modified by this plan.

## Issues Encountered

- Initial review exposed that canonical inspection safety did not establish cleanup ownership. Re-review then proved pathname precheck plus pathname deletion remained fundamentally unsafe, so the architecture was replaced with an opaque adapter-owned identity-bound cleanup contract.

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

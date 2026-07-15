---
phase: 03-safe-candidate-assembly
plan: 03
subsystem: release-candidate
tags: [typescript, vitest, filesystem, path-safety, deterministic-inventory]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Opaque canonical validated candidate input from plan 03-02
provides:
  - Deterministic inventory of both addon source roots before candidate creation
  - Explicit fail-closed classification for links, reparse points, special entries, and unknown entries
  - Normalized root-qualified identities with canonical containment and global case-fold collision detection
affects: [03-safe-candidate-assembly, candidate-lifecycle, candidate-copy, source-mutation]

tech-stack:
  added: []
  patterns: [names-only enumeration, adapter-owned classification, ordinal traversal, global identity collision map]

key-files:
  created: []
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Treat directory enumeration as untrusted names and require the filesystem adapter to classify every joined entry without dereferencing it."
  - "Normalize and collision-check one fixed-prefix identity space across both roots before any candidate creation seam is reachable."
  - "Continue inventory beneath a colliding directory so nested unsafe entries are still reported without accepting the colliding identity."

patterns-established:
  - "Rejected source entries serialize only stable codes, safe root-qualified identities, and categories."
  - "Only regular files and directories survive classification and canonical source-root containment."
  - "Filesystem enumeration, classification, and canonicalization remain within one required adapter contract."

requirements-completed: [RCFS-03]

duration: 11min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 03: Safe Source Identity Inventory Summary

**Both addon roots now produce one deterministic, collision-checked inventory that rejects unsafe identities and entry kinds before candidate creation.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-15T05:44:02Z
- **Completed:** 2026-07-15T05:55:00Z
- **Tasks:** 2 plus independent review remediation
- **Files modified:** 2

## Accomplishments

- Added macOS fixture coverage for real symbolic links plus injected Windows reparse, special, unknown, absolute, traversing, dot-segment, separator-ambiguous, canonical-escape, and case-collision observations.
- Added deterministic ordinal inventory for both fixed candidate prefixes, with forward-slash identities and one invariant case-fold map over all accepted files and directories.
- Ensured rejected entry kinds are never canonicalized through their targets, copied, repaired, retried, or followed by candidate creation.
- Required enumeration and classification through the injected filesystem adapter, preventing host-filesystem fallthrough in fixture or target contracts.
- Preserved full unsafe-entry reporting beneath colliding directories while keeping the colliding identities rejected.

## Task Commits

1. **Specify fail-closed source identities** - `2d19330` (test)
2. **Implement deterministic classification and collision inventory** - `4409b85` (feat)
3. **Expose nested unsafe entries beneath colliding directories** - `c5110af` (test)
4. **Inventory colliding directories through the required adapter** - `7842e4a` (fix)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Real and injected unsafe-entry contract matrix, deterministic ordering assertions, redaction checks, and zero-creation proof.
- `src/release-candidate.ts` - Entry-kind contract, normalized source inventory, canonical containment, ordinal sorting, and global case-fold collision detection.

## Decisions Made

- The inventory records fixed candidate-relative identities such as `game/dota_addons/<addon>/...` and `content/dota_addons/<addon>/...`; it does not expose absolute source paths.
- The adapter supplies names only during enumeration and authoritative entry kinds through `classifySourceEntry`; missing adapter operations are compile-time contract failures rather than host fallbacks.
- Case-colliding directories remain rejected but are traversed for blocker discovery, so a nested link or reparse point cannot disappear from the complete unsafe-entry report.
- Candidate layout creation, copying, source-mutation revalidation, manifests, cleanup evidence, MCP registration, and remote execution remain outside this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Complete unsafe inventory] Traverse rejected colliding directories for nested blockers**
- **Found during:** Independent adversarial review
- **Issue:** Returning immediately on a colliding directory prevented nested unsafe entries from being classified and reported.
- **Fix:** Record the collision, recurse only for blocker discovery when the rejected entry is a directory, and keep the directory absent from accepted entries.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`
- **Verification:** The focused RED returned only the collision; GREEN returns both the collision and nested reparse blocker.
- **Committed in:** `c5110af`, `7842e4a`

**2. [Rule 2 - Adapter isolation] Remove module-global classification fallback**
- **Found during:** Independent adversarial review
- **Issue:** Optional enumeration and classification methods allowed a supplied adapter to silently use host `readdir` or `lstat`.
- **Fix:** Made both methods required on `ReleaseCandidateFilesystem` and routed inventory exclusively through that adapter.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`
- **Verification:** Injected non-host entries pass through adapter classification; typecheck enforces the complete contract.
- **Committed in:** `c5110af`, `7842e4a`

---

**Total deviations:** 2 auto-fixed missing-critical contract issues.
**Impact on plan:** Both corrections strengthen RCFS-03 completeness and fixture/local adapter isolation without adding candidate creation, copying, cleanup, manifest, MCP, or remote scope.

## TDD Gate Compliance

- Initial RED failed because `inventoryReleaseCandidateSources` was not exported or implemented.
- The isolated test commit `2d19330` precedes the GREEN implementation commit `4409b85`.
- Review RED `c5110af` reproduced the missing nested unsafe blocker before fix commit `7842e4a`.
- Every GREEN transition was followed by the focused test, typecheck, and build checks.

## Verification Evidence

- Focused source-identity test: 1/1 passed.
- Candidate input and inventory suite: 4/4 passed.
- Full repository suite: 164/164 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; generated untracked `dist/release-candidate.js` was removed because this module is not yet a tracked package artifact.
- `git diff --check`: passed.
- Independent re-review: both confirmed warnings resolved; no remaining blocker or warning.
- Staged-path checks contained only the intended task file for every code commit; `.planning/graphs/` remained unstaged and unchanged by this plan.

## Issues Encountered

The first implementation passed the planned focused tests but independent review identified incomplete nested blocker discovery and an optional adapter fallback. Both were reproduced, corrected with a second RED/GREEN cycle, and re-reviewed successfully.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-04 can create a candidate only after this complete inventory succeeds and can retain the opaque validated input contract.
- Accepted entries provide deterministic normalized identities for later layout/copy work without yet claiming source stability or byte integrity.
- No blockers remain.

## Self-Check: PASSED

- Required source and test files exist.
- All four plan commits are present in order.
- RCFS-03 behavior, verification commands, and independent review remediation are recorded.
- No `.planning/graphs/` file is staged or included in a plan commit.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

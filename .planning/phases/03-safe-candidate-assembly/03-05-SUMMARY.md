---
phase: 03-safe-candidate-assembly
plan: 05
subsystem: release-candidate
tags: [typescript, vitest, filesystem, deterministic-copy, readiness-policy]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Validated source handle, complete safe inventory, and identity-bound candidate lease lifecycle
provides:
  - Exact game and content addon trees beneath the temporary candidate
  - Complete regular-file and empty-directory reproduction without inclusion heuristics
  - Per-write source reclassification, canonical containment, and destination isolation checks
  - Shared readiness blockers before candidate creation
affects: [03-safe-candidate-assembly, source-stability, integrity-manifest, verified-cleanup]

tech-stack:
  added: []
  patterns: [explicit per-entry assembly, exclusive destination creation, adapter-bound source observations]

key-files:
  created: [.planning/phases/03-safe-candidate-assembly/03-05-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Require explicit adapter capabilities for readiness reads, directory creation, and exclusive file copying; missing capabilities fail before candidate creation."
  - "Reclassify and canonicalize each source immediately before its candidate mkdir or copy, and validate every destination parent inside the canonical candidate."
  - "Run shared release readiness against the accepted inventory before creating the candidate, returning only redacted policy blockers."

patterns-established:
  - "Fixed candidate prefixes are created explicitly, followed by sorted inventoried directories and files with no name, extension, ignore, timestamp, hidden, or generated-file exclusion."
  - "Inspection begins only after complete assembly; any write or destination-identity failure skips inspection and still runs lease cleanup."

requirements-completed: [RCFS-02]

duration: 21min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 05: Complete Two-Root Assembly Summary

**Every accepted game and content source entry is explicitly reproduced under the fixed temporary candidate layout before callback inspection, with readiness and per-write safety gates.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-15T07:19:57Z
- **Completed:** 2026-07-15T07:40:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Reproduced exact `game/dota_addons/<addon>` and `content/dota_addons/<addon>` trees, including hidden, binary, extensionless, ignore-named, generated-looking, old-timestamp, nested, and empty-directory entries.
- Added immediate source kind and canonical-containment revalidation before every directory creation and file copy, plus candidate-parent canonical checks and unexpected-destination rejection.
- Evaluated structure, metadata, placeholder, and redacted sensitive-material readiness through `evaluateReleaseReadiness` before candidate creation.
- Ensured copy and destination failures skip the inspection callback, serialize only stable blockers, and preserve the identity-bound cleanup lifecycle.
- Kept source trees read-only and avoided recursive copy, retry, repair, filtering, generation, archive, manifest, hash, MCP, and remote behavior.

## Task Commits

1. **Specify complete fixed-layout assembly** - `5cfd11a` (test)
2. **Align prior lifecycle fixtures with complete readiness and assembly capabilities** - `2bf967a` (test)
3. **Cover shared readiness blocker categories and redaction** - `6705bfb` (test)
4. **Implement explicit directory and file assembly** - `250228c` (feat)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Complete-layout byte/directory fixtures, shuffled enumeration, copy failure, destination alias, readiness blocking, redaction, and cleanup assertions.
- `src/release-candidate.ts` - Shared precreation readiness observations and explicit safe mkdir/copy assembly inside the bound candidate lease.
- `.planning/phases/03-safe-candidate-assembly/03-05-SUMMARY.md` - Execution, TDD, review, and verification record.

## Decisions Made

- Bound readiness readers, directory creation, and copy operations from the validated filesystem adapter rather than bypassing the adapter with later direct operations.
- Used exclusive default file creation and explicit non-recursive directory creation so unexpected candidate entries block instead of being overwritten or merged.
- Preserved formal manifests, source-after final rewalk, hashes, scan-coverage payloads, and versioned cleanup evidence for their owning plans and phases.

## Deviations from Plan

None - the plan was executed within RCFS-02. Two additional test-only commits refined compatibility with the previously delivered lease lifecycle and exercised all required shared-readiness blocker classes without expanding production scope.

## TDD Gate Compliance

- RED command failed with `CANDIDATE_INSPECTION_FAILED` because the callback observed a candidate without the required fixed directories and files.
- RED commit `5cfd11a` precedes implementation commit `250228c`.
- GREEN proves byte-identical binary copying, all inclusion categories, nested empty directories, shuffled enumeration, cleanup after copy failure, destination escape prevention, and callback-after-completion ordering.

## Independent Review

- Reviewed destination containment and overwrite behavior, per-write source reclassification, precreation readiness/redaction, callback ordering, and cleanup ownership independently after implementation.
- No confirmed defects remained. No raw exception, private source path, credential value, unexpected destination write, recursive copy, retry, repair, or source mutation path was found.

## Verification Evidence

- Focused complete-layout test: 1/1 passed.
- Candidate lifecycle suite: 14/14 passed.
- Readiness and preflight regression suites: 19/19 passed.
- Full repository suite: 174/174 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- User-owned `.planning/graphs/` modifications remained unstaged and unchanged by this plan.
- The pre-existing untracked `dist/release-candidate.js` build output remained unstaged because this plan does not own distribution integration.

## Issues Encountered

- The first destination-alias assertion incorrectly expected zero earlier in-candidate copies even though deterministic content assembly precedes the attacked game destination. The assertion was narrowed to the actual invariant: every attempted destination stayed inside the owned candidate, the repository received no write, inspection was skipped, and cleanup removed the partial candidate.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-06 can add the final source-after topology rewalk and mutation detection without changing fixed-layout assembly or candidate ownership.
- Phase 4 can consume the complete candidate tree for deterministic manifests, byte hashes, scan coverage, and versioned cleanup evidence.

## Self-Check: PASSED

- Source, test, and summary files exist.
- RED and GREEN commits are present in order.
- RCFS-02 is exercised by macOS fixtures without requiring Dota or Windows.
- No graph, persistent candidate, archive, credential, MCP, remote, manifest, hash, or source-repair change is included.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

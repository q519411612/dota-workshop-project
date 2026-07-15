---
phase: 05-unified-mcp-and-remote-target-parity
plan: 02
subsystem: mcp-result-contract
tags: [typescript, normalization, immutable-evidence, hostile-input, tdd]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    provides: Versioned manifest, inclusion ledger, scan coverage, operation, artifact, and cleanup domains
provides:
  - One immutable schema-versioned release-candidate detail for the common MCP envelope
  - Strict hostile-input normalization with recomputed success and canonical digest authority
  - Optional ToolResult integration that preserves unrelated result shapes exactly
affects: [05-03, 05-04, 05-05, 05-06, remote-normalization, target-parity]

tech-stack:
  added: []
  patterns: [closed public detail union, guarded foreign snapshots, deep frozen projection, recomputed invariant authority]

key-files:
  created: [src/release-candidate-result.ts, tests/release-candidate-result.test.ts]
  modified: [src/release-candidate.ts, src/types.ts, src/result.ts, tests/result.test.ts]

key-decisions:
  - "Normalization failures expose one fixed sanitized category and no unproven nested facts."
  - "Top-level success is derived from completed execution and operation, passed artifact evidence, no blockers, and verified cleanup."
  - "The Phase 4 canonical nested-array digest implementation is exported and reused as the single authority."
  - "Boundary structure is closed here; exact mandatory boundary values remain owned by 05-03."

patterns-established:
  - "Foreign evidence is read through guarded recognized-field and fixed-length occurrence snapshots before validation."
  - "Manifest, ledger, coverage, artifact, blocker, cleanup, execution, path, warning, command, log, and boundary domains are cloned and deeply frozen."

requirements-completed: [RCOP-03]

duration: 15min
completed: 2026-07-16
status: complete
---

# Phase 5 Plan 02: Public Candidate Detail Summary

**Release-candidate preflight now has one strict immutable detail whose public success is computed from evidence rather than adapter narration.**

## Accomplishments

- Added a closed `ReleaseCandidateDetail` union with versioned operation, artifact, manifest, inclusion, coverage, blocker, cleanup, safe-path, execution, warning, command, log, and boundary domains.
- Added `normalizeReleaseCandidateDetail(unknown)` with guarded getters, Proxy-safe collection snapshots, closed versions/codes/discriminants, ordinal path and manifest validation, exact ledger and exhaustive coverage reconciliation, cleanup precedence, and sanitized fail-closed output.
- Added `createReleaseCandidateToolResult` and the optional `ToolResult.releaseCandidate` field while preserving the exact shape of every unrelated success and failure result.
- Recomputed canonical combined SHA-256 from the fixed Phase 4 nested-array representation and exported the Phase 4 helper as the single algorithm authority.
- Proved fixture/local and completed remote facts normalize substantively alike while transport uncertainty remains independently observable and forces failure.
- Proved returned details are independently cloned and deeply frozen, and callback values or temporary candidate paths cannot enter the detail.

## TDD Evidence

- RED commit `b1b4468` failed because the public detail module and common-envelope field did not exist.
- GREEN commit `76c9c67` added the strict normalizer, public detail types, canonical digest reuse, common result integration, and immutable projection.
- Review RED commit `4828a6c` proved blocked artifact facts and attempted cleanup evidence could be incomplete.
- Review GREEN commit `73ae61e` required exact optional-domain agreement and complete cleanup failure facts.
- Review RED commit `a6da87c` proved a mutable Proxy length could silently omit manifest occurrences.
- Review GREEN commit `323ff2f` snapshots every foreign collection length and occurrence exactly once with a bounded public collection size.

## Deviations from Plan

### [Rule 2 - Missing critical functionality] Export the existing canonical digest authority

- **Found during:** Task 2
- **Issue:** The plan requires one exact canonical algorithm, but the existing implementation was private inside `src/release-candidate.ts`.
- **Fix:** Exported the existing helper and made the public normalizer reuse it instead of transcribing a second implementation.
- **Files modified:** `src/release-candidate.ts`, `src/release-candidate-result.ts`
- **Verification:** Independent canonical vector, Phase 4 regressions, full suite, typecheck, build, and all repository verifiers passed.
- **Commit:** `76c9c67`

**Total deviations:** 1 auto-fixed missing correctness requirement. **Impact:** One minimal Phase 4 source edit established the required single digest authority without changing lifecycle behavior.

## Independent Review

- Confirmed exact version and discriminant handling, ordinal manifest ordering, duplicate rejection, lowercase digest and safe count validation, and recomputation of the fixed canonical digest.
- Confirmed manifest occurrences are processed before reconciliation and hostile array length/access changes cannot omit entries.
- Confirmed passed artifact evidence requires a bijective ledger and complete, non-overlapping four-class coverage.
- Confirmed blocked artifact optional ledger/coverage facts must agree exactly with the top-level proven facts.
- Confirmed attempted cleanup failures require complete identity, removal, and absence facts with code-consistent states; cleanup failure or uncertainty always forces overall failure.
- Confirmed blocker objects, nested arrays, paths, commands, logs, warnings, and boundaries are cloned and deeply frozen with no shared mutable aliases.
- Confirmed unknown codes, getters, proxies, throwing array access, thenables, unsafe paths, sensitive path segments, malformed counts, and contradictory states return only the fixed sanitized normalization failure.
- Confirmed unrelated result builders omit `releaseCandidate` entirely and retain byte-equivalent object shapes.
- Final review result: no unresolved confirmed issue.

## Verification Evidence

- Final focused detail/result suite: 13/13 passed.
- Final repository suite after review remediation: 224/224 passed across 21 files.
- `npm run typecheck`: passed after final review remediation.
- `npm run build`: passed during the complete Task 2 gate.
- `npm run verify:plugin`: passed.
- `npm run verify:same-machine-smoke`: passed with runtime evidence explicitly pending.
- `npm run verify:source-snapshot`: passed after removing the test-only static private-path literal.
- `npm run verify:install-simulation`: passed with cleanup evidence.
- `npm run verify:rc`: passed, including its nested full suite and build.
- `npm run verify:handoff`: passed.
- Historical `npm run verify:milestone`: passed.
- `git diff --check`: passed.
- Generated untracked candidate and Phase 5 distribution files were removed; tracked `dist/result.js` has no diff.
- Immutable graph baseline and cached graph exclusion guards passed before every commit.

## Security and Scope Review

- No adapter-supplied `ok`, exit narration, malformed nested fact, or cleanup contradiction can produce public success.
- No raw exception, private absolute path, credential-shaped relative segment, callback value, live capability, or deleted candidate root is returned.
- No fallback, retry, repair, source write, persistent archive, signing, encryption, upload, Steam login, Workshop mutation, compilation, remote execution, or real Windows proof was added.
- macOS fixture and adapter-contract evidence remains the completion basis; no real Windows runtime claim is made.
- User-owned `.planning/graphs/` modifications remain untouched, unstaged, and outside every plan commit.

## Self-Check: PASSED

- All declared source, test, and summary artifacts exist.
- RED `b1b4468` precedes GREEN `76c9c67`; review RED/GREEN pairs `4828a6c`/`73ae61e` and `a6da87c`/`323ff2f` are ordered correctly.
- `requirements-completed` contains only `RCOP-03`, with no competing Phase 5 summary owner.
- The worktree contains only the preserved user-owned graph modifications.

---
*Phase: 05-unified-mcp-and-remote-target-parity*
*Completed: 2026-07-16*

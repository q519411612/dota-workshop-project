---
phase: 04-integrity-manifest-and-verified-cleanup
plan: 06
subsystem: release-candidate
tags: [typescript, artifact-validation, cleanup-precedence, integrity, tdd]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    plan: 05
    provides: Exactly-once cleanup ownership and versioned cleanup evidence
provides:
  - Immutable operation, artifact-validation, and cleanup result domains
  - Independently cloned and deeply frozen blocker snapshots for each exposed lifecycle domain
  - Final post-callback artifact composition from triple integrity, manifest, inclusion ledger, and scan coverage
  - Strict cleanup version, attempt-count, identity, removal, and absence normalization
  - Overall-success precedence that preserves artifact truth while withholding failed callback values and candidate paths
affects: [05-unified-mcp-and-remote-target-parity, release-candidate-result, remote-normalization]

tech-stack:
  added: []
  patterns: [three-domain lifecycle result, final-evidence composition, strict cleanup precedence, failure value withholding]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-06-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Operation completion, artifact validation, and cleanup proof are immutable independent domains; overall success is their explicit conjunction."
  - "Final artifact validation is computed only after callback settlement from fresh candidate, source, topology, manifest, ledger, and coverage evidence."
  - "Cleanup failure appends removal evidence without replacing passed or blocked artifact truth, and every overall failure withholds the callback value."
  - "Top-level and artifact blockers are separate immutable snapshots so no caller mutation or shared identity can rewrite another evidence domain."
  - "The lifecycle owns cleanup schema version and exact attempt count while target-native adapters supply identity, removal, absence, and stable failure facts."

patterns-established:
  - "Artifact precedence: passed evidence survives cleanup-only failure; callback mutation produces blocked final evidence; callback failure remains independently observable."
  - "Cleanup normalization: one guarded boundary accepts only version 1.0, one attempt, literal identity/removal/absence facts, and closed failure codes."

requirements-completed: [RCCL-02]

duration: 21min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 06: Artifact and Cleanup Precedence Summary

**Final post-callback artifact truth now remains independently observable while verified cleanup is mandatory for overall success.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-15T16:20:00Z
- **Completed:** 2026-07-15T16:40:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added immutable `operation`, `artifactValidation`, and `cleanup` discriminated domains to every assembled-candidate lifecycle result.
- Made `artifactValidation: passed` require the final post-callback candidate/source triple, exact occurrence ledger, canonical manifest, exhaustive scan coverage, and final topology reconciliation together.
- Preserved a genuinely passed manifest, inclusion ledger, and scan coverage when cleanup alone fails while forcing `ok: false` and withholding the callback value.
- Recorded callback success and failure independently from artifact state, including a passed artifact after an unmutating callback throw and a blocked artifact after mutation immediately before a throw.
- Required cleanup schema version `1.0`, one lifecycle-owned attempt, exact identity/removal/absence facts, and a closed stable failure code; getters, proxies, thenables, malformed values, contradictory facts, unsupported versions, and unsafe counts fail closed.
- Preserved all artifact blockers when cleanup also fails instead of replacing earlier evidence with a removal-only outcome.
- Closed an independent-review finding by cloning supported blocker fields into separately frozen artifact and top-level snapshots, including precreation, readiness, acquisition, final artifact, and cleanup evidence.
- Characterized lifecycle boundaries for precreation and failed acquisition, direct cleanup exceptions, and simultaneous artifact plus cleanup failure without raw exception or candidate-path disclosure.
- Proved fresh candidate and source observations plus final topology reconciliation occur after callback settlement and before the sole cleanup attempt.
- Kept precreation, acquisition, operation, artifact, and cleanup states explicit without exposing a public MCP or remote contract.

## TDD Evidence

- RED command: `npm test -- tests/release-candidate.test.ts -t "preserves final artifact truth across callback and cleanup failures"`.
- RED result: failed on the first frozen-result assertion because the current lifecycle had no independent artifact or operation domain and cleanup could replace the outcome.
- RED commit: `f0b354b`.
- GREEN command: the same focused matrix passed after final-evidence composition and strict cleanup precedence were implemented.
- GREEN regression: the specified six-file suite passed 84/84, followed by typecheck and build.
- GREEN commit: `23aa6a4`.
- Review RED command: `npm test -- tests/release-candidate.test.ts -t "freezes independent blocker snapshots across every lifecycle domain"`.
- Review RED result: the first precreation blocker array was frozen but its blocker object remained mutable.
- Review RED commit: `1927fcf`.
- Review GREEN command: the same focused immutability matrix passed after blocker fields were snapshotted into independent deeply frozen arrays.
- Review GREEN commit: `d78d20e`.
- Characterization command: focused precreation/acquisition, direct cleanup throw, and blocked-artifact-plus-cleanup-failure tests passed 3/3.
- Characterization commit: `f0223db`.

## Task Commits

1. **Specify artifact and cleanup precedence independently** - `f0b354b` (`test`, RED)
2. **Implement separate result domains and strict overall precedence** - `23aa6a4` (`feat`, GREEN)
3. **Expose mutable blocker snapshot defect** - `1927fcf` (`test`, RED)
4. **Freeze independent blocker evidence** - `d78d20e` (`fix`, GREEN)
5. **Characterize lifecycle evidence boundaries** - `f0223db` (`test`)

## Files Created/Modified

- `src/release-candidate.ts` - Adds immutable operation/artifact/cleanup states, final post-callback composition, strict cleanup normalization, and overall-success/value precedence.
- `tests/release-candidate.test.ts` - Adds the cleanup-hostility and callback mutation/throw matrix, ordering, redaction, source immutability, and compatibility assertions.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-06-SUMMARY.md` - Records TDD, gate, review, and RCCL-02 evidence.

## Decisions Made

- A callback that throws without changing final bytes leaves `artifactValidation: passed` but records `operation: failed`; overall success remains false.
- A callback that mutates candidate bytes records `operation: completed` or `failed` according to callback settlement while final artifact validation is independently blocked.
- Cleanup-only failure preserves the passed artifact domain but never returns the callback value or a candidate path.
- Precreation outcomes use explicit `not-reached` operation, artifact, and cleanup states rather than fabricating cleanup failure evidence.
- Failed acquisition without an available registered identity records `attempted: false` cleanup failure explicitly; it does not fabricate an attempt or leak the acquisition exception.
- Every exposed blocker object and array is frozen, while artifact and top-level blocker collections use independent object identities with the same ordered values.
- Valid lease cleanup is attempted once in `finally`; normalization derives the fixed version and attempt facts from lifecycle ownership and validates all target-native cleanup facts inside one guarded boundary.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Existing exact-equality tests intentionally characterized the pre-04-06 flat result shape. Their compatibility helper was extended to ignore the new independent domains while retaining exact blocker, ledger, manifest, scan, and cleanup assertions.
- One mutation scenario initially labeled a successfully completed callback as `operation: not-reached`; focused evidence exposed the mismatch and the final composer was corrected before the GREEN commit.

## Verification

- Focused precedence matrix: 1/1 passed.
- Required regression suite: 6 files, 84/84 passed.
- Complete repository suite: 20 files, 211/211 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:plugin`: passed with zero warnings or blockers.
- `npm run verify:source-snapshot`: passed with explicit no-archive, no-signing, no-encryption, no-upload, no-login, no-credential, no-remote, and no-global-install boundaries.
- `npm run verify:install-simulation`: passed with verified temporary cleanup.
- `npm run verify:rc`: passed.
- `npm run verify:handoff`: passed.
- `npm run verify:milestone`: passed for its existing historical closeout scope.
- `git diff --check`: passed.
- Generated `dist/release-candidate.js` was removed after build verification.

## Independent Review

- Initial independent review found that blocker arrays were frozen while individual blocker objects remained mutable and shared between artifact and top-level domains.
- Confirmed remediation freezes every exposed blocker object and array, clones supported flat fields exactly once inside a guarded boundary, preserves ordering and values, and shares no blocker object identity across domains.
- Confirmed callback settlement precedes fresh source stability, candidate integrity, source-after integrity, final topology reconciliation, manifest projection, and the sole cleanup attempt.
- Confirmed artifact success requires strict triple equality, canonical ordinal manifest projection, occurrence-first exact inclusion, and complete scan coverage.
- Confirmed cleanup failure cannot erase passed or blocked artifact evidence and always forces overall failure.
- Confirmed all failure results omit the callback value and serialize no candidate root, private exception, or runtime-built secret.
- Confirmed production candidate code imports no source-tree write, repair, retry, or fallback primitive; source snapshot tests remain unchanged across success and failure matrices.
- Confirmed no Phase 5 MCP/schema/server/dispatcher/remote integration and no Steam, Workshop mutation, upload, credentials, persistent archive, signing, encryption, compilation, repair, transfer, retention, or real-Windows claim was added.
- Confirmed `.planning/graphs/` user modifications remain unstaged and outside all 04-06 commits.
- Revised review result: the confirmed blocker-snapshot issue is closed; no confirmed issues remain.
- External specification review: `SPEC COMPLIANT`; precreation/acquisition not-reached domains, direct cleanup throw normalization, blocked-artifact plus cleanup-failure separation, and full RCCL-02 precedence are explicitly covered.
- External quality review: `QUALITY APPROVED`; blocker evidence is independently cloned and frozen across every exposed domain, hostile cleanup normalization remains guarded, and no shared mutable evidence reference survives.
- Phase goal-backward verification: `passed`, 5/5 must-haves, 7/7 uniquely traced requirements, and `behavior_unverified: 0`.

## Threat Model Closure

- **T-04-13 cleanup spoofing:** verified cleanup requires exact supported version, one attempt, identity match, removal, and absence proof.
- **T-04-14 outcome repudiation:** operation, artifact validation, and cleanup remain separate immutable domains with explicit precedence.
- **T-04-15 failed-result disclosure:** callback values and candidate paths are withheld on every overall failure; raw exceptions and private roots are not serialized.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RCCL-02 is implemented with focused and full-suite evidence.
- Phase 4 internal lifecycle requirements RCIN-01 through RCIN-05 and RCCL-01 through RCCL-02 are ready for phase verification and independent review.
- Phase 5 can normalize the three strict domains into the unified MCP result without weakening cleanup or artifact precedence.
- No blockers remain.

## Self-Check: PASSED

- `src/release-candidate.ts`, `tests/release-candidate.test.ts`, and this summary exist.
- RED commits `f0b354b` and `1927fcf` precede their GREEN commits `23aa6a4` and `d78d20e`.
- All required tests and quality gates passed after the final implementation.
- The worktree contains only the preserved user-owned `.planning/graphs/` modifications.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

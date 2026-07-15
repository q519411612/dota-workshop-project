---
phase: 04-integrity-manifest-and-verified-cleanup
plan: 04
subsystem: release-candidate
tags: [typescript, scan-coverage, utf8, binary, evidence-sanitization]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    plan: 03
    provides: Exact inclusion ledger and final candidate manifest projection
provides:
  - Versioned exhaustive scan coverage for text, binary, unreadable, and oversized regular files
  - Fatal UTF-8 decoding for bounded text observations with required-text blockers
  - Binary scan bypass independent from manifest inclusion and integrity hashing
  - Sanitized complete coverage retained on successful candidates and readiness blockers
affects: [04-integrity-manifest-and-verified-cleanup, cleanup-evidence, artifact-validation, unified-mcp-result]

tech-stack:
  added: []
  patterns: [versioned bounded scan observations, fatal text decoding, ordinal pre-redaction ordering, scan-inclusion separation]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-04-SUMMARY.md]
  modified: [src/release-readiness.ts, src/release-candidate.ts, tests/release-readiness.test.ts, tests/release-candidate.test.ts, dist/release-readiness.js]

key-decisions:
  - "Classify every accepted regular file through a strict versioned scan observation while keeping the shared extension policy authoritative."
  - "Return bounded bytes only for text-classified inputs, decode them with fatal UTF-8 semantics, and group invalid encoding with unreadable coverage."
  - "Represent coverage as exact counts plus complete sanitized root-relative path lists ordered by raw ordinal identity before redaction."
  - "Treat binary classification as a scan decision only; binary files remain in source integrity, candidate integrity, inclusion-ledger, and manifest domains."

patterns-established:
  - "Accepted scan results require schema version, safe size, identity/kind/containment proof, and a state consistent with the domain-owned text policy."
  - "Coverage preserves every valid occurrence and sanitizes only after deterministic raw identity ordering."

requirements-completed: [RCIN-05]

duration: 32min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 04: Exhaustive Candidate Scan Coverage Summary

**Every accepted regular file now has one deterministic scan class, while fatal text validation and binary-preserving manifest inclusion remain separate proof domains.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-07-15T14:48:24Z
- **Completed:** 2026-07-15T15:20:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added schema-versioned coverage with exact total and per-category counts plus complete text, binary, unreadable, and oversized path lists.
- Ordered raw root-relative identities ordinally before applying the shared evidence sanitizer, preserving deterministic output even when redaction collapses path segments.
- Replaced unversioned string reads with bounded byte observations and fatal UTF-8 decoding for text-classified files.
- Required adapter scan states to agree with the shared text-path authority, preventing a text input from being mislabeled binary to bypass sensitive scanning.
- Kept arbitrary binary, optional unreadable, optional invalid-UTF-8, and optional oversized files in the exact integrity ledger and manifest.
- Blocked required unreadable, invalid-UTF-8, and oversized text before candidate creation while retaining complete sanitized coverage.
- Proved matched sensitive values, private absolute roots, and raw adapter exceptions do not enter serialized scan evidence.
- Proved both source trees remain byte-for-byte unchanged across scan success and readiness-blocked outcomes.
- Added one guarded coverage normalization boundary that snapshots hostile roots, file collections, relative paths, and states exactly once.
- Converted getter, proxy, and iterator exceptions into stable sanitized `POLICY_INPUT_INVALID` evidence instead of allowing private values or raw errors to escape.

## TDD Evidence

- RED: `npm test -- tests/release-readiness.test.ts tests/release-candidate.test.ts -t "reports complete release candidate scan coverage"` failed 3/3 focused cases because no four-class aggregate existed and the unversioned string-read parser rejected binary, unreadable, and byte observations as `SOURCE_READ_RESULT_INVALID`.
- GREEN: The same focused command passed 3/3 after adding the versioned bounded scan contract, fatal decoder, strict state parser, and coverage projection.
- Regression alignment updated controlled adapters to the new versioned bytes/binary grammar; production continued to reject legacy, malformed, size-inconsistent, proxy, and exceptional results.
- Final focused evidence includes arbitrary binary bytes, optional unreadable text, optional invalid UTF-8, optional oversized text, required unreadable/invalid/oversized text, sensitive text, exact manifest inclusion, no binary decode, redaction, cleanup, and source immutability.
- Review RED: `npm test -- tests/release-readiness.test.ts -t "release candidate scan coverage"` failed 3/3 because coverage returned no explicit result union, reread mutable getters, and allowed private getter/proxy exceptions to escape.
- Review GREEN: the same command passed 3/3 after guarded exactly-once snapshots and a stable sanitized failure union were added.

## Task Commits

1. **Require complete scan coverage** - `20473f5` (`test`, RED)
2. **Align scan adapter fixtures** - `4cba512` (`test`)
3. **Retain coverage on readiness blockers** - `e1423a6` (`test`)
4. **Classify non-text fixture entries** - `e30f6de` (`test`)
5. **Version malformed byte fixtures** - `c38f481` (`test`)
6. **Report candidate scan coverage** - `a0eb52a` (`feat`, GREEN)
7. **Sync scan coverage build** - `084d849` (`chore`)
8. **Prove scan source immutability** - `2af3f4f` (`test`)
9. **Expose hostile coverage observations** - `bc94c03` (`test`, review RED)
10. **Guard scan coverage observations** - `e255a7b` (`fix`, review GREEN)
11. **Sync guarded coverage build** - `81da4b9` (`chore`)

## Files Created/Modified

- `src/release-readiness.ts` - Defines four-class versioned coverage and shared deterministic sanitized projection.
- `src/release-candidate.ts` - Parses strict bounded scan observations, performs fatal UTF-8 decoding, and composes coverage with readiness and manifest results.
- `tests/release-readiness.test.ts` - Proves exact counts, complete lists, ordinal ordering before redaction, and matched-value sanitization.
- `tests/release-candidate.test.ts` - Proves integrated binary/text/unreadable/oversized/invalid/sensitive behavior, manifest inclusion, no binary decode, blockers, cleanup, and source immutability.
- `dist/release-readiness.js` - Synchronizes the tracked runtime build for the shared coverage policy.
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-04-SUMMARY.md` - Records execution and verification evidence.

## Decisions Made

- The domain calls the scan capability once for every accepted regular file, but the parser accepts `binary` only when the shared extension policy classifies that identity as non-text.
- Readable text observations carry at most `MAX_SECRET_SCAN_BYTES` of bytes; oversized observations carry only size and identity facts.
- Fatal UTF-8 decode failure becomes the public unreadable coverage class and uses the established required-text unreadable blocker.
- Coverage path identity is `<root>/<addon-root-relative-path>` so identical paths in game and content cannot collapse.
- Existing `non-text` readiness inputs remain compatible with prior policy callers, while the candidate lifecycle emits the clearer `binary` state.
- Coverage is attached to artifact success and readiness-blocked results; cleanup precedence remains owned by the following cleanup plans.
- The coverage policy now returns an explicit success/failure union; invalid or exceptional observations never produce partial counts or silently skipped files.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Several controlled tests still returned the prior string-content observation shape. They were migrated to versioned bounded bytes or binary states so strict production parsing could remain fail-closed without a compatibility fallback.
- The initial coverage sort used configured root order. The focused pure test exposed that the contract requires full raw root/path ordinal ordering before sanitization; the implementation was corrected before the production commit.
- Independent review found that coverage validation reread `scanRoot.root`, `scanRoot.files`, and file identities after validation, allowing mutable getters to substitute private values or throw raw errors. Focused RED tests reproduced the leak and exceptional paths before the guarded normalization fix.

## Review Remediation

- Root identity, file collection, relative path, and state are each acquired once through guarded `Reflect.get` calls and retained as immutable local snapshots.
- Every snapshot is validated before it enters ordering or evidence projection; later getter values cannot replace validated facts.
- Getter, proxy, and iterator exceptions return one stable `POLICY_INPUT_INVALID` blocker in the `scan-coverage-observation` category.
- Invalid observations fail closed rather than being omitted from counts, preventing partial coverage from masquerading as exhaustive evidence.
- Tests construct private paths and matched token-like values at runtime and prove neither appears in serialized success or failure evidence.

## Verification Evidence

- Focused scan-coverage and hostile-observation matrix: 3/3 passed.
- Required readiness/candidate/preflight/source-snapshot regression set: 66/66 passed.
- Complete release-candidate suite: 42/42 passed.
- Full repository suite: 205/205 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:rc`: passed with zero warnings and zero blockers; its nested full suite also passed 205/205.
- `git diff --check`: passed.
- Generated untracked `dist/release-candidate.js` was removed after each build verification.
- Existing `.planning/graphs/` user modifications remained untouched and unstaged.

## Security and Scope Review

- Confirmed binary classification cannot be used to bypass scanning for a text-classified identity.
- Confirmed invalid UTF-8 cannot be accepted through replacement decoding.
- Confirmed oversized content is never returned in scan observations and no manifest or coverage evidence is truncated.
- Confirmed adapter getters, proxies, thenables, malformed versions/states/counts, and raw exceptions fail through stable sanitized blockers.
- Confirmed coverage getters and iterators cannot escape raw exceptions or substitute a private second-read value after validation.
- Confirmed matched sensitive values and private absolute roots do not enter coverage or blocker serialization.
- Confirmed scan classification never removes files from integrity hashing, inclusion reconciliation, or manifest projection.
- Confirmed no fallback, retry, repair, source write, archive, signing, encryption, upload, credential, compile, remote, MCP, game launch, or runtime-validation behavior was added.
- Confirmed macOS fixtures prove semantic contract behavior only; no real Windows evidence is claimed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-05 can guarantee exactly-once cleanup after every post-creation outcome without changing scan classification or inclusion.
- Plan 04-06 can carry this coverage into the separate artifact-validation domain and apply final cleanup precedence.

## Self-Check: PASSED

- All source, test, tracked build, and summary files exist.
- RED commit `20473f5` precedes GREEN commit `a0eb52a`; review RED `bc94c03` precedes review GREEN `e255a7b`.
- Focused, regression, full-suite, typecheck, build, RC, diff, generated-artifact, source-immutability, and graph-exclusion checks passed.
- RCIN-05 has unique plan traceability and complete implementation/test evidence.

## Independent Review

- Specification review: `SPEC COMPLIANT` after confirming exhaustive four-class coverage, binary inclusion independence, required-text blocking, source immutability, and valid RED-before-GREEN ordering.
- Quality review: `QUALITY APPROVED` after the hostile-value remediation; `root`, `files`, `relativePath`, and `state` are snapshotted exactly once, exceptional getters/proxies/iterators return sanitized explicit failures, and no partial coverage or private path can escape.
- Final review regressions: readiness and candidate suites 53/53, full suite 205/205, typecheck, build, `verify:rc`, and diff check passed.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

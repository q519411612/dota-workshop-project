---
phase: 03-safe-candidate-assembly
plan: 01
subsystem: release-readiness
tags: [typescript, vitest, preflight, redaction]

requires: []
provides:
  - Shared structured release-readiness findings for required structure, metadata, placeholders, and sensitive material
  - Exact compatibility rendering for dry_run_release_report
  - Safe category-only handling for unsafe observation paths and unscannable required text
affects: [03-safe-candidate-assembly, release-candidate, preflight]

tech-stack:
  added: []
  patterns: [pure policy over filesystem observations, compatibility renderer, redacted structured findings]

key-files:
  created: [src/release-readiness.ts, tests/release-readiness.test.ts, dist/release-readiness.js]
  modified: [src/preflight.ts, tests/preflight.test.ts, dist/preflight.js]

key-decisions:
  - "Keep filesystem observation in preflight while release-readiness owns deterministic classification."
  - "Represent unreadable or oversized required text as blockers in structured policy while preserving existing dry-run warning rendering."
  - "Omit unsafe absolute or traversal-like paths from findings instead of exposing private roots."
  - "Redact any credential-bearing evidence-path segment through the same classifier used for sensitive content."
  - "Classify filesystem read/stat failures at the observation boundary without serializing raw exceptions."
  - "Use literal policy identities, explicit runtime invariant blockers, and canonical observation ordering."

patterns-established:
  - "Policy findings contain stable code, category, disposition, and only safe field or relative-path identity."
  - "Legacy operations render structured findings through an explicit compatibility seam."
  - "Structurally safe evidence paths pass through one segment-level credential redaction boundary before serialization."
  - "Policy callers cannot influence finding order; required labels, scan roots, and file paths are canonicalized before evaluation."

requirements-completed: [RCFS-04]

duration: 30min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 01: Shared Release Readiness Summary

**One structured readiness authority now serves future candidate assembly while preserving complete dry-run release results.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-15T04:20:00Z
- **Completed:** 2026-07-15T04:56:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added ordered structured findings for required paths, release metadata, placeholder values, sensitive categories, non-text inputs, and unscannable required text.
- Preserved complete `dry_run_release_report` results for success, metadata blockers, placeholder blockers, sensitive content, invalid addon names, and missing target roots.
- Proved findings omit matched secret values and unsafe private absolute paths.
- Restricted structure labels and scan-root identities to stable allowlists so all serialized input-derived fields remain redacted.
- Synchronized tracked runtime output with the TypeScript source contract.
- Redacted credential-bearing segments in metadata and scanned-file paths without hiding ordinary safe relative paths.
- Converted real read/stat failures into stable unreadable findings and explicit dry-run blockers without raw filesystem errors.
- Added literal/discriminated policy types, runtime invariant blockers, exhaustive rendering, and shuffled-input parity.

## Task Commits

1. **Characterize readiness and dry-run compatibility** - `19fb3b1` (test)
2. **Extract structured policy with compatibility rendering** - `9217049` (feat)
3. **Harden unsafe observation-path redaction** - `4a35d76` (fix)
4. **Sanitize caller-provided finding identities** - `7c258d1` (fix)
5. **Synchronize release policy runtime build** - `73419bc` (chore)
6. **Redact credential-bearing evidence-path segments** - `daeeb0d` (fix)
7. **Synchronize segment-redaction runtime build** - `942c98d` (chore)
8. **Fail closed on filesystem and policy invariants** - `22c785f` (fix)
9. **Synchronize invariant-safe runtime build** - `f46bbfc` (chore)

## Files Created/Modified

- `src/release-readiness.ts` - Pure release-readiness classification and redacted finding types.
- `src/preflight.ts` - Filesystem observation collection and exact dry-run compatibility rendering.
- `tests/release-readiness.test.ts` - Ordered policy, unscannable text, secret-value, and private-root coverage.
- `tests/preflight.test.ts` - Full representative `ToolResult` equality characterizations.
- `dist/release-readiness.js` - Runtime build of the shared policy used by the packaged server.
- `dist/preflight.js` - Runtime build of the compatibility-integrated preflight service.

## Decisions Made

- Filesystem reads remain in the existing preflight service; the shared module receives observations and returns deterministic findings.
- Required unreadable or oversized text is structurally blocking for candidate callers, but the legacy dry-run renderer retains its established skip-warning behavior.
- Unsafe path identities are omitted from structured findings so category evidence cannot leak a private absolute root.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Information Disclosure] Sanitized unsafe observation paths**
- **Found during:** Post-GREEN security review
- **Issue:** The first redaction assertion did not inject its private absolute root, and the pure policy would have echoed such a path.
- **Fix:** Added a failing regression case and omitted unsafe absolute, Windows-style, backslash, empty-segment, and traversal-like identities from findings.
- **Files modified:** `src/release-readiness.ts`, `tests/release-readiness.test.ts`
- **Verification:** Focused tests, typecheck, build, and serialized non-disclosure assertion pass.
- **Committed in:** `4a35d76`

**2. [Rule 1 - Information Disclosure] Sanitized input-derived finding fields**
- **Found during:** Independent specification review
- **Issue:** Caller-provided required-path labels and scan-root identities were serialized verbatim through `finding.field`.
- **Fix:** Added stable allowlists for required structure and scan roots; unknown identities become category-only findings while safe relative file paths remain visible.
- **Files modified:** `src/release-readiness.ts`, `tests/release-readiness.test.ts`
- **Verification:** RED exposed the token-shaped label verbatim; GREEN passed 12/12 focused tests and typecheck.
- **Committed in:** `7c258d1`

**3. [Rule 2 - Runtime Contract] Synchronized tracked build output**
- **Found during:** Independent specification review
- **Issue:** The package executable loads tracked `dist/`, but the first implementation commits excluded changed runtime output.
- **Fix:** Rebuilt TypeScript and committed only `dist/preflight.js` and `dist/release-readiness.js`.
- **Files modified:** `dist/preflight.js`, `dist/release-readiness.js`
- **Verification:** `npm run build` passed and the staged-file audit contained only the two release-policy runtime files.
- **Committed in:** `73419bc`

**4. [Rule 1 - Information Disclosure] Redacted credential-bearing path segments**
- **Found during:** Second independent specification review
- **Issue:** Structurally valid relative paths could still serialize credential-shaped metadata or scanned-file segments verbatim.
- **Fix:** Reused the sensitive-category classifier inside the single safe evidence-path boundary and replaced each matched segment with `[redacted]`; required-path identities remain allowlisted.
- **Files modified:** `src/release-readiness.ts`, `tests/release-readiness.test.ts`, `dist/release-readiness.js`
- **Verification:** RED produced 2 expected failures with the credential value visible in both paths; GREEN passed 14/14 focused tests and typecheck before the full gate.
- **Committed in:** `daeeb0d`, `942c98d`

**5. [Rule 1 - Information Disclosure] Classified filesystem observation failures**
- **Found during:** Quality review
- **Issue:** Required-text `readFile` or `stat` failures escaped `dryRunReleaseReport` as raw exceptions containing absolute paths.
- **Fix:** Added a narrow filesystem adapter and converted both failures to safe unreadable observations; required unreadable text now produces an explicit structured blocker.
- **Files modified:** `src/preflight.ts`, `tests/preflight.test.ts`, `dist/preflight.js`
- **Verification:** Real `EACCES` RED escaped with the absolute path; adapter RED ignored an injected stat failure and falsely returned success; both now pass through the structured result.
- **Committed in:** `22c785f`, `f46bbfc`

**6. [Rule 2 - Policy Invariants] Rejected impossible runtime identities**
- **Found during:** Quality review
- **Issue:** Exported policy types accepted arbitrary strings and silently omitted unknown labels/roots; the renderer defaulted every non-game root to content.
- **Fix:** Added literal identity unions, code-specific finding variants, runtime validation, explicit `POLICY_INPUT_INVALID` blockers, and exhaustive root rendering.
- **Files modified:** `src/release-readiness.ts`, `src/preflight.ts`, `tests/release-readiness.test.ts`, `dist/release-readiness.js`, `dist/preflight.js`
- **Verification:** RED produced no blockers for four impossible identities; GREEN returns four stable category-only blockers and never emits scan completion for an invalid root.
- **Committed in:** `22c785f`, `f46bbfc`

**7. [Rule 1 - Determinism] Canonicalized policy observation order**
- **Found during:** Quality review
- **Issue:** Reversing required paths, scan roots, or scan files changed finding order.
- **Fix:** Canonicalized required labels by policy order, roots by fixed provenance order, and files by sanitized relative identity before classification.
- **Files modified:** `src/release-readiness.ts`, `tests/release-readiness.test.ts`, `dist/release-readiness.js`
- **Verification:** Shuffled-input parity RED showed reordered findings; GREEN produces complete equality.
- **Committed in:** `22c785f`, `f46bbfc`

---

**Total deviations:** 7 auto-fixed issues (4 information-disclosure controls, 2 policy/determinism controls, 1 runtime synchronization requirement)
**Impact on plan:** The changes strengthen redaction and keep the packaged runtime synchronized without expanding candidate lifecycle or public MCP scope.

## Issues Encountered

Three independent review passes found confirmed redaction, runtime, invariant, and determinism issues; each was reproduced, corrected, and verified as documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Candidate assembly can consume `evaluateReleaseReadiness` without duplicating release rules.
- Manifest, candidate lifecycle, cleanup evidence, MCP registration, and remote behavior remain untouched for their assigned plans and phases.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

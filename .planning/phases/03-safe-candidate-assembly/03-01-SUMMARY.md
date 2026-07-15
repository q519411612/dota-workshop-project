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
  created: [src/release-readiness.ts, tests/release-readiness.test.ts]
  modified: [src/preflight.ts, tests/preflight.test.ts]

key-decisions:
  - "Keep filesystem observation in preflight while release-readiness owns deterministic classification."
  - "Represent unreadable or oversized required text as blockers in structured policy while preserving existing dry-run warning rendering."
  - "Omit unsafe absolute or traversal-like paths from findings instead of exposing private roots."

patterns-established:
  - "Policy findings contain stable code, category, disposition, and only safe field or relative-path identity."
  - "Legacy operations render structured findings through an explicit compatibility seam."

requirements-completed: [RCFS-04]

duration: 7min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 01: Shared Release Readiness Summary

**One structured readiness authority now serves future candidate assembly while preserving complete dry-run release results.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-15T04:20:00Z
- **Completed:** 2026-07-15T04:27:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added ordered structured findings for required paths, release metadata, placeholder values, sensitive categories, non-text inputs, and unscannable required text.
- Preserved complete `dry_run_release_report` results for success, metadata blockers, placeholder blockers, sensitive content, invalid addon names, and missing target roots.
- Proved findings omit matched secret values and unsafe private absolute paths.

## Task Commits

1. **Characterize readiness and dry-run compatibility** - `19fb3b1` (test)
2. **Extract structured policy with compatibility rendering** - `9217049` (feat)
3. **Harden unsafe observation-path redaction** - `4a35d76` (fix)

## Files Created/Modified

- `src/release-readiness.ts` - Pure release-readiness classification and redacted finding types.
- `src/preflight.ts` - Filesystem observation collection and exact dry-run compatibility rendering.
- `tests/release-readiness.test.ts` - Ordered policy, unscannable text, secret-value, and private-root coverage.
- `tests/preflight.test.ts` - Full representative `ToolResult` equality characterizations.

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

---

**Total deviations:** 1 auto-fixed missing critical security behavior
**Impact on plan:** The change strengthens the required redaction boundary without expanding candidate lifecycle or public MCP scope.

## Issues Encountered

None beyond the security deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Candidate assembly can consume `evaluateReleaseReadiness` without duplicating release rules.
- Manifest, candidate lifecycle, cleanup evidence, MCP registration, and remote behavior remain untouched for their assigned plans and phases.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

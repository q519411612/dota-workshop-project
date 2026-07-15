---
phase: 05-unified-mcp-and-remote-target-parity
plan: 01
subsystem: mcp-public-surface
tags: [mcp, routing, schema, structured-content, tdd]

requires:
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 03
    provides: Production fixture/local release-candidate lifecycle and mandatory boundaries
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 05
    provides: Strict sanitized remote release-candidate normalization
provides:
  - One discoverable preflight_release_candidate MCP operation
  - Exact strict target plus addonName public schema
  - Explicit fixture/local and SSH/PowerShell service routing with no fallback
  - Identical text and structured ToolResult serialization
affects: [05-06, 05-07, packaged-runtime, operator-guidance]

tech-stack:
  added: []
  patterns: [strict full-schema MCP registration, injectable target service boundary, additive tool routing]

key-files:
  created: [tests/preflight-release-candidate.test.ts]
  modified: [src/tools.ts, src/server.ts, README.md, skills/dota2-workshop-tools/SKILL.md]

key-decisions:
  - "The MCP SDK receives the complete strict Zod schema rather than its raw shape so unknown fields are rejected instead of stripped."
  - "Fixture/local results wrap the production Node detail in the common result envelope with a sanitized target."
  - "The existing dry_run_release_report branch is unchanged and remains inspection-only."

patterns-established:
  - "Target routing is counter-testable through a narrow service seam while production defaults call only the established lifecycle services."

requirements-completed: [RCOP-01]

duration: 8min
completed: 2026-07-16
status: complete
---

# Phase 5 Plan 01: Public Candidate Preflight Summary

**The MCP server now exposes exactly one strict `preflight_release_candidate` operation across fixture, local, SSH, and PowerShell targets without changing the adjacent dry-run inspection route.**

## Accomplishments

- Added the operation once to the canonical tool list, server registry, dispatcher, README list, and skill list.
- Routed fixture and local inputs only to the production Node lifecycle and remote inputs only to the strict target-native remote service.
- Wrapped Node lifecycle detail in the common ToolResult with a sanitized fixture/local target.
- Registered the complete strict input schema so unknown and prohibited fields fail at both the MCP and dispatcher boundaries.
- Proved MCP text parses to the exact structuredContent object and `isError` follows the recomputed ToolResult success state.
- Preserved the existing `dry_run_release_report` branch and characterized result behavior unchanged.

## TDD Evidence

- RED commit `bb06e4f` failed on missing discoverability, registration, routing, and strict validation.
- GREEN commit `8507d9a` added the additive public route and canonical tool-list entries.
- Review RED commit `e70fd47` proved raw-shape MCP registration silently stripped unknown fields.
- Review GREEN commit `63fc706` registered the complete strict schema.

## Independent Review

- Confirmed exactly one operation name and one server registration.
- Confirmed all four target branches select only their intended lifecycle service.
- Confirmed prohibited fields are rejected before any service invocation.
- Confirmed text and structured content remain identical.
- Confirmed `dry_run_release_report` code and whole-result tests remain unchanged and inspection-only.
- Confirmed runtime `dist` promotion remains exclusively owned by Plan 05-07.
- Final review result: no unresolved confirmed issue.

## Verification Evidence

- Final focused public/dry-run/result/plugin suite: 28/28 passed.
- Final repository suite: 284/284 passed across 26 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; generated Phase 5 runtime files were removed afterward.
- `git diff --check`: passed.
- Immutable graph baseline and cached graph exclusion guards passed before every commit.

## Security and Scope Review

- No credential, upload, retention, archive, signing, encryption, build, repair, temporary-path, fallback, or retry field exists in the public schema.
- No Steam login, Workshop mutation, upload, source mutation, candidate retention, or real Windows claim was added.
- User-owned `.planning/graphs/` modifications remain untouched, unstaged, and outside every commit.

## Self-Check: PASSED

- All declared source, test, and documentation artifacts exist.
- RED `bb06e4f` precedes GREEN `8507d9a`; review RED `e70fd47` precedes review GREEN `63fc706`.
- `requirements-completed` contains only `RCOP-01`.
- The worktree contains only the preserved user-owned graph modifications.

---
*Phase: 05-unified-mcp-and-remote-target-parity*
*Completed: 2026-07-16*

# Phase 8 Summary: Safe Smoke Cleanup Controls

**Status:** Complete
**Date:** 2026-07-04

## What Changed

- Added `cleanup_playable_smoke` as an explicit MCP operation for repeat playable smoke cleanup.
- Added `src/cleanup.ts` with addon-name validation, fixture/local/remote target handling, dry-run default behavior, execute mode, no-match evidence, and standard `ToolResult` output.
- Added PowerShell cleanup script construction that filters Dota-related processes by process name and requested addon command-line match before stopping process IDs.
- Added remote cleanup through the existing remote command adapter, preserving stdout, stderr, exit code, command evidence, and error logs on remote failure.
- Added non-Windows local host protection when no executor is injected.
- Exposed cleanup through schemas, dispatcher tool names, MCP server registration, and built `dist/` output.
- Added `tests/cleanup.test.ts` covering schema/dispatcher exposure, invalid addon names, local and remote dry-run, local and remote execute paths, no-match evidence, remote failure evidence, missing target data, unsupported local hosts, and no implicit cleanup inside `run_playable_smoke`.
- Updated README and Dota skill references for the explicit dry-run then execute cleanup workflow.

## Verification Notes

- Focused cleanup tests first failed because `src/cleanup.ts` did not exist, then passed after implementation.
- An independent review found local cleanup on a non-Windows host without an injected executor would otherwise fall through to command failure; a failing test was added and then fixed with an explicit `UNSUPPORTED_HOST_PLATFORM` result.
- Full fixture validation passed with 59 Vitest tests.
- Real Windows cleanup validation passed on 2026-07-06 through the remote SSH target adapter. The run verified remote Dota path discovery, invalid addon rejection before command construction, dry-run and execute no-match evidence, dry-run matching against one addon-scoped `dota2.exe` process, execute stopping only PID `43300`, and a post-cleanup `matchedCount: 0` inspection.

## Follow-Up Candidates

- Add generated addon file cleanup as a separate explicit operation if users need target disk hygiene.
- Add richer process evidence formatting if future real Windows output reveals useful extra fields.

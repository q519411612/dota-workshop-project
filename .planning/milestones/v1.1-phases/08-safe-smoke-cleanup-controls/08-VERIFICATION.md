# Phase 8 Verification: Safe Smoke Cleanup Controls

**Status:** Passed
**Date:** 2026-07-04

## Commands

- `git diff --check` - passed.
- `npm run typecheck` - passed.
- `npm test` - passed with 59 tests.
- `npm run build` - passed.
- Plugin validation - passed through manifest JSON, MCP config, and referenced-path checks.
- Skill validation - passed through required skill/reference presence checks and cleanup operation mention checks.
- Strict secret scan - passed across tracked and untracked repository files excluding `node_modules`.

## Test Coverage

- `tests/cleanup.test.ts` covers:
  - MCP schema parse and dispatcher exposure.
  - Invalid addon name rejection before command construction.
  - Local dry-run command construction without `Stop-Process`.
  - Local execute command construction with addon-scoped `Stop-Process`.
  - No-match cleanup evidence.
  - Remote dry-run command construction through SSH transport.
  - Remote command failure evidence with stdout, stderr, exit code, command, and logs.
  - Missing local/remote target root evidence.
  - Non-Windows local host rejection without injected executor.
  - `run_playable_smoke` not invoking cleanup implicitly after launch failure.

## Real Windows Cleanup

Real Windows validation passed on 2026-07-06 through the remote SSH target adapter without storing credentials in the repository.

Evidence:

- Remote environment discovery verified `dota2.exe`, `vconsole2.exe`, `game/dota_addons`, and `content/dota_addons` under the runtime Dota root.
- Invalid cleanup addon name `Bad Addon Name` returned `INVALID_ADDON_NAME` before remote command construction.
- Dry-run cleanup for `cleanup_smoke_nomatch_20260706` returned `matchedCount: 0` and no stopped process IDs.
- Execute cleanup for `cleanup_smoke_nomatch_20260706` returned `matchedCount: 0` and no stopped process IDs.
- After real placement smoke launch, dry-run cleanup for `placement_smoke_20260705215923395` matched exactly one `dota2.exe` process with the requested addon name in the command line and did not stop it.
- Execute cleanup for `placement_smoke_20260705215923395` matched exactly that `dota2.exe` process and stopped PID `43300`.
- A post-cleanup process inspection for `placement_smoke_20260705215923395` returned `matchedCount: 0`.
- Cleanup warnings explicitly stated that cleanup only targets Dota processes whose command line contains the requested addon name, does not stop Steam, and does not delete generated addon files.

## Requirement Evidence

- CLEN2-01 through CLEN2-03: schema, dispatcher, server registration, and invalid addon tests passed.
- CLEN2-04 through CLEN2-06: dry-run, execute, no file deletion, no Steam stop, no broad Dota kill command assertions, and real Windows addon-scoped process matching passed.
- CLEN2-07 through CLEN2-08: result-shape, no-match, missing target info, and remote failure tests passed.
- CLEN2-09: full macOS fixture test suite passed.
- CLEN2-10: README and skill references updated and skill validation passed.

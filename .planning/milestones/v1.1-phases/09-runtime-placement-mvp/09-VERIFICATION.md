# Phase 9 Verification: Runtime Placement MVP

**Status:** Passed
**Date:** 2026-07-06

## Commands

- `git diff --check` - passed.
- `npm run typecheck` - passed.
- `npm test` - passed with 66 tests.
- `npm run build` - passed.
- Plugin validation - passed through manifest JSON, MCP config, and referenced-path checks.
- Skill validation - passed through required skill/reference presence checks and runtime placement mention checks.
- Strict secret scan - passed across tracked and untracked repository files excluding ignored paths and `node_modules`.

## Test Coverage

- `tests/addon.test.ts` covers:
  - placement schema parsing through MCP input schemas.
  - placement Lua rendering.
  - invalid placement rejection before generation.
  - placement rejection on marker-only minimal templates.
  - placement inspect evidence.
- `tests/smoke.test.ts` covers:
  - placement marker validation through `run_playable_smoke`.
  - unchanged default playable smoke behavior.
- `tests/remote-operations.test.ts` covers:
  - remote addon creation command construction through the shared placement renderer.

## Real Windows Placement Smoke

Real Windows placement smoke passed on 2026-07-06 through the remote SSH target adapter without storing credentials in the repository.

Smoke input:

- Addon: `placement_smoke_20260705215923395`
- Map: `dota`
- Placement unit: `npc_dota_creep_badguys_melee`
- Placement team: `badguys`
- Placement origin: `x=256 y=-384 z=128`
- Launch mode: remote `interactiveTask`
- Runtime log: remote `game/dota/console.log`

Runtime evidence:

- Remote addon creation and inspection succeeded for both game and content addon roots.
- Interactive launch produced a `dota2.exe` process for `placement_smoke_20260705215923395`.
- Runtime validation passed after marker polling found all default playable markers:
  - `[DOTA_WORKSHOP_MCP] addon loaded: placement_smoke_20260705215923395`
  - `[DOTA_WORKSHOP_MCP] gamemode initialized: placement_smoke_20260705215923395`
  - `[DOTA_WORKSHOP_MCP] round started: placement_smoke_20260705215923395`
  - `[DOTA_WORKSHOP_MCP] score updated: placement_smoke_20260705215923395`
  - `[DOTA_WORKSHOP_MCP] win condition reached: placement_smoke_20260705215923395`
- Runtime validation also found all placement markers:
  - `[DOTA_WORKSHOP_MCP] placement configured: placement_smoke_20260705215923395`
  - `[DOTA_WORKSHOP_MCP] placement origin: placement_smoke_20260705215923395 x=256 y=-384 z=128`
  - `[DOTA_WORKSHOP_MCP] placement unit: placement_smoke_20260705215923395 npc_dota_creep_badguys_melee team=badguys`
  - `[DOTA_WORKSHOP_MCP] placement spawned: placement_smoke_20260705215923395 npc_dota_creep_badguys_melee`
- Cleanup dry-run matched the addon-scoped `dota2.exe` process and did not stop it.
- Cleanup execute stopped only the matched addon-scoped `dota2.exe` process.
- Post-cleanup inspection returned no matching process for the addon.

## Requirement Evidence

- PLAC2-01 through PLAC2-03: `create_addon` placement input, validation, Lua constants, and marker tests passed.
- PLAC2-04: `inspect_addon` placement evidence test passed.
- PLAC2-05: remote command construction test passed.
- PLAC2-06: `run_playable_smoke` placement marker validation test and real Windows placement smoke passed.
- PLAC2-07: macOS fixture test suite passed.
- PLAC2-08: README and skill references updated and skill validation passed.

# Phase 6 Remote Runtime Smoke

**Date:** 2026-07-04
**Status:** Passed

## Target Handling

- Ran against a user-provided Windows Dota 2 target over SSH.
- Private target identity, credentials, host address, and account details are intentionally omitted from repository artifacts.
- Temporary SSH password handling stayed outside the repository and was removed after commands completed.

## Addon

- Smoke addon: `v2_smoke_20260704_0003`
- Template: `playable`
- Map: `dota`
- Launch mode: `interactiveTask`
- Runtime mode: `game`
- Console log: enabled with `-condebug`

## Evidence

Remote target validation verified the Dota runtime binaries and addon roots before generation.

The runtime launch produced a fresh `dota2.exe` process in the logged-in Windows session with:

```text
-addon v2_smoke_20260704_0003 +dota_launch_custom_game v2_smoke_20260704_0003 dota -console -condebug
```

`validate_addon` succeeded against `game/dota/console.log` with the required marker set:

```text
[DOTA_WORKSHOP_MCP] addon loaded: v2_smoke_20260704_0003
[DOTA_WORKSHOP_MCP] gamemode initialized: v2_smoke_20260704_0003
[DOTA_WORKSHOP_MCP] round started: v2_smoke_20260704_0003
[DOTA_WORKSHOP_MCP] score updated: v2_smoke_20260704_0003
[DOTA_WORKSHOP_MCP] win condition reached: v2_smoke_20260704_0003
```

Additional runtime evidence:

```text
[DOTA_WORKSHOP_MCP] target spawned: v2_smoke_20260704_0003 npc_dota_creep_badguys_melee
[DOTA_WORKSHOP_MCP] score updated: v2_smoke_20260704_0003 1/3 source=think
[DOTA_WORKSHOP_MCP] score updated: v2_smoke_20260704_0003 2/3 source=think
[DOTA_WORKSHOP_MCP] score updated: v2_smoke_20260704_0003 3/3 source=think
```

## Findings

- `CreateUnitByName("npc_dota_creep_badguys_melee", Vector(0, 0, 256), ...)` worked on the stock `dota` map.
- `SetContextThink` drove score updates after the map reached `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`.
- `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)` executed after the score target.
- Remote log validation needed a wider console-log tail than 200 lines because Dota startup logs pushed early markers out before score and win markers appeared.
- `GameRules:SetCustomGameForceHero("npc_dota_hero_lina")` caused a Lua runtime error in this runtime and was removed from the stable template.

## Cleanup

The smoke Dota process launched by this validation was stopped by matching its addon command line. Generated smoke addon files were left on the Windows target for inspection and were not committed to this repository.

# Gameplay Loop API Notes

**Date:** 2026-07-03
**Purpose:** Translate v2 API research into implementation decisions for the Playable Gameplay Loop MVP.

## Recommended Minimal Loop

The generated Lua should implement this runtime flow:

1. `Precache(context)` precaches the candidate spawned unit.
2. `Activate()` creates a game mode object and calls `InitGameMode()`.
3. `InitGameMode()` emits the v1.1 addon marker and v2 gamemode marker.
4. `InitGameMode()` registers `game_rules_state_change` and `entity_killed`.
5. `InitGameMode()` registers a `SetContextThink` loop on `GameRules:GetGameModeEntity()`.
6. When `GameRules:State_Get()` equals `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`, the round starts.
7. Round start emits a marker and attempts to spawn one target unit.
8. Score advances through a small validation tick and through `entity_killed`.
9. A target score ends the loop and calls `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)`.

## Why `SetContextThink` Instead of Timers

Barebones uses a bundled `libraries/timers` helper, but v2 should avoid copying a larger framework. ModDota documents `CBaseEntity:SetContextThink(...)`, and the game mode entity is available from `GameRules:GetGameModeEntity()`. This gives the generated prototype a small engine-backed tick loop.

## Marker Contract

Minimum marker set:

```text
[DOTA_WORKSHOP_MCP] addon loaded: <addon>
[DOTA_WORKSHOP_MCP] gamemode initialized: <addon>
[DOTA_WORKSHOP_MCP] round started: <addon>
[DOTA_WORKSHOP_MCP] score updated: <addon>
[DOTA_WORKSHOP_MCP] win condition reached: <addon>
```

Optional marker:

```text
[DOTA_WORKSHOP_MCP] target spawned: <addon>
```

The optional spawn marker depends on candidate spawn behavior that still needs real runtime validation. The validation tool should support checking multiple markers, but docs should recommend validating the required marker set first and then using the spawn marker as additional evidence when present.

## File Generation Contract

`create_addon` should be able to generate a playable template without changing local/remote target contracts.

Generated game tree:

```text
game/dota_addons/<addon>/
  addoninfo.txt
  scripts/vscripts/addon_game_mode.lua
  scripts/npc/herolist.txt
  scripts/npc/npc_heroes_custom.txt
  scripts/npc/npc_units_custom.txt
  resource/addon_<addon>_english.txt
```

Generated content tree:

```text
content/dota_addons/<addon>/
  maps/
```

## Validation Contract

`validate_addon` should keep the old single-marker behavior for compatibility and add a multiple-marker mode:

```json
{
  "expectedMarkers": [
    "[DOTA_WORKSHOP_MCP] addon loaded: demo_addon",
    "[DOTA_WORKSHOP_MCP] gamemode initialized: demo_addon",
    "[DOTA_WORKSHOP_MCP] round started: demo_addon",
    "[DOTA_WORKSHOP_MCP] score updated: demo_addon",
    "[DOTA_WORKSHOP_MCP] win condition reached: demo_addon"
  ]
}
```

Validation succeeds only when every requested marker appears in readable logs. Lua startup errors must still fail before marker success.

## Open Runtime Questions

These are not blockers for macOS fixture implementation, but they must be checked on Windows before claiming real gameplay smoke success:

- Does `npc_dota_creep_badguys_melee` spawn successfully through `CreateUnitByName` on the stock `dota` map?
- Does the `SetContextThink` loop fire early enough in non-tools runtime launch to emit score and win markers without manual player input?
- Does `SetGameWinner(DOTA_TEAM_GOODGUYS)` write any additional console evidence that should be captured?
- Should a later custom map replace the origin-based spawn point with named map entities?


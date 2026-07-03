# Gameplay Loop API Notes

**Date:** 2026-07-03
**Purpose:** Translate v2 API research into implementation decisions for the Playable Gameplay Loop MVP.

## Recommended Minimal Loop

The generated Lua should implement this runtime flow:

1. `Precache(context)` precaches the candidate spawned unit.
2. `Activate()` creates a game mode object and calls `InitGameMode()`.
3. `InitGameMode()` emits the v1.1 addon marker and v2 gamemode marker.
4. `InitGameMode()` configures short setup, hero-selection, strategy, showcase, and pre-game timers so runtime smoke can proceed without UI automation.
5. `InitGameMode()` registers `game_rules_state_change` and `entity_killed`.
6. `InitGameMode()` registers a `SetContextThink` loop on `GameRules:GetGameModeEntity()`.
7. When `GameRules:State_Get()` equals `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`, the round starts.
8. Round start emits a marker and attempts to spawn one target unit.
9. Score advances through a small validation tick and through `entity_killed`.
10. A target score ends the loop and calls `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)`.

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

The optional spawn marker was verified on a real Windows runtime smoke on 2026-07-04 with the stock `dota` map and `npc_dota_creep_badguys_melee`. The validation tool should still recommend the required marker set first and use the spawn marker as additional evidence when present.

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

Validation succeeds only when every requested marker appears in readable logs. Lua startup errors must still fail before marker success. Remote runtime validation reads a wider console-log tail because Dota can emit enough startup noise to push early Lua markers beyond a 200-line window before score and win markers appear.

## Runtime Smoke Findings

The 2026-07-04 remote Windows smoke used a user-provided target and did not write private target details or credentials into the repository.

- `CreateUnitByName("npc_dota_creep_badguys_melee", Vector(0, 0, 256), ...)` spawned successfully and emitted the optional spawn marker.
- `SetContextThink` emitted score markers in game runtime mode after the stock `dota` map reached `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`.
- `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)` executed after the score target and the win-condition marker was validated.
- `GameRules:SetCustomGameForceHero("npc_dota_hero_lina")` caused a Lua runtime error in the tested runtime and was removed from the stable template.
- A later custom map can replace the origin-based spawn point with named map entities.

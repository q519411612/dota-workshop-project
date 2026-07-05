# Minimal Playable Addon Template

Use this reference when generating or reviewing the default v2 playable addon. Use `template: "minimal"` only for the older marker-only smoke template.

## Goal

Generate the smallest deterministic custom game addon that can prove the file layout, Lua entry point, metadata, runtime marker flow, and a minimal gameplay loop.

## Files

Minimum fixture output:

```text
game/dota_addons/<addon_name>/
  addoninfo.txt
  scripts/vscripts/addon_game_mode.lua
  scripts/npc/herolist.txt
  scripts/npc/npc_heroes_custom.txt
  scripts/npc/npc_units_custom.txt
  scripts/npc/npc_abilities_custom.txt
  resource/addon_<addon_name>_english.txt
content/dota_addons/<addon_name>/
  maps/
```

## Lua Markers

The generated `addon_game_mode.lua` should emit stable markers that validation can search for:

```lua
print("[DOTA_WORKSHOP_MCP] addon loaded: <addon_name>")
print("[DOTA_WORKSHOP_MCP] gamemode initialized: <addon_name>")
print("[DOTA_WORKSHOP_MCP] round started: <addon_name>")
print("[DOTA_WORKSHOP_MCP] score updated: <addon_name>")
print("[DOTA_WORKSHOP_MCP] win condition reached: <addon_name>")
```

Do not claim validation success until a log or console surface contains the marker or another expected target-specific success signal.

## Gameplay Loop

The playable template should define `Precache(context)` and `Activate()`. `Activate()` initializes a Lua game mode object, configures short setup and pre-game timers for non-UI runtime smoke, registers `game_rules_state_change` and `entity_killed`, starts a small `SetContextThink` loop, emits round/score/win markers, and calls `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)` when the target score is reached.

The spawn marker is useful additional evidence. Real Windows runtime smoke on 2026-07-04 verified the stock `dota` map can emit `target spawned` for `npc_dota_creep_badguys_melee` at the generated origin position. Do not use `GameRules:SetCustomGameForceHero` for the v2 stable template; it produced a Lua runtime error in the tested current runtime.

## Score Objective

When a caller passes score objective configuration, the playable template should parameterize the existing score/win loop. Score objectives require the `playable` template; do not claim objective support for `template: "minimal"`.

```lua
self.objectiveType = "score"
self.targetScore = 2
```

It should emit objective markers for configured state, progress, and completion:

```lua
print("[DOTA_WORKSHOP_MCP] objective configured: <addon_name> type=score target=2")
print("[DOTA_WORKSHOP_MCP] objective progress: <addon_name> 1/2 source=think")
print("[DOTA_WORKSHOP_MCP] objective complete: <addon_name> type=score")
```

This is a minimal score objective in the existing runtime loop. It is not a quest graph, AI system, custom unit/ability/item generator, hero system, or UI.

## Unit Ability Scaffold

When a caller passes `unitAbilityScaffold`, generate deterministic KV entries for one custom unit and one linked custom ability:

```text
scripts/npc/npc_units_custom.txt
scripts/npc/npc_abilities_custom.txt
```

The unit entry should include the requested unit name and:

```text
"Ability1" "<abilityName>"
```

The ability entry should include the requested ability name and passive behavior:

```text
"AbilityBehavior" "DOTA_ABILITY_BEHAVIOR_PASSIVE"
```

This scaffold proves file generation and inspect evidence. It does not prove custom ability runtime execution, Lua modifiers, particles, sounds, balance, items, heroes, AI, UI, or publishing.

## Runtime Placement

When a caller passes placement configuration, the playable template should set deterministic Lua placement values before spawning the validation unit. Runtime placement requires the `playable` template; do not claim placement support for `template: "minimal"`.

```lua
self.placementOrigin = Vector(128, -64, 256)
self.placementUnitName = "npc_dota_creep_badguys_melee"
self.placementTeam = DOTA_TEAM_BADGUYS
```

It should emit placement markers for configured state and spawn result:

```lua
print("[DOTA_WORKSHOP_MCP] placement configured: <addon_name>")
print("[DOTA_WORKSHOP_MCP] placement origin: <addon_name> x=128 y=-64 z=256")
print("[DOTA_WORKSHOP_MCP] placement unit: <addon_name> npc_dota_creep_badguys_melee team=badguys")
print("[DOTA_WORKSHOP_MCP] placement spawned: <addon_name> npc_dota_creep_badguys_melee")
```

This is runtime spawn placement on a launchable map. It is not Hammer map editing and does not create custom spawn point entities.

## Metadata

`addoninfo.txt` format may vary between classic KeyValues and KV3-like output. For fixture generation, use one deterministic compatibility format and keep the format choice explicit in the MCP result. When editing an existing addon, preserve the detected metadata format.

## Boundaries

Do not generate complex gameplay systems, custom map editing, runtime custom ability behavior, React Panorama, TypeScript-to-Lua scaffolding, publishing scripts, or large starter kits for the playable MVP template.

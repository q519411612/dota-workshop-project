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

## Metadata

`addoninfo.txt` format may vary between classic KeyValues and KV3-like output. For fixture generation, use one deterministic compatibility format and keep the format choice explicit in the MCP result. When editing an existing addon, preserve the detected metadata format.

## Boundaries

Do not generate complex gameplay systems, custom abilities, React Panorama, TypeScript-to-Lua scaffolding, publishing scripts, or large starter kits for the playable MVP template.

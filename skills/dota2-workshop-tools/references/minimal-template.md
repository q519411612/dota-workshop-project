# Minimal Addon Template

Use this reference when generating or reviewing the v1 smoke-test addon.

## Goal

Generate the smallest deterministic custom game addon that can prove the file layout, Lua entry point, metadata, and validation-marker flow.

## Files

Minimum fixture output:

```text
game/dota_addons/<addon_name>/
  addoninfo.txt
  scripts/vscripts/addon_game_mode.lua
  scripts/npc/herolist.txt
  scripts/npc/npc_heroes_custom.txt
  resource/addon_<addon_name>_english.txt
content/dota_addons/<addon_name>/
  maps/
```

## Lua Marker

The generated `addon_game_mode.lua` should emit a stable marker that validation can search for:

```lua
print("[DOTA_WORKSHOP_MCP] addon loaded: <addon_name>")
```

Do not claim validation success until a log or console surface contains the marker or another expected target-specific success signal.

## Metadata

`addoninfo.txt` format may vary between classic KeyValues and KV3-like output. For v1 fixture generation, use one deterministic compatibility format and keep the format choice explicit in the MCP result. When editing an existing addon, preserve the detected metadata format.

## Boundaries

Do not generate gameplay systems, custom abilities, React Panorama, TypeScript-to-Lua scaffolding, publishing scripts, or large starter kits for the v1 smoke template.

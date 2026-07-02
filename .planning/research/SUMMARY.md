# Project Research Summary

## Key Findings

### Stack

The recommended v1 stack is a plugin-first package with a concise Dota 2 Workshop Tools skill, a TypeScript/Node.js MCP server, deterministic Windows adapters, and a minimal Lua/KV addon template. Do not start with a full TypeScript-to-Lua or React Panorama game framework.

### Addon layout

Real Dota 2 custom game templates use two Dota addon roots:

```text
game/dota_addons/<addon_name>
content/dota_addons/<addon_name>
```

The `game` tree holds Lua, NPC data, addon metadata, localization, and runtime scripts. The `content` tree holds maps, Panorama source/layout/style/script files, particles, materials, and other source assets.

### Lua entry point

Observed templates use `scripts/vscripts/addon_game_mode.lua` as the entry point. Barebones uses it to define `Precache(context)` and `Activate()`, then initializes the game mode. A minimal generated addon should include a small entry point that emits a validation marker.

### Launch path

`XavierCHN/x-template` provides a concrete launch candidate:

```text
<dota_path>/game/bin/win64/dota2.exe -novid -tools -addon <addon_name>
```

For direct custom game launch it appends:

```text
+dota_launch_custom_game <addon_name> <map_name>
```

It also starts `vconsole2.exe`. This should be treated as a strong candidate that the MCP validates on the target Windows machine.

### Modern framework boundary

Modern custom game templates may use TypeScript, React Panorama, webpack, TypeScriptToLua, Excel-to-KV generation, test utilities, and publishing/encryption scripts. These are valuable later, but they are too heavy for the first end-to-end validation loop.

## Implications for Roadmap

- Start with project/plugin skeleton and skill references.
- Define MCP tool schemas before implementing Windows control.
- Build environment discovery and addon inspection before launch commands.
- Generate the smallest addon template possible.
- Validate on local Windows first.
- Add remote Windows through SSH/PowerShell Remoting using the same tool interface.
- Defer gameplay generators, React Panorama, TypeScript-to-Lua, and publishing.

## Recommended v1 Scope

Include:

- Plugin manifest and skill folder.
- Skill references for addon layout, Workshop Tools operations, minimal template, and troubleshooting.
- MCP server skeleton.
- Local Windows target adapter.
- Remote Windows command adapter.
- Dota install discovery.
- Minimal addon generator.
- Workshop Tools launch.
- Custom game launch candidate.
- Log/console readback.
- Validation result with explicit evidence.

Exclude:

- UI automation as primary control.
- Rich gameplay loop generation.
- Ability/item/unit generators.
- React Panorama generation.
- Publishing to Workshop.
- Full Dota API reference.

## Sources

- `https://github.com/bmddota/barebones`
- `https://github.com/XavierCHN/x-template`
- Valve Developer Community Dota 2 Workshop Tools pages were attempted but returned an Anubis challenge page, so they were not used as direct evidence.

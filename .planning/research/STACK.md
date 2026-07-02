# Project Research - Stack

## Recommendation

Use a small plugin-first stack:

- Codex plugin packaging for distribution.
- One Dota 2 Workshop Tools skill for agent workflow guidance.
- One MCP server implemented in TypeScript/Node.js.
- Windows local adapter for direct Dota 2 Workshop Tools control.
- Windows remote adapter over SSH or PowerShell Remoting.
- Minimal Lua and KeyValues/KV3 addon template for the first runnable custom game.
- Optional later TypeScript/React Panorama toolchain only after the minimal loop is reliable.

## Dota 2 Addon Runtime Stack

### Required for v1

- Windows with Steam and Dota 2 Workshop Tools installed.
- Dota install root, typically ending in `steamapps/common/dota 2 beta`.
- Game tree: `game/dota_addons/<addon_name>`.
- Content tree: `content/dota_addons/<addon_name>`.
- Lua entry point under `game/dota_addons/<addon_name>/scripts/vscripts/addon_game_mode.lua`.
- Addon metadata under `game/dota_addons/<addon_name>/addoninfo.txt`.
- A map name that Workshop Tools can load for validation.

### Candidate launch path

Accessible template code in `XavierCHN/x-template` launches Dota from:

```text
<dota_path>/game/bin/win64/dota2.exe -novid -tools -addon <addon_name>
```

When launching a map, the same template appends:

```text
+dota_launch_custom_game <addon_name> <map_name>
```

It also starts:

```text
<dota_path>/game/bin/win64/vconsole2.exe
```

Treat this as a strong candidate, not a hard assumption. The MCP v1 should include a target-machine discovery/verification command before relying on it.

### Addon metadata format

Two observed formats exist in real templates:

- `bmddota/barebones` uses classic KeyValues style:

```text
"AddonInfo"
{
  "TeamCount" "10"
  "maps" "template_map playground"
  "IsPlayable" "1"
}
```

- `XavierCHN/x-template` uses a KV3-style `addoninfo.txt` with a header and fields such as `IsPlayable`, `DefaultMap`, `maps`, `MinPlayers`, and `MaxPlayers`.

Recommendation: v1 should preserve existing format when editing an addon. For generated addons, prefer the current Workshop Tools-created format after Windows validation. If validation is not available yet, generate the simpler format only behind an explicit compatibility test.

## Plugin and MCP Stack

### Plugin packaging

Package the project as a plugin so the skill, MCP server, scripts, references, and configuration stay together. The plugin should eventually contain:

```text
.codex-plugin/plugin.json
skills/dota2-workshop-tools/SKILL.md
skills/dota2-workshop-tools/references/
mcp/
scripts/
assets/templates/
```

### MCP server

TypeScript/Node.js is the best first implementation target because:

- MCP server libraries and JSON-RPC tooling are common in Node.
- Dota helper templates already use Node scripts for install and launch flow.
- Windows process control, registry reads, and SSH command wrappers are straightforward.
- The same codebase can expose local and remote adapters behind one tool interface.

The MCP server should avoid UI automation in v1. Prefer filesystem, process, and command operations. UI automation may become an optional fallback after deterministic controls are exhausted.

### Remote control

Remote Windows support should use the same logical tools as local Windows:

- `discover_environment`
- `create_addon`
- `link_addon`
- `launch_tools`
- `launch_custom_game`
- `read_console_or_logs`
- `validate_addon`

The remote adapter should send commands to Windows over SSH or PowerShell Remoting. The local adapter should run the same operations directly on Windows.

## What Not To Use In v1

- Full TypeScript-to-Lua pipeline.
- React Panorama pipeline.
- Excel-to-KV generation.
- Publishing/encryption pipeline.
- Desktop-only automation as the primary control path.
- Large gameplay framework libraries copied from starter projects.

These are useful later, but they increase the first verification loop too much.

## Confidence

| Recommendation | Confidence | Evidence |
|----------------|------------|----------|
| Separate `game/dota_addons` and `content/dota_addons` trees | High | Observed in both Barebones and x-template |
| Lua entry point named `addon_game_mode.lua` | High | Observed in Barebones and x-template |
| Launch with `dota2.exe -novid -tools -addon <addon>` | Medium-high | Implemented by x-template launch script |
| Use `+dota_launch_custom_game <addon> <map>` for map validation | Medium-high | Implemented by x-template launch script |
| Use Node/TypeScript for MCP server | Medium | Fits plugin/MCP ecosystem and observed Dota helper tooling |
| Prefer KV3 for new addon metadata | Medium | Observed in x-template, but must verify against current Workshop Tools |

## Sources

- `https://github.com/bmddota/barebones`
- `https://github.com/XavierCHN/x-template`
- Valve Developer Community pages for Dota 2 Workshop Tools were attempted but returned an Anubis bot challenge instead of document content, so they were not used as direct textual evidence.

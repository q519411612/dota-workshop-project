# Workshop Tools Launch Flow

Use this reference for local Windows launch and validation tasks.

## Discovery First

Before launching anything, MCP should verify:

- The target is Windows when using the local adapter.
- The Dota install root exists.
- `game/bin/win64/dota2.exe` exists.
- `game/bin/win64/vconsole2.exe` exists when console launch is requested.
- `game/dota_addons` and `content/dota_addons` exist.
- The selected addon exists or was just generated in the expected roots.

If any check fails, return an explicit error with attempted paths.

## Candidate Commands

Research identified this Workshop Tools launch candidate:

```text
<dota_root>/game/bin/win64/dota2.exe -novid -tools -addon <addon_name>
```

For direct custom game launch:

```text
<dota_root>/game/bin/win64/dota2.exe -novid -tools -addon <addon_name> +dota_launch_custom_game <addon_name> <map_name>
```

For Lua runtime marker validation, use game runtime mode and console logging:

```json
{
  "runtimeMode": "game",
  "consoleLog": true
}
```

That command omits `-tools`, launches `+dota_launch_custom_game`, and enables `game/dota/console.log` through `-condebug`.
When `dotaRoot` is known and `logPaths` is omitted, use MCP log reading to inspect `game/dota/console.log` as the primary runtime evidence path.

For console output:

```text
<dota_root>/game/bin/win64/vconsole2.exe
```

Treat these as target-validated candidates. Do not silently substitute guessed commands.

On remote Windows targets, if command execution is outside the logged-in desktop session, use `launchMode: "interactiveTask"` on `launch_tools` or `launch_custom_game`. That mode launches through Steam in the interactive Windows session and should return process command-line evidence for the requested addon and map.

## Validation

Process start is not enough. A successful validation result needs evidence such as:

- The generated Lua marker appears in logs or console output.
- Workshop Tools emits a known addon-loaded signal.
- A target-specific validation command reports the addon/map loaded successfully.

For Dota runtime console logs, the marker may appear inside a prefixed line such as:

```text
[VScript] [DOTA_WORKSHOP_MCP] addon loaded: <addon_name>
```

For the playable template, validate all required gameplay markers when the runtime has had time to tick:

```json
{
  "expectedMarkers": [
    "[DOTA_WORKSHOP_MCP] addon loaded: <addon_name>",
    "[DOTA_WORKSHOP_MCP] gamemode initialized: <addon_name>",
    "[DOTA_WORKSHOP_MCP] round started: <addon_name>",
    "[DOTA_WORKSHOP_MCP] score updated: <addon_name>",
    "[DOTA_WORKSHOP_MCP] win condition reached: <addon_name>"
  ]
}
```

Return a concise transcript with commands, relevant log lines, warnings, and classified errors.

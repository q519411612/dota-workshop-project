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

Remote log discovery reads a wider runtime console tail so early initialization markers and later score/win markers can be validated together in noisy Dota logs.

Return a concise transcript with commands, relevant log lines, warnings, and classified errors.

## Repeatable Playable Smoke

Use `run_playable_smoke` for the standard v2 playable smoke path. It runs the same logical sequence as the manual flow:

1. Create a playable addon.
2. Inspect generated addon evidence.
3. Launch `+dota_launch_custom_game <addon> dota` in game runtime mode with console logging.
4. Validate all required gameplay markers.

By default it generates a unique addon name, polls marker validation for a bounded window, leaves generated files on the target, and returns a transcript with the generated addon name, commands, paths, warnings, logs, and marker evidence. Pass an explicit `addonName` only for deterministic fixtures or intentional repeat runs.

When `placement` is provided, `run_playable_smoke` adds placement configured, origin, unit, and spawned markers to the default validation list. Use this to prove deterministic runtime placement on a stock launchable map before designing custom map spawn points.

When `objective` is provided, `run_playable_smoke` adds objective configured, progress, and complete markers to the default validation list. Use this to prove a configurable score objective in the existing playable loop before adding complex quest, AI, unit, ability, item, hero, or UI systems.

When `unitAbilityScaffold` is provided, `run_playable_smoke` creates the scaffold files during addon generation but does not add custom unit or ability runtime markers. Use inspect evidence for the KV files, and keep runtime ability behavior as separate validation work.

When `customMap` is provided, `run_playable_smoke` changes the sequence to:

1. Create a playable addon with the custom map name in metadata.
2. Call `prepare_custom_map` to copy `addon_template/maps/template_map.vmap`, verify goodguys and badguys spawn entity markers, and compile the map with `resourcecompiler.exe`.
3. Inspect generated addon evidence.
4. Launch `+dota_launch_custom_game <addon> <custom_map>` in game runtime mode with console logging.
5. Validate all required gameplay markers.

Custom-map smoke success requires both compile evidence and runtime log marker evidence. The custom-map MVP does not edit binary `.vmap` spawn coordinates or drive Hammer UI.

## Explicit Smoke Cleanup

Use `cleanup_playable_smoke` only when the user deliberately wants to inspect or stop a known smoke process before or after a repeat run. It is not part of `run_playable_smoke`.

Safe workflow:

1. Call `cleanup_playable_smoke` with the previous smoke `addonName` and `dryRun: true`.
2. Review the returned process command-line evidence.
3. If every match belongs to that smoke addon, call `cleanup_playable_smoke` again with `dryRun: false`.
4. Rerun `run_playable_smoke`.

Cleanup only matches Dota-related process names and requires the command line to contain the requested addon name. It does not delete generated addon files, stop Steam, or stop unrelated Dota processes.

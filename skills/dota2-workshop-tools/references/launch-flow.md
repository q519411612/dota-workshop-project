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

For console output:

```text
<dota_root>/game/bin/win64/vconsole2.exe
```

Treat these as target-validated candidates. Do not silently substitute guessed commands.

## Validation

Process start is not enough. A successful validation result needs evidence such as:

- The generated Lua marker appears in logs or console output.
- Workshop Tools emits a known addon-loaded signal.
- A target-specific validation command reports the addon/map loaded successfully.

Return a concise transcript with commands, relevant log lines, warnings, and classified errors.

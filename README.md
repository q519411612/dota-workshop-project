# Dota Workshop Project

Plugin and MCP server for AI-assisted Dota 2 Workshop Tools custom game workflows.

## What Is Included

- `.codex-plugin/plugin.json` plugin manifest.
- `skills/dota2-workshop-tools/` skill and references.
- TypeScript MCP server in `src/`.
- Built stdio server output in `dist/`.
- Minimal playable Dota 2 addon generator and inspector.
- Local Windows discovery, launch command, log reading, and validation helpers.
- Remote Windows command support through SSH or PowerShell Remoting.

## Setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

The plugin MCP config is `.mcp.json` and points to:

```bash
node ./dist/index.js
```

Run `npm run build` after changing TypeScript so `dist/` stays in sync.

## Skill

Use the `dota2-workshop-tools` skill for:

- Dota 2 Workshop Tools workflows.
- Custom game addon layout.
- Lua gamemode entry point work.
- KeyValues or KV3 addon metadata.
- Panorama scope decisions.
- Local or remote Windows validation.
- Launch and log troubleshooting.

The skill tells agents to use MCP tools for target control instead of guessing paths or commands.

## MCP Tools

The server exposes these logical operations:

- `discover_environment`
- `validate_target`
- `create_addon`
- `inspect_addon`
- `launch_tools`
- `launch_custom_game`
- `run_playable_smoke`
- `cleanup_playable_smoke`
- `read_console_or_logs`
- `validate_addon`
- `remote_command`

Every result includes target, operation, success state, evidence, warnings, paths, commands, and logs. Failures include stable error codes.

## Targets

Fixture target for tests and dry generation:

```json
{
  "kind": "fixture",
  "root": "/tmp/dota-fixture"
}
```

Local Windows target:

```json
{
  "kind": "local",
  "dotaRoot": "C:/Program Files (x86)/Steam/steamapps/common/dota 2 beta"
}
```

Remote Windows target:

```json
{
  "kind": "remote",
  "name": "windows-lab",
  "transport": "ssh",
  "host": "windows.example.test",
  "username": "builder",
  "dotaRoot": "C:/Steam/steamapps/common/dota 2 beta"
}
```

Do not store real credentials, tokens, private keys, Steam credentials, or private host data in the repository.

## Playable Addon

`create_addon` generates:

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

By default, the generated template is `playable`. It keeps the v1.1 runtime marker and adds a small Lua gameplay loop with GameRules initialization, short non-UI runtime setup, round start, score updates, and a win condition.

The Lua entry point emits markers such as:

```text
[DOTA_WORKSHOP_MCP] addon loaded: <addon_name>
[DOTA_WORKSHOP_MCP] gamemode initialized: <addon_name>
[DOTA_WORKSHOP_MCP] round started: <addon_name>
[DOTA_WORKSHOP_MCP] score updated: <addon_name>
[DOTA_WORKSHOP_MCP] win condition reached: <addon_name>
```

Use `"template": "minimal"` only when you need the old marker-only smoke template.

`validate_addon` only succeeds when expected log or console evidence is present.
Map names are restricted to Dota map path characters: letters, digits, underscores, hyphens, and forward slashes.

## Local Windows Smoke Checklist

Use a real Windows machine with Dota 2 Workshop Tools installed.

1. Build the server with `npm run build`.
2. Call `discover_environment` with a local target and explicit `dotaRoot`.
3. Call `create_addon` with a Dota-safe addon name.
4. Call `launch_tools` for the addon.
5. Call `launch_custom_game` with the addon and map candidate when a map exists.
   For remote targets where SSH or PowerShell Remoting runs outside the desktop session, pass `"launchMode": "interactiveTask"` so the launch is scheduled in the logged-in Windows user session through Steam.
   For Lua runtime marker validation, pass `"runtimeMode": "game"` and `"consoleLog": true`; this omits `-tools` and enables Dota `game/dota/console.log`.
6. Call `read_console_or_logs` with the relevant Workshop Tools log path.
   On local targets, `logPaths` may be omitted when `dotaRoot` is set and `game/dota/console.log` is the desired runtime log. On remote Windows targets, `logPaths` may be omitted when `dotaRoot` is set; the MCP server prioritizes `game/dota/console.log` and then inspects recent Dota, Workshop, and Steam log candidates.
7. Call `validate_addon` and require the expected marker or gameplay marker list. Remote validation reads enough runtime console history to match early initialization markers and later score/win markers together.

Example gameplay marker validation:

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

Process startup alone is not validation success.

## Repeatable Playable Smoke

Use `run_playable_smoke` when you want the MCP server to run the verified v2 playable path as one workflow. It composes addon generation, inspection, game runtime launch, and gameplay marker validation.

Default behavior:

- Generates a unique addon name like `playable_smoke_<date>_<time>_<suffix>`.
- Creates the default `playable` template.
- Launches map `dota` with `"runtimeMode": "game"` and `"consoleLog": true`.
- Validates addon loaded, gamemode initialized, round started, score updated, and win condition markers.
- Polls marker validation for a bounded window because Dota runtime logs may appear after launch returns.
- Leaves generated addon files on the target for inspection.

Example:

```json
{
  "target": {
    "kind": "remote",
    "name": "windows-lab",
    "transport": "ssh",
    "host": "windows.example.test",
    "username": "builder",
    "dotaRoot": "C:/Steam/steamapps/common/dota 2 beta"
  },
  "launchMode": "interactiveTask"
}
```

For deterministic fixture tests or repeatable local checks, pass an explicit `addonName` and optional `logPaths`. Do not store real private hostnames, account names, passwords, tokens, private keys, Steam credentials, or target-specific secret configuration in repository files.

### Safe Repeat Cleanup

If a repeat smoke fails because a previous Dota process is still running for a known smoke addon, call `cleanup_playable_smoke` explicitly before rerunning `run_playable_smoke`. The cleanup tool only targets Dota-related processes whose command line contains the requested `addonName`.

Inspect first:

```json
{
  "target": {
    "kind": "remote",
    "name": "windows-lab",
    "transport": "ssh",
    "host": "windows.example.test",
    "username": "builder",
    "dotaRoot": "C:/Steam/steamapps/common/dota 2 beta"
  },
  "addonName": "playable_smoke_20260703_214855162_4lmj",
  "dryRun": true
}
```

Stop only the matched smoke process:

```json
{
  "target": {
    "kind": "remote",
    "name": "windows-lab",
    "transport": "ssh",
    "host": "windows.example.test",
    "username": "builder",
    "dotaRoot": "C:/Steam/steamapps/common/dota 2 beta"
  },
  "addonName": "playable_smoke_20260703_214855162_4lmj",
  "dryRun": false
}
```

Cleanup is never automatic inside `run_playable_smoke`. It does not delete generated addon files, does not stop Steam, and does not stop unrelated Dota processes whose command line does not contain the requested addon name.

## Remote Windows Smoke Checklist

Use SSH or PowerShell Remoting configured outside the repository.

1. Create a remote target object without storing secrets in files.
2. Call `discover_environment` with the remote target and `dotaRoot`.
3. Call `create_addon`, `inspect_addon`, `launch_tools`, and `launch_custom_game` through the same logical MCP tools.
4. Use `"launchMode": "interactiveTask"` when the remote transport is a service session and Workshop Tools must appear in the logged-in desktop session.
5. For runtime validation, call `launch_custom_game` with `"runtimeMode": "game"`, `"consoleLog": true`, and a launchable map such as `dota` for the generated playable template.
6. Confirm command evidence includes stdout, stderr, exit code, and attempted command.
7. If any remote command fails, fix remote configuration. The server does not fall back to local behavior.

For the repeatable path, call `run_playable_smoke` with the same remote target and `"launchMode": "interactiveTask"`. If it fails, use the returned transcript to identify whether creation, inspection, launch, or marker validation failed, then fall back to the atomic tools above for diagnosis.

When the failure is `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND` and you know a previous smoke addon is still running, call `cleanup_playable_smoke` with `dryRun: true` for that previous addon name. If the candidate process list is correct, rerun cleanup with `dryRun: false`, then run `run_playable_smoke` again.

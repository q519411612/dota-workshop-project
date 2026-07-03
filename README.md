# Dota Workshop Project

Plugin and MCP server for AI-assisted Dota 2 Workshop Tools custom game workflows.

## What Is Included

- `.codex-plugin/plugin.json` plugin manifest.
- `skills/dota2-workshop-tools/` skill and references.
- TypeScript MCP server in `src/`.
- Built stdio server output in `dist/`.
- Minimal Dota 2 addon generator and inspector.
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

## Minimal Addon

`create_addon` generates:

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

The Lua entry point emits:

```text
[DOTA_WORKSHOP_MCP] addon loaded: <addon_name>
```

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
7. Call `validate_addon` and require the expected marker or equivalent log evidence.

Process startup alone is not validation success.

## Remote Windows Smoke Checklist

Use SSH or PowerShell Remoting configured outside the repository.

1. Create a remote target object without storing secrets in files.
2. Call `discover_environment` with the remote target and `dotaRoot`.
3. Call `create_addon`, `inspect_addon`, `launch_tools`, and `launch_custom_game` through the same logical MCP tools.
4. Use `"launchMode": "interactiveTask"` when the remote transport is a service session and Workshop Tools must appear in the logged-in desktop session.
5. For runtime validation, call `launch_custom_game` with `"runtimeMode": "game"`, `"consoleLog": true`, and a launchable map such as `dota` for the minimal generated template.
6. Confirm command evidence includes stdout, stderr, exit code, and attempted command.
7. If any remote command fails, fix remote configuration. The server does not fall back to local behavior.

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

## Plugin Handoff Readiness

Before installing or handing off the plugin, run:

```bash
npm run build
npm run verify:plugin
npm run verify:install-simulation
npm run verify:rc
npm run verify:handoff
npm run verify:milestone
```

The verifier checks the plugin manifest, MCP config, package entrypoint, built server entrypoint, skill references, and documented MCP tool lists. It is local-only: do not store Steam credentials, GitHub tokens, Windows passwords, private keys, remote host details, or private target data in this repository.

`npm run verify:rc` is the local release-candidate gate. It aggregates plugin readiness, schema-valid workflow examples, typecheck, tests, build, repository hygiene scanning, and publishing boundary checks. It is not upload automation and does not log into Steam, run Workshop upload, encrypt content, sign packages, run Windows smoke, or contact remote targets.

`npm run verify:install-simulation` creates an isolated temporary plugin layout, checks the install-facing manifest, skill, MCP config, package entrypoint, and built dist entrypoint, then removes the temporary layout. It does not perform a global install, write user config, mutate environment variables, upload, sign, encrypt, publish, or contact Windows targets.

`npm run verify:handoff` is the local release handoff gate. It reuses `verify:rc`, records the current commit, checks the plugin manifest, MCP config, package entrypoints, skill references, workflow examples, README, and operator runbook, and reports explicit release boundaries. It does not upload to Workshop, log into Steam, handle Steam Guard, encrypt content, sign packages, store credentials, or connect to remote Windows.

`npm run verify:milestone` is the local milestone closeout gate for release notes review. It reuses `verify:handoff`, summarizes v1.2-v1.7 goals, commit SHAs, delivery summaries, verification status, documentation status, release boundaries, and remaining non-blocking items. It does not upload to Workshop, log into Steam, handle Steam Guard, encrypt content, sign packages, store credentials, connect to remote Windows, or require Dota 2, Steam, Workshop Tools, Windows, network access, or remote target credentials.

## Operator Runbook and Examples

Use [docs/operator-runbook.md](docs/operator-runbook.md) for the checked operator workflow.

Reusable workflow inputs live in [examples/workflows/](examples/workflows/). They are safe templates for fixture checks and optional runtime-provided remote smoke targets, not upload automation.

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
- `prepare_custom_map`
- `inspect_addon`
- `inspect_workshop_preflight`
- `dry_run_release_report`
- `preflight_release_candidate`
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
  scripts/npc/npc_abilities_custom.txt
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

`create_addon` and `run_playable_smoke` can also accept optional runtime placement configuration:

```json
{
  "placement": {
    "unitName": "npc_dota_creep_badguys_melee",
    "team": "badguys",
    "origin": { "x": 128, "y": -64, "z": 256 }
  }
}
```

When placement is present, the playable Lua emits additional markers:

```text
[DOTA_WORKSHOP_MCP] placement configured: <addon_name>
[DOTA_WORKSHOP_MCP] placement origin: <addon_name> x=128 y=-64 z=256
[DOTA_WORKSHOP_MCP] placement unit: <addon_name> npc_dota_creep_badguys_melee team=badguys
[DOTA_WORKSHOP_MCP] placement spawned: <addon_name> npc_dota_creep_badguys_melee
```

Runtime placement applies to the `playable` template and controls the generated Lua spawn call on an already launchable map. It does not generate Hammer maps, edit custom map spawn entities, or create unit/ability systems.

`create_addon` and `run_playable_smoke` can also accept an optional score objective:

```json
{
  "objective": {
    "type": "score",
    "targetScore": 2,
    "tickIntervalSeconds": 1
  }
}
```

When objective configuration is present, the playable Lua keeps the existing score/win loop and emits additional objective markers:

```text
[DOTA_WORKSHOP_MCP] objective configured: <addon_name> type=score target=2
[DOTA_WORKSHOP_MCP] objective progress: <addon_name> 1/2 source=think
[DOTA_WORKSHOP_MCP] objective complete: <addon_name> type=score
```

Score objectives apply to the `playable` template only. They do not generate quest graphs, AI, custom units, abilities, items, heroes, or Panorama UI.

`create_addon` and `run_playable_smoke` can also accept a minimal unit/ability KV scaffold:

```json
{
  "unitAbilityScaffold": {
    "unitName": "npc_dota_workshop_mcp_dummy",
    "abilityName": "ability_dota_workshop_mcp_dummy"
  }
}
```

When scaffold configuration is present, generated addons include:

```text
scripts/npc/npc_units_custom.txt
scripts/npc/npc_abilities_custom.txt
```

The unit KV links `Ability1` to the requested ability. This is scaffolded file generation and inspect evidence only; it does not prove custom ability runtime execution, Lua modifiers, items, heroes, AI, Panorama UI, or publishing behavior.

Use `"template": "minimal"` only when you need the old marker-only smoke template.

`validate_addon` only succeeds when expected log or console evidence is present.
Map names are restricted to Dota map path characters: letters, digits, underscores, hyphens, and forward slashes.

## Workshop Preflight

Use `inspect_workshop_preflight` when you need an inspection-only readiness report for an existing addon before deciding what to build next. It accepts the same fixture, local, and remote target contract as `inspect_addon`:

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
  "addonName": "demo_addon"
}
```

The result reports addon layout evidence for runtime files, content roots, map directories, localization, and unit/ability support files. It also reports Panorama source/runtime directory evidence, XML/CSS/JavaScript files under `content/dota_addons/<addon>/panorama`, and toolchain marker files such as `package.json`, `tsconfig.json`, `tsconfig.tstl.json`, `vite.config.*`, and `webpack.config.js`.

Publishing readiness is reported as blockers and warnings only. Workshop upload remains out of scope. Preflight does not accept Steam credentials, store publishing keys, encrypt content, upload to Workshop, generate Panorama UI, run `npm`, run TypeScript-to-Lua, run React builds, run bundlers, or prove runtime validation.

## Dry-Run Release Report

Use `dry_run_release_report` when an addon is ready for manual release review and you need stricter pre-upload evidence:

```json
{
  "target": {
    "kind": "fixture",
    "root": "/tmp/dota-fixture"
  },
  "addonName": "demo_addon"
}
```

The report checks release-critical addon roots/files, publish-facing `addoninfo.txt` metadata, and text-like addon files for obvious sensitive material. Missing critical files, missing metadata keys, placeholder metadata values, and secret-like matches are release blockers. Blocker results return `ok: false`; clean dry runs return `ok: true` while still showing warnings.

Required metadata keys are:

```text
addonSteamAppID
addontitle
addonAuthor
addonDescription
```

The sensitive information scan reports only relative file paths and rule labels. It does not print full secret values. Binary and oversized files are not silently accepted; they are reported as skipped warnings.

This is a dry run only. It does not create archives, encrypt content, run build tools, store credentials, log into Steam, mutate Workshop publish state, upload to Workshop, or prove runtime validation.

## Release Candidate Preflight

Use `preflight_release_candidate` after the existing `game` and `content` addon trees are ready for a strict evidence pass. The operation accepts only `target` and `addonName`. Fixture and local targets run the same production Node lifecycle; SSH and PowerShell Remoting run one target-native PowerShell lifecycle with no local fallback.

The operation creates one isolated temporary candidate, inventories every regular source file without ignore or extension filtering, computes the ordinal manifest and combined digest, verifies the inclusion ledger and scan coverage, then removes the candidate exactly once and proves absence. The manifest plus verified cleanup proof is the deliverable; no candidate remains to upload. The deleted path is not upload-ready material and the two-root layout is not an official Valve upload payload.

Passing fixture, local-adapter, mocked SSH, and mocked PowerShell tests are contract evidence. They do not prove real Windows reparse, canonicalization, transport, or cleanup behavior. Results explicitly keep `realWindowsRuntimeProven` false.

Remote authorization is external runtime configuration. The operation never accepts, loads, stores, prompts for, or synthesizes credentials. It does not log into Steam, create or modify a Workshop item, upload, archive, sign, encrypt, launch the game, validate runtime behavior, compile or convert source, repair metadata, retain a candidate, or transfer addon files.

## Custom Map Preparation

`prepare_custom_map` prepares a launchable custom-map source for an existing addon by copying the installed Workshop template map:

```text
content/dota_addons/addon_template/maps/template_map.vmap
```

into:

```text
content/dota_addons/<addon_name>/maps/<map_name>.vmap
```

The tool refuses unsafe addon or map names, refuses to overwrite an existing destination unless `replace` is true, verifies the copied source contains both `info_player_start_goodguys` and `info_player_start_badguys`, and runs `game/bin/win64/resourcecompiler.exe`. Success requires compile evidence and an expected compiled output path such as:

```text
game/dota_addons/<addon_name>/maps/<map_name>.vpk
```

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
  "addonName": "demo_addon",
  "mapName": "demo_template_map"
}
```

This MVP does not edit binary `.vmap` spawn coordinates and does not automate Hammer. It only copies the installed template map, proves known spawn entity names exist in the source, compiles it, and leaves runtime validation to `launch_custom_game`, `validate_addon`, or `run_playable_smoke`.

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
- When `customMap` is provided, prepares that map before inspection and launch, then launches the custom map instead of `dota`.
- Validates addon loaded, gamemode initialized, round started, score updated, and win condition markers.
- When `placement` is provided, also validates placement configured, origin, unit, and spawned markers.
- When `objective` is provided, also validates objective configured, progress, and complete markers.
- When `unitAbilityScaffold` is provided, creates scaffold files but does not add scaffold runtime markers.
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

Custom-map smoke example:

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
  "addonName": "demo_addon",
  "customMap": {
    "mapName": "demo_template_map"
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
5. For runtime validation, call `launch_custom_game` with `"runtimeMode": "game"`, `"consoleLog": true`, and a launchable map such as `dota` for the generated playable template. For a template-derived custom map, call `prepare_custom_map` first or pass `customMap` to `run_playable_smoke`.
6. Confirm command evidence includes stdout, stderr, exit code, and attempted command.
7. If any remote command fails, fix remote configuration. The server does not fall back to local behavior.

For the repeatable path, call `run_playable_smoke` with the same remote target and `"launchMode": "interactiveTask"`. If it fails, use the returned transcript to identify whether creation, inspection, launch, or marker validation failed, then fall back to the atomic tools above for diagnosis.

When the failure is `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND` and you know a previous smoke addon is still running, call `cleanup_playable_smoke` with `dryRun: true` for that previous addon name. If the candidate process list is correct, rerun cleanup with `dryRun: false`, then run `run_playable_smoke` again.

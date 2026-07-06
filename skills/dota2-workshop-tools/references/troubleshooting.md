# Troubleshooting

Use this reference when a Dota 2 Workshop Tools operation fails or validation evidence is missing.

## Common Failures

### Unsupported host

Local Workshop Tools control requires Windows. On macOS or Linux, use a remote Windows target or only perform repository-side generation and fixture tests.

### Dota install not found

Discovery should inspect verified Steam/Dota locations or use a user-provided install root override. If the resolved root lacks expected binaries or addon directories, fail with the checked paths.

### Addon already exists

If either `game/dota_addons/<addon>` or `content/dota_addons/<addon>` exists, inspect and report it. Do not overwrite unless the user explicitly requested replacement.

### Missing map

Launch may start but custom game validation can fail if the requested map is absent or not compiled. Report missing map evidence separately from addon startup.

### Custom map preparation failed

`prepare_custom_map` should fail before launch when required map inputs are missing or unsafe:

- `CUSTOM_MAP_TEMPLATE_MISSING`: the installed `addon_template/maps/template_map.vmap` source is absent.
- `CUSTOM_MAP_ALREADY_EXISTS`: the destination source map exists and replacement was not requested.
- `CUSTOM_MAP_COMPILER_MISSING`: `game/bin/win64/resourcecompiler.exe` is absent.
- `CUSTOM_MAP_GAMEINFO_MISSING`: `game/dota/gameinfo.gi` is absent.
- `CUSTOM_MAP_SPAWN_MARKER_MISSING`: the copied source lacks `info_player_start_goodguys` or `info_player_start_badguys`.
- `CUSTOM_MAP_COMPILE_FAILED`: `resourcecompiler.exe` returned a non-zero exit code.
- `CUSTOM_MAP_OUTPUT_MISSING`: compilation returned success but the expected compiled map output was not found.

Do not continue to launch when map preparation fails. Fix the path, source map, or compiler issue and rerun the preparation step.

### Metadata format mismatch

`addoninfo.txt` may be classic KeyValues or KV3-like. Preserve existing format when editing. For generated fixtures, report which format was created.

### Lua startup error

Read logs or console output for syntax/runtime errors. Validation succeeds only when the expected marker or equivalent success evidence appears.

### Runtime marker missing

If Workshop Tools opens but the Lua marker is missing, distinguish editor launch from game runtime launch. For runtime marker validation, call `launch_custom_game` with `runtimeMode: "game"` and `consoleLog: true`, then read `game/dota/console.log`. A `-tools` launch can prove the addon opened in Workshop Tools without proving Lua `Activate()` executed.

### Gameplay marker missing

If the addon marker appears but gameplay markers are missing, inspect the generated Lua for `SetContextThink`, `game_rules_state_change`, and the requested marker strings. Then read `game/dota/console.log` for Lua startup errors. Do not treat partial marker presence as success when `expectedMarkers` requested multiple markers.

If only the target-spawn marker is missing, remember that the stock `dota` map spawn position and built-in spawn unit are candidate runtime details until a real Windows smoke run verifies them.

### Placement marker missing

If placement markers are missing, inspect the generated Lua for `self.placementOrigin`, `self.placementUnitName`, `self.placementTeam`, and the requested marker strings. Then read `game/dota/console.log` for Lua startup errors or `CreateUnitByName` failures. Placement markers prove runtime spawn intent and execution on a launchable map; they do not prove Hammer map spawn entity placement.

### Objective marker missing

If score objective markers are missing, inspect the generated Lua for `self.objectiveType`, `self.targetScore`, `objective configured`, `objective progress`, and `objective complete` strings. Then read `game/dota/console.log` for Lua startup errors and confirm the game reached `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`.

Objective markers prove the configured score objective path in the minimal playable loop. They do not prove complex quest graphs, AI, custom units, abilities, items, heroes, or UI.

### Unit ability scaffold missing

If scaffold evidence is missing, inspect `scripts/npc/npc_units_custom.txt` for the requested custom unit and `Ability1`, then inspect `scripts/npc/npc_abilities_custom.txt` for the requested ability and `AbilityBehavior`.

Scaffold evidence proves deterministic KV generation only. Runtime custom ability execution, modifiers, item systems, heroes, AI, UI, and publishing need separate validation.

### Workshop preflight warning

`inspect_workshop_preflight` reports readiness evidence and blockers without modifying the addon. Missing Panorama directories, missing toolchain markers, or publishing blockers are expected evidence unless the user specifically asked for those assets to exist.

Use the returned paths to inspect:

- Runtime addon layout under `game/dota_addons/<addon>`.
- Source layout under `content/dota_addons/<addon>`.
- Panorama files under `content/dota_addons/<addon>/panorama`.
- Toolchain markers such as `package.json`, `tsconfig.tstl.json`, and `vite.config.*`.

Do not treat preflight success as runtime validation. Do not continue into credential handling, encryption, Workshop upload, npm builds, TypeScript-to-Lua compilation, or React Panorama generation unless a later scope explicitly adds those workflows.

### Dry-run release report blocked

`dry_run_release_report` returns `ok: false` when metadata, package files, or sensitive information findings block release review. Treat these blockers as actionable release-readiness failures:

- Metadata blockers mean `addoninfo.txt` is missing `addonSteamAppID`, `addontitle`, `addonAuthor`, or `addonDescription`, or one of those values is empty or placeholder text.
- Package blockers mean a release-critical addon root or file is missing.
- Secret blockers mean a text-like addon file matched a sensitive marker. The report intentionally redacts the value; inspect the file directly and remove the sensitive material.

Do not bypass blockers by uploading manually from the agent workflow. Steam login, content encryption, and Workshop upload remain explicit manual boundaries.

### Repeatable smoke failed

`run_playable_smoke` stops at the failed operation and returns the transcript gathered so far. Use `failed smoke operation` to decide the next diagnostic path:

- `create_addon`: inspect addon name, target root, existing addon roots, and replacement intent.
- `inspect_addon`: verify generated game/content addon paths and support files.
- `launch_custom_game`: inspect launch command evidence, map name, runtime mode, console logging, and remote `interactiveTask` requirements.
- `validate_addon`: inspect `game/dota/console.log`, Lua startup errors, and missing marker evidence.

The workflow does not delete generated target files or stop Dota processes. Cleanup requires an explicit user-controlled action through `cleanup_playable_smoke`.

### Remote execution failure

Return the failed remote command, exit code, stdout, stderr, and target metadata. Do not run a local substitute command.

### Remote interactive launch process not found

If remote `interactiveTask` launch fails with `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND`, check whether Dota is already running from a previous smoke. Steam may focus the existing process instead of creating a new process whose command line matches the requested addon.

Use the explicit cleanup path:

1. Call `cleanup_playable_smoke` with the previous smoke `addonName` and `dryRun: true`.
2. Confirm the returned Dota process command line contains that addon name.
3. Call `cleanup_playable_smoke` with `dryRun: false` to stop only those matched Dota process IDs.
4. Rerun `run_playable_smoke`.

Do not add automatic broad process cleanup. Do not stop Steam. Do not delete generated addon files.

## Result Hygiene

Every failure report should include:

- Operation.
- Target.
- Stable error code.
- Actionable message.
- Attempted paths or commands.
- Relevant log lines.
- Warnings, if any.

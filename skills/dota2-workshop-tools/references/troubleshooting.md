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

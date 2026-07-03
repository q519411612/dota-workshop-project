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

### Remote execution failure

Return the failed remote command, exit code, stdout, stderr, and target metadata. Do not run a local substitute command.

## Result Hygiene

Every failure report should include:

- Operation.
- Target.
- Stable error code.
- Actionable message.
- Attempted paths or commands.
- Relevant log lines.
- Warnings, if any.

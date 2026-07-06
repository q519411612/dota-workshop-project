# Phase 7 Context: Repeatable Playable Smoke Workflow

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Package the real v2 playable runtime smoke path into a repeatable MCP workflow. The workflow should compose existing generation, inspection, launch, and validation capabilities, return a concise transcript, and keep local and remote targets behind the same contract.

</domain>

<decisions>
## Implementation Decisions

### Workflow Shape
- Add a single orchestration tool for playable smoke instead of requiring the user to manually call `create_addon`, `inspect_addon`, `launch_custom_game`, and `validate_addon`.
- Generate a unique smoke addon name by default using a safe prefix and timestamp-like suffix.
- Keep explicit `addonName` available for reproducible tests, and keep replacement opt-in only.
- Default to `template: "playable"`, `mapName: "dota"`, `runtimeMode: "game"`, and `consoleLog: true`.

### Marker Contract
- Use the required v2 gameplay marker set: addon loaded, gamemode initialized, round started, score updated, and win condition reached.
- Allow callers to override expected markers only through the smoke workflow input.
- Treat missing markers or Lua startup errors as validation failure.

### Target and Secrets
- Reuse the existing target schema for fixture, local, and remote targets.
- Do not persist target host, account, password, Steam credential, token, private key, or private IP data.
- Keep Windows target data runtime-only; planning and verification documents may record redacted evidence only.

### Cleanup Boundary
- Do not delete generated target addon files automatically.
- Do not stop target processes in this phase because process cleanup needs explicit target-safety design.
- Return cleanup guidance in warnings when relevant.

### the agent's Discretion
- Add a small orchestration module if it keeps `tools.ts` readable.
- Reuse existing result structures and marker helpers.
- Prefer fixture tests for behavior and command transcript shape before any real Windows smoke.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/addon.ts` generates and inspects playable addon files for fixture/local targets.
- `src/remote.ts` mirrors remote addon generation, inspection, launch, log reading, and validation.
- `src/launch.ts` constructs runtime launch commands and validates marker sets.
- `src/tools.ts` already routes local and remote operations through one tool dispatcher.
- `src/schemas.ts` owns target and MCP input validation.

### Integration Points
- Add a `run_playable_smoke` tool schema and server registration.
- Implement orchestration through existing exported functions instead of duplicating generation or validation logic.
- Return a smoke transcript through the normal `ToolResult` fields.

</code_context>

<deferred>
## Deferred Ideas

- Automatic process cleanup.
- Automatic generated addon deletion.
- Custom map spawn point validation.
- Complex gameplay objective generation.
- UI automation.

</deferred>

# Phase 5 Spec: Runtime Marker Validation

## User Story

As an AI-assisted Dota 2 custom game creator, I can launch a generated addon in Dota game runtime mode and validate success only when the generated Lua marker appears in readable console evidence.

## Requirements

1. `launch_custom_game` accepts an explicit runtime mode that launches Dota without `-tools`.
2. `launch_custom_game` can enable Dota console logging through `-condebug`.
3. Existing Workshop Tools launch behavior remains available and unchanged by default.
4. Local and remote launch command evidence shows whether `-tools` and `-condebug` were used.
5. Remote interactive launch supports runtime mode through the existing `interactiveTask` mechanism.
6. `read_console_or_logs` can read `game/dota/console.log` when log paths are omitted and a target Dota root is known.
7. `validate_addon` succeeds when the expected marker appears anywhere inside a log line.
8. `validate_addon` still fails when the marker is absent or a Lua startup error is present.

## Acceptance Criteria

- Fixture tests prove runtime launch command construction for local and remote targets.
- Fixture tests prove marker substring validation for prefixed Dota console lines.
- Real remote smoke proves `+dota_launch_custom_game <addon> dota -condebug` writes a console log containing `[VScript] [DOTA_WORKSHOP_MCP] addon loaded: <addon>`.
- Verification results are recorded in planning artifacts.

## Non-Goals

- Generating a compiled custom map.
- Publishing to Workshop.
- UI automation.
- Changing default `launch_tools` behavior.

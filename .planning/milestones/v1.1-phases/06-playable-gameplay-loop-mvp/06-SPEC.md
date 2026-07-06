# Phase 6 Spec: Playable Gameplay Loop MVP

## User Story

As an AI-assisted Dota 2 custom game creator, I can generate a minimal playable custom game prototype and validate its Lua gameplay loop through Dota runtime console markers using the same MCP local/remote target contract proven in v1.1.

## Requirements

1. API research documents exist under `.planning/research/` and distinguish verified evidence from candidates.
2. v2 requirements, roadmap, and state documents describe the playable gameplay loop MVP.
3. `create_addon` can generate a playable template with Lua gamemode initialization, round start, score update, and win-condition markers.
4. The generated template preserves the v1.1 addon runtime marker.
5. The generated template includes necessary addon metadata and KV files for the minimal loop.
6. `inspect_addon` reports whether gameplay markers and generated support files exist.
7. `validate_addon` can validate multiple expected markers from readable local or remote logs.
8. Local and remote targets use the same MCP tool names and input contract for playable generation and validation.
9. Launch behavior continues to support runtime mode with `consoleLog: true`.
10. README and skill references explain how to generate, launch, read logs, and validate the playable prototype.

## Acceptance Criteria

- Fixture tests prove playable addon generation writes Lua, metadata, hero files, unit support file, and gameplay markers.
- Fixture tests prove `inspect_addon` reports gameplay marker presence.
- Fixture tests prove local and remote `validate_addon` succeeds only when all requested gameplay markers appear.
- Fixture tests prove missing gameplay markers fail with explicit evidence.
- Existing runtime marker launch and validation tests still pass.
- Documentation states which APIs are verified, community-documented, or pending real Windows validation.
- Verification results are recorded in planning artifacts.

## Non-Goals

- Compiled custom map generation.
- Panorama UI.
- TypeScript-to-Lua.
- Excel-to-KV.
- Workshop publishing.
- Complex AI or complete gameplay framework.
- UI automation as the primary control path.


# Phase 6 Context: Playable Gameplay Loop MVP

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the v1.1 runtime marker validation loop into a minimal playable Dota 2 custom game prototype generator. The phase delivers API research, updated v2 requirements and roadmap traceability, a generated Lua/KV gameplay loop, marker validation for gameplay runtime evidence, and README/skill guidance.

</domain>

<decisions>
## Implementation Decisions

### API Evidence Gate
- Use project v1.1 runtime console evidence as the highest-confidence validation source.
- Treat Valve Developer Community scripting pages as inaccessible to automation because they returned an Anubis challenge.
- Use ModDota API docs and Barebones/x-template only as community documentation/template evidence.
- Mark unverified spawn details and built-in unit names as pending real Windows runtime validation.

### Gameplay Loop Shape
- Generate a single-file Lua game mode instead of introducing a framework.
- Keep `Precache(context)` and `Activate()` as the runtime entry points.
- Use `GameRules:GetGameModeEntity():SetContextThink(...)` for a minimal tick loop instead of copying a Timers library.
- Listen to `game_rules_state_change` for round start and `entity_killed` for optional kill scoring.
- Add an automatic score/win validation tick so smoke validation can complete without UI automation or manual combat.

### Marker Validation
- Preserve the v1.1 `[DOTA_WORKSHOP_MCP] addon loaded: <addon>` marker.
- Add gameplay markers for gamemode initialization, round start, score update, and win condition.
- Extend validation to support multiple expected markers while keeping existing single-marker behavior.
- Continue using substring matching inside prefixed Dota console lines.

### Target Contract
- Keep local Windows and remote Windows behind the same MCP operations.
- Do not add a separate remote workflow for v2.
- Update remote addon creation so it generates the same playable template as local creation.

### the agent's Discretion
- Choose small TypeScript changes that preserve the existing source layout.
- Keep generated template deterministic and fixture-testable on macOS.
- Update docs directly in the project planning location instead of creating separate superpowers docs because the user requested GSD artifacts.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/addon.ts` already owns addon name/map validation, local template generation, and inspect evidence.
- `src/launch.ts` already reads default runtime console logs and validates a single marker through substring matching.
- `src/remote.ts` already mirrors local launch/log/validation contracts and has remote addon generation scripts.
- `tests/addon.test.ts`, `tests/local-validation.test.ts`, and `tests/remote-operations.test.ts` cover fixture behavior without a Dota install.

### Established Patterns
- Tool results include target, operation, success state, evidence, warnings, paths, commands, and logs.
- Failures use stable error codes and no silent fallback.
- Addon generation refuses replacement unless `replace` is explicit.
- Runtime validation uses `game/dota/console.log` when `dotaRoot` is known.

### Integration Points
- Add optional `template` to `create_addon`.
- Add optional `expectedMarkers` to `validate_addon`.
- Share generated addon file content between local and remote creation paths.

</code_context>

<specifics>
## Specific Ideas

- The default v2 generated template should be `playable`.
- A `minimal` template can remain available for the old runtime marker-only smoke shape.
- The generated Lua should avoid comments unless a non-obvious block needs Chinese explanation.
- The research documents should be referenced from README and skill guidance.

</specifics>

<deferred>
## Deferred Ideas

- React Panorama UI.
- TypeScript-to-Lua.
- Excel-to-KV.
- Workshop publishing.
- Complex heroes, abilities, items, unit generators, AI, and full gameplay frameworks.
- UI automation as the main validation path.

</deferred>


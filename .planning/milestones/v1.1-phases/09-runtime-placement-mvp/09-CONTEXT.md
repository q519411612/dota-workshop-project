# Phase 9 Context: Runtime Placement MVP

## Current Baseline

The project can generate a playable addon, launch it in game runtime mode, and validate runtime markers from `game/dota/console.log`. The default playable template spawns `npc_dota_creep_badguys_melee` at `Vector(0, 0, 256)` and emits a target-spawn marker, but that placement is hard-coded and not exposed through the MCP contract.

`run_playable_smoke` composes addon creation, inspection, launch, and validation. It already accepts optional `expectedMarkers`, but the default marker set only covers core gameplay markers. Remote addon creation already reuses `renderAddonFiles`, so renderer changes can stay unified.

## Desired Delta

Make runtime placement explicit, deterministic, and auditable:

- callers can request a placement config;
- the generated Lua records the config as constants;
- validation can require placement markers;
- inspection can report whether placement support exists.

## Integration Points

- `src/addon.ts`: placement types, validation, renderer, local create/inspect evidence.
- `src/remote.ts`: remote create input and renderer invocation.
- `src/smoke.ts`: placement input and default placement marker expansion.
- `src/schemas.ts`, `src/server.ts`, `src/tools.ts`: MCP input contract exposure.
- `tests/addon.test.ts`, `tests/smoke.test.ts`, `tests/remote-operations.test.ts`: fixture coverage.
- README and skill references: user workflow documentation.

## Constraints

- No silent fallback: invalid placement must return explicit errors.
- No custom map or Hammer editing in this phase.
- Default behavior must remain compatible with existing playable smoke.
- Real Windows validation is optional and depends on runtime target access.

## Verification Plan

- `git diff --check`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Plugin validation
- Skill validation
- Strict secret scan
- Real Windows placement smoke if runtime target access is available

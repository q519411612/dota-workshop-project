# Phase 9 Spec: Runtime Placement MVP

**Date:** 2026-07-06
**Status:** Ready for implementation
**Requirements:** PLAC2-01, PLAC2-02, PLAC2-03, PLAC2-04, PLAC2-05, PLAC2-06, PLAC2-07, PLAC2-08

## Goal

Add deterministic runtime placement configuration to the playable addon template so a generated addon can prove where it intended to spawn a validation unit and whether that spawn path ran, using the existing log-marker validation surface.

## Scope

In scope:

- Optional placement input on `create_addon` and `run_playable_smoke`.
- Validation for placement unit name, team, and numeric origin vector.
- Generated Lua constants and markers for configured placement.
- Local fixture and remote command construction parity through the shared renderer.
- `inspect_addon` evidence for placement configuration and placement markers.
- Documentation for using placement markers in manual and repeatable smoke flows.

Out of scope:

- Hammer map editing or custom map file generation.
- UI automation.
- Custom spawn point entities in a compiled map.
- Complex gameplay objectives.
- Unit, ability, item, or hero generators.
- Workshop publishing.

## Placement Contract

The placement input is optional. When omitted, existing playable template output and smoke marker expectations stay compatible.

Fields:

- `unitName`: Dota unit name to precache and spawn. Default for placement-aware smoke is `npc_dota_creep_badguys_melee`.
- `team`: one of `goodguys`, `badguys`, or `neutral`.
- `origin`: object with numeric `x`, `y`, and `z`.

Validation:

- `unitName` must match Dota-safe unit identifiers: lowercase letters, digits, and underscores, starting with a lowercase letter.
- `team` must be one of the supported values.
- `origin` values must be finite numbers.
- Invalid placement must fail before writing files or constructing remote commands.

## Runtime Markers

When placement is present, generated Lua must emit these marker substrings:

- `[DOTA_WORKSHOP_MCP] placement configured: <addonName>`
- `[DOTA_WORKSHOP_MCP] placement origin: <addonName> x=<x> y=<y> z=<z>`
- `[DOTA_WORKSHOP_MCP] placement unit: <addonName> <unitName> team=<team>`
- `[DOTA_WORKSHOP_MCP] placement spawned: <addonName> <unitName>`

The existing addon loaded, gamemode initialized, round started, score updated, and win condition markers remain unchanged.

## Acceptance

- Fixture tests prove invalid placement fails before generation.
- Fixture tests prove playable Lua includes placement constants, precache, Vector origin, team mapping, and marker strings.
- `inspect_addon` reports placement evidence when placement exists.
- Remote creation command includes the same rendered placement Lua.
- `run_playable_smoke` includes placement markers when placement is requested.
- Default `run_playable_smoke` and default playable template continue to pass existing tests without placement.

## Ambiguity Score

- Goal Clarity: 0.90
- Boundary Clarity: 0.88
- Constraint Clarity: 0.82
- Acceptance Criteria: 0.86
- Ambiguity: 0.13

Gate passed.

# Phase 11: Gameplay Objective MVP - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a configurable score objective to the existing playable template. The goal is not to design a full game system, but to expose one gameplay objective knob that can be generated, inspected, launched, and validated through runtime markers.

</domain>

<decisions>
## Implementation Decisions

- Objective type is `score` only.
- Objective config fields are `targetScore` and `tickIntervalSeconds`.
- Default playable behavior remains unchanged when `objective` is absent.
- Objective markers are additional validation evidence only when `objective` is present.
- Real Windows validation should prefer the custom-map smoke path validated in Phase 10, but objective behavior must still work on stock `dota`.

</decisions>

<code_context>
## Existing Code Insights

- `src/addon.ts` owns playable Lua rendering, placement validation, inspect evidence, and marker helper exports.
- `src/remote.ts` writes addon files remotely through `renderAddonFiles`, so renderer changes give local/remote parity.
- `src/smoke.ts` expands expected markers for placement and can do the same for objective markers.
- `src/schemas.ts` and `src/server.ts` expose create and smoke input shapes.
- `tests/addon.test.ts`, `tests/remote-operations.test.ts`, and `tests/smoke.test.ts` cover the closest existing placement patterns.

</code_context>

<deferred>
## Deferred Ideas

- Custom units, abilities, items, heroes, AI, quest graphs, and Panorama UI.
- Map-triggered objectives or Hammer entity interactions.
- Publishing or packaged Workshop release workflows.

</deferred>

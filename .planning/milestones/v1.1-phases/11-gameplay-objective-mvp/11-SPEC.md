# Phase 11: Gameplay Objective MVP - Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.16 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Agents can generate and validate a configurable score objective in the playable template, with explicit runtime markers for objective configuration, progress, and completion.

## Background

The project already generates a minimal playable loop with score updates and a win condition. Real Windows validation has proved the loop on the stock `dota` map, deterministic runtime placement, and a custom map copied from the installed Workshop template. The next smallest gameplay objective slice is to parameterize the existing score/win loop and expose objective-specific markers without adding complex quests, AI, custom units, abilities, items, or UI.

## Requirements

1. **Objective input**: Add an optional score objective configuration to addon generation and smoke input.
   - Target: `objective` accepts type `score`, optional `targetScore`, and optional `tickIntervalSeconds`.
   - Acceptance: Schema tests cover valid parsing and invalid values.

2. **Validation before writes**: Reject invalid objective configuration before filesystem writes or remote command construction.
   - Target: objective type must be `score`; `targetScore` must be an integer in a small safe range; `tickIntervalSeconds` must be a positive finite number in a safe range.
   - Acceptance: Fixture tests prove invalid values do not write addon files and remote tests prove invalid values do not construct commands.

3. **Generated Lua markers**: Emit stable objective markers when objective configuration is present.
   - Target markers:
     - `[DOTA_WORKSHOP_MCP] objective configured: <addon> type=score target=<n>`
     - `[DOTA_WORKSHOP_MCP] objective progress: <addon> <score>/<target> source=<source>`
     - `[DOTA_WORKSHOP_MCP] objective complete: <addon> type=score`
   - Acceptance: Fixture tests inspect generated Lua and smoke marker validation uses these strings.

4. **Default compatibility**: Preserve current playable behavior when no objective is provided.
   - Target: default markers, score target, smoke expected markers, and real runtime path remain unchanged.
   - Acceptance: Existing tests continue to pass and a focused default smoke test proves objective markers are not required by default.

5. **Inspect evidence**: `inspect_addon` reports objective configuration and marker evidence when objective configuration is present.
   - Acceptance: Fixture inspect tests cover objective-present and objective-absent behavior.

6. **Remote parity**: Remote addon creation uses the same renderer and objective validation as fixture/local addon creation.
   - Acceptance: Remote command-construction tests prove objective Lua markers are rendered into the remote write command.

7. **Smoke composition**: `run_playable_smoke` includes objective markers in expected validation when objective configuration is requested.
   - Acceptance: Fixture smoke tests prove objective markers are required only when `objective` is present; real Windows validation should run through the custom-map smoke path if feasible.

8. **Documentation and scope fence**: README and skill references describe score objective configuration and defer complex gameplay systems.
   - Acceptance: Docs mention score objective markers and explicitly defer complex quests, AI, custom unit/ability/item generation, and UI.

## Boundaries

**In scope:**
- Optional score objective configuration.
- Generated Lua target score and tick interval wiring.
- Objective configured, progress, and complete markers.
- Local/fixture/remote renderer parity.
- Smoke marker expansion when objective is present.
- Real Windows objective marker validation.

**Out of scope:**
- Quest graphs or mission scripting.
- Custom unit, ability, item, or hero scaffolding.
- AI behavior.
- Panorama UI.
- Binary map editing or Hammer automation.

## Acceptance Criteria

- [ ] Objective input schemas exist for `create_addon` and `run_playable_smoke`.
- [ ] Invalid objective values fail before file writes or remote command construction.
- [ ] Generated Lua includes objective configuration and markers when requested.
- [ ] Default playable Lua and default smoke expected markers remain compatible.
- [ ] `inspect_addon` reports objective configuration and objective markers.
- [ ] Remote command construction includes objective Lua markers through the shared renderer.
- [ ] `run_playable_smoke` validates objective markers when objective is requested.
- [ ] Real Windows validation finds objective markers in `game/dota/console.log`.
- [ ] README and skill references document the objective workflow and deferred scope.

## Prohibitions

- Must not add complex quest or objective graphs in this slice.
- Must not generate custom units, abilities, items, heroes, AI, or UI for this slice.
- Must not change default smoke marker requirements when objective is absent.
- Must not report objective validation success from process launch alone.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Simplifier | What is the smallest objective? | Parameterize the existing score/win loop. |
| 2 | Boundary Keeper | What remains deferred? | Quests, AI, custom unit/ability/item scaffolding, UI, and map editing. |
| 3 | Failure Analyst | What would invalidate success? | Missing objective markers, invalid config accepted, default smoke drift, or launch-only evidence. |

---

*Phase: 11-gameplay-objective-mvp*
*Spec created: 2026-07-06*

# Phase 9 Summary: Runtime Placement MVP

**Date:** 2026-07-06
**Status:** Complete

## What Changed

Implemented optional runtime placement configuration for the playable template.

Key behavior:

- `create_addon` accepts `placement` for playable addons.
- Placement validates unit name, team, and finite origin vector values before file writes.
- The generated playable Lua emits placement configured, origin, unit, and spawned markers.
- `inspect_addon` reports runtime placement config and marker evidence.
- `run_playable_smoke` adds placement markers to default validation when placement is requested.
- Remote addon creation uses the same renderer and placement validation as local generation.
- `template: "minimal"` rejects placement instead of claiming unsupported placement evidence.

## Key Files

Created:

- `.planning/phases/09-runtime-placement-mvp/09-SPEC.md`
- `.planning/phases/09-runtime-placement-mvp/09-CONTEXT.md`
- `.planning/phases/09-runtime-placement-mvp/09-01-PLAN.md`

Modified:

- `src/addon.ts`
- `src/smoke.ts`
- `src/remote.ts`
- `src/schemas.ts`
- `src/server.ts`
- `src/tools.ts`
- `tests/addon.test.ts`
- `tests/smoke.test.ts`
- `tests/remote-operations.test.ts`
- `README.md`
- `skills/dota2-workshop-tools/SKILL.md`
- `skills/dota2-workshop-tools/references/minimal-template.md`
- `skills/dota2-workshop-tools/references/launch-flow.md`
- `skills/dota2-workshop-tools/references/troubleshooting.md`

## Verification Summary

Automated verification passed on macOS with fixture coverage. Real Windows placement smoke passed on 2026-07-06 through the remote SSH target adapter with addon `placement_smoke_20260705215923395`, placement unit `npc_dota_creep_badguys_melee`, team `badguys`, origin `x=256 y=-384 z=128`, and runtime `console.log` evidence for placement configured, origin, unit/team, spawned unit, gameplay score, and win-condition markers. Addon-scoped cleanup then stopped the matched Dota process and post-cleanup inspection returned no matching process.

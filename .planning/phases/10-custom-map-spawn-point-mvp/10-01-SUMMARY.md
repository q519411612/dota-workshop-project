# Phase 10 Summary: Custom Map Spawn Point MVP

**Date:** 2026-07-06
**Status:** complete

## Delivered

- Added `prepare_custom_map` MCP operation.
- Added fixture/local/remote custom-map preparation logic.
- Copied the installed Workshop template map into addon content maps.
- Verified copied map source contains `info_player_start_goodguys` and `info_player_start_badguys`.
- Compiled custom maps through `resourcecompiler.exe`.
- Verified real compiler output as `<map>.vpk`.
- Added optional `customMap` orchestration to `run_playable_smoke`.
- Preserved default stock `dota` smoke behavior.
- Updated README and skill references with the workflow and binary map-editing boundary.

## Validation

- Local verification passed with typecheck, tests, build, diff check, docs checks, and secret scan.
- Real Windows validation passed through remote SSH:
  - copied template map;
  - found both spawn markers;
  - compiled `template_spawn_smoke.vpk`;
  - launched the custom map through `interactiveTask`;
  - validated gameplay markers from `game/dota/console.log`;
  - stopped only the matching smoke Dota process.

## Decisions

- Use the installed `addon_template/maps/template_map.vmap` as the deterministic source for this slice.
- Treat `.vpk` as the compiled map output for the copied template map.
- Pass `-game <dotaRoot>/game/dota` to `resourcecompiler.exe`.
- Keep binary `.vmap` spawn coordinate editing deferred.
- Keep Hammer UI automation deferred.

## Next

Proceed to the gameplay objective slice on top of the validated playable addon, custom map, runtime marker, and cleanup path.

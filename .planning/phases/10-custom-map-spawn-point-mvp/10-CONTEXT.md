# Phase 10 Context: Custom Map Spawn Point MVP

**Gathered:** 2026-07-06
**Status:** Ready for planning

## Phase Boundary

Prepare a launchable custom map by copying the installed Dota Workshop `addon_template` `.vmap`, verifying map-authored spawn entity names, compiling through `resourcecompiler.exe`, and validating runtime markers on the custom map.

## Implementation Decisions

- Use the installed `addon_template/maps/template_map.vmap` as the default source map.
- Treat the template `.vmap` as binary DMX. Do not patch spawn coordinates or entities in this slice.
- Add `prepare_custom_map` as a separate MCP operation instead of expanding `create_addon`.
- Add optional `customMap` orchestration to `run_playable_smoke` so repeatable smoke can create addon, prepare map, launch map, validate markers, and leave cleanup explicit.
- Keep local and remote Windows behind the same logical tool contract.
- Fixture mode may prove copy and spawn-marker evidence without invoking `resourcecompiler.exe`.
- Local or remote Windows compile success requires real `resourcecompiler.exe` command evidence.

## Existing Code Insights

- `src/addon.ts` owns addon name/map name validation, addon file rendering, and local addon generation.
- `src/remote.ts` owns remote command construction and remote addon/smoke operations.
- `src/smoke.ts` already composes create, inspect, launch, and validate operations.
- `src/tools.ts`, `src/server.ts`, and `src/schemas.ts` expose MCP tool schemas and dispatcher routes.
- Existing tests in `tests/remote-operations.test.ts`, `tests/smoke.test.ts`, and `tests/addon.test.ts` show the preferred fixture and command-construction style.

## Remote Windows Research Notes

- Dota root was verified at runtime through user-provided remote access.
- `resourcecompiler.exe` exists under `game/bin/win64`.
- `resourcecompiler.exe -help` reports `-i`, `-game`, `-f`, `-fshallow`, `-novpk`, and related options.
- Installed source template exists at `content/dota_addons/addon_template/maps/template_map.vmap`.
- The template source contains `info_player_start_goodguys`, `info_player_start_badguys`, `info_courier_spawn_radiant`, and `ent_dota_game_events` strings.

## Specific Ideas

- `prepareCustomMap(input)` should validate addon name and map name before filesystem or remote command construction.
- Local/fixture path layout should reuse `dotaRoot/content/dota_addons/<addon>/maps/<map>.vmap`.
- Result paths should include `templateMap`, `contentMap`, `compiledMap`, and `resourceCompiler` when applicable.
- Evidence should include copied source path, spawn marker names found, and compile result.
- `runPlayableSmoke` should use `customMap.mapName` as launch map when custom map preparation is requested.

## Deferred Ideas

- Text DMX generation from scratch.
- Binary map entity mutation.
- Hammer UI automation.
- Navigation/pathing validation.
- Objective design tied to map regions.


# Phase 10 Verification: Custom Map Spawn Point MVP

**Date:** 2026-07-06
**Status:** passed

## Local Verification

- `git diff --check` passed.
- `npm run typecheck` passed.
- `npm test` passed with 73 tests.
- `npm run build` passed.
- Targeted TDD verification passed for `tests/map.test.ts`, `tests/remote-operations.test.ts`, and `tests/smoke.test.ts`.
- Skill/reference validation found custom-map guidance, `prepare_custom_map`, `customMap`, spawn marker evidence, `resourcecompiler.exe`, `.vpk`, and binary `.vmap` editing boundary text.
- Strict secret scan found no repository-stored credentials from the remote Windows validation.

## Real Windows Validation

Remote target access was provided at runtime only. No host password, Steam credential, token, private key, or private target secret was written into repository files.

Validated addon:

```text
custommap_20260705222604
```

Validated map:

```text
template_spawn_smoke
```

Evidence:

- Copied `content/dota_addons/addon_template/maps/template_map.vmap` into the generated addon's content map directory.
- Found source spawn entity markers:
  - `info_player_start_goodguys`
  - `info_player_start_badguys`
- Ran `resourcecompiler.exe` with `-game <dotaRoot>/game/dota`.
- Compiler returned exit code `0`.
- Compiler wrote:

```text
game/dota_addons/custommap_20260705222604/maps/template_spawn_smoke.vpk
```

- Remote `interactiveTask` launched:

```text
+dota_launch_custom_game custommap_20260705222604 template_spawn_smoke -console -condebug
```

- Runtime validation found all gameplay markers in `game/dota/console.log`:
  - `[DOTA_WORKSHOP_MCP] addon loaded: custommap_20260705222604`
  - `[DOTA_WORKSHOP_MCP] gamemode initialized: custommap_20260705222604`
  - `[DOTA_WORKSHOP_MCP] round started: custommap_20260705222604`
  - `[DOTA_WORKSHOP_MCP] score updated: custommap_20260705222604`
  - `[DOTA_WORKSHOP_MCP] win condition reached: custommap_20260705222604`
- Validation needed 12 polling retries before all runtime markers appeared.
- Cleanup stopped only the matching Dota process:

```text
PID 35616 dota2.exe
```

## Real Findings Folded Back

- `resourcecompiler.exe -game` must receive the `game/dota` directory, not `game/dota/gameinfo.gi`.
- The installed template map compiles to `<map>.vpk`, not `<map>.vmap_c`.
- Compile output contains warnings about missing shader/signing resources, but exit code `0`, `.vpk` existence, and runtime marker validation are the success evidence for this slice.

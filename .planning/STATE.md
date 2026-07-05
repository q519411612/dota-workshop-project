# Project State: Dota Workshop Project

**Updated:** 2026-07-06

## Project Reference

See: `.planning/PROJECT.md`

**Core value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** v2.5 Gameplay Objective MVP complete; next work should define minimal unit and ability scaffolding with fixture validation before any runtime claim.

## Current Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Plugin and Skill Foundation | Complete |
| 2 | MCP Contract and Addon Template | Complete |
| 3 | Local Windows Workshop Validation | Complete |
| 4 | Remote Windows Target Support | Complete |
| 5 | Runtime Marker Validation | Complete |
| 6 | Playable Gameplay Loop MVP | Complete |
| 7 | Repeatable Playable Smoke Workflow | Complete |
| 8 | Safe Smoke Cleanup Controls | Complete |
| 9 | Runtime Placement MVP | Complete |
| 10 | Custom Map Spawn Point MVP | Complete |
| 11 | Gameplay Objective MVP | Complete |

## Decisions In Effect

| Decision | Source |
|----------|--------|
| Build a thin vertical slice first | `.planning/PROJECT.md` |
| Package as a Codex plugin | `.planning/PROJECT.md` |
| Support both local Windows and remote Windows | `.planning/PROJECT.md` |
| Use SSH or PowerShell Remoting for remote Windows | `.planning/PROJECT.md` |
| Keep one unified MCP tool interface | `.planning/PROJECT.md` |
| Start with a minimal runnable addon template | `.planning/PROJECT.md` |
| Use Vertical MVP roadmap structure | Roadmap setup |
| Runtime validation launches without `-tools` and enables `-condebug` | Remote v1.1 investigation |
| v2 uses a small Lua `SetContextThink` gameplay loop instead of importing a framework | `.planning/research/GAMEPLAY_LOOP_API_NOTES.md` |
| v2 stable template avoids `GameRules:SetCustomGameForceHero` because current runtime smoke rejected it | `.planning/phases/06-playable-gameplay-loop-mvp/06-REMOTE-SMOKE.md` |
| v2.1 should compose existing MCP operations instead of creating a separate local or remote smoke contract | `.planning/ROADMAP.md` |
| v2.1 does not automatically delete target files or stop broad process sets; smoke cleanup remains explicit and user-controlled | `.planning/phases/07-repeatable-playable-smoke-workflow/07-REVIEW.md` |
| v2.2 cleanup must be an explicit MCP operation and must not run silently inside `run_playable_smoke` | `.planning/phases/08-safe-smoke-cleanup-controls/08-SPEC.md` |
| v2.3 placement should extend the playable template and marker validation before custom map editing or unit/ability generation | `.planning/ROADMAP.md` |
| v2.4 should copy and compile the installed template map before attempting binary Hammer map entity editing | `.planning/phases/10-custom-map-spawn-point-mvp/10-SPEC.md` |
| `resourcecompiler.exe -game` must receive the `game/dota` directory, and the compiled template map output is `<map>.vpk` | Real Windows v2.4 smoke |
| v2.5 should parameterize the validated score/win loop before introducing complex quests, AI, custom units, abilities, items, or UI | `.planning/ROADMAP.md` |
| Objective validation success requires objective markers from logs, not launch success alone | `.planning/phases/11-gameplay-objective-mvp/11-VERIFICATION.md` |

## Research Inputs

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/DOTA2_WORKSHOP_API_V2.md`
- `.planning/research/GAMEPLAY_LOOP_API_NOTES.md`

## Verification Notes

- `npm test` passed with 37 tests at v1.1 completion.
- `npm run typecheck` passes.
- `npm run build` passes and produces `dist/index.js`.
- Plugin manifest validation passes.
- Skill validation passes.
- Remote Windows SSH discovery smoke passed on a user-provided target with OpenSSH defaulting to PowerShell: Dota root, `dota2.exe`, `vconsole2.exe`, game addon root, and content addon root were verified through the MCP remote adapter.
- Workshop Tools related process evidence was observed through remote PowerShell (`dota2cfg.exe` and Steam process evidence).
- Remote generated-addon smoke created and inspected `mcp_smoke_20260703_0439` on the user-provided Windows target without replacement.
- Remote custom game launch now returns `Start-Process` PID evidence through the MCP remote adapter.
- Remote log reading returns string log lines from real Steam logs, but runtime validation remains incomplete because the expected Lua marker was not found in readable logs.
- Remote log auto-discovery works without explicit `logPaths` when `dotaRoot` is configured; it found recent Steam/Dota log candidates and produced the expected marker-missing diagnostic.
- Real remote `Start-Process` launch through SSH can return a PID and then exit without entering the logged-in desktop session.
- Remote `launchMode: "interactiveTask"` uses a temporary Windows Scheduled Task with `LogonType Interactive` and Steam `-applaunch 570`; it produced desktop-session `dota2.exe` command-line evidence for both `overthrow/forest_solo` and the generated `mcp_smoke_20260703_0439` addon.
- Real remote Workshop Tools touched addon-scoped artifacts for the generated addon (`tools_asset_info.bin` and thumbnail cache files), proving the addon directory was opened by Workshop Tools.
- The generated addon's Lua marker and `addoninfo.txt` metadata were verified on the remote target during v1 smoke. v1.1 closed the remaining runtime marker gap through Dota game runtime console evidence; do not store hostnames, usernames, passwords, or private target data.
- v1.1 remote investigation found `game/dota/console.log` is created by `-condebug`.
- v1.1 remote investigation found `-tools` opens the addon/tooling context but does not provide Lua runtime marker evidence.
- v1.1 remote investigation found non-tools custom game launch with `+dota_launch_custom_game <addon> dota -console -condebug` reaches Lua `Activate()` and writes `[VScript] [DOTA_WORKSHOP_MCP] addon loaded: <addon>` into `game/dota/console.log`.
- v1.1 implementation adds explicit `runtimeMode: "game"` and `consoleLog: true` launch controls, local default reading of `game/dota/console.log`, remote discovery that prioritizes `game/dota/console.log`, and substring marker validation for Dota-prefixed console lines.
- v1.1 independent review found that custom game map names needed the same explicit input validation discipline as addon names; implementation now rejects unsafe map names before addon metadata writes or launch command construction.
- v1.1 verification passed `npm run typecheck`, `npm test`, and `npm run build` after fixture coverage increased to 37 tests.
- v2 implementation added a playable Lua template, multiple-marker validation, remote template parity, README/skill guidance, and API research artifacts.
- v2 verification passed `git diff --check`, `npm run typecheck`, `npm test` with 44 tests after real-smoke fixes, `npm run build`, plugin validation, skill validation, and strict secret scan across tracked and untracked files.
- Real Windows v2 gameplay smoke passed on 2026-07-04 using a user-provided target over SSH without storing private target details or credentials in the repository.
- v2 smoke generated `v2_smoke_20260704_0003`, launched it in Dota game runtime mode with `-condebug`, and validated addon loaded, gamemode initialized, round started, score updated, and win condition markers from `game/dota/console.log`.
- v2 smoke also verified the optional spawn marker for `npc_dota_creep_badguys_melee`, `SetContextThink` score ticks, and `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)`.
- v2 smoke found remote log validation needed a wider runtime console tail than 200 lines; the remote reader now uses a wider marker window.
- v2 smoke found `GameRules:SetCustomGameForceHero("npc_dota_hero_lina")` causes a Lua runtime error in the tested runtime; it is documented as rejected and not used by the stable template.
- v2.1 implementation added `run_playable_smoke`, default gameplay marker validation, bounded marker polling, compact transcripts, fixture/remote orchestration tests, and repeatable workflow documentation.
- Real Windows v2.1 smoke passed on 2026-07-04 using a user-provided target over SSH without storing private target details or credentials in the repository.
- v2.1 smoke generated `playable_smoke_20260703_214855162_4lmj`, launched it with remote `interactiveTask`, and validated addon loaded, gamemode initialized, round started, score updated, and win condition markers.
- v2.1 smoke needed 13 validation retries before all gameplay markers appeared in `game/dota/console.log`; the compact transcript retained 4 command records.
- A repeat smoke attempt while a previous smoke Dota process was still running produced `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND`; stopping only the known smoke process by addon command line allowed the current build smoke to pass.
- v2.2 implementation added `cleanup_playable_smoke`, local/fixture/remote target schema support, dry-run inspection, execute cleanup, addon-name validation, no-match evidence, remote failure evidence, and repeat-smoke documentation.
- v2.2 cleanup fixture verification passed `git diff --check`, `npm run typecheck`, `npm test` with 59 tests, `npm run build`, plugin validation, skill validation, and strict secret scan.
- Real Windows cleanup validation passed on 2026-07-06 through the remote SSH target adapter without storing private target credentials in the repository. The run verified remote Dota path discovery, invalid addon rejection before command construction, dry-run and execute no-match evidence, dry-run matching against one addon-scoped `dota2.exe` process, execute stopping only PID `43300`, and post-cleanup `matchedCount: 0` evidence.
- v2.3 is scoped to deterministic runtime placement configuration and markers on launchable maps; Hammer map editing, UI automation, complex objectives, and unit/ability generators remain deferred.
- v2.3 implementation added optional `placement` input for `create_addon` and `run_playable_smoke`, generated Lua placement markers, placement validation, inspect evidence, remote renderer parity, schema/server exposure, docs, and fixture tests.
- v2.3 verification passed `git diff --check`, `npm run typecheck`, `npm test` with 66 tests, `npm run build`, plugin validation, skill validation, and strict secret scan.
- Real Windows placement smoke passed on 2026-07-06 through the remote SSH target adapter without storing private target credentials in the repository. Addon `placement_smoke_20260705215923395` launched on map `dota` with placement unit `npc_dota_creep_badguys_melee`, team `badguys`, origin `x=256 y=-384 z=128`, and runtime `console.log` evidence for placement configured, origin, unit/team, spawned unit, gameplay score, and win-condition markers.
- v2.4 remote Windows research found `resourcecompiler.exe` under `game/bin/win64`, an installed `addon_template/maps/template_map.vmap` source under `content/dota_addons`, and source strings for `info_player_start_goodguys` and `info_player_start_badguys`. The v2.4 slice should use that template as a deterministic custom-map source and defer binary map entity mutation.
- v2.4 implementation added `prepare_custom_map`, schema/server/tool exposure, template `.vmap` copy, spawn marker verification, `resourcecompiler.exe` compilation, `.vpk` output verification, optional `run_playable_smoke.customMap` orchestration, docs, and fixture/remote/smoke tests.
- v2.4 verification passed `git diff --check`, `npm run typecheck`, `npm test` with 73 tests, `npm run build`, skill/reference validation, and strict secret scan.
- Real Windows custom-map smoke passed on 2026-07-06 through the remote SSH target adapter without storing private target credentials in the repository. Addon `custommap_20260705222604` copied `addon_template/maps/template_map.vmap`, verified `info_player_start_goodguys` and `info_player_start_badguys`, compiled `template_spawn_smoke.vpk`, launched map `template_spawn_smoke`, found all gameplay markers in `game/dota/console.log`, and cleaned up only PID `35616` matching the smoke addon command line.
- v2.5 implementation added optional score objective input for `create_addon` and `run_playable_smoke`, objective validation, generated Lua objective markers, inspect evidence, remote renderer parity, fixture/remote/smoke tests, and documentation.
- v2.5 verification passed `git diff --check`, `npm run typecheck`, `npm test` with 80 tests, `npm run build`, manifest/reference validation, and strict secret scan.
- Real Windows objective smoke passed on 2026-07-06 through the remote SSH target adapter without storing private target credentials in the repository. Addon `objective_20260705224126` prepared and compiled `template_objective_smoke.vpk`, launched map `template_objective_smoke`, found default gameplay markers plus objective configured/progress/complete markers in `game/dota/console.log`, and cleaned up only the matching Dota process.

## Next Action

Define the next unit and ability scaffolding slice, then proceed with spec, plan, implementation, verification, independent review, commit, and push.

---
*Last updated: 2026-07-06 after v2.5 gameplay objective MVP*

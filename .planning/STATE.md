# Project State: Dota Workshop Project

**Updated:** 2026-07-03

## Project Reference

See: `.planning/PROJECT.md`

**Core value:** AI can reliably create and validate a minimal runnable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** v1.1 Runtime Marker Validation complete and verified

## Current Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Plugin and Skill Foundation | Complete |
| 2 | MCP Contract and Addon Template | Complete |
| 3 | Local Windows Workshop Validation | Complete |
| 4 | Remote Windows Target Support | Complete |
| 5 | Runtime Marker Validation | Complete |

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

## Research Inputs

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/SUMMARY.md`

## Verification Notes

- `npm test` passes with 37 tests.
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

## Next Action

Keep future work in v2/deferred scope unless the roadmap is updated.

---
*Last updated: 2026-07-03 after v1.1 runtime marker validation*

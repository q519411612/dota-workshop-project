# Project State: Dota Workshop Project

**Updated:** 2026-07-03

## Project Reference

See: `.planning/PROJECT.md`

**Core value:** AI can reliably create and validate a minimal runnable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** v1 Vertical MVP complete, verified, reviewed, committed, pushed, and hardened with real remote Windows interactive launch evidence

## Current Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Plugin and Skill Foundation | Complete |
| 2 | MCP Contract and Addon Template | Complete |
| 3 | Local Windows Workshop Validation | Complete |
| 4 | Remote Windows Target Support | Complete |

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

## Research Inputs

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/SUMMARY.md`

## Verification Notes

- `npm test` passes with 28 tests.
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
- The generated addon's Lua marker and `addoninfo.txt` metadata were verified on the remote target. Full Lua `Activate()` marker validation still needs a readable Workshop Tools console/log source or a compiled map path that reaches Lua runtime; do not store hostnames, usernames, passwords, or private target data.

## Next Action

Use `launchMode: "interactiveTask"` for remote Windows desktop-session Workshop Tools validation when SSH or PowerShell Remoting is service-session based.

---
*Last updated: 2026-07-03 after v1 MVP completion*

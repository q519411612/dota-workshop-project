# Project State: Dota Workshop Project

**Updated:** 2026-07-03

## Project Reference

See: `.planning/PROJECT.md`

**Core value:** AI can reliably create and validate a minimal runnable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** v1 Vertical MVP implementation complete; verification and independent review in progress

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

- `npm test` passes with 24 tests.
- `npm run typecheck` passes.
- `npm run build` passes and produces `dist/index.js`.
- Plugin manifest validation passes.
- Skill validation passes.
- Real local and remote Windows smoke checks require user-provided target access and are documented in `README.md`.

## Next Action

Run independent review, fix any findings, then commit and push the v1 MVP.

---
*Last updated: 2026-07-03 after v1 MVP implementation*

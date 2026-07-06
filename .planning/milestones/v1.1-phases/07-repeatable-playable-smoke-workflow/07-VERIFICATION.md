# Phase 7 Verification: Repeatable Playable Smoke Workflow

**Status:** Passed
**Date:** 2026-07-04

## Commands

- `git diff --check` - passed.
- `npm run typecheck` - passed.
- `npm test` - passed with 49 tests.
- `npm run build` - passed.
- Plugin validation - passed through manifest JSON and referenced-path checks.
- Skill validation - passed through required skill/reference presence checks.
- Strict secret scan - passed after implementation and planning updates.

## Real Windows Smoke

Real Windows smoke passed on 2026-07-04 using a user-provided Windows target over SSH. Private host identity, account details, password, private IP address, and full target paths are intentionally not recorded.

Current build smoke result:

- Generated smoke addon: `playable_smoke_20260703_214855162_4lmj`.
- Workflow: `run_playable_smoke`.
- Launch mode: `interactiveTask`.
- Runtime mode: `game`.
- Console logging: enabled.
- Map: `dota`.
- Compact transcript command count: 4.
- Validation polling: 13 retry attempts before final success.

Validated marker evidence:

```text
[DOTA_WORKSHOP_MCP] addon loaded: playable_smoke_20260703_214855162_4lmj
[DOTA_WORKSHOP_MCP] gamemode initialized: playable_smoke_20260703_214855162_4lmj
[DOTA_WORKSHOP_MCP] round started: playable_smoke_20260703_214855162_4lmj
[DOTA_WORKSHOP_MCP] score updated: playable_smoke_20260703_214855162_4lmj
[DOTA_WORKSHOP_MCP] win condition reached: playable_smoke_20260703_214855162_4lmj
```

Additional observed evidence:

```text
[DOTA_WORKSHOP_MCP] target spawned: playable_smoke_20260703_214855162_4lmj npc_dota_creep_badguys_melee
[DOTA_WORKSHOP_MCP] score updated: playable_smoke_20260703_214855162_4lmj 1/3 source=think
[DOTA_WORKSHOP_MCP] score updated: playable_smoke_20260703_214855162_4lmj 2/3 source=think
[DOTA_WORKSHOP_MCP] score updated: playable_smoke_20260703_214855162_4lmj 3/3 source=think
```

## Runtime Caveat

A repeat smoke attempt failed while a previous smoke Dota process was still running:

```text
INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND
```

The failure was caused by remote interactive launch process matching, not by addon generation or marker validation. The known previous smoke Dota process was stopped by matching its smoke addon command line, and the current build smoke then passed. Automatic broad process cleanup remains out of scope for this phase.

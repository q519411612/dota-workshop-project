---
status: clean
reviewed_at: 2026-07-06
---

# Phase 12 Independent Review: Unit Ability Scaffolding MVP

## Review Scope

- `src/addon.ts`
- `src/remote.ts`
- `src/schemas.ts`
- `src/server.ts`
- `src/smoke.ts`
- `src/tools.ts`
- `tests/addon.test.ts`
- `tests/remote-operations.test.ts`
- `tests/smoke.test.ts`
- README and Dota Workshop skill references
- Phase 12 specification, plan, and verification evidence

## Findings

No blocking issues found.

## Checks Performed

- Invalid scaffold input is rejected before local writes and before remote command construction.
- Remote addon creation uses `renderAddonFiles` rather than a remote-only scaffold renderer.
- `run_playable_smoke` passes scaffold input into addon creation without adding scaffold runtime markers.
- Inspect evidence now requires a unit `AbilityN` reference to match a passive ability definition in `npc_abilities_custom.txt`.
- README and skill references describe KV scaffolding as generation and inspect evidence only.
- Secret scan found no private host, account, password, token, or key material in the repository.

## Residual Risk

- `npc_abilities_custom.txt` uses a minimal passive `ability_datadriven` scaffold. Runtime ability behavior remains intentionally unproven and must be handled by a later slice with separate log or console evidence.
- Inspect verifies linked scaffold structure, not full Dota KV semantic validity beyond this minimal passive ability shape.

## Review Outcome

Phase 12 is ready to commit and push after planning docs are marked complete.

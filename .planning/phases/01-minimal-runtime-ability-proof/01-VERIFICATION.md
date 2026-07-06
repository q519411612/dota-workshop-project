# Verification: Minimal Runtime Ability Proof

status: passed
date: 2026-07-07

## Commands

- `npm test -- tests/addon.test.ts tests/smoke.test.ts`
  - Result: passed.
  - Evidence: 2 test files passed, 37 tests passed.
- Red test check before implementation:
  - Result: failed as expected.
  - Evidence: schema stripped `abilityProof`, generated ability proof harness evidence was missing, smoke did not expect proof markers.
- `npm run typecheck`
  - Result: passed.
- `npm run build`
  - Result: passed.
- `git diff --check && npm run typecheck && npm test && npm run build && npm run verify:rc && npm run verify:handoff && npm run verify:milestone`
  - Result: passed.
  - Evidence: full test suite passed with 17 test files and 138 tests; RC, handoff, and milestone gates returned `ok: true`.

## Local Evidence

- `unitAbilityScaffold.abilityProof` is preserved by MCP input schemas.
- Proof generation writes `scripts/vscripts/abilities/<ability>.lua`.
- Ability KV links to the Lua file through `BaseClass` and `ScriptFile`.
- Inspect evidence reports `ability proof harness exists` when the local proof files and marker strings are present.
- Smoke validation includes ability proof markers only when `abilityProof` is requested.
- Fixture smoke passes when proof markers exist and fails when the requested proof marker is missing.

## Runtime Evidence State

- Local harness status: ready.
- Real Windows ability runtime evidence: pending.
- Reason: no same-machine or remote Windows Dota runtime was invoked for this slice, and no sanitized runtime log containing the ability proof marker was collected.

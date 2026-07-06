# Summary: Minimal Runtime Ability Proof

status: complete
date: 2026-07-07

## Delivered

- Added `unitAbilityScaffold.abilityProof` as the explicit switch for ability proof generation.
- Generated a minimal Lua ability proof file with deterministic loaded and spawned markers.
- Linked proof abilities from KV through `ability_lua` and `ScriptFile`.
- Added inspect evidence for local ability proof harness readiness.
- Added smoke validation expectations for ability proof markers only when the proof option is requested.
- Added local tests for schema parsing, generated files, KV links, marker helpers, inspect evidence, fixture validation success, and missing marker failure.

## Verified

- Targeted addon and smoke tests passed.
- Full local test suite passed.
- Build, typecheck, RC, handoff, and milestone gates passed.

## Boundary

- No real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connection, or UI automation was added.
- Real Windows runtime ability evidence remains pending until actual sanitized Dota logs contain the proof markers.

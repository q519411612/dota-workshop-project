# Requirements: v1.12 Minimal Runtime Ability Proof

**Created:** 2026-07-07
**Milestone:** v1.12 Minimal Runtime Ability Proof
**Status:** Active

## Goal

Add the smallest local ability proof harness on top of the existing unit and ability KV scaffold so reviewers can inspect generated Lua ability marker files, KV-to-Lua links, marker expectations, and validation contracts without claiming real runtime success unless sanitized Windows logs contain the expected marker evidence.

## Scope

### In Scope

- An explicit ability proof option on the existing unit ability scaffold.
- A minimal Lua ability marker file generated under `scripts/vscripts`.
- Ability KV linking the scaffolded ability to its Lua file.
- Local inspect evidence for ability proof harness readiness.
- Smoke marker expectations that include ability proof markers only when the proof option is requested.
- Tests for schema parsing, generated files, KV/Lua links, marker expectations, and validation contract behavior.
- GSD verification and independent review artifacts.

### Out of Scope

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, UI automation, or credential handling.
- Broad gameplay systems, Panorama, TypeScript-to-Lua, React, Excel-to-KV, or complex ability behavior.
- Claiming real runtime ability evidence without actual same-machine or remote Windows Dota runtime logs containing the expected ability proof marker.

## Requirements

### ABILITY-01 Explicit Ability Proof Option

Expose a deliberate option on the unit ability scaffold for the minimal runtime proof.

Acceptance:

- `unitAbilityScaffold.abilityProof` is parsed by the MCP input schemas.
- Existing scaffold behavior remains unchanged when `abilityProof` is omitted.
- Invalid unit and ability names continue to fail before files are written.

### ABILITY-02 Generated Ability Proof Files

Generate a minimal Lua ability marker proof when requested.

Acceptance:

- The generated addon includes an ability Lua file under `scripts/vscripts/abilities`.
- The file defines the requested ability class.
- The file emits deterministic `[DOTA_WORKSHOP_MCP]` ability proof markers.
- The generated file contains no private host, user, account, token, password, or machine path data.

### ABILITY-03 KV To Lua Link

Link the scaffolded KV ability to the generated Lua ability file.

Acceptance:

- `npc_units_custom.txt` still assigns the scaffold ability to the scaffold unit.
- `npc_abilities_custom.txt` uses a Lua ability base class when ability proof is requested.
- `npc_abilities_custom.txt` references the generated ability script path.
- Existing passive datadriven scaffold output remains available when ability proof is not requested.

### ABILITY-04 Marker Expectations And Validation Contract

Make ability proof validation explicit and reviewable.

Acceptance:

- Local marker expectation helpers return ability proof markers for the requested addon and ability.
- Smoke workflow validation includes ability proof markers only when `abilityProof` is requested.
- Fixture log validation can pass when the expected ability proof marker exists.
- Fixture log validation fails when a requested proof marker is missing.
- Absence of real Windows logs keeps real runtime ability evidence pending, not passed.

### ABILITY-05 Local Verification And Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted addon and smoke tests pass.
- `npm run build` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone` succeed.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome and note the real Windows runtime evidence state.

## Definition of Done

- [x] v1.12 requirements, roadmap, spec, and plan exist.
- [x] Ability proof scaffold is explicit and backwards compatible.
- [x] Generated Lua/KV files link the ability proof marker correctly.
- [x] Local tests prove marker expectations and validation behavior.
- [x] Real Windows runtime ability evidence is marked pending unless real logs prove it.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

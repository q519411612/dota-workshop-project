# Phase 12: Unit Ability Scaffolding MVP - Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.14 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Agents can generate, inspect, and remotely write a minimal custom unit plus linked custom ability KV scaffold without claiming full gameplay behavior.

## Background

The addon generator already writes an empty `npc_units_custom.txt` support file. The roadmap has intentionally deferred custom ability, item, unit, and hero generators until the playable smoke, placement, custom map, and score objective paths were validated. The next smallest slice is a schema-driven scaffold: write deterministic KV entries for one custom unit and one linked ability, expose evidence through inspect and remote command construction, and prove on real Windows that a scaffolded addon still launches and emits the existing runtime markers.

## Requirements

1. **Scaffold input**: `create_addon` and `run_playable_smoke` accept an optional `unitAbilityScaffold` with `unitName` and `abilityName`.
   - Current: `npc_units_custom.txt` is always empty and there is no ability file.
   - Target: Callers can request one custom unit plus one linked ability scaffold.
   - Acceptance: Schema tests parse valid scaffold input for addon creation and smoke.

2. **Validation before writes**: Scaffold names are validated before local file writes or remote command construction.
   - Current: Placement validates runtime unit names, but scaffold names are not accepted anywhere.
   - Target: `unitName` must start with `npc_` and `abilityName` must start with `ability_`, with lowercase letters, digits, and underscores only.
   - Acceptance: Invalid scaffold tests return `INVALID_SCAFFOLD` and prove no addon roots or remote commands are created.

3. **Unit KV generation**: Generated `npc_units_custom.txt` contains a deterministic unit scaffold when requested.
   - Current: The unit support file contains only an empty `DOTAUnits` root.
   - Target: The file contains the requested unit entry, safe base class fields, and `Ability1` pointing at the requested ability.
   - Acceptance: Fixture tests inspect exact unit and ability linkage strings.

4. **Ability KV generation**: Generated `npc_abilities_custom.txt` exists and contains a deterministic ability scaffold when requested.
   - Current: No ability support file is generated.
   - Target: The ability support file exists for generated addons and contains the requested ability entry when scaffold input is present.
   - Acceptance: Fixture tests inspect the ability file for `DOTAAbilities`, requested ability name, and passive behavior.

5. **Inspect evidence**: `inspect_addon` reports unit and ability scaffold evidence.
   - Current: Inspect reports only unit support file existence.
   - Target: Inspect reports ability support file existence and scaffold marker evidence when entries are present.
   - Acceptance: Inspect tests cover scaffold-present and scaffold-absent output.

6. **Remote parity**: Remote addon creation uses the same renderer and scaffold validation as local generation.
   - Current: Remote addon creation writes renderer output for existing files.
   - Target: Remote command construction writes both unit and ability support files with the same scaffold content.
   - Acceptance: Remote command-construction tests prove scaffold KV strings are present and invalid scaffold input creates no command.

7. **Smoke compatibility**: `run_playable_smoke` can create a scaffolded addon while preserving default marker validation.
   - Current: Smoke creates playable addons with optional placement, objective, and custom map inputs.
   - Target: Smoke passes scaffold input through addon creation but does not add custom unit or ability runtime markers in this slice.
   - Acceptance: Fixture smoke tests prove scaffolded smoke still expects only default, placement, objective, or caller-provided markers as appropriate.

8. **Documentation and scope fence**: README and skill references describe scaffolded KV generation and its limits.
   - Current: Docs say custom unit/ability generators are deferred.
   - Target: Docs explain this is a minimal scaffold, not a full gameplay generator, balancing, Lua ability behavior, item system, hero system, AI, or UI.
   - Acceptance: Documentation mentions `unitAbilityScaffold`, generated files, inspect evidence, and deferred behavior.

## Boundaries

**In scope:**

- Optional `unitAbilityScaffold` input for addon creation and playable smoke.
- Name validation for one custom unit and one custom ability.
- Deterministic KV generation for `npc_units_custom.txt` and `npc_abilities_custom.txt`.
- Local fixture and remote command parity through the shared renderer.
- Inspect evidence for scaffolded files and entries.
- Real Windows smoke proving scaffolded addons do not break the validated runtime marker loop.

**Out of scope:**

- Spawning the custom unit by default; placement remains the runtime spawn control surface.
- Proving the custom ability executes in Dota runtime; this phase only scaffolds KV.
- Lua ability behavior, modifiers, particles, sounds, balance tuning, item generation, hero generation, AI, Panorama UI, publishing, and Workshop upload.
- Silent fallback to empty files when invalid scaffold input is provided.

## Constraints

- Keep local Windows and remote Windows behind the same MCP input contract.
- Do not store private Windows target details or credentials in repository files.
- Preserve existing playable, placement, objective, and custom-map smoke behavior.
- Validation success must continue to require log evidence; scaffold generation alone is not runtime success.

## Acceptance Criteria

- [ ] `CreateAddonInputSchema` and `RunPlayableSmokeInputSchema` parse valid `unitAbilityScaffold`.
- [ ] Invalid scaffold names fail before local writes and before remote command construction.
- [ ] Generated unit KV contains the requested custom unit and `Ability1` link.
- [ ] Generated ability KV file exists and contains the requested custom ability scaffold.
- [ ] `inspect_addon` reports scaffold-present and scaffold-absent evidence.
- [ ] Remote addon command construction includes the unit and ability scaffold files through the shared renderer.
- [ ] Scaffolded playable smoke keeps existing marker expectations unchanged.
- [ ] Real Windows smoke with scaffold input validates existing runtime markers from `game/dota/console.log`.
- [ ] README and skill references document scaffold inputs, generated files, and deferred behavior.

## Edge Coverage

**Coverage:** 6/6 applicable edges resolved - 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| invalid input | R2 | covered | Invalid unit and ability names must return `INVALID_SCAFFOLD` before writes or remote commands. |
| default compatibility | R4/R7 | covered | Ability file exists by default, but smoke marker expectations do not change when scaffold input is absent. |
| remote parity | R6 | covered | Remote tests must assert scaffold strings in the generated command and no command on invalid input. |
| evidence boundary | R7/R8 | covered | Runtime validation proves existing markers only; docs must not claim ability execution. |
| overwrite safety | R2/R3 | covered | Existing addon replace behavior remains unchanged; scaffold validation runs before overwrite. |
| scope drift | R8 | covered | Docs explicitly defer full gameplay generators, ability behavior, items, heroes, AI, UI, and publishing. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved - 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not claim custom ability runtime execution from scaffold generation alone. | R7/R8 | resolved | verification: judgment |
| Must not silently fall back to empty scaffold files on invalid names. | R2 | resolved | verification: test |
| Must not introduce a remote-only scaffold renderer. | R6 | resolved | verification: test |
| Must not change default smoke expected markers when scaffold input is absent. | R7 | resolved | verification: test |
| Must not store private remote host, account, password, token, or Steam credentials. | R6 | resolved | verification: test |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.92 | 0.75 | met | One custom unit plus one linked ability scaffold. |
| Boundary Clarity | 0.90 | 0.70 | met | Runtime ability behavior and full generators are excluded. |
| Constraint Clarity | 0.82 | 0.65 | met | Shared renderer, no credential storage, marker evidence retained. |
| Acceptance Criteria | 0.88 | 0.70 | met | Schema, generation, inspect, remote, smoke, docs, and Windows checks are concrete. |
| Ambiguity | 0.14 | <=0.20 | met | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Empty unit support file exists; no ability file or scaffold input exists. |
| 2 | Simplifier | What is the smallest useful scaffold? | One unit and one linked ability KV scaffold. |
| 3 | Boundary Keeper | What is not part of this slice? | No ability execution, modifiers, balance, items, heroes, AI, UI, or publishing. |
| 4 | Failure Analyst | What would invalidate success? | Invalid input accepted, remote drift, default smoke drift, or runtime claims without log evidence. |

---

*Phase: 12-unit-ability-scaffolding-mvp*
*Spec created: 2026-07-06*

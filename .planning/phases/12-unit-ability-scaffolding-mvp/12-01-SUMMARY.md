# Phase 12 Summary: Unit Ability Scaffolding MVP

## Delivered

- Added optional `unitAbilityScaffold` input for `create_addon` and `run_playable_smoke`.
- Added scaffold validation for `unitName` and `abilityName`.
- Generated `scripts/npc/npc_units_custom.txt` with a deterministic custom unit and `Ability1` link.
- Generated `scripts/npc/npc_abilities_custom.txt` with a deterministic passive custom ability scaffold.
- Added ability support file generation even when no scaffold is requested.
- Added local inspect evidence for ability file existence and linked scaffold structure.
- Passed scaffold input through remote addon creation and smoke workflow.
- Kept smoke validation markers unchanged for scaffold input.
- Updated README and skill references with the scaffold input, generated files, inspect guidance, and deferred runtime behavior boundaries.

## Tests Added

- Schema parsing for `unitAbilityScaffold`.
- Default ability support file generation.
- Scaffolded unit and ability KV generation.
- Invalid local scaffold rejection.
- Inspect scaffold-present, scaffold-absent, and mismatched-link evidence.
- Remote scaffold command rendering.
- Invalid remote scaffold command suppression.
- Scaffolded smoke compatibility without scaffold runtime markers.

## Verification

- Local verification passed with 88 tests.
- Build passed.
- Manifest and documentation checks passed.
- Secret scan found no repository credential leakage.
- Real Windows scaffolded smoke passed with addon `scaffold_20260705231402`.
- Explicit cleanup stopped only the matching smoke Dota process.

## Next Work

Continue with Panorama/toolchain boundary and publishing preflight slices. Keep runtime ability behavior, custom unit spawning, item/hero systems, complex AI, and balancing deferred until the roadmap introduces specific validation criteria.

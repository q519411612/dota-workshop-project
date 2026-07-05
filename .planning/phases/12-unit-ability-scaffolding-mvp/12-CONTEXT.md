# Phase 12: Unit Ability Scaffolding MVP - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning
**Mode:** Auto-selected from autonomous roadmap instruction

<domain>
## Phase Boundary

Add a minimal schema-driven custom unit plus linked custom ability KV scaffold to generated addons. The phase proves deterministic file generation, inspection, remote command parity, and smoke compatibility. It does not prove custom ability runtime behavior.

</domain>

<decisions>
## Implementation Decisions

- The input key is `unitAbilityScaffold`.
- The scaffold contains exactly `unitName` and `abilityName` in this slice.
- `unitName` must start with `npc_`; `abilityName` must start with `ability_`.
- Generated addons should include `scripts/npc/npc_abilities_custom.txt` even when no scaffold is requested.
- `npc_units_custom.txt` remains an empty `DOTAUnits` root when no scaffold is requested.
- Smoke passes scaffold input through creation but does not add custom scaffold runtime markers.
- Real Windows validation should launch a scaffolded playable addon and validate existing runtime markers only.

</decisions>

<code_context>
## Existing Code Insights

- `src/addon.ts` owns validation, renderer output, local writes, inspect evidence, and generated KV helpers.
- `src/remote.ts` calls `renderAddonFiles`, so shared renderer changes can keep local and remote content aligned.
- `src/schemas.ts` and `src/server.ts` expose MCP input contracts.
- `src/smoke.ts` passes creation options through local and remote addon creation.
- Existing tests for placement and objective provide the closest patterns for schema parsing, invalid-input rejection, inspect evidence, remote command construction, and smoke compatibility.

</code_context>

<specifics>
## Specific Ideas

- Add `UnitAbilityScaffold` type with `unitName` and `abilityName`.
- Add `validateUnitAbilityScaffold`.
- Add an `abilityData` file path and renderer field.
- Use deterministic passive ability KV and a small creature unit KV with `Ability1`.
- Inspect should report ability support file existence and scaffold entries when present.

</specifics>

<deferred>
## Deferred Ideas

- Lua ability behavior and modifiers.
- Runtime custom ability execution markers.
- Custom item, hero, AI, and UI generation.
- Balance tuning, particles, sounds, publishing, and Workshop upload.

</deferred>

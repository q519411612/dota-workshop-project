# Phase 6 Summary: Playable Gameplay Loop MVP

## Outcome

v2 extends the v1.1 runtime marker loop into a minimal playable Dota 2 custom game prototype generator. The default generated addon now includes a small Lua game mode with initialization, round start, score update, and win-condition markers, and validation can require multiple runtime markers from readable console logs.

## Delivered

- Added v2 API research documents under `.planning/research/`.
- Updated PROJECT, REQUIREMENTS, ROADMAP, and STATE for v2.
- Added a default `playable` addon template and kept `template: "minimal"` for marker-only generation.
- Generated `scripts/npc/npc_units_custom.txt` as part of the support-file set.
- Added playable Lua markers for gamemode initialization, round start, target spawn, score update, and win condition.
- Added shared marker validation helpers and `expectedMarkers` support for local and remote validation.
- Updated remote addon creation to render the same template content as local creation.
- Updated README and skill references for the playable workflow.

## Evidence

- Fixture tests verify playable template generation, Lua marker content, support files, inspect evidence, and minimal-template compatibility.
- Local validation tests verify multiple expected markers and missing-marker failure.
- Remote validation tests verify multiple expected markers, missing-marker failure, and remote creation command parity.
- Build output in `dist/` was regenerated.

## Runtime Notes

- v1.1 real Windows console evidence remains the verified basis for `game/dota/console.log` marker validation.
- v2 spawn details that depend on `Vector(0, 0, 256)` and `npc_dota_creep_badguys_melee` remain candidates until a real Windows gameplay smoke run confirms them.
- No private hostnames, credentials, Steam secrets, tokens, or machine-specific target data were written to the repository.

## Requirements

- API2-01 through API2-03 are implemented.
- GAME2-01 through GAME2-05 are implemented.
- MCP2-01 through MCP2-04 are implemented.
- DOC2-01 and DOC2-02 are implemented.


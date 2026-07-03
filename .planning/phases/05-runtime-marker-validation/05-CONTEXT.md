# Phase 5 Context: Runtime Marker Validation

## Purpose

Phase 5 closes the remaining validation gap: prove that a generated addon reaches Dota Lua runtime by reading the generated marker from a real Dota console log.

## Current Evidence

- Remote interactive launch with `-tools` opens the Workshop Tools addon context and writes addon-scoped tooling artifacts.
- Remote interactive custom game launch with `-tools` did not surface the Lua marker.
- Remote interactive custom game launch without `-tools` and with `-condebug` produced `game/dota/console.log`.
- That console log included `[VScript] [DOTA_WORKSHOP_MCP] addon loaded: <addon>`, proving Lua `Activate()` executed.

## Decisions

- Keep `launch_tools` and Workshop Tools editor behavior unchanged.
- Add explicit runtime launch controls to `launch_custom_game`; do not silently infer runtime mode.
- Use console log evidence from `game/dota/console.log` for v1.1 runtime validation.
- Treat marker matching as substring matching inside a log line because Dota prefixes script output with channel and timestamp data.

## Boundaries

- Do not introduce gameplay generation.
- Do not require a compiled custom map for v1.1; the real target demonstrated runtime marker execution on the `dota` map.
- Do not store credentials, hostnames, private IP addresses, Steam credentials, or machine-specific secrets.

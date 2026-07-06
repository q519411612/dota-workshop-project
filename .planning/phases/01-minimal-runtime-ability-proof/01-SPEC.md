# Phase 1: Minimal Runtime Ability Proof - Spec

**Status:** Ready for implementation
**Date:** 2026-07-07

## Intent

Extend the existing unit ability scaffold with an explicit minimal ability proof harness. The local slice should prove generated file structure, KV-to-Lua linkage, expected marker contracts, and smoke validation behavior without claiming real runtime ability execution unless sanitized Windows Dota logs contain the expected marker.

## Functional Contract

- `unitAbilityScaffold.abilityProof` requests the proof harness.
- Existing unit ability scaffold output remains unchanged when the proof option is omitted.
- Proof generation writes a Lua ability file under `scripts/vscripts/abilities`.
- The ability KV uses a Lua base class and links to the generated script path.
- The generated Lua emits deterministic `[DOTA_WORKSHOP_MCP] ability proof ...` markers.
- Inspect evidence reports whether the ability proof harness is present.
- Smoke validation expects ability proof markers only when the proof option is requested.

## Boundary Contract

- No Workshop upload.
- No Steam login or Steam Guard handling.
- No content encryption.
- No package signing.
- No archive creation.
- No registry or package publishing.
- No global installation or environment mutation.
- No remote Windows connection.
- No real runtime ability pass without actual sanitized Windows log evidence.
- No broad gameplay, Panorama, TypeScript-to-Lua, React, or Excel-to-KV expansion.

## Acceptance Checks

- Tests prove schema parsing for the explicit proof option.
- Tests prove generated Lua ability file contents.
- Tests prove unit KV and ability KV linkage.
- Tests prove inspect evidence distinguishes harness readiness.
- Tests prove smoke validation passes with fixture proof markers and fails when proof markers are missing.
- Verification artifacts record local harness readiness and real Windows runtime evidence as pending.

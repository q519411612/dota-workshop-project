# Phase 10: Custom Map Spawn Point MVP - Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.13 (gate: <= 0.20)
**Requirements:** 7 locked

## Goal

Agents can prepare and validate a launchable custom map derived from the installed Dota Workshop `addon_template` map, with explicit evidence that the source map contains player spawn entities before runtime launch validation.

## Background

The project can generate playable addons, launch stock `dota`, validate gameplay markers, configure runtime placement vectors, and clean up addon-scoped Dota processes. It does not yet prepare a compiled custom map. Remote Windows investigation on 2026-07-06 found `resourcecompiler.exe` at the Dota install root and an installed binary DMX template map at `content/dota_addons/addon_template/maps/template_map.vmap`. That template source contains `info_player_start_goodguys`, `info_player_start_badguys`, and courier/game event entity names. Directly editing binary DMX map content is not rigorous enough for this slice; the minimum reliable map milestone is copying the installed template map, verifying spawn entity names in the source, compiling it with `resourcecompiler.exe`, updating addon metadata to launch the custom map, and validating runtime markers on that map.

## Requirements

1. **Map preparation tool**: Expose a typed MCP operation that prepares a custom map for an existing addon.
   - Current: MCP tools can create addons and launch maps, but no tool copies or compiles a custom map.
   - Target: `prepare_custom_map` accepts the existing target schema, `addonName`, `mapName`, optional `templateAddonName`, optional `templateMapName`, and optional `replace`.
   - Acceptance: Schema parsing, tool registration, dispatcher routing, and server registration tests cover `prepare_custom_map`.

2. **Template source copy**: Copy the installed template `.vmap` into the selected addon's content map directory without overwriting unless requested.
   - Current: Generated addons create `content/dota_addons/<addon>/maps/` but do not write a real `.vmap`.
   - Target: The tool copies `<dotaRoot>/content/dota_addons/addon_template/maps/template_map.vmap` to `<dotaRoot>/content/dota_addons/<addon>/maps/<mapName>.vmap` by default.
   - Acceptance: Fixture and command-construction tests prove source and destination paths, replacement behavior, and existing destination rejection.

3. **Spawn entity evidence**: Verify copied map source contains known player spawn entity names before reporting map preparation success.
   - Current: Runtime placement proves Lua vector spawn, not map-authored spawn points.
   - Target: The tool checks the copied source for `info_player_start_goodguys` and `info_player_start_badguys` and records those markers as evidence.
   - Acceptance: Tests cover success with both markers and explicit failure when either marker is missing.

4. **Windows compilation**: Compile the copied `.vmap` through `resourcecompiler.exe` on local or remote Windows targets.
   - Current: Launch can reference a map name, but no compile operation exists.
   - Target: Local Windows and remote Windows use the same logical tool contract and return `resourcecompiler.exe` command evidence, stdout, stderr, exit code, source path, and expected compiled map path.
   - Acceptance: Fixture tests cover command construction; real Windows validation must show `resourcecompiler.exe` exit code 0 before runtime launch is counted as validated.

5. **No silent fallback**: Fail explicitly when the template source, spawn markers, Dota root, compiler, target map output, or remote command fails.
   - Current: Map absence can only surface later as launch or marker failure.
   - Target: `prepare_custom_map` returns stable error codes and evidence for missing or unsafe inputs before launch.
   - Acceptance: Tests cover invalid addon/map names, missing target root, missing template source, missing compiler, missing spawn entity marker, existing map without replacement, and compile failure.

6. **Smoke composition**: Provide a repeatable custom-map smoke path using existing addon creation, custom map preparation, custom map launch, marker validation, and cleanup.
   - Current: `run_playable_smoke` launches stock `dota` by default and can accept a map name only if it already exists.
   - Target: `run_playable_smoke` can optionally prepare a custom map before launch when given `customMap`, preserving default stock-map behavior.
   - Acceptance: Tests prove default smoke behavior is unchanged and custom-map smoke invokes map preparation before launch; real Windows smoke validates gameplay markers from `console.log` on the custom map.

7. **Documentation and scope fence**: Document the custom-map MVP and keep binary Hammer entity editing out of this slice.
   - Current: Docs say custom map spawn points are deferred.
   - Target: README and skill references explain template-map preparation, compiler requirements, spawn entity evidence, and the boundary that this does not edit binary `.vmap` spawn coordinates.
   - Acceptance: Skill/reference validation finds custom-map guidance and deferred binary entity editing language.

## Boundaries

**In scope:**
- A new `prepare_custom_map` MCP operation.
- Fixture/local/remote target input shape parity.
- Copying the installed `addon_template` `.vmap` into generated addon content.
- Verifying spawn entity names in copied map source.
- Running `resourcecompiler.exe` for local or remote Windows targets.
- Optional `customMap` orchestration inside `run_playable_smoke`.
- Real Windows validation that compiles and launches the custom map with runtime marker evidence.

**Out of scope:**
- Binary DMX `.vmap` spawn coordinate editing - current template map is binary and direct patching would be brittle.
- Hammer UI automation - project prefers deterministic command/file operations.
- Generating a map from scratch - no stable text map schema is verified yet.
- Complex lane, objective, navigation, or pathing design - later gameplay objective work.
- Publishing or workshop upload behavior - later publishing prerequisite work.

## Constraints

- Default template source is `content/dota_addons/addon_template/maps/template_map.vmap`.
- Default output map name should be safe and Dota map-name validated.
- The operation must refuse unsafe addon and map names before command construction.
- Remote Windows commands must not persist private host, username, password, Steam credentials, or machine secrets in repository files.
- Validation success requires compile evidence and runtime marker evidence; process launch alone is insufficient.

## Acceptance Criteria

- [x] `prepare_custom_map` schema, dispatcher, and server registration exist.
- [x] `prepare_custom_map` rejects unsafe addon names and unsafe map names before command construction.
- [x] `prepare_custom_map` rejects missing target roots, missing template source, missing compiler, existing destination without `replace`, missing spawn markers, and compile failure with explicit evidence.
- [x] Fixture tests prove template copy, spawn marker evidence, and result paths without a real Dota install.
- [x] Remote command tests prove `resourcecompiler.exe` command construction and result evidence.
- [x] `run_playable_smoke` default stock-map behavior is unchanged.
- [x] `run_playable_smoke` with `customMap` prepares the custom map before launch and validates gameplay markers.
- [x] Real Windows validation compiles a copied template map with `resourcecompiler.exe` exit code 0.
- [x] Real Windows validation launches the custom map and finds gameplay markers in remote `game/dota/console.log`.
- [x] README and skill references document the custom-map workflow and binary map-editing boundary.

## Completion Notes

Real Windows validation on 2026-07-06 showed `resourcecompiler.exe -game` requires the `game/dota` directory and the compiled template map output is `<map>.vpk`. The implementation records that `.vpk` path as `compiledMap`.

## Edge Coverage

**Coverage:** 8/8 applicable edges resolved - 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| invalid input | R1, R5 | covered | Acceptance criteria require unsafe addon/map rejection before command construction. |
| overwrite safety | R2, R5 | covered | Existing destination without `replace` must fail. |
| missing dependency | R4, R5 | covered | Missing compiler and template source must fail explicitly. |
| content validation | R3 | covered | Missing spawn entity marker must fail explicitly. |
| remote failure | R4, R5 | covered | Compile failure must include remote command evidence. |
| default compatibility | R6 | covered | Default `run_playable_smoke` behavior must remain unchanged. |
| runtime evidence | R6 | covered | Real Windows validation requires runtime log markers. |
| scope drift | R7 | covered | Binary map entity editing is documented out of scope. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved - 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not edit binary `.vmap` entity coordinates in this slice. | R7 | resolved | Judgment review and documentation check. |
| Must not report map validation success from process launch alone. | R4, R6 | resolved | Real Windows verification must include compile and log marker evidence. |
| Must not overwrite existing map source unless `replace` is true. | R2 | resolved | Fixture tests. |
| Must not fall back from remote Windows to local behavior on command failure. | R4, R5 | resolved | Remote failure tests. |
| Must not persist private target credentials in repo artifacts. | R4, R6 | resolved | Secret scan. |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes |
|--------------------|-------|------|--------|-------|
| Goal Clarity       | 0.90  | 0.75 | met    | Outcome is custom-map preparation plus runtime validation. |
| Boundary Clarity   | 0.88  | 0.70 | met    | Binary map editing and Hammer automation are excluded. |
| Constraint Clarity | 0.82  | 0.65 | met    | Compiler, template source, remote evidence, and secrets constraints are explicit. |
| Acceptance Criteria| 0.86  | 0.70 | met    | Fixture, command, docs, and real Windows checks are enumerated. |
| **Ambiguity**      | 0.13  | <=0.20 | met | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Runtime placement exists; custom map preparation and compilation do not. |
| 2 | Simplifier | What is the irreducible custom-map slice? | Copy installed template `.vmap`, verify spawn entity names, compile, launch, validate markers. |
| 3 | Boundary Keeper | What is not included? | No binary `.vmap` coordinate editing, no Hammer UI automation, no generated map from scratch. |
| 4 | Failure Analyst | What would invalidate success? | Missing compiler/source/spawn markers, compile failure, launch-only evidence, or credential leakage. |

---

*Phase: 10-custom-map-spawn-point-mvp*
*Spec created: 2026-07-06*
*Next step: implementation planning*

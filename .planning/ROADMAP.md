# Roadmap: Dota Workshop Project

**Created:** 2026-07-03
**Mode:** Vertical MVP
**Granularity:** Coarse
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 1 | Plugin and Skill Foundation | Load a plugin project with a focused Dota 2 Workshop Tools skill and progressively loaded references. | PLUG-01, PLUG-02, PLUG-03, SKIL-01, SKIL-02, SKIL-03, SKIL-04 | Complete |
| 2 | MCP Contract and Addon Template | Expose typed MCP tools and generate/inspect a minimal addon template in fixtures before touching a real Dota install. | MCP-01, MCP-02, MCP-03, MCP-04, ADDN-01, ADDN-02, ADDN-03, ADDN-04, ADDN-05, ADDN-06 | Complete |
| 3 | Local Windows Workshop Validation | Discover a local Windows Dota install, launch Workshop Tools/custom game candidates, and validate with logs or console evidence. | ENV-01, ENV-02, ENV-03, ENV-04, LNCH-01, LNCH-03, LNCH-04, VALD-01, VALD-02, VALD-03, VALD-04 | Complete |
| 4 | Remote Windows Target Support | Run the same MCP workflows against a remote Windows target through SSH or PowerShell Remoting. | REMT-01, REMT-02, REMT-03, REMT-04, LNCH-02 | Complete |
| 5 | Runtime Marker Validation | Launch a generated addon in Dota game runtime mode and validate the Lua marker from readable console logs. | RTVL-01, RTVL-02, RTVL-03, RTVL-04, RTVL-05 | Complete |
| 6 | Playable Gameplay Loop MVP | Generate a minimal playable Lua gameplay loop and validate gameplay markers through the existing runtime console log path. | API2-01, API2-02, API2-03, GAME2-01, GAME2-02, GAME2-03, GAME2-04, GAME2-05, MCP2-01, MCP2-02, MCP2-03, MCP2-04, DOC2-01, DOC2-02 | Complete |
| 7 | Repeatable Playable Smoke Workflow | Package the verified playable runtime smoke path into one repeatable MCP workflow with safe transcript output. | SMOK2-01, SMOK2-02, SMOK2-03, SMOK2-04, SMOK2-05, SMOK2-06, SMOK2-07, SMOK2-08 | Complete |
| 8 | Safe Smoke Cleanup Controls | Add explicit dry-run and execute cleanup for known smoke Dota processes before or after repeat playable smoke runs. | CLEN2-01, CLEN2-02, CLEN2-03, CLEN2-04, CLEN2-05, CLEN2-06, CLEN2-07, CLEN2-08, CLEN2-09, CLEN2-10 | Complete |
| 9 | Runtime Placement MVP | Add deterministic spawn placement configuration and validation markers to the playable template without introducing map editing. | PLAC2-01, PLAC2-02, PLAC2-03, PLAC2-04, PLAC2-05, PLAC2-06, PLAC2-07, PLAC2-08 | Complete |
| 10 | Custom Map Spawn Point MVP | Prepare, compile, launch, and validate a custom map copied from the installed Workshop template with spawn entity evidence. | MAP2-01, MAP2-02, MAP2-03, MAP2-04, MAP2-05, MAP2-06, MAP2-07, MAP2-08 | Complete |

## Phase Details

### Phase 1: Plugin and Skill Foundation

**Goal:** Load a plugin project with a focused Dota 2 Workshop Tools skill and progressively loaded references.
**Mode:** mvp

**Requirements:** PLUG-01, PLUG-02, PLUG-03, SKIL-01, SKIL-02, SKIL-03, SKIL-04

**Success Criteria**:

1. The plugin manifest validates and references only files that exist in the project.
2. The skill triggers for Dota 2 Workshop Tools, addon, Lua gamemode, Panorama, and validation requests.
3. The skill tells the agent when to use MCP tools instead of guessing paths or commands.
4. Skill references cover addon layout, launch flow, remote control, minimal templates, and troubleshooting.
5. Deferred workflows are explicitly marked so v1 does not drift into TypeScript-to-Lua, React Panorama, ability generation, or Workshop publishing.

**Notes:**

- This phase should use plugin and skill scaffolding helpers where practical.
- The plugin does not need to be globally installed to pass this phase; project-local validation is enough.

### Phase 2: MCP Contract and Addon Template

**Goal:** Expose typed MCP tools and generate/inspect a minimal addon template in fixtures before touching a real Dota install.
**Mode:** mvp

**Requirements:** MCP-01, MCP-02, MCP-03, MCP-04, ADDN-01, ADDN-02, ADDN-03, ADDN-04, ADDN-05, ADDN-06

**Success Criteria**:

1. MCP tool schemas require explicit target selection and return structured results with success state, operation, evidence, warnings, paths, commands, and logs.
2. Error results include stable error codes and actionable messages.
3. The addon generator validates names and refuses accidental overwrite.
4. The generated fixture contains the minimal `game/dota_addons/<addon>` and `content/dota_addons/<addon>` structure.
5. The generated Lua entry point includes a startup validation marker that later validation can search for.

**Notes:**

- This phase should be verifiable on macOS without a real Dota install through fixture tests and schema tests.
- Addon metadata format should remain configurable until current Workshop Tools behavior is validated on Windows.

### Phase 3: Local Windows Workshop Validation

**Goal:** Discover a local Windows Dota install, launch Workshop Tools/custom game candidates, and validate with logs or console evidence.
**Mode:** mvp

**Requirements:** ENV-01, ENV-02, ENV-03, ENV-04, LNCH-01, LNCH-03, LNCH-04, VALD-01, VALD-02, VALD-03, VALD-04

**Success Criteria**:

1. The local adapter discovers or accepts a Dota install root and verifies expected binaries and addon directories.
2. Missing Steam, missing Dota 2, missing Workshop Tools paths, unsupported OS, or invalid override paths produce explicit failures.
3. The local adapter can launch Workshop Tools for a selected addon.
4. The local adapter can attempt a target-validated custom game launch for a selected addon and map.
5. Validation reports success only when expected log or console evidence is present, and returns a concise transcript for review.

**Notes:**

- The candidate launch command from research is `dota2.exe -novid -tools -addon <addon>` with `+dota_launch_custom_game <addon> <map>` when launching a map.
- This phase must verify the candidate command on the actual target Windows environment before treating it as stable.

### Phase 4: Remote Windows Target Support

**Goal:** Run the same MCP workflows against a remote Windows target through SSH or PowerShell Remoting.
**Mode:** mvp

**Requirements:** REMT-01, REMT-02, REMT-03, REMT-04, LNCH-02

**Success Criteria**:

1. The user can configure a remote Windows target for SSH or PowerShell Remoting.
2. Remote environment discovery uses the same logical MCP tool interface as local Windows discovery.
3. Remote file and process operations return stdout, stderr, exit code, attempted command, and target metadata.
4. Remote failures do not silently fall back to local behavior.
5. The remote adapter can launch Workshop Tools for a selected addon through the same user-facing tool contract.

**Notes:**

- Remote validation should reuse the launch and log-reading concepts proven in the local Windows phase.
- If no remote machine is available during implementation, this phase should still ship command adapter tests and a documented manual smoke checklist.

### Phase 5: Runtime Marker Validation

**Goal:** Launch a generated addon in Dota game runtime mode and validate the Lua marker from readable console logs.
**Mode:** mvp

**Requirements:** RTVL-01, RTVL-02, RTVL-03, RTVL-04, RTVL-05

**Success Criteria**:

1. `launch_custom_game` can request a game runtime launch without `-tools` while preserving Workshop Tools launch behavior.
2. `launch_custom_game` can enable console logging with Dota's `-condebug` output.
3. Local and remote validation can read Dota `game/dota/console.log` when present.
4. Marker validation succeeds when the expected marker appears inside a console log line with Dota prefixes such as `[VScript]`.
5. Real remote smoke evidence proves the generated addon reaches Lua `Activate()` and the marker appears in a readable log.

**Notes:**

- Real remote investigation showed `-tools` opens the addon/tooling context but does not provide sufficient evidence that Lua runtime executed.
- Real remote investigation showed non-tools custom game launch with `-condebug` writes `game/dota/console.log`, including `[VScript] [DOTA_WORKSHOP_MCP] addon loaded: <addon>`.
- Runtime validation must remain evidence-driven; process start or Workshop Tools asset cache writes are not enough.

### Phase 6: Playable Gameplay Loop MVP

**Goal:** Generate a minimal playable Lua gameplay loop and validate gameplay markers through the existing runtime console log path.
**Mode:** mvp

**Requirements:** API2-01, API2-02, API2-03, GAME2-01, GAME2-02, GAME2-03, GAME2-04, GAME2-05, MCP2-01, MCP2-02, MCP2-03, MCP2-04, DOC2-01, DOC2-02

**Success Criteria**:

1. v2 API research documents exist and distinguish verified, community-documented, inaccessible, and candidate evidence.
2. The generated playable template includes Lua initialization, round start, score update, win-condition logic, and gameplay markers.
3. The generated addon preserves the v1.1 addon runtime marker and includes needed metadata/KV support files.
4. `inspect_addon` reports gameplay marker and support-file evidence.
5. `validate_addon` can require multiple gameplay markers in local and remote log validation.
6. README and skill references guide the user through playable generation, runtime launch, log reading, and marker validation.

**Notes:**

- Use `game/dota/console.log` and substring marker matching from v1.1.
- Use `SetContextThink` for the minimal validation tick instead of importing a Timers framework.
- Keep stock `dota` map validation for runtime markers; custom map spawn points are deferred.
- Real Windows runtime smoke on 2026-07-04 validated the required gameplay markers and optional built-in creep spawn marker on the stock `dota` map.
- `GameRules:SetCustomGameForceHero` was rejected by current runtime smoke and is not part of the stable v2 template.

### Phase 7: Repeatable Playable Smoke Workflow

**Goal:** Package the verified playable runtime smoke path into one repeatable MCP workflow with safe transcript output.
**Mode:** mvp

**Requirements:** SMOK2-01, SMOK2-02, SMOK2-03, SMOK2-04, SMOK2-05, SMOK2-06, SMOK2-07, SMOK2-08

**Success Criteria**:

1. A single MCP operation can generate a unique playable smoke addon, inspect it, launch game runtime mode, and validate the required marker set.
2. The workflow works through the same target schema for fixture, local, and remote targets, with remote launch options such as `interactiveTask` available when needed.
3. The smoke transcript exposes operation outcomes, command evidence, paths, marker evidence, logs, warnings, and the generated addon name.
4. Failure at any workflow operation stops the workflow with explicit evidence and does not report partial success as validation success.
5. Documentation explains repeatable local and remote playable smoke usage without persisting private target or credential details.

**Notes:**

- Default addon names should be generated from a safe prefix plus timestamp-like uniqueness.
- Default launch settings should be `runtimeMode: "game"`, `consoleLog: true`, `mapName: "dota"`, and required gameplay markers.
- Cleanup of target files or processes is not automatic in this phase; destructive target cleanup requires an explicit future design.
- Real Windows runtime smoke on 2026-07-04 validated `run_playable_smoke` with remote `interactiveTask`, marker polling, and a compact transcript after stopping a previous smoke Dota process by matching its smoke addon command line.

### Phase 8: Safe Smoke Cleanup Controls

**Goal:** Add explicit dry-run and execute cleanup for known smoke Dota processes before or after repeat playable smoke runs.
**Mode:** mvp

**Requirements:** CLEN2-01, CLEN2-02, CLEN2-03, CLEN2-04, CLEN2-05, CLEN2-06, CLEN2-07, CLEN2-08, CLEN2-09, CLEN2-10

**Success Criteria**:

1. `cleanup_playable_smoke` is exposed through MCP schemas, dispatcher, and server registration without changing the `run_playable_smoke` execution path.
2. Local and remote targets share the same cleanup input contract and return the same result shape.
3. Dry-run cleanup reports matching Dota process candidates for the requested addon without stopping anything.
4. Execute cleanup stops only Dota-related processes whose command line explicitly contains the requested addon name.
5. Fixture tests cover command construction, no-match, invalid addon name, remote command failure, dry-run, execute mode, and MCP exposure.
6. README and skill references describe the explicit cleanup workflow for repeat playable smoke runs.

**Notes:**

- The cleanup operation must never delete generated addon files.
- The cleanup operation must never stop Steam and must not perform a broad Dota process kill.
- A no-match result should be explicit and auditable; it is a successful inspection of the target state, not a hidden fallback.
- Real Windows cleanup and repeat smoke validation can run only when runtime target access is provided.
- Implementation added `cleanup_playable_smoke`, dry-run default behavior, execute mode, local/remote command construction tests, explicit no-match evidence, remote failure evidence, and documentation.

### Phase 9: Runtime Placement MVP

**Goal:** Add deterministic spawn placement configuration and validation markers to the playable template without introducing map editing.
**Mode:** mvp

**Requirements:** PLAC2-01, PLAC2-02, PLAC2-03, PLAC2-04, PLAC2-05, PLAC2-06, PLAC2-07, PLAC2-08

**Success Criteria**:

1. `create_addon` accepts optional placement configuration for the playable template and rejects invalid unit names, teams, or vector values before writing files.
2. The playable Lua template emits placement markers that validation can search for through existing `validate_addon` and `run_playable_smoke` paths.
3. `inspect_addon` reports placement configuration and marker evidence when placement is present.
4. Remote addon generation reuses the same renderer and command contract as local generation.
5. Fixture tests cover local generation, remote command construction, smoke marker validation, invalid placement, and default-path compatibility.
6. README and skill references explain runtime placement while keeping custom map editing, Hammer UI automation, complex objectives, and unit/ability generators deferred.

**Notes:**

- This phase controls runtime placement on stock launchable maps; it does not generate or edit Hammer maps.
- The default playable template must remain compatible with v2/v2.1/v2.2 smoke tests.
- Placement validation remains evidence-driven and uses log markers, not process launch success.
- Implementation added optional placement input, placement validation, generated Lua placement markers, inspect evidence, smoke marker expansion, remote renderer parity, fixture tests, and documentation.

### Phase 10: Custom Map Spawn Point MVP

**Goal:** Prepare, compile, launch, and validate a custom map copied from the installed Workshop template with spawn entity evidence.
**Mode:** mvp

**Requirements:** MAP2-01, MAP2-02, MAP2-03, MAP2-04, MAP2-05, MAP2-06, MAP2-07, MAP2-08

**Success Criteria**:

1. `prepare_custom_map` is exposed through MCP schemas, dispatcher, and server registration.
2. The tool copies the installed `addon_template/maps/template_map.vmap` into the selected addon's content map directory and rejects existing output unless replacement is requested.
3. The copied source is inspected for `info_player_start_goodguys` and `info_player_start_badguys` before success is reported.
4. Local and remote Windows compile paths use `resourcecompiler.exe` and return command evidence, output, exit code, paths, warnings, and logs.
5. `run_playable_smoke` can optionally prepare the custom map before launch while preserving default stock-map behavior.
6. Real Windows validation compiles the custom map, launches it, validates runtime gameplay markers from `game/dota/console.log`, and uses addon-scoped cleanup afterward.

**Notes:**

- This phase uses the installed Workshop template map as the deterministic source of spawn entities.
- This phase does not edit binary `.vmap` spawn coordinates and does not automate Hammer UI.
- Custom map validation remains evidence-driven: compile success plus runtime log markers are required.
- Implementation added `prepare_custom_map`, custom-map smoke orchestration, local/remote command evidence, `.vpk` output verification, fixture and remote tests, and documentation.
- Real Windows custom-map smoke passed on 2026-07-06 using the remote SSH target adapter without storing private target credentials in the repository. The run copied `addon_template/maps/template_map.vmap`, verified `info_player_start_goodguys` and `info_player_start_badguys`, compiled `template_spawn_smoke.vpk` with `resourcecompiler.exe`, launched the custom map with remote `interactiveTask`, validated all gameplay markers from `game/dota/console.log`, and cleaned up only the matching Dota process.
- Real compiler validation showed `resourcecompiler.exe -game` must receive the `game/dota` directory, not `game/dota/gameinfo.gi`, and the map output for this template is `<map>.vpk`.

## Coverage

| Metric | Count |
|--------|-------|
| v1 requirements | 33 |
| v1.1 requirements | 5 |
| v2 MVP requirements | 14 |
| v2.1 requirements | 8 |
| v2.2 requirements | 10 |
| v2.3 requirements | 8 |
| v2.4 requirements | 8 |
| Mapped requirements | 86 |
| Unmapped requirements | 0 |
| Phases | 10 |

## Deferred Scope

- Binary Hammer map entity editing.
- Ability, item, unit, and hero generators.
- React Panorama generation.
- TypeScript-to-Lua project templates.
- Excel-to-KV workflows.
- Workshop publishing and encryption.
- UI automation as a primary control strategy.

---
*Roadmap updated: 2026-07-06 for v2.4 custom map spawn point MVP*

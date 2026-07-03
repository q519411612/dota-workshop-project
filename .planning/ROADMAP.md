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

## Coverage

| Metric | Count |
|--------|-------|
| v1 requirements | 33 |
| v1.1 requirements | 5 |
| v2 MVP requirements | 14 |
| Mapped requirements | 52 |
| Unmapped requirements | 0 |
| Phases | 6 |

## Deferred Scope

- Ability, item, unit, and hero generators.
- React Panorama generation.
- TypeScript-to-Lua project templates.
- Excel-to-KV workflows.
- Workshop publishing and encryption.
- UI automation as a primary control strategy.

---
*Roadmap updated: 2026-07-03 after v2 playable gameplay loop implementation*

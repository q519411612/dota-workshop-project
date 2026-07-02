# Roadmap: Dota Workshop Project

**Created:** 2026-07-03
**Mode:** Vertical MVP
**Granularity:** Coarse
**Core Value:** AI can reliably create and validate a minimal runnable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 1 | Plugin and Skill Foundation | Load a plugin project with a focused Dota 2 Workshop Tools skill and progressively loaded references. | PLUG-01, PLUG-02, PLUG-03, SKIL-01, SKIL-02, SKIL-03, SKIL-04 | Complete |
| 2 | MCP Contract and Addon Template | Expose typed MCP tools and generate/inspect a minimal addon template in fixtures before touching a real Dota install. | MCP-01, MCP-02, MCP-03, MCP-04, ADDN-01, ADDN-02, ADDN-03, ADDN-04, ADDN-05, ADDN-06 | Complete |
| 3 | Local Windows Workshop Validation | Discover a local Windows Dota install, launch Workshop Tools/custom game candidates, and validate with logs or console evidence. | ENV-01, ENV-02, ENV-03, ENV-04, LNCH-01, LNCH-03, LNCH-04, VALD-01, VALD-02, VALD-03, VALD-04 | Complete |
| 4 | Remote Windows Target Support | Run the same MCP workflows against a remote Windows target through SSH or PowerShell Remoting. | REMT-01, REMT-02, REMT-03, REMT-04, LNCH-02 | Complete |

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

## Coverage

| Metric | Count |
|--------|-------|
| v1 requirements | 33 |
| Mapped requirements | 33 |
| Unmapped requirements | 0 |
| Phases | 4 |

## Deferred Scope

- Gameplay loop generation.
- Ability, item, unit, and hero generators.
- React Panorama generation.
- TypeScript-to-Lua project templates.
- Excel-to-KV workflows.
- Workshop publishing and encryption.
- UI automation as a primary control strategy.

---
*Roadmap created: 2026-07-03*

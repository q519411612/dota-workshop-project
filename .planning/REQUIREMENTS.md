# Requirements: Dota Workshop Project

**Defined:** 2026-07-03
**Core Value:** AI can reliably create and validate a minimal runnable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## User Stories

- As an AI-assisted custom game creator, I can install one plugin that contains the Dota 2 Workshop Tools skill and MCP server so setup stays coherent.
- As an AI agent, I can discover whether the target Windows machine has Dota 2 Workshop Tools installed before attempting addon operations.
- As an AI agent, I can create a minimal Dota 2 addon template with deterministic files and a validation marker.
- As an AI agent, I can launch Workshop Tools and validate an addon through logs or console evidence instead of guessing from process startup.
- As a Mac user controlling a Windows machine, I can use the same MCP tool interface against a remote Windows target through SSH or PowerShell Remoting.

## v1 Requirements

### Plugin

- [ ] **PLUG-01**: User can install or load a Codex plugin project that contains the Dota 2 Workshop Tools skill, MCP server, scripts, and templates.
- [ ] **PLUG-02**: User can validate the plugin manifest without placeholder metadata or missing referenced plugin components.
- [ ] **PLUG-03**: User can keep plugin development files in the project repository without requiring global installation during development.

### Skill

- [ ] **SKIL-01**: Agent can trigger the Dota 2 Workshop Tools skill for Dota 2 custom game, addon, Workshop Tools, Lua gamemode, Panorama, and validation tasks.
- [ ] **SKIL-02**: Agent can read concise skill guidance that explains when to use MCP tools instead of guessing paths or launch commands.
- [ ] **SKIL-03**: Agent can load reference material for addon layout, minimal template generation, Workshop Tools launch flow, remote Windows control, and troubleshooting only when needed.
- [ ] **SKIL-04**: Agent can distinguish v1 supported workflows from deferred workflows such as TypeScript-to-Lua, React Panorama, ability generation, and Workshop publishing.

### MCP Interface

- [ ] **MCP-01**: Agent can call a typed MCP tool interface with explicit target selection for local Windows and remote Windows.
- [ ] **MCP-02**: Agent receives structured MCP results that include success state, target, operation, evidence, warnings, paths, commands, and logs.
- [ ] **MCP-03**: Agent receives explicit error codes and messages when an operation cannot proceed.
- [ ] **MCP-04**: Agent can inspect an existing addon without modifying or overwriting it.

### Environment

- [ ] **ENV-01**: Agent can discover the Dota 2 install root on a local Windows target.
- [ ] **ENV-02**: Agent can verify that expected Dota binaries and addon directories exist before launch or file generation.
- [ ] **ENV-03**: Agent can use a user-provided Dota install root override when automatic discovery is insufficient.
- [ ] **ENV-04**: Agent can report missing Steam, missing Dota 2, missing Workshop Tools paths, or unsupported operating system as explicit failures.

### Remote

- [ ] **REMT-01**: Agent can configure a remote Windows target using SSH or PowerShell Remoting.
- [ ] **REMT-02**: Agent can run environment discovery on a remote Windows target through the same logical MCP tool interface used for local Windows.
- [ ] **REMT-03**: Agent can execute remote file and process operations with stdout, stderr, exit code, and command evidence returned to the caller.
- [ ] **REMT-04**: Agent can avoid silently falling back from remote Windows to local behavior when remote execution fails.

### Addon

- [ ] **ADDN-01**: Agent can validate addon names before writing files.
- [ ] **ADDN-02**: Agent can generate the minimal `game/dota_addons/<addon>` and `content/dota_addons/<addon>` directory structure required for v1 validation.
- [ ] **ADDN-03**: Agent can generate an addon metadata file using a verified format or a selected compatibility format.
- [ ] **ADDN-04**: Agent can generate `scripts/vscripts/addon_game_mode.lua` with a startup validation marker.
- [ ] **ADDN-05**: Agent can generate the minimal supporting NPC, hero list, localization, or map metadata files required by the chosen validation template.
- [ ] **ADDN-06**: Agent refuses to overwrite an existing addon unless the user explicitly requests replacement.

### Launch

- [ ] **LNCH-01**: Agent can launch Dota 2 Workshop Tools for a selected addon on local Windows.
- [ ] **LNCH-02**: Agent can launch Dota 2 Workshop Tools for a selected addon on remote Windows through the remote target adapter.
- [ ] **LNCH-03**: Agent can attempt a custom game launch for a selected addon and map using a target-validated launch command.
- [ ] **LNCH-04**: Agent can start or locate the console/logging surface needed for validation.

### Validation

- [ ] **VALD-01**: Agent can read relevant Dota 2 Workshop Tools logs or console output after launch.
- [ ] **VALD-02**: Agent can determine addon validation success only when expected log or console evidence is present.
- [ ] **VALD-03**: Agent can classify common validation failures such as missing install root, invalid addon name, missing map, invalid metadata, launch failure, and Lua startup error.
- [ ] **VALD-04**: Agent can return a concise validation transcript that can be attached to later review or debugging.

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Gameplay

- **GAME-01**: Agent can generate a basic gameplay loop with spawn logic, scoring, win/loss conditions, and simple UI.
- **GAME-02**: Agent can generate custom abilities, items, units, and heroes.

### Panorama

- **PANO-01**: Agent can generate simple Panorama UI using XML, JavaScript, and CSS.
- **PANO-02**: Agent can support React Panorama projects.

### Toolchain

- **TOOL-01**: Agent can support TypeScript-to-Lua project templates.
- **TOOL-02**: Agent can support Excel-to-KV generation workflows.
- **TOOL-03**: Agent can support publish and encryption workflows for Workshop release.

### Automation

- **AUTO-01**: Agent can use UI automation for Workshop Tools operations that have no deterministic command or file-based path.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full gameplay generation in v1 | The first milestone must prove the Workshop Tools control loop before adding gameplay complexity. |
| React Panorama in v1 | Requires a larger frontend build chain and is not needed to validate minimal addon creation. |
| TypeScript-to-Lua in v1 | Useful later, but the minimal Lua template is easier to validate first. |
| Excel-to-KV in v1 | Data pipeline complexity is not required for the first runnable addon. |
| Workshop publishing in v1 | Publishing requires separate account, metadata, key, and upload concerns after local validation works. |
| UI automation as primary control | File, process, command, and log operations are more reliable and easier to verify. |
| Silent fallback behavior | The project follows explicit failure reporting so wrong environment assumptions surface early. |

## Acceptance Criteria

- Every v1 requirement maps to exactly one roadmap phase.
- The first implementation milestone can be verified without a real Dota install by schema, fixture, and template tests.
- The Windows smoke milestone can be verified on a real local Windows target with Dota 2 Workshop Tools installed.
- Remote Windows support uses the same logical MCP tool names as local Windows support.
- Validation success requires evidence from logs or console output, not only process launch success.

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLUG-01 | TBD | Pending |
| PLUG-02 | TBD | Pending |
| PLUG-03 | TBD | Pending |
| SKIL-01 | TBD | Pending |
| SKIL-02 | TBD | Pending |
| SKIL-03 | TBD | Pending |
| SKIL-04 | TBD | Pending |
| MCP-01 | TBD | Pending |
| MCP-02 | TBD | Pending |
| MCP-03 | TBD | Pending |
| MCP-04 | TBD | Pending |
| ENV-01 | TBD | Pending |
| ENV-02 | TBD | Pending |
| ENV-03 | TBD | Pending |
| ENV-04 | TBD | Pending |
| REMT-01 | TBD | Pending |
| REMT-02 | TBD | Pending |
| REMT-03 | TBD | Pending |
| REMT-04 | TBD | Pending |
| ADDN-01 | TBD | Pending |
| ADDN-02 | TBD | Pending |
| ADDN-03 | TBD | Pending |
| ADDN-04 | TBD | Pending |
| ADDN-05 | TBD | Pending |
| ADDN-06 | TBD | Pending |
| LNCH-01 | TBD | Pending |
| LNCH-02 | TBD | Pending |
| LNCH-03 | TBD | Pending |
| LNCH-04 | TBD | Pending |
| VALD-01 | TBD | Pending |
| VALD-02 | TBD | Pending |
| VALD-03 | TBD | Pending |
| VALD-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-03 after initial definition*

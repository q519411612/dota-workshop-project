# Dota Workshop Project

## What This Is

Dota Workshop Project is a Codex plugin project for building Dota 2 custom games with AI assistance. It will package a Dota 2 Workshop Tools skill, an MCP server, scripts, and configuration so an AI agent can create, open, run, and inspect a minimal Dota 2 addon without rediscovering the Workshop Tools workflow every time.

The v1.1 Workshop MVP milestone is complete and archived. The project now has a validated end-to-end plugin slice: agents can generate playable addons, run evidence-driven smoke workflows on Windows targets, inspect custom map/objective/unit scaffold readiness, and report Panorama/toolchain/publishing boundaries without expanding into full UI generation or Workshop upload automation. v1.2 added dry-run release/package readiness before any real Workshop upload automation. v1.3 added sanitized real Windows validation closure through the remote SSH path. v1.4 added local plugin installation and operator handoff readiness verification. v1.5 added checked operator docs and reusable safe workflow examples. v1.6 added a local release-candidate audit gate. v1.7 added a local release handoff readiness report.

## Core Value

AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Requirements

### Validated

- [x] Package the work as a Codex plugin with a Dota 2 Workshop Tools skill, MCP server, scripts, and configuration.
- [x] Provide a skill that explains the Dota 2 custom game workflow, addon layout, Lua gamemode basics, KV configuration, Panorama boundaries, and validation flow.
- [x] Provide a unified MCP tool interface for local Windows and remote Windows targets.
- [x] Support local Windows as the first validation path where the MCP server runs on the same machine as Dota 2 Workshop Tools.
- [x] Support remote Windows through SSH or PowerShell Remoting with the same user-facing MCP tool interface.
- [x] Generate a minimal runnable addon template with Lua gamemode files, required KV configuration, and a launchable entry point.
- [x] Open or run the generated addon through Dota 2 Workshop Tools command construction and collect enough fixture logs or console output to verify the validation flow.
- [x] Validate a generated addon's Lua `Activate()` marker from a readable Dota runtime console log on real Windows without storing private target data.
- [x] Generate a minimal playable gameplay loop with Lua gamemode initialization, round start, score update, and win-condition markers.
- [x] Preserve v1.1 runtime marker validation while adding gameplay marker validation.
- [x] Keep local Windows and remote Windows behind the same MCP tool contract for playable addon generation, launch, log reading, and validation.
- [x] Document the v2 API research evidence and mark unverified Dota APIs as pending real Windows runtime validation.
- [x] Provide a repeatable playable smoke workflow that composes addon generation, inspection, runtime launch, gameplay marker validation, and concise transcript output through the unified MCP contract.
- [x] Keep smoke target configuration runtime-only and avoid persisting private host, account, password, token, or Steam credential details in the repository.
- [x] Document the workflow so a user can run a safe local or remote playable smoke without manually stitching every MCP operation together.
- [x] Provide explicit safe cleanup controls so repeat playable smoke runs can dry-run inspect or stop only known Dota smoke processes matching a requested smoke addon name.
- [x] Keep `run_playable_smoke` free of hidden cleanup side effects while documenting the explicit cleanup workflow.
- [x] Generate a minimal runtime placement configuration for the playable template and validate placement markers through the existing local or remote runtime log path.
- [x] Prepare a launchable custom map from the installed Workshop template and validate spawn entity evidence, compile evidence, and runtime marker evidence through the same local or remote MCP contract.
- [x] Add an inspection-only Panorama/toolchain boundary and publishing preflight capability with fixture, local, and remote evidence.

### Recently Validated

- [x] Milestone v1.1 passed audit with all mapped requirements, delivery slices, integration checks, and end-to-end flows satisfied.
- [x] Real Windows validation used the remote target path for cleanup, placement, custom map, objective, scaffold, and preflight evidence.
- [x] Graphify was refreshed locally after the audit commit and remains intentionally uncommitted for HEAD freshness.

### Recently Validated

- [x] Added a dry-run release report for release/package preflight, addon metadata completeness, sensitive information scanning, and publishing boundary reporting.
- [x] Completed sanitized Windows validation closure on a user-provided Windows host through remote SSH runtime marker validation.
- [x] Added local plugin handoff readiness verification for manifest, MCP config, entrypoints, skill references, and documented tool-list drift.
- [x] Added checked operator runbook and schema-valid safe workflow examples.
- [x] Added a local `verify:rc` gate for plugin/package readiness, example/schema checks, build/test checks, repository hygiene scanning, and publishing boundary checks.
- [x] Added a local `verify:handoff` gate for commit identity, RC preflight evidence, delivery checklist reporting, documentation coverage, and explicit release boundaries.

### Active

- [ ] Decide the next publishing readiness increment after dry-run release reporting.
- [ ] Decide whether a separate Windows-local MCP server run is worth scheduling as optional evidence.

### Out of Scope

- Full gameplay generation beyond the minimal playable loop - keep v2 focused on proving the gameplay validation loop.
- Fragile UI-only automation as the primary path - prefer command, file, and process control before desktop automation.
- A complete Dota 2 modding knowledge base - keep detailed references progressively loaded through the skill.
- Global installation as the primary project layout - build a plugin project first, then install or share it after validation.

## Context

The project exists to make AI-assisted Dota 2 arcade custom game creation practical. The repeated pain is not only writing Lua or configuration files, but also knowing where Workshop Tools expects files, how to create an addon, how to launch tools, how to run a map or addon, and how to inspect failures.

The first target environment is Windows with Dota 2 Workshop Tools installed. Remote Windows is also in scope because the AI session may run on a Mac while the tools run on a Windows machine. The remote path should use SSH or PowerShell Remoting instead of relying on remote desktop interactions.

The skill and MCP server should have separate responsibilities. The skill teaches the agent how to reason about Dota 2 Workshop Tools tasks and when to use references or scripts. The MCP server exposes deterministic operations such as creating an addon, opening tools, running validation commands, reading console output, and inspecting generated files.

Milestone v1.1 is archived under `.planning/milestones/`. Current planning should start from a fresh requirement slice rather than editing the archived roadmap directly.

## Constraints

- **Packaging**: Deliver as a Codex plugin - keeps the skill, MCP server, scripts, and configuration installable together.
- **Target OS**: Dota 2 Workshop Tools control requires Windows - Mac-side work should connect to a Windows runtime when needed.
- **Remote Control**: Use SSH or PowerShell Remoting for remote Windows - this is more testable than UI automation.
- **Interface**: Keep local and remote control behind the same MCP tool names - the AI should not need different workflows for each target.
- **Scope**: Thin slice first - prove the addon creation and validation loop before adding gameplay systems.
- **Reliability**: Let failures surface through explicit errors and logs - avoid silent fallback behavior or heuristic repair.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build a thin vertical slice first | Proves the whole AI-to-Workshop-Tools loop before expanding scope | Implemented |
| Package as a Codex plugin | Keeps the skill, MCP server, scripts, and configuration together for installation and sharing | Implemented |
| Support both local Windows and remote Windows | Local Windows is the fastest validation path; remote Windows matches likely Mac-to-Windows usage | Implemented |
| Use SSH or PowerShell Remoting for remote Windows | Command-oriented remote control is more reliable and easier to verify than UI-only automation | Implemented |
| Keep one unified MCP tool interface | Prevents local and remote implementations from drifting into separate workflows | Implemented |
| Start with a minimal runnable addon template | Validates Workshop Tools integration without mixing in gameplay design complexity | Implemented |
| Separate Workshop Tools opening from game runtime validation | `-tools` opens the editor context, while Lua `Activate()` marker validation requires a non-tools custom game runtime launch with console logging | Implemented |
| Use a small Lua gameplay loop for v2 | Extends runtime evidence without importing large frameworks or UI automation | Implemented |
| Add a repeatable playable smoke workflow for v2.1 | Real v2 smoke succeeded, but the validated path was too manual for reliable reuse | Implemented |
| Add explicit safe smoke cleanup controls for v2.2 | Real v2.1 repeat smoke found stale smoke Dota processes can block interactive launch matching | Implemented |
| Add deterministic runtime placement markers for v2.3 | The current playable loop proves scoring on stock `dota`; placement configuration is the next smallest step toward controlled custom game scenarios | Implemented |
| Validate cleanup and placement on real Windows before expanding v2.x | Fixture tests proved contracts, but later map and unit work needs confidence in the remote runtime loop | Implemented |
| Use installed template maps before binary map editing | The current `template_map.vmap` is binary DMX; copying, checking spawn entity strings, compiling, and launching it is a rigorous smaller slice than patching binary entity coordinates | Implemented |
| Start gameplay objectives with score configuration | The existing score/win loop is already Windows-validated, so parameterizing it is the smallest objective slice before custom quests or unit systems | Implemented |
| Scaffold custom units and abilities as KV evidence before runtime behavior | File generation and inspect evidence are a smaller validated slice than proving custom ability execution | Implemented |
| Add preflight before Panorama, toolchain, and publishing automation | Inspection-only evidence gives agents a safe boundary report before larger UI/toolchain/publishing workflows | Implemented |
| Archive v1.1 before opening publishing automation | The completed milestone is large enough that future publishing work needs fresh requirements and a tighter release-readiness boundary | Implemented |
| Start v1.2 with dry-run release readiness only | Publishing work has high credential and account risk, so v1.2 must prove local evidence and boundaries before any upload automation | Implemented |
| Keep v1.3 Windows host details runtime-only | Validation closure uses a private user-provided target, so repository artifacts must record only sanitized evidence categories | Implemented |
| Treat remote real-Windows validation as closure for v1.3 | The user-provided Windows host produced environment category evidence, runtime marker validation, release dry-run blockers, and addon-scoped cleanup evidence | Implemented |
| Add handoff readiness before broader distribution | The project has real runtime evidence, but installation/package drift needs a local verifier before external handoff | Implemented |
| Make operator examples machine-checkable | Reusable examples are useful only if schemas and safety boundaries keep them from drifting or storing private material | Implemented |
| Add release handoff reporting before external delivery | Operators need one local, credential-free report that aggregates RC evidence, delivery artifacts, docs coverage, and release boundaries | Implemented |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 after v1.7 Release Handoff Bundle Readiness*

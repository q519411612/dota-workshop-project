# Dota Workshop Project

## What This Is

Dota Workshop Project is a Codex plugin project for building Dota 2 custom games with AI assistance. It will package a Dota 2 Workshop Tools skill, an MCP server, scripts, and configuration so an AI agent can create, open, run, and inspect a minimal Dota 2 addon without rediscovering the Workshop Tools workflow every time.

The initial focus is a thin vertical slice: create a minimal runnable addon template on Windows, open it in Dota 2 Workshop Tools, run it, and read enough console or log feedback to know whether the loop worked.

## Core Value

AI can reliably create and validate a minimal runnable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Package the work as a Codex plugin with a Dota 2 Workshop Tools skill, MCP server, scripts, and configuration.
- [ ] Provide a skill that explains the Dota 2 custom game workflow, addon layout, Lua gamemode basics, KV configuration, Panorama boundaries, and validation flow.
- [ ] Provide a unified MCP tool interface for local Windows and remote Windows targets.
- [ ] Support local Windows as the first validation path where the MCP server runs on the same machine as Dota 2 Workshop Tools.
- [ ] Support remote Windows through SSH or PowerShell Remoting with the same user-facing MCP tool interface.
- [ ] Generate a minimal runnable addon template with Lua gamemode files, required KV configuration, and a launchable entry point.
- [ ] Open or run the generated addon through Dota 2 Workshop Tools and collect enough logs or console output to verify the result.

### Out of Scope

- Full gameplay generation beyond the minimal runnable template - keep v1 focused on proving the tooling loop.
- Fragile UI-only automation as the primary path - prefer command, file, and process control before desktop automation.
- A complete Dota 2 modding knowledge base - keep detailed references progressively loaded through the skill.
- Global installation as the primary project layout - build a plugin project first, then install or share it after validation.

## Context

The project exists to make AI-assisted Dota 2 arcade custom game creation practical. The repeated pain is not only writing Lua or configuration files, but also knowing where Workshop Tools expects files, how to create an addon, how to launch tools, how to run a map or addon, and how to inspect failures.

The first target environment is Windows with Dota 2 Workshop Tools installed. Remote Windows is also in scope because the AI session may run on a Mac while the tools run on a Windows machine. The remote path should use SSH or PowerShell Remoting instead of relying on remote desktop interactions.

The skill and MCP server should have separate responsibilities. The skill teaches the agent how to reason about Dota 2 Workshop Tools tasks and when to use references or scripts. The MCP server exposes deterministic operations such as creating an addon, opening tools, running validation commands, reading console output, and inspecting generated files.

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
| Build a thin vertical slice first | Proves the whole AI-to-Workshop-Tools loop before expanding scope | - Pending |
| Package as a Codex plugin | Keeps the skill, MCP server, scripts, and configuration together for installation and sharing | - Pending |
| Support both local Windows and remote Windows | Local Windows is the fastest validation path; remote Windows matches likely Mac-to-Windows usage | - Pending |
| Use SSH or PowerShell Remoting for remote Windows | Command-oriented remote control is more reliable and easier to verify than UI-only automation | - Pending |
| Keep one unified MCP tool interface | Prevents local and remote implementations from drifting into separate workflows | - Pending |
| Start with a minimal runnable addon template | Validates Workshop Tools integration without mixing in gameplay design complexity | - Pending |

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
*Last updated: 2026-07-03 after initialization*

---
name: dota2-workshop-tools
description: Use for Dota 2 Workshop Tools, Dota 2 custom game addons, addon templates, Lua gamemode files, KeyValues or KV3 addon metadata, Panorama boundaries, local or remote Windows Workshop validation, launch troubleshooting, and MCP-backed addon operations.
---

# Dota 2 Workshop Tools

Use this skill for Dota 2 custom game work. Keep the current scope focused on plugin packaging, addon layout, minimal Lua/KV generation, playable gameplay loop generation, runtime placement markers, repeatable playable smoke workflows, explicit smoke cleanup controls, Workshop Tools launch, log evidence, and local or remote Windows validation.

## Core Workflow

1. Identify whether the task is about an existing addon, a new minimal addon, launch validation, or troubleshooting.
2. Read only the reference needed for the task:
   - Addon layout and file placement: `references/addon-layout.md`
   - Minimal generated template: `references/minimal-template.md`
   - Workshop Tools launch and validation: `references/launch-flow.md`
   - Remote Windows control: `references/remote-control.md`
   - Failure diagnosis: `references/troubleshooting.md`
3. Use MCP tools for environment, filesystem, process, launch, and validation operations. Do not guess Windows paths, Steam library paths, launch commands, log paths, or remote commands.
4. Inspect existing addons before editing them. Refuse overwrite unless the user explicitly asks for replacement.
5. Treat process launch and validation as separate outcomes. Validation needs expected log or console evidence.

## When To Use MCP

Use MCP tools when the request needs any of these operations:

- Discovering or verifying a Dota 2 install root.
- Creating, inspecting, linking, or validating addon files.
- Launching Workshop Tools or a custom game.
- Reading console output or logs.
- Running commands on local Windows or remote Windows.
- Running the repeatable playable smoke workflow.
- Inspecting or stopping known smoke Dota processes through explicit addon-scoped cleanup.
- Generating or validating runtime placement markers for the playable template.
- Collecting evidence for a validation transcript.

If MCP is unavailable, explain that target-control work cannot be performed deterministically. You may still edit repository files, write Lua/KV/Panorama source, or prepare a manual checklist, but do not claim Workshop validation.

## Supported Boundaries

Supported:

- Minimal addon generation with `game/dota_addons/<addon>` and `content/dota_addons/<addon>`.
- Lua gamemode entry point and startup validation marker.
- Minimal playable Lua loop with gamemode initialization, round start, score update, and win-condition markers.
- Optional runtime placement configuration and placement markers in the playable template.
- Addon metadata and minimal supporting KV files.
- Local Windows target discovery and launch validation.
- Remote Windows target execution through SSH or PowerShell Remoting.
- Repeatable playable smoke orchestration through `run_playable_smoke`.
- Explicit repeat-smoke process cleanup through `cleanup_playable_smoke`.
- Structured evidence with target, operation, success state, paths, commands, logs, warnings, and errors.

Deferred:

- TypeScript-to-Lua project templates.
- React Panorama projects.
- Excel-to-KV pipelines.
- Ability, item, unit, hero, complex AI, or gameplay generators beyond the minimal playable loop.
- Workshop publishing and encryption.
- UI automation as the primary control path.

## MCP Tool Contract

Prefer one logical workflow for local and remote targets. Every call should include an explicit target and every result should echo that target.

Expected v1 operations:

- `discover_environment`
- `validate_target`
- `create_addon`
- `inspect_addon`
- `link_addon`
- `launch_tools`
- `launch_custom_game`
- `run_playable_smoke`
- `cleanup_playable_smoke`
- `read_console_or_logs`
- `validate_addon`

Every result must make failures visible. Missing Dota paths, unsupported OS, invalid addon names, remote execution failures, missing maps, metadata errors, and Lua startup errors should return explicit errors with evidence.

For v2 playable validation, call `validate_addon` with `expectedMarkers` when checking more than one gameplay marker. Validation should pass only when every requested marker appears in readable logs.

For v2.1 repeatable playable smoke, prefer `run_playable_smoke` when the user wants one end-to-end smoke transcript. Use the atomic tools when investigating a specific failure or preserving a hand-controlled launch sequence.

For v2.2 repeat-smoke cleanup, call `cleanup_playable_smoke` explicitly. Start with `dryRun: true` to inspect matching Dota processes for the known smoke addon name, then call again with `dryRun: false` only when the matches are correct. Do not add hidden cleanup to `run_playable_smoke`.

For v2.3 runtime placement, pass `placement` to `create_addon` or `run_playable_smoke` only when the user wants deterministic spawn evidence on an already launchable map. Validate the placement markers from logs. Do not imply this edits Hammer map spawn entities or generates full unit/ability systems.

## Editing Rules

- Use English identifiers, file names, configuration keys, and API names.
- Add comments only for non-obvious code, and write comments in Chinese.
- Preserve existing addon structure and metadata format when editing.
- Keep generated v1 templates intentionally small.
- Do not store Steam credentials, remote credentials, tokens, passwords, private keys, or host secrets in the repository.

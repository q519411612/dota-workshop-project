---
name: dota2-workshop-tools
description: Use for Dota 2 Workshop Tools, Dota 2 custom game addons, addon templates, Lua gamemode files, KeyValues or KV3 addon metadata, Panorama boundaries, local or remote Windows Workshop validation, launch troubleshooting, and MCP-backed addon operations.
---

# Dota 2 Workshop Tools

Use this skill for Dota 2 custom game work. Keep v1 focused on plugin packaging, addon layout, minimal Lua/KV generation, Workshop Tools launch, log evidence, and local or remote Windows validation.

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
- Collecting evidence for a validation transcript.

If MCP is unavailable, explain that target-control work cannot be performed deterministically. You may still edit repository files, write Lua/KV/Panorama source, or prepare a manual checklist, but do not claim Workshop validation.

## v1 Boundaries

Supported in v1:

- Minimal addon generation with `game/dota_addons/<addon>` and `content/dota_addons/<addon>`.
- Lua gamemode entry point and startup validation marker.
- Addon metadata and minimal supporting KV files.
- Local Windows target discovery and launch validation.
- Remote Windows target execution through SSH or PowerShell Remoting.
- Structured evidence with target, operation, success state, paths, commands, logs, warnings, and errors.

Deferred:

- TypeScript-to-Lua project templates.
- React Panorama projects.
- Excel-to-KV pipelines.
- Ability, item, unit, hero, or gameplay generators beyond the minimal smoke template.
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
- `read_console_or_logs`
- `validate_addon`

Every result must make failures visible. Missing Dota paths, unsupported OS, invalid addon names, remote execution failures, missing maps, metadata errors, and Lua startup errors should return explicit errors with evidence.

## Editing Rules

- Use English identifiers, file names, configuration keys, and API names.
- Add comments only for non-obvious code, and write comments in Chinese.
- Preserve existing addon structure and metadata format when editing.
- Keep generated v1 templates intentionally small.
- Do not store Steam credentials, remote credentials, tokens, passwords, private keys, or host secrets in the repository.

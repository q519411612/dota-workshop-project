---
name: dota2-workshop-tools
description: Use for Dota 2 Workshop Tools, Dota 2 custom game addons, addon templates, Lua gamemode files, KeyValues or KV3 addon metadata, Panorama boundaries, local or remote Windows Workshop validation, launch troubleshooting, and MCP-backed addon operations.
---

# Dota 2 Workshop Tools

Use this skill for Dota 2 custom game work. Keep the current scope focused on plugin packaging, addon layout, minimal Lua/KV generation, minimal unit/ability KV scaffolding, playable gameplay loop generation, score objective markers, runtime placement markers, template-derived custom map preparation, Workshop preflight inspection, dry-run release reporting, repeatable playable smoke workflows, explicit smoke cleanup controls, Workshop Tools launch, log evidence, and local or remote Windows validation.

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
- Generating or validating score objective markers for the playable template.
- Generating or inspecting minimal unit/ability KV scaffolds.
- Preparing and compiling a template-derived custom map with spawn entity evidence.
- Inspecting addon layout, Panorama directories, toolchain markers, and publishing blockers through preflight.
- Running dry-run release reports for metadata completeness, package blockers, sensitive information findings, and manual upload boundaries.
- Collecting evidence for a validation transcript.

If MCP is unavailable, explain that target-control work cannot be performed deterministically. You may still edit repository files, write Lua/KV/Panorama source, or prepare a manual checklist, but do not claim Workshop validation.

## Supported Boundaries

Supported:

- Minimal addon generation with `game/dota_addons/<addon>` and `content/dota_addons/<addon>`.
- Lua gamemode entry point and startup validation marker.
- Minimal playable Lua loop with gamemode initialization, round start, score update, and win-condition markers.
- Optional score objective configuration and objective markers in the playable template.
- Optional runtime placement configuration and placement markers in the playable template.
- Optional minimal custom unit plus linked ability KV scaffold files.
- Template-derived custom map source copy, spawn entity marker verification, and `resourcecompiler.exe` compile evidence.
- Inspection-only Workshop preflight for addon layout, Panorama source/runtime directories, toolchain marker files, and publishing blockers.
- Dry-run release report for package readiness, addon metadata completeness, sensitive information scanning, and publishing boundaries.
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
- Runtime ability behavior, item, hero, complex AI, or gameplay generators beyond the minimal playable loop and scaffolded KV files.
- Workshop publishing and encryption.
- Binary `.vmap` spawn coordinate editing.
- Hammer UI automation.
- UI automation as the primary control path.

## MCP Tool Contract

Prefer one logical workflow for local and remote targets. Every call should include an explicit target and every result should echo that target.

Expected v1 operations:

- `discover_environment`
- `validate_target`
- `create_addon`
- `prepare_custom_map`
- `inspect_addon`
- `inspect_workshop_preflight`
- `dry_run_release_report`
- `preflight_release_candidate`
- `export_release_candidate`
- `cleanup_exported_candidate`
- `launch_tools`
- `launch_custom_game`
- `run_playable_smoke`
- `cleanup_playable_smoke`
- `read_console_or_logs`
- `validate_addon`
- `remote_command`

Every result must make failures visible. Missing Dota paths, unsupported OS, invalid addon names, remote execution failures, missing maps, metadata errors, and Lua startup errors should return explicit errors with evidence.

For v2 playable validation, call `validate_addon` with `expectedMarkers` when checking more than one gameplay marker. Validation should pass only when every requested marker appears in readable logs.

For v2.1 repeatable playable smoke, prefer `run_playable_smoke` when the user wants one end-to-end smoke transcript. Use the atomic tools when investigating a specific failure or preserving a hand-controlled launch sequence.

For v2.2 repeat-smoke cleanup, call `cleanup_playable_smoke` explicitly. Start with `dryRun: true` to inspect matching Dota processes for the known smoke addon name, then call again with `dryRun: false` only when the matches are correct. Do not add hidden cleanup to `run_playable_smoke`.

For v2.3 runtime placement, pass `placement` to `create_addon` or `run_playable_smoke` only when the user wants deterministic spawn evidence on an already launchable map. Validate the placement markers from logs. Do not imply this edits Hammer map spawn entities or generates full unit/ability systems.

For v2.4 custom map preparation, call `prepare_custom_map` for an existing addon or pass `customMap` to `run_playable_smoke`. The operation copies `content/dota_addons/addon_template/maps/template_map.vmap`, verifies `info_player_start_goodguys` and `info_player_start_badguys`, runs `resourcecompiler.exe`, and returns source, compiler, command, and compiled-map evidence. Do not claim this edits binary `.vmap` spawn coordinates.

For v2.5 score objectives, pass `objective: { type: "score", targetScore, tickIntervalSeconds }` to `create_addon` or `run_playable_smoke` only when the user wants configurable objective evidence in the existing playable loop. Validate objective configured, progress, and complete markers from logs. Do not imply this generates complex quests, AI, custom units, abilities, items, heroes, or UI.

For v2.6 unit/ability scaffolding, pass `unitAbilityScaffold: { unitName, abilityName }` to `create_addon` or `run_playable_smoke` only when the user wants deterministic KV files for one custom unit and one linked ability. Inspect `npc_units_custom.txt` and `npc_abilities_custom.txt` for evidence. Do not claim this proves custom ability runtime execution, modifiers, items, heroes, AI, UI, publishing, or balancing.

For v2.7 Workshop preflight, call `inspect_workshop_preflight` when the user asks whether an addon is ready around Panorama, TypeScript-to-Lua, React Panorama, or publishing boundaries. Treat its evidence as inspection only: Workshop upload remains out of scope, and it does not generate UI files, run `npm`, run compilers or bundlers, encrypt content, accept credentials, upload to Workshop, or prove runtime validation.

For v1.2 release readiness, call `dry_run_release_report` when the user asks for a pre-upload release/package review. Treat blockers as release-stopping until resolved. The operation checks metadata completeness, package candidate files, and sensitive information markers; it never accepts credentials, logs into Steam, encrypts content, creates upload artifacts, uploads to Workshop, or proves runtime validation.

For v1.14 release-candidate evidence, call `preflight_release_candidate` with only `target` and `addonName`. Fixture/local and SSH/PowerShell targets share the same strict artifact, manifest, blocker, cleanup, safe-path, and boundary semantics. Treat the result as contract evidence: it does not prove real Windows reparse, canonicalization, transport, or cleanup behavior. The manifest plus verified cleanup proof is the deliverable, no candidate remains to upload, and the two-root candidate is not an official Valve upload payload. Never retry or fall back locally after a remote failure. Remote authorization is external runtime configuration; the operation never handles credentials, Steam login, Workshop item mutation, upload, archive, signing, encryption, launch, runtime validation, compilation, source conversion, metadata repair, candidate retention, or file transfer.

For a retained target-local handoff, call `export_release_candidate` with an explicit isolated `exportRoot` and absent direct-child `destination`. This is independent from temporary preflight. Require the external handoff manifest, complete file-and-directory topology, combined digest, ownership evidence, and verified staging cleanup before describing export as successful. Remote exports remain on the target Windows host and never transfer candidate files to the MCP host.

Before deletion, call `cleanup_exported_candidate` with `dryRun: true` and the exact path, ownership identifier, manifest version, and combined SHA-256 returned by export. Execute only after dry-run authorization succeeds. A partial candidate removal must preserve the handoff, and remote execute uncertainty means both object states are unknown. Never widen the path, repair a mismatch, retry into mixed state, or treat ownership evidence as a connection credential.

## Editing Rules

- Use English identifiers, file names, configuration keys, and API names.
- Add comments only for non-obvious code, and write comments in Chinese.
- Preserve existing addon structure and metadata format when editing.
- Keep generated v1 templates intentionally small.
- Do not store Steam credentials, remote credentials, tokens, passwords, private keys, or host secrets in the repository.

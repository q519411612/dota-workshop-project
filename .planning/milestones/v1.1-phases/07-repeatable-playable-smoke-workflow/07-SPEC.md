# Phase 7 Spec: Repeatable Playable Smoke Workflow

## User Story

As an AI-assisted Dota 2 custom game creator, I can run one MCP workflow that creates a fresh playable smoke addon, launches it in Dota runtime mode, validates gameplay markers, and returns a concise transcript without storing private target configuration.

## Requirements

1. `run_playable_smoke` accepts the existing target schema for fixture, local, and remote targets.
2. The workflow creates a unique playable addon name by default and refuses to replace an existing addon unless replacement is explicitly requested.
3. The workflow can accept an explicit addon name for deterministic fixture tests.
4. The workflow inspects the generated addon and records file/marker evidence.
5. The workflow launches the addon with `runtimeMode: "game"`, `consoleLog: true`, and map `dota` by default.
6. Remote workflows can pass existing launch options such as `launchMode: "interactiveTask"` and task name.
7. The workflow validates all required playable markers by default.
8. The result transcript includes operation outcomes, command evidence, paths, logs, warnings, marker evidence, and generated addon name.
9. Failure in create, inspect, launch, or validate stops the workflow and reports the failed operation explicitly.
10. README and skill references explain safe local and remote use, including that private target configuration is runtime-only.

## Acceptance Criteria

- Fixture tests prove default smoke addon names are valid, unique enough for repeated runs, and use the playable template.
- Fixture tests prove an explicit addon name produces deterministic transcript evidence.
- Local-style tests prove the launch operation uses game runtime mode with console logging.
- Remote tests prove `interactiveTask` launch settings are passed through the smoke workflow.
- Validation tests prove all required gameplay markers are required by default and missing markers fail the workflow.
- MCP schema tests prove `run_playable_smoke` is exposed through the server and dispatcher.
- Documentation covers the repeatable smoke workflow and troubleshooting path.

## Non-Goals

- Deleting generated addon files.
- Stopping Dota or Steam processes.
- Persisting target configuration.
- Custom map generation.
- Panorama UI.
- Complex AI, hero, ability, item, or unit generators.
- UI automation as the primary control path.

## Ambiguity Report

- Goal Clarity: 0.92
- Boundary Clarity: 0.88
- Constraint Clarity: 0.84
- Acceptance Criteria: 0.90
- Ambiguity: 0.11

## Edge Coverage

- Covered: explicit addon name allows deterministic tests while default generation avoids accidental overwrite.
- Covered: launch success is not validation success; marker validation remains required.
- Covered: remote launch options are pass-through, not a separate remote workflow.
- Backstop: missing marker failure should be tested through the smoke orchestration path.

## Prohibitions

- The workflow must not persist private target configuration or credentials.
- The workflow must not silently clean up or delete target files.
- The workflow must not report success when marker validation fails.

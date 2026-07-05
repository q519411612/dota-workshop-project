# Graph Report - dota-workshop-project  (2026-07-06)

## Corpus Check
- 120 files · ~208,017 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1144 nodes · 1477 edges · 104 communities (103 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6851764b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]

## God Nodes (most connected - your core abstractions)
1. `Communities (80 total, 1 thin omitted)` - 80 edges
2. `createFailureResult()` - 38 edges
3. `handleTool()` - 25 edges
4. `createSuccessResult()` - 24 edges
5. `runPlayableSmoke()` - 21 edges
6. `runRemoteCommand()` - 18 edges
7. `validateAddonName()` - 17 edges
8. `createAddon()` - 17 edges
9. `Common Failures` - 16 edges
10. `Requirements: Dota Workshop Project` - 15 edges

## Surprising Connections (you probably didn't know these)
- `validateRemoteAddonInput()` --calls--> `validateAddonName()`  [EXTRACTED]
  src/remote.ts → src/addon.ts
- `validateSmokeInput()` --calls--> `validateAddonName()`  [EXTRACTED]
  src/smoke.ts → src/addon.ts
- `launchCustomGame()` --calls--> `validateMapName()`  [EXTRACTED]
  src/launch.ts → src/addon.ts
- `validatePrepareInput()` --calls--> `validateMapName()`  [EXTRACTED]
  src/map.ts → src/addon.ts
- `launchRemoteCustomGame()` --calls--> `validateMapName()`  [EXTRACTED]
  src/remote.ts → src/addon.ts

## Import Cycles
- None detected.

## Communities (104 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (24): UnitAbilityScaffold, buildRemoteCommand(), createRemoteAddon(), defaultExecutor(), execFileAsync, LaunchRemoteDotaInput, quoteForPosixShell(), quoteForPowerShellSingleQuotedString() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (38): Acceptance Criteria, Addon, Automation, Custom Map Spawn Point MVP, Deferred v2.x Requirements, Documentation, Environment, Gameplay (+30 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (32): CleanupPlayableSmokeInputSchema, CleanupPlayableSmokeToolInput, CreateAddonInputSchema, CreateAddonToolInput, DiscoverEnvironmentInputSchema, DiscoverEnvironmentToolInput, FixtureTargetSchema, GameplayObjectiveSchema (+24 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): bin, dota-workshop-mcp, dependencies, @modelcontextprotocol/sdk, zod, description, devDependencies, @types/node (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (80): Communities (80 total, 1 thin omitted), Community 0 - "Community 0", Community 10 - "Community 10", Community 11 - "Community 11", Community 12 - "Community 12", Community 13 - "Community 13", Community 14 - "Community 14", Community 15 - "Community 15" (+72 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (30): abilityData(), addonInfo(), AddonNameValidation, addonPaths(), AddonTemplateKind, CreateAddonInput, existingAddonEvidence(), formatLuaNumber() (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (16): Canonical References, Deferred Ideas, Established Patterns, Existing Code Insights, Implementation Decisions, Integration Points, Phase 1: Plugin and Skill Foundation - Context, Phase Boundary (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (16): Addon Template, Canonical References, Deferred Ideas, Established Patterns, Existing Code Insights, Implementation Decisions, Integration Points, Phase 2: MCP Contract and Addon Template - Context (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (14): API Evidence Gate, Deferred Ideas, Established Patterns, Existing Code Insights, Gameplay Loop Shape, Implementation Decisions, Integration Points, Marker Validation (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (18): Addon already exists, Common Failures, Custom map preparation failed, Dota install not found, Gameplay marker missing, Lua startup error, Metadata format mismatch, Missing map (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (14): Build Order Implications, Component Boundaries, Data Flow, Local Windows, MCP server, Project Research - Architecture, Recommended Architecture, Remote Windows (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (13): Canonical References, Deferred Ideas, Discovery, Established Patterns, Existing Code Insights, Implementation Decisions, Integration Points, Launch (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (13): Canonical References, Credential Handling, Deferred Ideas, Established Patterns, Existing Code Insights, Implementation Decisions, Integration Points, Phase 4: Remote Windows Target Support - Context (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): Coverage, Deferred Scope, Overview, Phase 10: Custom Map Spawn Point MVP, Phase 11: Gameplay Objective MVP, Phase 12: Unit Ability Scaffolding MVP, Phase 1: Plugin and Skill Foundation, Phase 2: MCP Contract and Addon Template (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (13): Addon metadata format, Candidate launch path, Confidence, Dota 2 Addon Runtime Stack, MCP server, Plugin and MCP Stack, Plugin packaging, Project Research - Stack (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (12): Cleanup Boundary, Deferred Ideas, Existing Code Insights, Implementation Decisions, Integration Points, Marker Contract, Phase 7 Context: Repeatable Playable Smoke Workflow, Phase Boundary (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (11): Acceptance Criteria, Ambiguity Report, Background, Boundaries, Constraints, Edge Coverage, Goal, Interview Log (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (12): Active, Constraints, Context, Core Value, Dota Workshop Project, Evolution, Key Decisions, Out of Scope (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (12): Custom Map Preparation, Dota Workshop Project, Local Windows Smoke Checklist, MCP Tools, Playable Addon, Remote Windows Smoke Checklist, Repeatable Playable Smoke, Safe Repeat Cleanup (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (11): Pitfall: Confusing `game` and `content` trees, Pitfall: Format drift in `addoninfo.txt`, Pitfall: Hardcoding Dota install paths, Pitfall: Official docs are not always accessible to automation, Pitfall: Overbuilding the first template, Pitfall: Remote target ambiguity, Pitfall: Silent fallback behavior, Pitfall: Treating process start as validation (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (10): Canonical References, Deferred Ideas, Implementation Decisions, Phase 8 Context: Safe Smoke Cleanup Controls, Phase Boundary, Result Contract, Safety Contract, Target and Secrets (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (10): Addon Metadata and KV Files, Candidate APIs Requiring Real Runtime Validation, Deferred v2.x Scope, Dota 2 Workshop API Research for v2, GameRules and Gameplay APIs, Map Dependency Findings, Research Boundary, Runtime Entry Points (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (10): Addon layout, Implications for Roadmap, Key Findings, Launch path, Lua entry point, Modern framework boundary, Project Research Summary, Recommended v1 Scope (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (9): Finding 1: Secret scan initially omitted untracked files, Finding 2: Remote validation log window was too narrow for gameplay markers, Finding 3: Forced hero API was not stable in current runtime, Findings, Phase 6 Review: Playable Gameplay Loop MVP, Post-Smoke Review, Re-Review, Scope (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (9): Feature Categories, MCP addon creation, MCP environment discovery, MCP launch and validation, Project Research - Features, Remote Windows control, Skill guidance, Sources (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (8): File Structure, Playable Gameplay Loop MVP Implementation Plan, Task 1: Playable Template Contract, Task 2: Inspect Evidence, Task 3: Multiple Marker Validation, Task 4: Remote Template Parity, Task 5: Documentation, Task 6: Verification and Review

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (8): File Structure, Repeatable Playable Smoke Workflow Implementation Plan, Task 1: Smoke Workflow Contract, Task 2: Local and Fixture Orchestration, Task 3: Remote Orchestration, Task 4: MCP Exposure, Task 5: Documentation, Task 6: Verification and Review

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (8): Acceptance Criteria, Ambiguity Report, Edge Coverage, Non-Goals, Phase 7 Spec: Repeatable Playable Smoke Workflow, Prohibitions, Requirements, User Story

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (8): File Structure, Safe Smoke Cleanup Controls Implementation Plan, Task 1: Cleanup Contract Tests, Task 2: Local Cleanup Behavior, Task 3: Remote Cleanup Behavior, Task 4: MCP Exposure, Task 5: Documentation, Task 6: Verification and Review

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (7): Current Roadmap, Decisions In Effect, Next Action, Project Reference, Project State: Dota Workshop Project, Research Inputs, Verification Notes

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (10): Boundaries, Files, Gameplay Loop, Goal, Lua Markers, Metadata, Minimal Playable Addon Template, Runtime Placement (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (7): File Generation Contract, Gameplay Loop API Notes, Marker Contract, Recommended Minimal Loop, Runtime Smoke Findings, Validation Contract, Why `SetContextThink` Instead of Timers

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (6): Files To Modify, Objective, Out Of Scope, Phase 1 Plan: Plugin and Skill Foundation, Tasks, Verification

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (6): Areas Considered, Deferred, Phase 1: Plugin and Skill Foundation - Discussion Log, Plugin Shape, Reference Set, Skill Guidance

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (6): Files To Modify, Objective, Out Of Scope, Phase 2 Plan: MCP Contract and Addon Template, Tasks, Verification

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (6): Addon Template, Areas Considered, Deferred, Phase 2: MCP Contract and Addon Template - Discussion Log, Runtime Shape, Tool Contract

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (6): Areas Considered, Deferred, Discovery, Launch, Phase 3: Local Windows Workshop Validation - Discussion Log, Validation

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (6): Findings, Open Findings, Phase 4 Review: Remote Windows Target Support, Residual Risk, Resolved, Verification After Review

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (6): Delivered, Evidence, Outcome, Phase 5 Summary: Runtime Marker Validation, Requirements, Verification

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): Finding 1: Unsafe map names reached launch command construction, Findings, Phase 5 Review: Runtime Marker Validation, Re-Review, Scope, Verification Reviewed

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (6): Delivered, Evidence, Outcome, Phase 6 Summary: Playable Gameplay Loop MVP, Requirements, Runtime Notes

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (6): Addon, Cleanup, Evidence, Findings, Phase 6 Remote Runtime Smoke, Target Handling

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (6): F1: Successful transcripts included every missing-marker retry, F2: Repeat remote smoke can fail when a prior Dota process is still running, Findings, Phase 7 Review: Repeatable Playable Smoke Workflow, Residual Risk, Review Result

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (6): Core Workflow, Dota 2 Workshop Tools, Editing Rules, MCP Tool Contract, Supported Boundaries, When To Use MCP

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (6): Candidate Commands, Discovery First, Explicit Smoke Cleanup, Repeatable Playable Smoke, Validation, Workshop Tools Launch Flow

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (6): Evidence Requirements, Interactive Launches, Remote Windows Control, Same Logical Tools, Secrets, Supported Channels

### Community 47 - "Community 47"
Cohesion: 0.09
Nodes (37): checkRequiredPath(), discoverCandidateRoots(), discoverEnvironment(), DiscoverEnvironmentInput, installPaths(), readSteamLibraryRoots(), validateInstallRoot(), ValidateInstallRootInput (+29 more)

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (5): Follow-up, Phase 1 Summary: Plugin and Skill Foundation, Requirement Coverage, Verification, What Changed

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (5): Follow-up, Phase 2 Summary: MCP Contract and Addon Template, Requirement Coverage, Verification, What Changed

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (5): Objective, Out Of Scope, Phase 3 Plan: Local Windows Workshop Validation, Tasks, Verification

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (5): Manual Smoke Status, Phase 3 Summary: Local Windows Workshop Validation, Requirement Coverage, Verification, What Changed

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): Objective, Out Of Scope, Phase 4 Plan: Remote Windows Target Support, Tasks, Verification

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (5): Manual Smoke Status, Phase 4 Summary: Remote Windows Target Support, Requirement Coverage, Verification, What Changed

### Community 54 - "Community 54"
Cohesion: 0.33
Nodes (5): Areas Considered, Credential Handling, Phase 4: Remote Windows Target Support - Discussion Log, Remote Contract, Verification

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (5): Findings, Important: Stale Process Evidence Could Be Accepted, Interactive Remote Launch Review, Re-Review Result, Residual Risk

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (5): Boundaries, Current Evidence, Decisions, Phase 5 Context: Runtime Marker Validation, Purpose

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (5): Inputs, Investigation, Phase 5 Discussion Log, Rejected Approaches, Selected Approach

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (5): Conclusion, Evidence, Runtime Marker Remote Smoke Evidence, Scope, Setup

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (5): Acceptance Criteria, Non-Goals, Phase 5 Spec: Runtime Marker Validation, Requirements, User Story

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (5): Acceptance Criteria, Non-Goals, Phase 6 Spec: Playable Gameplay Loop MVP, Requirements, User Story

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (5): F1: Local cleanup on non-Windows hosts fell through to command failure, Findings, Phase 8 Review: Safe Smoke Cleanup Controls, Residual Risk, Review Result

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (5): Commands, Phase 8 Verification: Safe Smoke Cleanup Controls, Real Windows Cleanup, Requirement Evidence, Test Coverage

### Community 63 - "Community 63"
Cohesion: 0.33
Nodes (5): Implementation Rules, Project Focus, Project Instructions, Scope Discipline, Validation

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (5): Content Files, Dota 2 Addon Layout, Roots, Runtime Files, Safety Rules

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (5): compilerOptions, rootDir, exclude, extends, include

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (4): Evidence, Remaining Runtime Limit, Remote Windows Smoke Evidence, Scope

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (4): Phase 5 Plan: Runtime Marker Validation, Scope, Tasks, Verification

### Community 68 - "Community 68"
Cohesion: 0.40
Nodes (4): Automated Verification, Coverage, Manual/Real Target Verification, Phase 6 Verification: Playable Gameplay Loop MVP

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (4): Follow-Up Candidates, Phase 7 Summary: Repeatable Playable Smoke Workflow, Verification Notes, What Changed

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (4): Commands, Phase 7 Verification: Repeatable Playable Smoke Workflow, Real Windows Smoke, Runtime Caveat

### Community 71 - "Community 71"
Cohesion: 0.40
Nodes (4): Follow-Up Candidates, Phase 8 Summary: Safe Smoke Cleanup Controls, Verification Notes, What Changed

### Community 73 - "Community 73"
Cohesion: 0.18
Nodes (10): Community Hubs (Navigation), Corpus Check, God Nodes (most connected - your core abstractions), Graph Freshness, Graph Report - dota-workshop-project  (2026-07-06), Import Cycles, Knowledge Gaps, Suggested Questions (+2 more)

### Community 74 - "Community 74"
Cohesion: 0.25
Nodes (7): Acceptance, Ambiguity Score, Goal, Phase 9 Spec: Runtime Placement MVP, Placement Contract, Runtime Markers, Scope

### Community 75 - "Community 75"
Cohesion: 0.29
Nodes (6): Constraints, Current Baseline, Desired Delta, Integration Points, Phase 9 Context: Runtime Placement MVP, Verification Plan

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (5): Deferred Work, Implementation Tasks, Phase 9 Plan: Runtime Placement MVP, Risk Controls, Test-First Slices

### Community 77 - "Community 77"
Cohesion: 0.33
Nodes (5): F1: Placement on `template: "minimal"` produced misleading evidence, Findings, Phase 9 Review: Runtime Placement MVP, Residual Risk, Review Result

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (5): Commands, Phase 9 Verification: Runtime Placement MVP, Real Windows Placement Smoke, Requirement Evidence, Test Coverage

### Community 79 - "Community 79"
Cohesion: 0.40
Nodes (4): Key Files, Phase 9 Summary: Runtime Placement MVP, Verification Summary, What Changed

### Community 80 - "Community 80"
Cohesion: 0.16
Nodes (20): customGameArgs(), defaultExecutor(), defaultLogPaths(), execFileAsync, launchCustomGame(), LaunchCustomGameInput, LaunchDotaInput, LaunchOutput (+12 more)

### Community 81 - "Community 81"
Cohesion: 0.20
Nodes (19): GameplayObjective, RuntimePlacement, compactTranscriptResults(), generatePlayableSmokeAddonName(), isRetryableValidationMiss(), playableSmokeMarkers(), pollValidation(), prepareCustomMapForSmoke() (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.26
Nodes (19): validateAddonName(), validateCleanupInput(), launchDota(), launchTools(), readConsoleOrLogs(), prepareCustomMap(), prepareRemoteCustomMap(), validatePrepareInput() (+11 more)

### Community 83 - "Community 83"
Cohesion: 0.20
Nodes (17): cleanupFromStdout(), CleanupOutput, cleanupPaths(), CleanupPayload, cleanupPlayableSmoke(), CleanupPlayableSmokeInput, CleanupProcess, cleanupProcessScript() (+9 more)

### Community 84 - "Community 84"
Cohesion: 0.15
Nodes (12): Acceptance Criteria, Ambiguity Report, Background, Boundaries, Completion Notes, Constraints, Edge Coverage, Goal (+4 more)

### Community 85 - "Community 85"
Cohesion: 0.15
Nodes (12): 1. Tests First, 2. Objective Types and Validation, 3. Lua Rendering, 4. Schema, Server, and Remote Parity, 5. Smoke Orchestration, 6. Documentation, 7. Verification, 8. Independent Review (+4 more)

### Community 86 - "Community 86"
Cohesion: 0.17
Nodes (11): 1. Schema and Tool Exposure, 2. Local and Fixture Map Preparation, 3. Remote Map Preparation, 4. Smoke Orchestration, 5. Documentation, 6. Verification, 7. Independent Review, Expected Files (+3 more)

### Community 87 - "Community 87"
Cohesion: 0.17
Nodes (11): Acceptance Criteria, Ambiguity Report, Background, Boundaries, Constraints, Edge Coverage, Goal, Interview Log (+3 more)

### Community 88 - "Community 88"
Cohesion: 0.22
Nodes (8): server, transport, createServer(), objectiveInput, placementInput, targetInput, unitAbilityScaffoldInput, asToolContent()

### Community 89 - "Community 89"
Cohesion: 0.22
Nodes (8): Acceptance Criteria, Background, Boundaries, Goal, Interview Log, Phase 11: Gameplay Objective MVP - Specification, Prohibitions, Requirements

### Community 90 - "Community 90"
Cohesion: 0.25
Nodes (7): Deferred Ideas, Existing Code Insights, Implementation Decisions, Phase 10 Context: Custom Map Spawn Point MVP, Phase Boundary, Remote Windows Research Notes, Specific Ideas

### Community 91 - "Community 91"
Cohesion: 0.25
Nodes (7): Contract Review, Default Compatibility, Documentation Review, Files Reviewed, Findings, Phase 11: Gameplay Objective MVP - Independent Review, Scope Review

### Community 92 - "Community 92"
Cohesion: 0.29
Nodes (6): Artifacts This Phase Produces, Must Haves, Objective, Phase 12 Plan: Unit Ability Scaffolding MVP, Tasks, Verification Commands

### Community 93 - "Community 93"
Cohesion: 0.29
Nodes (6): Deferred Ideas, Existing Code Insights, Implementation Decisions, Phase 12: Unit Ability Scaffolding MVP - Context, Phase Boundary, Specific Ideas

### Community 94 - "Community 94"
Cohesion: 0.29
Nodes (6): Checks Performed, Findings, Phase 12 Independent Review: Unit Ability Scaffolding MVP, Residual Risk, Review Outcome, Review Scope

### Community 95 - "Community 95"
Cohesion: 0.57
Nodes (7): createAddon(), validateGameplayObjective(), validateMapName(), validateRuntimePlacement(), validateUnitAbilityScaffold(), validateRemoteAddonInput(), validateSmokeInput()

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (5): Decisions, Delivered, Next, Phase 10 Summary: Custom Map Spawn Point MVP, Validation

### Community 97 - "Community 97"
Cohesion: 0.33
Nodes (5): Checks, Findings, Phase 10 Independent Review, Residual Risk, Reviewed Surface

### Community 98 - "Community 98"
Cohesion: 0.33
Nodes (5): Deferred Ideas, Existing Code Insights, Implementation Decisions, Phase 11: Gameplay Objective MVP - Context, Phase Boundary

### Community 99 - "Community 99"
Cohesion: 0.33
Nodes (5): Acceptance Mapping, Contract Checks, Local Verification, Phase 11: Gameplay Objective MVP - Verification, Real Windows Validation

### Community 100 - "Community 100"
Cohesion: 0.33
Nodes (5): Delivered, Next Work, Phase 12 Summary: Unit Ability Scaffolding MVP, Tests Added, Verification

### Community 101 - "Community 101"
Cohesion: 0.33
Nodes (5): Local Verification, Phase 12 Verification: Unit Ability Scaffolding MVP, Real Windows Verification, Requirement Trace, Residual Risk

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (4): Local Verification, Phase 10 Verification: Custom Map Spawn Point MVP, Real Findings Folded Back, Real Windows Validation

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (4): Delivered, Next Work, Phase 11: Gameplay Objective MVP - Summary, Verification

## Knowledge Gaps
- **728 isolated node(s):** `node`, `name`, `version`, `description`, `type` (+723 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Communities (80 total, 1 thin omitted)` connect `Community 4` to `Community 73`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `createFailureResult()` connect `Community 82` to `Community 0`, `Community 2`, `Community 5`, `Community 47`, `Community 80`, `Community 81`, `Community 83`, `Community 95`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `node`, `name`, `version` to the rest of the system?**
  _728 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08108108108108109 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
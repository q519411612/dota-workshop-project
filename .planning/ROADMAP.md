# Roadmap: Dota Workshop Project

**Created:** 2026-07-03
**Updated:** 2026-07-07
**Mode:** Vertical MVP
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Milestones

- [x] **v1.1 Workshop MVP** - 13 delivery slices shipped on 2026-07-06.
- [x] **v1.2 Publishing Readiness** - dry-run release/package readiness before real Workshop upload automation.
- [x] **v1.3 Windows Validation Closure** - sanitized real Windows evidence for the remaining local/same-machine smoke gap.
- [x] **v1.4 Plugin Install Handoff Readiness** - local plugin readiness verification before operator handoff.
- [x] **v1.5 Operator Runbook and Example Workflows** - checked operator runbook and reusable safe workflow examples.
- [x] **v1.6 Release Candidate Audit Gate** - local RC gate before any broader handoff or publishing work.
- [x] **v1.7 Release Handoff Bundle Readiness** - local handoff report before external operator delivery or release review.
- [x] **v1.8 Milestone Archive and Release Notes Readiness** - local closeout report for v1.2-v1.7 release readiness history.
- [x] **v1.9 Same-Machine Windows Local Smoke Evidence** - local harness and sanitized evidence verifier for MCP running directly on Windows.
- [x] **v1.10 Release Bundle Manifest / Source Snapshot Dry Run** - deterministic source snapshot manifest without archive, signing, encryption, or upload.
- [x] **v1.11 Addon Metadata Polish** - richer addon metadata generation and dry-run metadata blockers.
- [x] **v1.12 Minimal Runtime Ability Proof** - explicit Lua ability marker proof harness without claiming real runtime evidence unless logs prove it.
- [x] **v1.13 Local Install Simulation** - isolated temporary plugin install simulation without global install or environment mutation.

## Active Work

### v1.13 Local Install Simulation

Goal: add a local-only install simulation that proves the plugin structure can be consumed from an isolated temporary directory without writing global install paths, mutating the user environment, storing credentials, or connecting to Windows.

Scope:

- Add `npm run verify:install-simulation`.
- Copy or reference plugin manifest, skill files, MCP config, package metadata, package entrypoint, and dist entrypoint in a temporary simulation root.
- Validate consumer-facing structure, path isolation, cleanup, sensitive-material exclusion, and environment non-mutation.
- Keep the slice free of global installation, user config writes, Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, remote Windows connections, Dota runtime work, network access, and UI automation.

### Phase 1: Local Install Simulation

**Status:** Complete
**Goal:** Add isolated local install simulation verifier, tests, and review artifacts.
**Requirements:** INSTALL-01, INSTALL-02, INSTALL-03, INSTALL-04, INSTALL-05, INSTALL-06
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-local-install-simulation/01-SPEC.md`
- `.planning/phases/01-local-install-simulation/01-01-PLAN.md`

**In scope:**

- Local-only install simulation command.
- Temporary simulation root with plugin manifest, skill files, MCP config, package metadata, package entrypoint, and dist entrypoint.
- Consumer contract checks for manifest, MCP config, package bin, and skill presence.
- Cleanup and environment safety evidence.
- Sensitive-material scanning without value leakage.

**Out of scope:**

- Global plugin installation, user config writes, package publishing, registry publishing, archive creation, package signing, content encryption, Workshop upload, Steam login, Steam Guard handling, remote Windows connections, Dota runtime work, network access, or UI automation.

**Outcome:**

- Added `npm run verify:install-simulation`.
- Added an isolated temporary plugin layout verifier for manifest, MCP config, package metadata, dist entrypoint, and skill file readiness.
- Added cleanup evidence proving the temporary simulation root is removed by default.
- Added selected environment variable non-mutation evidence and global install boundary evidence.
- Added sensitive-material blockers that report category and relative path without leaking matched values.
- Added README and operator runbook coverage for the simulation gate.

### Phase 2: Audit Gap Closure

**Status:** In Progress
**Goal:** Close the v1.13 sensitive-material scanning and requirement-traceability gaps found by the milestone audit.
**Requirements:** INSTALL-01, INSTALL-02, INSTALL-03, INSTALL-04, INSTALL-05, INSTALL-06
**Depends on:** Phase 1
**Canonical refs:**

- `.planning/v1.13-MILESTONE-AUDIT.md`
- `.planning/phases/02-audit-gap-closure/02-SPEC.md`
- `.planning/phases/02-audit-gap-closure/02-01-PLAN.md`
- `.planning/phases/02-audit-gap-closure/02-02-PLAN.md`

**In scope:**

- Scan copied YAML and YML text inputs without leaking matched values.
- Add regression coverage for the real copied skill metadata path.
- Keep cleanup and structured blocker behavior intact.
- Remove duplicate missing-dist blocker evidence if the change remains local.
- Restore per-requirement traceability across requirements, verification, summary, and state artifacts.

**Out of scope:**

- New install simulation features, global installation, user config writes, publishing, Windows runtime work, network access, or UI automation.

## Latest Completed Work

### v1.12 Minimal Runtime Ability Proof

Goal: add a minimal Lua ability marker proof on top of the existing unit and ability KV scaffold while keeping real runtime ability evidence pending unless actual Windows Dota logs contain the expected marker.

Scope:

- Add an explicit ability proof option to the existing unit ability scaffold.
- Generate a minimal Lua ability marker file and link it from ability KV.
- Expose marker expectations and validation contract evidence for local tests and smoke validation.
- Keep harness readiness separate from real Windows runtime evidence.
- Keep the slice free of Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, UI automation, broad gameplay expansion, Panorama, TypeScript-to-Lua, React, or Excel-to-KV.

### Phase 1: Minimal Runtime Ability Proof

**Status:** Complete
**Goal:** Add explicit Lua ability marker proof generation and local validation contract tests.
**Requirements:** ABILITY-01, ABILITY-02, ABILITY-03, ABILITY-04, ABILITY-05
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-minimal-runtime-ability-proof/01-SPEC.md`
- `.planning/phases/01-minimal-runtime-ability-proof/01-01-PLAN.md`

**In scope:**

- Schema parsing for the explicit proof option.
- Generated ability Lua marker proof file.
- Unit KV and ability KV link checks.
- Marker expectation helpers and smoke validation contract.
- Local-only tests and review artifacts that do not require Dota, Steam, Workshop Tools, Windows, or network access.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, UI automation, complex gameplay systems, Panorama, TypeScript-to-Lua, React, Excel-to-KV, or claimed runtime ability success without real marker logs.

**Outcome:**

- Added an explicit `unitAbilityScaffold.abilityProof` option.
- Generated ability proof Lua files under `scripts/vscripts/abilities` and linked them from ability KV with `ScriptFile`.
- Added deterministic ability proof loaded and spawned marker expectations.
- Smoke validation now expects ability proof markers only when the proof option is requested.
- Local tests prove schema parsing, generated files, KV links, inspect evidence, fixture validation pass, and missing marker failure.
- Real Windows runtime ability evidence remains pending until sanitized runtime logs contain the expected markers.

### v1.11 Addon Metadata Polish

Goal: polish generated addon metadata and dry-run release metadata checks for title, author, description, version, default map, maps entry, missing-field blockers, placeholder blockers, and release report evidence.

Scope:

- Enhance generated `addoninfo.txt` metadata.
- Extend dry-run release metadata checks.
- Cover missing metadata fields and placeholder values with blockers.
- Add metadata report evidence suitable for release review.
- Keep the slice free of Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, Dota runtime work, or UI automation.

### Phase 1: Addon Metadata Polish

**Status:** Complete
**Goal:** Enhance addon metadata generation and dry-run release metadata checks.
**Requirements:** META-01, META-02, META-03, META-04, META-05
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-addon-metadata-polish/01-SPEC.md`
- `.planning/phases/01-addon-metadata-polish/01-01-PLAN.md`

**In scope:**

- `addoninfo.txt` title, author, description, version, default map, and maps entry generation.
- Dry-run release metadata checks for missing fields and placeholders.
- Metadata report evidence and release blocker counts.
- Local-only tests and review artifacts.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, UI automation, or new gameplay/toolchain features.

**Outcome:**

- Generated `addoninfo.txt` now includes title, author, description, version, default map, and maps entry.
- Dry-run release metadata checks now cover addon version, default map, and maps entry in addition to existing release metadata.
- Missing and placeholder metadata fields produce release blockers and are included in the blocker count.
- Local and remote dry-run release metadata key lists remain aligned.
- No Steam, Workshop upload, encryption, signing, archive, or publishing behavior was added.

### v1.10 Release Bundle Manifest / Source Snapshot Dry Run

Goal: establish a deterministic, credential-free source snapshot manifest dry run for release handoff review without creating an archive, signing, encrypting, publishing, uploading, or mutating external state.

Scope:

- Add a source snapshot manifest generator.
- Add `npm run verify:source-snapshot` as a local-only dry-run manifest gate.
- Include repository-relative file entries with byte sizes and SHA-256 hashes.
- Include version, generation time, commit identity, verification summaries, and release boundary statements.
- Keep the command free of archive creation, package signing, content encryption, upload, Steam login, Steam Guard handling, credential storage, remote Windows connections, network access, global install, Dota runtime work, or UI automation.

### Phase 1: Release Bundle Manifest / Source Snapshot Dry Run

**Status:** Complete
**Goal:** Add deterministic source snapshot manifest generation, verifier command, tests, and review artifacts.
**Requirements:** SNAPSHOT-01, SNAPSHOT-02, SNAPSHOT-03, SNAPSHOT-04, SNAPSHOT-05, SNAPSHOT-06
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-release-bundle-manifest-source-snapshot-dry-run/01-SPEC.md`
- `.planning/phases/01-release-bundle-manifest-source-snapshot-dry-run/01-01-PLAN.md`

**In scope:**

- Manifest schema and generator.
- Deterministic file inventory with SHA-256 coverage.
- Verification summaries and release boundary statements.
- Sensitive material scanning without value leakage.
- Local-only verifier command and tests.

**Out of scope:**

- Archive creation, package signing, content encryption, package publishing, registry publishing, real Workshop upload, Steam login, Steam Guard handling, network access, remote Windows connections, SSH, PowerShell Remoting, global installation, UI automation, or new gameplay/toolchain features.

**Outcome:**

- Added `npm run verify:source-snapshot`.
- Added a deterministic source snapshot manifest generator with repository-relative file inventory, byte sizes, SHA-256 hashes, version data, commit data, verification summaries, and release boundaries.
- Added sensitive material scanning that reports relative path and category without file content or secret value leakage.
- The manifest dry run excludes graph freshness output, generated dependency/output trees, and OS metadata.
- Local verification passes without creating an archive, signing, encrypting, publishing, uploading, connecting to Windows, or mutating global install state.

### v1.9 Same-Machine Windows Local Smoke Evidence

Goal: establish a local, credential-free same-machine Windows smoke evidence harness that can be verified on macOS and can only mark real runtime evidence passed when sanitized Windows log or console markers are present.

Scope:

- Add a same-machine smoke evidence schema and verifier.
- Add `npm run verify:same-machine-smoke` as a local-only harness gate.
- Add a runbook for collecting sanitized same-machine Windows evidence when the MCP server runs directly on Windows.
- Distinguish `harness_ready`, `runtime_pending`, and `runtime_passed` without treating harness evidence as real runtime success.
- Keep the command free of Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, credential storage, remote Windows connections, network access, Dota runtime work, or UI automation.

### Phase 1: Same-Machine Windows Local Smoke Evidence

**Status:** Complete
**Goal:** Add sanitized same-machine smoke evidence schema, verifier, runbook, tests, and local harness command.
**Requirements:** LOCAL-SMOKE-01, LOCAL-SMOKE-02, LOCAL-SMOKE-03, LOCAL-SMOKE-04, LOCAL-SMOKE-05, LOCAL-SMOKE-06
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-same-machine-windows-local-smoke-evidence/01-SPEC.md`
- `.planning/phases/01-same-machine-windows-local-smoke-evidence/01-01-PLAN.md`

**In scope:**

- Local evidence artifact schema and verifier.
- Status separation for harness readiness and real runtime proof.
- Sanitization scanning for private paths, host/user/account fields, credentials, tokens, and keys.
- Runbook for safe same-machine Windows collection.
- Local-only command and tests.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, SSH, PowerShell Remoting, UI automation, or new gameplay/toolchain features.

**Outcome:**

- Added `npm run verify:same-machine-smoke`.
- Added a same-machine smoke evidence verifier with `harness_ready`, `runtime_pending`, and `runtime_passed` status separation.
- Added sanitization checks for credential-like values, private paths, host/user/account fields, tokens, and keys without echoing sensitive values.
- Added a runbook for collecting same-machine Windows evidence with sanitized marker logs.
- Local harness verification passes and reports real same-machine Windows runtime evidence as pending rather than passed.

### v1.8 Milestone Archive and Release Notes Readiness

Goal: establish a local, credential-free milestone closeout and release notes readiness report that aggregates v1.2-v1.7 goals, commits, delivery summaries, verification status, documentation coverage, release boundaries, and remaining non-blocking items.

Scope:

- Add `npm run verify:milestone` as a local-only gate.
- Reuse the existing handoff gate as the milestone preflight.
- Report v1.2-v1.7 version inventory with commit SHAs, goals, key delivery summaries, verification status, known boundaries, and remaining non-blocking items.
- Check README, operator runbook, and handoff readiness output for review and handoff support.
- Keep the command free of Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, credential storage, remote Windows connections, network access, Dota runtime work, or UI automation.

### Phase 1: Milestone Archive and Release Notes Readiness

**Status:** Complete
**Goal:** Add `npm run verify:milestone`, structured milestone closeout evidence, tests, and docs.
**Requirements:** MILESTONE-01, MILESTONE-02, MILESTONE-03, MILESTONE-04, MILESTONE-05, MILESTONE-06, MILESTONE-07
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-milestone-archive-release-notes-readiness/01-SPEC.md`
- `.planning/phases/01-milestone-archive-release-notes-readiness/01-01-PLAN.md`

**In scope:**

- Local milestone closeout report command.
- Handoff gate preflight reuse.
- v1.2-v1.7 version inventory and commit range reporting.
- Documentation and handoff output coverage checks.
- Explicit no-upload/no-login/no-credential/no-remote boundary reporting.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, Windows smoke, remote smoke, SSH, PowerShell Remoting, MCP runtime target operations, UI automation, or new gameplay/toolchain features.

**Outcome:**

- Added `npm run verify:milestone`.
- Added a structured local milestone closeout verifier and CLI.
- The milestone report records the v1.2-v1.7 commit range, version inventory, goals, delivery summaries, verification status, documentation status, release boundaries, and remaining non-blocking items.
- The verifier reuses `verify:handoff` as the preflight and checks README, operator runbook, and handoff output coverage.
- README and the operator runbook now include the milestone closeout gate after `verify:handoff`.

### v1.7 Release Handoff Bundle Readiness

Goal: establish a local, credential-free handoff readiness report that aggregates commit identity, `verify:rc` evidence, plugin/package entrypoints, MCP config, skill references, workflow examples, operator runbook coverage, README coverage, and explicit publishing boundaries.

Scope:

- Add `npm run verify:handoff` as a local-only gate.
- Reuse the existing RC gate as the handoff preflight.
- Report the handoff delivery checklist for plugin manifest, MCP config, package metadata, built entrypoint, skill references, README, runbook, and examples.
- Check README and operator runbook coverage for installation, verification, safe runtime operation, and credential boundaries.
- Keep the command free of Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, credential storage, remote Windows connections, network access, Dota runtime work, or UI automation.

### Phase 1: Release Handoff Bundle Readiness

**Status:** Complete
**Goal:** Add `npm run verify:handoff`, structured handoff report evidence, tests, and docs.
**Requirements:** HANDOFF-01, HANDOFF-02, HANDOFF-03, HANDOFF-04, HANDOFF-05, HANDOFF-06, HANDOFF-07
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-release-handoff-bundle-readiness/01-SPEC.md`
- `.planning/phases/01-release-handoff-bundle-readiness/01-01-PLAN.md`

**In scope:**

- Local handoff report command.
- RC gate preflight reuse.
- Delivery checklist and documentation coverage checks.
- Explicit no-upload/no-login/no-credential/no-remote boundary reporting.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, Windows smoke, remote smoke, SSH, PowerShell Remoting, MCP runtime target operations, UI automation, or new gameplay/toolchain features.

**Outcome:**

- Added `npm run verify:handoff`.
- Added a structured local handoff verifier and CLI.
- The handoff report records commit SHA, RC preflight status, delivery checklist items, documentation coverage, and explicit release boundaries.
- The report sanitizes RC command output so repository absolute paths are not leaked.
- README and the operator runbook now include the handoff gate after `verify:rc`.

### v1.6 Release Candidate Audit Gate

Goal: establish a local `verify:rc` gate that aggregates plugin/package readiness, examples/schema validation, build/test checks, strict sensitive information scanning, and explicit no-upload/no-login/no-encryption boundary checks.

Scope:

- Add `npm run verify:rc` as a local-only gate.
- Run existing readiness commands through a structured verifier.
- Scan repository-owned text files for credential/private-target material and unsafe publishing automation.
- Document the gate in README and the operator runbook.
- Avoid Windows runtime work, real Workshop upload, Steam login, Steam Guard, content encryption, package signing, and credential storage.

### Phase 1: Release Candidate Audit Gate

**Status:** Complete
**Goal:** Add `npm run verify:rc`, structured RC gate evidence, tests, and docs.
**Requirements:** RC-01, RC-02, RC-03, RC-04, RC-05, RC-06, RC-07
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-release-candidate-audit-gate/01-SPEC.md`
- `.planning/phases/01-release-candidate-audit-gate/01-01-PLAN.md`

**In scope:**

- Local command aggregation.
- Repository-owned text scanning.
- Publishing boundary failure checks.
- Documentation and test coverage.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard, content encryption, package signing, archive creation, Windows smoke, remote smoke, UI automation, or new gameplay/toolchain features.

**Outcome:**

- Added `npm run verify:rc`.
- Added a structured RC verifier and CLI.
- The gate runs plugin readiness, example/schema tests, typecheck, full tests, build, and repository hygiene scanning.
- The scanner excludes generated dependency/output trees and `.planning/graphs` freshness output.
- Documentation now places the RC gate before handoff or optional remote smoke.

## Completed Work

<details>
<summary>v1.1 Workshop MVP - shipped 2026-07-06</summary>

Historical details:

- Roadmap archive: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Audit archive: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`
- Execution history: `.planning/milestones/v1.1-phases/`

Delivered capabilities:

- Plugin packaging and Dota 2 Workshop Tools skill guidance.
- Unified MCP contract for fixture, local Windows, and remote Windows targets.
- Minimal addon generation, inspection, launch construction, and evidence-driven validation.
- Remote Windows discovery, file/process execution, runtime launch, and log validation.
- Runtime marker validation through Dota `game/dota/console.log`.
- Playable Lua gameplay loop with score and win-condition markers.
- Repeatable playable smoke workflow and explicit addon-scoped cleanup controls.
- Runtime placement markers and custom map spawn point preparation from the installed template map.
- Configurable score objective markers.
- Minimal custom unit and linked ability KV scaffolding.
- Panorama, toolchain, and publishing preflight inspection without UI generation or Workshop upload automation.

Known residual items:

- Same-machine local Windows smoke was not separately recorded; real Windows validation used the remote Windows target path.
- Publishing preflight is inspection-only and does not run build pipelines, encrypt content, store credentials, or upload to Workshop.
- Runtime ability behavior, complex gameplay systems, generated Panorama UI, TypeScript-to-Lua, Excel-to-KV, and real publishing remain deferred.

</details>

## Completed Work

### v1.2 Publishing Readiness

Goal: turn the inspection-only publishing preflight into a stricter release-readiness workflow before any real Workshop upload automation.

Scope:

- Package/build readiness checks that can run without Steam credentials.
- Addon metadata completeness and publish-blocker reporting.
- Secret and private target data scans before packaging.
- Dry-run release report suitable for manual review.
- Clear boundary around Steam login, encryption, and actual Workshop upload.

### Phase 1: Release Package Preflight MVP

**Status:** Complete
**Goal:** Add a deterministic `dry_run_release_report` MCP operation for release/package preflight, addon metadata completeness, sensitive information scanning, and manual publishing boundary reporting.
**Requirements:** PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07, PUB-08
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-release-package-preflight-mvp/01-SPEC.md`
- `.planning/phases/01-release-package-preflight-mvp/01-01-PLAN.md`

**In scope:**

- Fixture, local, and remote target support through the existing target contract.
- Metadata completeness blockers for `addoninfo.txt`.
- Package candidate root/file blockers.
- Redacted sensitive information blockers.
- Dry-run release report warnings for Steam login, encryption, and Workshop upload boundaries.

**Out of scope:**

- Real upload, encryption, credential handling, publish-state mutation, archive signing, toolchain execution, or same-machine local Windows smoke as a blocker.

## Completed Work

### v1.3 Windows Validation Closure

Goal: decide whether to close the remaining same-machine local Windows smoke gap.

Scope:

- Run the local Windows target path directly on the Windows machine that has Dota 2 and Workshop Tools installed.
- Record discovery, launch, log, and validation evidence without storing credentials or private host details.
- Add a small verification artifact if the local smoke materially increases confidence beyond the existing remote Windows evidence.

### Phase 1: Windows Validation Closure

**Status:** Complete
**Goal:** Collect sanitized evidence from a user-provided Windows host for Dota/Workshop path discovery and the smallest practical existing smoke workflow.
**Requirements:** VAL-01, VAL-02, VAL-03, VAL-04, VAL-05
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-windows-validation-closure/01-SPEC.md`
- `.planning/phases/01-windows-validation-closure/01-01-PLAN.md`

**In scope:**

- Runtime-only SSH probing of the user-provided Windows host.
- Dota and Workshop Tools path-category evidence.
- Playable smoke marker validation when the environment permits it.
- Fallback addon generation/inspection/dry-run evidence when launch is blocked.
- Sanitized verification and review artifacts.

**Out of scope:**

- Storing connection details, broad cleanup, UI automation, Steam login, encryption, or Workshop upload.

**Outcome:**

- Real Windows validation passed through the remote SSH path on a user-provided Windows host.
- Environment category checks verified Dota executable, Workshop tool-adjacent binaries, addon roots, and Steam manifest.
- Playable smoke addon `validation_closure_20260706_103317` created, inspected, launched, and passed runtime marker validation.
- Dry-run release report returned expected publishing blockers without upload, encryption, or credential handling.
- Addon-scoped cleanup stopped only the matching validation smoke process after dry-run evidence.
- Separate same-machine Windows-local MCP server execution remains unproven and non-blocking.

## Completed Work

### v1.4 Plugin Install Handoff Readiness

Goal: make plugin installation and operator handoff readiness verifiable before anyone installs or uses the plugin outside the repository.

Scope:

- Add a repository-local plugin readiness verifier.
- Check manifest, MCP config, package entrypoint, built server entrypoint, skill references, and documented tool lists.
- Document the handoff command.
- Keep the slice local-only, with no real plugin installation, registry publish, Steam login, encryption, Workshop upload, or credential storage.

### Phase 1: Plugin Readiness Verifier

**Status:** Complete
**Goal:** Add `npm run verify:plugin` to detect plugin/package/skill/documentation drift before handoff.
**Requirements:** HAND-01, HAND-02, HAND-03, HAND-04, HAND-05, HAND-06
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-plugin-install-handoff-readiness/01-SPEC.md`
- `.planning/phases/01-plugin-install-handoff-readiness/01-01-PLAN.md`

**In scope:**

- Local repository verifier and tests.
- Manifest and entrypoint checks.
- Skill reference checks.
- README and skill tool-list drift checks.
- Handoff documentation.

**Out of scope:**

- Global installation, package publishing, archive signing, Steam login, encryption, Workshop upload, or credential storage.

**Outcome:**

- Added `npm run verify:plugin`.
- Added local verifier checks for plugin manifest, MCP config, package bin, built server entrypoint, skill references, README tool list, and skill tool list.
- Fixed skill tool-list drift by removing `link_addon` and adding `remote_command`.
- README now documents plugin handoff readiness commands and the no-credentials boundary.

## Completed Work

### v1.5 Operator Runbook and Example Workflows

Goal: make the validated workflow understandable and reusable through checked docs and schema-valid example inputs.

Scope:

- Add a local operator runbook for build, plugin verification, fixture flow, optional remote smoke, cleanup, preflight, and dry-run release review.
- Add machine-checkable workflow JSON examples.
- Validate examples against existing schemas and scan them for private or credential-like material.
- Keep examples as safe templates only, with no real upload, credentials, or private target data.

### Phase 1: Operator Runbook and Examples

**Status:** Complete
**Goal:** Add `docs/operator-runbook.md`, schema-valid example workflow inputs, tests, and README links.
**Requirements:** RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06
**Canonical refs:**

- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-operator-runbook-example-workflows/01-SPEC.md`
- `.planning/phases/01-operator-runbook-example-workflows/01-01-PLAN.md`

**In scope:**

- Docs and examples.
- Tests for schema validity and secret hygiene.
- README discoverability.

**Out of scope:**

- Real Windows smoke, real Workshop upload, Steam login, encryption, global plugin install, or package publishing.

**Outcome:**

- Added `docs/operator-runbook.md`.
- Added schema-valid examples under `examples/workflows/`.
- Added tests that validate example operations, schemas, README links, and forbidden private/credential-like material.
- README links the runbook and examples.

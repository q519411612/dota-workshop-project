# Roadmap: Dota Workshop Project

**Created:** 2026-07-03
**Updated:** 2026-07-06
**Mode:** Vertical MVP
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Milestones

- [x] **v1.1 Workshop MVP** - 13 delivery slices shipped on 2026-07-06.
- [x] **v1.2 Publishing Readiness** - dry-run release/package readiness before real Workshop upload automation.
- [x] **v1.3 Windows Validation Closure** - sanitized real Windows evidence for the remaining local/same-machine smoke gap.
- [x] **v1.4 Plugin Install Handoff Readiness** - local plugin readiness verification before operator handoff.
- [x] **v1.5 Operator Runbook and Example Workflows** - checked operator runbook and reusable safe workflow examples.

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

# Roadmap: Dota Workshop Project

**Created:** 2026-07-03
**Updated:** 2026-07-06
**Mode:** Vertical MVP
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Milestones

- [x] **v1.1 Workshop MVP** - 13 delivery slices shipped on 2026-07-06.
- [x] **v1.2 Publishing Readiness** - dry-run release/package readiness before real Workshop upload automation.

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

## Active Work

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

## Next Milestone Candidates

### Optional Validation Closure

Goal: decide whether to close the remaining same-machine local Windows smoke gap.

Candidate scope:

- Run the local Windows target path directly on the Windows machine that has Dota 2 and Workshop Tools installed.
- Record discovery, launch, log, and validation evidence without storing credentials or private host details.
- Add a small verification artifact if the local smoke materially increases confidence beyond the existing remote Windows evidence.

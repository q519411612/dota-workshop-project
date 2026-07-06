# Requirements: v1.8 Milestone Archive and Release Notes Readiness

**Created:** 2026-07-06
**Milestone:** v1.8 Milestone Archive and Release Notes Readiness
**Status:** Complete

## Goal

Create a local, credential-free milestone closeout and release notes readiness report that aggregates the completed v1.2-v1.7 release preparation work into an operator-readable and future-reviewer-readable summary before any real Workshop publishing action.

## Scope

### In Scope

- A repository-local `npm run verify:milestone` command.
- A structured verifier module that emits a JSON report with success state, handoff preflight status, v1.2-v1.7 version list, commit SHAs, commit range, delivery summaries, verification status, documentation status, release boundaries, remaining non-blocking items, evidence, warnings, blockers, paths, commands, and logs where applicable.
- Reuse of the existing handoff verifier as the milestone closeout preflight.
- Checks that README, operator runbook, and handoff readiness output support release review and operator handoff.
- Explicit release boundary entries for no real Workshop upload, no Steam login, no Steam Guard handling, no content encryption, no package signing, no credential storage, and no remote Windows connection.
- Tests that run on macOS without Dota 2, Steam, Workshop Tools, Windows, network access, or remote target credentials.
- GSD verification and independent review artifacts.

### Out of Scope

- Real Workshop upload, publish-state mutation, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, or package distribution.
- Running Dota 2, Workshop Tools, remote Windows smoke, same-machine Windows smoke, SSH, PowerShell Remoting, MCP runtime target operations, or UI automation as part of the milestone gate.
- Reading or storing Steam, GitHub, Windows, remote, token, password, private key, private host, or private target material.
- Adding gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime, or publishing automation capabilities.

## Requirements

### MILESTONE-01 Local Milestone Command

Provide a local milestone closeout readiness command.

Acceptance:

- `package.json` defines `verify:milestone`.
- `verify:milestone` runs from built output.
- The command exits non-zero when any blocker is found.
- The command prints a structured JSON report.

### MILESTONE-02 Handoff Preflight

Reuse the release handoff gate as a milestone closeout preflight.

Acceptance:

- The milestone verifier runs the handoff verifier before marking the milestone ready.
- The report includes handoff readiness status.
- The report includes handoff command results or injected handoff evidence without leaking repository absolute paths.
- Handoff blockers are included in milestone blockers without leaking sensitive values.

### MILESTONE-03 Version Inventory

Report the completed v1.2-v1.7 release preparation history.

Acceptance:

- The report lists v1.2, v1.3, v1.4, v1.5, v1.6, and v1.7.
- Each version records title, commit SHA, goal, key delivery summary, verification status, and known boundary.
- The report records the commit range from v1.2 through v1.7.
- Missing or malformed version inventory entries produce blockers.

### MILESTONE-04 Review Readiness Coverage

Check that operator-facing review materials support handoff and release notes review.

Acceptance:

- README includes build, plugin verification, RC verification, handoff verification, milestone verification, local-only boundary text, and operator runbook link.
- Operator runbook includes install/readiness commands, `verify:plugin`, `verify:rc`, `verify:handoff`, `verify:milestone`, fixture workflow, optional remote smoke, cleanup, and credential boundary text.
- Handoff readiness output includes delivery checklist, documentation coverage, and release boundaries.
- Missing coverage produces blockers with relative file paths.

### MILESTONE-05 Release Boundaries

Make release prohibitions explicit in the milestone report.

Acceptance:

- The report lists no real Workshop upload.
- The report lists no Steam login and no Steam Guard handling.
- The report lists no content encryption.
- The report lists no package signing.
- The report lists no credential or private target storage.
- The report lists no remote Windows connection by the milestone command.
- The command does not perform any of those actions.

### MILESTONE-06 Local-Only Execution

Keep the milestone check deterministic and local-only.

Acceptance:

- The milestone gate does not call Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, or MCP runtime target operations.
- The milestone gate does not require Windows.
- The milestone gate does not require network access.
- The milestone gate does not read credentials from environment variables.

### MILESTONE-07 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted milestone tests pass.
- `npm run build` succeeds.
- `npm run verify:milestone` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, and `npm run verify:handoff` succeed.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.8 requirements, roadmap, spec, and plan exist.
- [x] `verify:milestone` exists and emits structured milestone closeout readiness results.
- [x] Milestone tests cover handoff preflight reuse, v1.2-v1.7 inventory, documentation coverage, release boundaries, and local-only execution.
- [x] README and operator runbook include the milestone gate.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [x] Changes are committed and pushed.

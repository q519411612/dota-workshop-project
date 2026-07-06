# Requirements: v1.7 Release Handoff Bundle Readiness

**Created:** 2026-07-06
**Milestone:** v1.7 Release Handoff Bundle Readiness
**Status:** Complete

## Goal

Create a local, credential-free release handoff report that aggregates the current repository commit, release-candidate verification evidence, plugin/package entrypoints, MCP configuration, skill references, checked examples, operator runbook, and explicit publishing boundaries before any future external handoff or release review.

## Scope

### In Scope

- A repository-local `npm run verify:handoff` command.
- A structured handoff verifier module that emits a JSON report with success state, commit SHA, evidence, warnings, blockers, paths, delivery checklist, verification summary, and release boundaries.
- Reuse of the existing `verify:rc` gate as the handoff preflight.
- Checks that the report covers plugin manifest, MCP config, package entrypoints, skill file and references, README, operator runbook, and workflow examples.
- Checks that README and operator runbook describe installation/readiness commands, local verification, safe optional remote smoke, and credential boundaries.
- Explicit release boundary entries for no real Workshop upload, no Steam login, no Steam Guard handling, no content encryption, no package signing, no credential storage, and no remote Windows connection as part of the handoff report.
- Tests that run on macOS without Dota 2, Steam, Workshop Tools, Windows, network access, or remote target credentials.
- GSD verification and independent review artifacts.

### Out of Scope

- Real Workshop upload, publish-state mutation, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, or global installation.
- Running Dota 2, Workshop Tools, remote Windows smoke, same-machine Windows smoke, SSH, PowerShell Remoting, MCP runtime target operations, or UI automation as part of the handoff gate.
- Reading or storing Steam, GitHub, Windows, remote, token, password, private key, private host, or private target material.
- Adding gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime, or publishing automation capabilities.

## Requirements

### HANDOFF-01 Local Handoff Command

Provide a local handoff readiness command.

Acceptance:

- `package.json` defines `verify:handoff`.
- `verify:handoff` runs from built output.
- The command exits non-zero when any blocker is found.
- The command prints a structured JSON report.

### HANDOFF-02 RC Gate Preflight

Reuse the release-candidate gate as a handoff preflight.

Acceptance:

- The handoff verifier runs the RC verifier before marking handoff ready.
- The report includes `verify:rc` status.
- The report includes RC command results for plugin readiness, example/schema tests, typecheck, tests, and build.
- RC blockers are included in the handoff blockers without leaking sensitive values.

### HANDOFF-03 Delivery Checklist

Report the deliverables an operator needs for handoff.

Acceptance:

- The checklist includes plugin manifest, MCP config, package JSON, built MCP server entrypoint, package bin, verify scripts, skill file, skill references, README, operator runbook, and workflow examples.
- Each checklist item records a label, path, success state, and evidence.
- Missing required checklist items produce blockers.

### HANDOFF-04 Documentation Readiness

Check operator-facing docs for install, verification, and safe operation coverage.

Acceptance:

- README includes build, plugin verification, RC verification, handoff verification, local-only boundary text, and operator runbook link.
- Operator runbook includes install/readiness commands, `verify:plugin`, `verify:rc`, `verify:handoff`, fixture workflow, optional remote smoke, cleanup, and credential boundary text.
- Missing documentation coverage produces blockers with relative file paths.

### HANDOFF-05 Release Boundaries

Make publishing boundaries explicit in the report.

Acceptance:

- The report lists no real Workshop upload.
- The report lists no Steam login and no Steam Guard handling.
- The report lists no content encryption.
- The report lists no package signing.
- The report lists no credential or private target storage.
- The report lists no remote Windows connection by the handoff command.
- The command does not perform any of those actions.

### HANDOFF-06 Local-Only Execution

Keep the handoff check deterministic and local-only.

Acceptance:

- The handoff gate does not call Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, or MCP runtime target operations.
- The handoff gate does not require Windows.
- The handoff gate does not require network access.
- The handoff gate does not read credentials from environment variables.

### HANDOFF-07 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted handoff tests pass.
- `npm run build` succeeds.
- `npm run verify:handoff` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, and `npm run verify:rc` succeed.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.7 requirements, roadmap, spec, and plan exist.
- [x] `verify:handoff` exists and emits structured handoff readiness results.
- [x] Handoff tests cover RC preflight reuse, delivery checklist failures, documentation coverage, and release boundaries.
- [x] README and operator runbook include the handoff gate.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

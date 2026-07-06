# Requirements: v1.4 Plugin Install Handoff Readiness

**Created:** 2026-07-06
**Milestone:** v1.4 Plugin Install Handoff Readiness
**Status:** Complete

## Goal

Make plugin installation and operator handoff readiness verifiable from the repository without needing Dota 2, Steam credentials, Windows credentials, or a real Workshop upload.

## Scope

### In Scope

- A local verification command that checks plugin package readiness before handoff.
- Manifest, MCP config, package entrypoint, built server entrypoint, skill references, and documented tool contract consistency checks.
- Tests that prove the verifier fails on drift and passes on the current repository.
- Documentation that tells operators how to run the verifier before installing or handing off the plugin.
- GSD verification and independent review artifacts for the v1.4 slice.

### Out of Scope

- Installing the plugin into a global Codex profile.
- Publishing a package to npm or any plugin registry.
- Creating archives, signed packages, encrypted packages, or upload-ready bundles.
- Real Workshop upload, Steam login, Steam Guard, content encryption, or publish-state mutation.
- Storing Steam, GitHub, Windows, remote, token, password, private key, or private host material.
- Real Windows smoke as a blocker for this slice.

## Requirements

### HAND-01 Local Plugin Readiness Verifier

Provide a repository-local command for plugin handoff readiness.

Acceptance:

- `npm run verify:plugin` exists and runs against the current repository.
- The command exits non-zero when readiness blockers exist.
- The command exits zero and prints evidence when no blockers exist.
- The command does not require Dota 2, Steam, Windows, network access, or private credentials.

### HAND-02 Manifest and Entrypoint Checks

Verify plugin/package entrypoints point to files that exist after build.

Acceptance:

- The verifier checks `.codex-plugin/plugin.json`.
- The verifier checks `.mcp.json`.
- The verifier checks `package.json`.
- The verifier confirms the plugin skill directory exists.
- The verifier confirms MCP config points to `node ./dist/index.js`.
- The verifier confirms package bin points to the built server entrypoint.

### HAND-03 Skill Reference Checks

Verify skill guidance does not reference missing local reference files.

Acceptance:

- The verifier reads `skills/dota2-workshop-tools/SKILL.md`.
- Every `references/*.md` path mentioned in the skill exists under the skill directory.
- Missing reference files are blockers.

### HAND-04 Tool Contract Drift Checks

Verify documented MCP tool lists match the code tool registry.

Acceptance:

- The verifier compares `toolNames` from code against the README tool list.
- The verifier compares `toolNames` from code against the skill MCP tool contract list.
- Extra documented tools are blockers.
- Missing documented tools are blockers.
- The stale `link_addon` mention is removed or otherwise no longer causes drift.

### HAND-05 Handoff Documentation

Document the operator handoff command.

Acceptance:

- README includes a plugin handoff or installation readiness section.
- The section includes `npm run build` and `npm run verify:plugin`.
- The section repeats that credentials and private target details must not be stored in the repository.

### HAND-06 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted plugin verifier tests pass.
- `npm run verify:plugin` passes after build.
- `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- A strict high-signal secret scan reports no stored credentials.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.4 requirements, roadmap, spec, and plan exist.
- [x] The plugin readiness verifier is implemented and documented.
- [x] Tests prove drift detection.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

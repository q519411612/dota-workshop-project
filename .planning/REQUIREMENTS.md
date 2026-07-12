# Requirements: v1.13 Local Install Simulation

**Created:** 2026-07-07
**Milestone:** v1.13 Local Install Simulation
**Status:** Complete

## Goal

Add a local-only plugin install simulation that proves the plugin structure can be consumed from an isolated temporary directory without performing a global install, changing the user environment, storing credentials, uploading content, or connecting to Windows.

## Scope

### In Scope

- A local install simulation verifier command.
- Temporary directory copy or reference checks for plugin manifest, MCP config, skill files, package metadata, package entrypoint, and built dist entrypoint.
- Output evidence for structure readiness, path isolation, cleanup behavior, and environment non-mutation.
- Sensitive material scanning for copied simulation inputs without leaking secret values.
- Tests for successful simulation, missing required files, cleanup, path isolation, no credential leakage, and no environment pollution.
- GSD verification and independent review artifacts.

### Out of Scope

- Global plugin installation.
- User environment mutation.
- Codex config directory writes.
- Package publishing, registry publishing, archive creation, package signing, content encryption, Workshop upload, Steam login, Steam Guard handling, remote Windows connections, Dota runtime work, network access, or UI automation.

## Requirements

### INSTALL-01 Simulation Command

Expose a local verifier for install simulation.

Acceptance:

- `package.json` includes `verify:install-simulation`.
- The command runs from built output.
- The command reports structured `ok`, evidence, blockers, warnings, paths, and cleanup state.

### INSTALL-02 Isolated Install Layout

Build a temporary simulation layout that an install consumer can inspect.

Acceptance:

- The simulation root is created under a temporary parent, not under the repository source tree.
- The simulation includes `.codex-plugin/plugin.json`.
- The simulation includes `.mcp.json`.
- The simulation includes `package.json`.
- The simulation includes `dist/index.js`.
- The simulation includes the Dota Workshop skill directory and skill file.

### INSTALL-03 Consumer Contract Checks

Validate plugin structure from the simulated layout.

Acceptance:

- Plugin manifest points skills to `./skills/`.
- Plugin manifest points MCP servers to `./.mcp.json`.
- MCP config points to `node ./dist/index.js`.
- Package bin points to `./dist/index.js`.
- Required skill files are present.
- Missing required files produce blockers with relative labels.

### INSTALL-04 Cleanup And Environment Safety

Prove the simulation is local and self-cleaning.

Acceptance:

- The simulation removes its temporary root by default.
- Cleanup evidence reports that the temporary root no longer exists.
- Tests prove the simulation does not mutate selected environment variables.
- The verifier does not write global install paths or user config directories.

### INSTALL-05 Sensitive Material Exclusion

Reject credential or private target material in simulation inputs.

Acceptance:

- Credential-like values, tokens, private keys, private host paths, and private user paths produce blockers.
- Blockers report category and repository-relative path without leaking the matched value.
- Tests prove blocker output does not include the secret value.

### INSTALL-06 Local Verification And Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted install simulation tests pass.
- `npm run verify:install-simulation` passes.
- `npm run build` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone` succeed.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.13 requirements, roadmap, spec, and plan exist.
- [x] Local install simulation verifier exists and is scriptable.
- [x] Simulation validates plugin manifest, skill, MCP config, package entrypoint, and dist entrypoint.
- [x] Simulation proves path isolation, cleanup, no credentials, and no environment pollution.
- [x] Local tests and gates pass.
- [x] Independent review is recorded.
- [x] Changes are committed and pushed.

## Traceability

| Requirement | Delivery | Verification | Status |
|---|---|---|---|
| INSTALL-01 | `package.json`, `src/verify-install-simulation.ts` | Built CLI and structured-result checks in `tests/install-simulation.test.ts` | satisfied |
| INSTALL-02 | `src/install-simulation.ts` temporary layout copy | Isolated layout and cleanup assertions in `tests/install-simulation.test.ts` | satisfied |
| INSTALL-03 | Manifest, MCP, package, dist, and skill contract checks | Consumer contract assertions and unique missing-dist blocker regression | satisfied |
| INSTALL-04 | Environment snapshot and `finally` cleanup | Success and blocker paths prove environment stability and root removal | satisfied |
| INSTALL-05 | YAML/YML-aware sensitive-material scan | Real `agents/openai.yaml` path, case variants, redaction, and cleanup regression | satisfied |
| INSTALL-06 | Automated gates and independent review artifacts | Phase 1 re-review plus Phase 2 verification and milestone audit | satisfied |

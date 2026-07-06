# Requirements: v1.5 Operator Runbook and Example Workflows

**Created:** 2026-07-06
**Milestone:** v1.5 Operator Runbook and Example Workflows
**Status:** Complete

## Goal

Give operators and future agents a checked runbook and reusable example workflow inputs for the already-validated create/smoke/preflight/release dry-run paths, without storing credentials or performing real Workshop upload behavior.

## Scope

### In Scope

- A local operator runbook that explains the safe order of build, plugin readiness verification, fixture workflow, optional remote smoke, cleanup, preflight, and dry-run release review.
- Machine-checkable example workflow JSON files for fixture create/inspect/preflight/release dry-run and optional remote playable smoke.
- Tests that parse every example and validate it against existing MCP input schemas.
- Tests that scan examples and the runbook for forbidden private credential/host/token material.
- README links to the runbook and examples.
- GSD verification and independent review artifacts.

### Out of Scope

- Running real Windows smoke as part of this slice.
- Real Workshop upload, Steam login, Steam Guard, content encryption, publish-state mutation, package signing, or archive creation.
- Storing Steam, GitHub, Windows, remote, token, password, private key, private host, or private target material.
- Generating a new gameplay feature, Panorama UI, TypeScript-to-Lua project, React project, Excel-to-KV pipeline, or custom ability runtime behavior.
- Global plugin installation or package registry publishing.

## Requirements

### RUN-01 Operator Runbook

Document the safe operator workflow.

Acceptance:

- `docs/operator-runbook.md` exists.
- The runbook includes `npm run build`, `npm run verify:plugin`, fixture validation, optional remote smoke, cleanup, preflight, and dry-run release review.
- The runbook states process launch is not validation success.
- The runbook states credentials and private target details must remain runtime-only.

### RUN-02 Machine-Checkable Examples

Provide reusable workflow input examples.

Acceptance:

- `examples/workflows/fixture-create-addon.json` exists.
- `examples/workflows/fixture-preflight.json` exists.
- `examples/workflows/fixture-release-dry-run.json` exists.
- `examples/workflows/remote-playable-smoke.template.json` exists.
- Examples use operation names that exist in `toolNames`.
- Examples include only schema-valid input payloads.

### RUN-03 Example Safety Scan

Block private or credential-like material in examples and runbook.

Acceptance:

- Tests scan example files and `docs/operator-runbook.md`.
- The scan blocks private host/address material, passwords, tokens, private keys, Steam credentials, and known private target fragments.
- The remote example uses placeholder values only.

### RUN-04 Schema Validation

Validate examples against existing MCP input schemas.

Acceptance:

- Tests parse every example JSON file.
- Each example's `input` validates against the matching schema in `src/schemas.ts`.
- Unknown operations are blockers.

### RUN-05 Discoverability

Expose the runbook and examples from README.

Acceptance:

- README links to `docs/operator-runbook.md`.
- README links to `examples/workflows/`.
- README repeats that examples are dry-run/safe templates and not real upload automation.

### RUN-06 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted example tests pass.
- `npm run verify:plugin` still passes.
- `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- Strict high-signal secret scan reports no stored credentials.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.5 requirements, roadmap, spec, and plan exist.
- [x] Operator runbook exists and is linked.
- [x] Example workflow JSON files exist and are schema-validated.
- [x] Example/runbook safety scan passes.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

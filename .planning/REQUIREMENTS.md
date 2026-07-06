# Requirements: v1.6 Release Candidate Audit Gate

**Created:** 2026-07-06
**Milestone:** v1.6 Release Candidate Audit Gate
**Status:** Complete

## Goal

Create a local release-candidate verification gate that aggregates package readiness, example/schema validation, build/test checks, strict sensitive information scanning, and explicit publishing boundary checks before any future distribution or upload work.

## Scope

### In Scope

- A repository-local `npm run verify:rc` command.
- A structured RC verifier module that reports checks, evidence, warnings, blockers, paths, and commands.
- Gate command coverage for plugin readiness, examples/schema validation, typecheck, tests, and build.
- A strict repository scan that excludes generated dependencies and graph output while scanning tracked project sources, docs, examples, planning artifacts, plugin metadata, and skills.
- Boundary checks that fail if repository content appears to introduce real Workshop upload automation, Steam login automation, Steam Guard handling, content encryption, package signing, private target storage, credentials, tokens, private keys, or private host data.
- Tests for success and failure behavior without requiring Dota 2, Steam, Workshop Tools, or Windows.
- README and operator runbook updates that place `verify:rc` before handoff.
- GSD verification and independent review artifacts.

### Out of Scope

- Real Workshop upload, publish-state mutation, Steam login, Steam Guard, content encryption, package signing, or archive creation.
- Running Dota 2, Workshop Tools, remote Windows smoke, same-machine Windows smoke, or UI automation as part of the RC gate.
- Storing Steam, GitHub, Windows, remote, token, password, private key, private host, or private target material.
- Adding new gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime, or publishing automation capabilities.

## Requirements

### RC-01 Local RC Command

Provide a local release-candidate gate command.

Acceptance:

- `package.json` defines `verify:rc`.
- `verify:rc` runs from built output.
- The command exits non-zero when any blocker is found.
- The command prints a structured JSON report.

### RC-02 Gate Command Aggregation

Aggregate existing local readiness checks.

Acceptance:

- The RC verifier runs `npm run verify:plugin`.
- The RC verifier runs the example/schema test target.
- The RC verifier runs `npm run typecheck`.
- The RC verifier runs `npm test`.
- The RC verifier runs `npm run build`.
- Every command result records command text, exit code, stdout, stderr, and duration.

### RC-03 Strict Repository Scan

Scan repository-owned text files for private or credential-like material.

Acceptance:

- The scan excludes `node_modules`, `dist`, `.git`, `graphify-out`, `.planning/graphs`, package lockfiles, and binary-like files.
- The scan blocks private host/address material, passwords, tokens, private keys, Steam credentials, and known private target fragments.
- Findings include only relative paths and rule labels, not secret values.
- Oversized or unreadable files are reported explicitly instead of silently accepted.

### RC-04 Publishing Boundary Checks

Fail if unsafe publishing automation appears in repository-owned files.

Acceptance:

- The scan blocks real Workshop upload automation.
- The scan blocks Steam login or Steam Guard automation.
- The scan blocks content encryption automation.
- The scan blocks package signing or publish-state mutation automation.
- Existing documentation may discuss these behaviors only as explicit out-of-scope or manual boundaries.

### RC-05 Safe Local-Only Execution

Keep the RC gate deterministic and local-only.

Acceptance:

- The RC gate does not call Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, or MCP runtime target operations.
- The RC gate does not require Windows.
- The RC gate does not require network access.
- The RC gate does not read credentials from environment variables.

### RC-06 Discoverability

Document the RC gate for operators.

Acceptance:

- README mentions `npm run verify:rc`.
- `docs/operator-runbook.md` places `npm run verify:rc` before handoff.
- Documentation states the gate is local-only and not upload automation.

### RC-07 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted RC tests pass.
- `npm run build` succeeds.
- `npm run verify:rc` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, and strict secret scan succeed.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.6 requirements, roadmap, spec, and plan exist.
- [x] `verify:rc` exists and emits structured gate results.
- [x] RC tests cover command aggregation, secret scan failures, and publishing boundary failures.
- [x] README and operator runbook include the RC gate.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

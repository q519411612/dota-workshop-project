# Requirements: v1.9 Same-Machine Windows Local Smoke Evidence

**Created:** 2026-07-07
**Milestone:** v1.9 Same-Machine Windows Local Smoke Evidence
**Status:** Complete

## Goal

Create a credential-free same-machine Windows smoke evidence harness for cases where the MCP server runs directly on the Windows machine that has Dota 2 Workshop Tools installed. The slice must make local harness readiness verifiable on macOS while refusing to present real Windows runtime validation as passed unless sanitized log or console marker evidence is provided.

## Scope

### In Scope

- A sanitized same-machine smoke evidence schema and verifier.
- A local `npm run verify:same-machine-smoke` command that exercises the verifier without Dota 2, Steam, Workshop Tools, Windows, network access, or credentials.
- A runbook for collecting real same-machine Windows evidence without storing private paths, usernames, hostnames, account data, tokens, passwords, private keys, or Steam credentials.
- Clear status separation between `harness_ready`, `runtime_pending`, and `runtime_passed`.
- Tests for artifact structure, required boundaries, marker evidence, and sensitive information rejection.
- GSD verification and independent review artifacts.

### Out of Scope

- Real Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, SSH, PowerShell Remoting, UI automation, or credential handling.
- Claiming same-machine Windows runtime evidence passed without real sanitized Windows runtime marker evidence.
- Adding gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime behavior, or publishing automation capabilities.

## Requirements

### LOCAL-SMOKE-01 Evidence Schema

Define a same-machine Windows smoke evidence artifact shape.

Acceptance:

- The artifact records schema version, addon name, map name, generated time, target category, status, operations, evidence, warnings, blockers, boundaries, commands, paths, and logs where applicable.
- The target category is same-machine Windows without host, username, account, or private machine identity fields.
- Status must be one of `harness_ready`, `runtime_pending`, or `runtime_passed`.
- Invalid status values produce blockers.

### LOCAL-SMOKE-02 Runtime Evidence Gate

Prevent harness evidence from being mistaken for real Windows runtime success.

Acceptance:

- `harness_ready` may pass with local harness evidence and an explicit runtime pending warning.
- `runtime_pending` may pass only as a non-runtime-success artifact with blockers explaining the external Windows evidence gap.
- `runtime_passed` requires real runtime marker evidence from sanitized log or console lines.
- `runtime_passed` without marker evidence produces blockers.

### LOCAL-SMOKE-03 Sanitization

Reject sensitive or private target material in artifacts.

Acceptance:

- Artifact text is scanned for credential, token, password, private key, private host, username, and private absolute path indicators.
- Blockers report only the field path and finding category, not the sensitive value.
- Sanitized paths use placeholders or categories instead of private machine paths.

### LOCAL-SMOKE-04 Runbook

Document the same-machine Windows collection workflow.

Acceptance:

- The runbook explains how to run the MCP server directly on Windows and collect sanitized marker evidence.
- The runbook distinguishes harness readiness from real runtime pass.
- The runbook prohibits Steam login capture, Workshop upload, encryption, signing, credential storage, and private path storage.
- The runbook describes where to paste sanitized evidence into the verifier input.

### LOCAL-SMOKE-05 Local Verification

Keep the verifier deterministic and local-only.

Acceptance:

- `package.json` defines `verify:same-machine-smoke`.
- The command runs from built output.
- The command emits structured JSON.
- The command does not launch Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, network calls, or UI automation.

### LOCAL-SMOKE-06 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted same-machine smoke tests pass.
- `npm run build` succeeds.
- `npm run verify:same-machine-smoke` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone` succeed or record explicit blockers unrelated to this slice.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.9 requirements, roadmap, spec, and plan exist.
- [x] Same-machine smoke evidence verifier exists.
- [x] Local tests cover status separation, marker requirements, and sanitization.
- [x] Runbook documents safe same-machine evidence collection.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

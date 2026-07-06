# Phase 1: Same-Machine Windows Local Smoke Evidence - Spec

**Status:** Ready for implementation
**Date:** 2026-07-07

## Intent

Provide a same-machine Windows smoke evidence contract for operators who run the MCP server directly on the Windows machine with Dota 2 Workshop Tools installed. The contract must be locally testable on macOS and must never convert harness readiness into real runtime success.

## Functional Contract

- The verifier accepts a structured evidence artifact.
- The artifact target is a category, not a private machine identity.
- The artifact status is exactly one of `harness_ready`, `runtime_pending`, or `runtime_passed`.
- `harness_ready` represents schema, runbook, and local verifier readiness.
- `runtime_pending` represents an external Windows evidence gap and must keep explicit blockers.
- `runtime_passed` requires sanitized runtime marker evidence from logs or console output.
- The verifier returns structured JSON with success state, status, runtime evidence state, evidence, warnings, blockers, paths, commands, and logs.
- The verifier rejects credentials, tokens, passwords, private keys, private host data, private usernames, and private absolute machine paths without echoing sensitive values.

## Non-Functional Contract

- The local command runs without Dota 2, Steam, Workshop Tools, Windows, network access, or credentials.
- The command does not launch processes other than local Node execution.
- The verifier is deterministic for the same input artifact.
- Comments in production code are only added for non-obvious logic and must be Chinese.

## Boundary Contract

- No Workshop upload.
- No Steam login or Steam Guard handling.
- No content encryption.
- No package signing.
- No remote Windows connection.
- No global install or user environment mutation.
- No real same-machine Windows pass unless runtime marker evidence is present.

## Acceptance Checks

- Tests cover harness-ready success.
- Tests cover runtime-passed blocker when marker evidence is missing.
- Tests cover runtime-passed success when sanitized marker evidence exists.
- Tests cover sensitive material rejection without leaking the sensitive value.
- `npm run verify:same-machine-smoke` emits a harness-ready structured report.

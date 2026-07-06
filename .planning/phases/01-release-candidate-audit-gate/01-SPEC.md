# v1.6 Release Candidate Audit Gate Spec

**Status:** Ready for implementation
**Date:** 2026-07-06

## Purpose

The project needs a single local command that says whether the repository is ready to be treated as a release candidate for handoff review. The gate must aggregate existing readiness checks, add stricter repository hygiene scanning, and make unsafe publishing boundaries fail loudly without performing any real publishing or Windows runtime action.

## Requirements

### RC-01 Local RC Command

`package.json` must expose `npm run verify:rc`. It must run from built output and print a structured JSON report. Any blocker must produce a non-zero exit code.

### RC-02 Gate Command Aggregation

The verifier must run these commands in order:

- `npm run verify:plugin`
- `npm test -- tests/examples.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Each command result must include command text, exit code, stdout, stderr, and duration. The verifier must continue after failures so the report shows every failing gate.

### RC-03 Strict Repository Scan

The verifier must scan repository-owned text files and exclude generated dependency/output trees. It must fail on credential-like or private-target material while reporting only relative path and rule label evidence.

Required exclusions:

- `.git`
- `node_modules`
- `dist`
- `graphify-out`
- `.planning/graphs`
- package lockfiles
- binary-like files

### RC-04 Publishing Boundary Checks

The verifier must fail if repository-owned files introduce real Workshop upload, Steam login or Steam Guard automation, content encryption automation, package signing automation, or publish-state mutation automation. Documentation can mention those behaviors only as manual or out-of-scope boundaries.

### RC-05 Safe Local-Only Execution

The verifier must not call Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, MCP target operations, or environment credential readers. It must run without Windows or network access.

### RC-06 Discoverability

README and `docs/operator-runbook.md` must document `npm run verify:rc`, state that it is local-only, and state that it is not upload automation.

### RC-07 Verification and Review

The slice must close with targeted RC tests, full local verification, independent review, verification artifact, summary artifact, and a commit/push.

## Boundaries

Allowed:

- Running local npm commands.
- Reading repository-owned files.
- Printing structured reports with relative paths, command text, exit code, stdout, stderr, duration, evidence, warnings, and blockers.

Forbidden:

- Real Workshop upload.
- Steam login or Steam Guard automation.
- Content encryption.
- Package signing.
- Archive creation.
- Windows smoke or remote smoke.
- Reading or storing credentials, tokens, private keys, private hosts, or private target details.

## Acceptance

The verifier is accepted when `npm run verify:rc` passes on the current repository after build, fails on injected credential or upload-boundary fixture content, and produces no stored private data.

## Ambiguity Report

- Goal Clarity: 0.95
- Boundary Clarity: 0.95
- Constraint Clarity: 0.90
- Acceptance Criteria: 0.90
- Ambiguity: 0.07

The remaining ambiguity is operational ordering only; the implementation will keep the command order listed above.

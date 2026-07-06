# Phase 1: Release Handoff Bundle Readiness - SPEC

**Created:** 2026-07-06
**Status:** Locked for planning
**Source:** v1.7 requirements and current repository state

## Goal

Create a local, credential-free handoff readiness report that lets an operator or future release reviewer inspect the plugin delivery state without running Dota 2, contacting Windows targets, storing credentials, or performing any publishing action.

## Current State

- `npm run verify:plugin` verifies plugin manifest, MCP config, package entrypoint, built server entrypoint, skill references, and documented tool lists.
- `npm run verify:rc` aggregates plugin readiness, example/schema tests, typecheck, tests, build, repository hygiene scanning, and publishing boundary checks.
- README and `docs/operator-runbook.md` document local readiness, optional remote smoke, cleanup, and dry-run release boundaries.
- There is no single release handoff report that combines the current commit, RC evidence, delivery checklist, docs coverage, and release boundaries.

## Target State

- `npm run verify:handoff` emits a structured JSON handoff readiness report from built output.
- The report includes current commit SHA, `verify:rc` status and command evidence, delivery checklist status, documentation readiness status, and explicit release boundaries.
- The command is deterministic and local-only: it does not call Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, MCP runtime target operations, network services, or environment credentials.

## Requirements

### HANDOFF-01 Local Handoff Command

Current state: `package.json` has no `verify:handoff` script and no built handoff verifier entrypoint.

Target state: `package.json` defines `verify:handoff` as a built-output Node command.

Acceptance:

- [ ] `package.json` contains `"verify:handoff": "node ./dist/verify-handoff.js"`.
- [ ] The command prints JSON with `ok`, `commit`, `verification`, `delivery`, `boundaries`, `evidence`, `warnings`, `blockers`, and `paths`.
- [ ] The command exits non-zero when blockers exist.

### HANDOFF-02 RC Gate Preflight

Current state: RC evidence exists only through `verify:rc`.

Target state: handoff readiness reuses the RC verifier and includes its status.

Acceptance:

- [ ] The handoff verifier invokes the RC verifier before returning ready status.
- [ ] The report includes `verification.releaseCandidate.ok`.
- [ ] The report includes RC command result entries for `npm run verify:plugin`, example/schema tests, typecheck, tests, and build.
- [ ] RC blockers appear in handoff blockers with no secret values.

### HANDOFF-03 Delivery Checklist

Current state: plugin and docs verifiers check parts of handoff readiness, but no single report lists all handoff deliverables.

Target state: the handoff report lists all required delivery artifacts and their evidence.

Acceptance:

- [ ] Delivery checklist includes plugin manifest, MCP config, package JSON, built MCP server entrypoint, package bin, `verify:plugin`, `verify:rc`, `verify:handoff`, skill file, skill references, README, operator runbook, and workflow examples.
- [ ] Each item includes `label`, `path`, `ok`, and `evidence`.
- [ ] Missing required items produce blockers with relative paths.

### HANDOFF-04 Documentation Readiness

Current state: README and runbook mention RC and safe operation but do not mention a handoff bundle gate.

Target state: README and runbook document the handoff command and remain sufficient for install, verification, fixture workflow, optional remote smoke, cleanup, and credential safety.

Acceptance:

- [ ] README mentions `npm run verify:handoff`.
- [ ] README links the operator runbook and describes local-only verification boundaries.
- [ ] Operator runbook mentions `npm run verify:plugin`, `npm run verify:rc`, and `npm run verify:handoff`.
- [ ] Operator runbook covers fixture workflow, optional remote smoke, cleanup, and credential/private target boundaries.
- [ ] Missing coverage produces blockers with relative file paths.

### HANDOFF-05 Release Boundaries

Current state: RC scanning blocks unsafe publishing automation, but the handoff output does not explicitly list the release boundaries for the operator.

Target state: the handoff report records explicit must-not boundaries.

Acceptance:

- [ ] Report lists no real Workshop upload.
- [ ] Report lists no Steam login.
- [ ] Report lists no Steam Guard handling.
- [ ] Report lists no content encryption.
- [ ] Report lists no package signing.
- [ ] Report lists no credential or private target storage.
- [ ] Report lists no remote Windows connection by the handoff command.

### HANDOFF-06 Local-Only Execution

Current state: RC is local-only; handoff must preserve that property.

Target state: handoff readiness performs file, package, git, and RC checks only.

Acceptance:

- [ ] Tests prove the handoff verifier can run with an injected RC verifier and command runner.
- [ ] The verifier does not require Dota 2, Steam, Workshop Tools, Windows, network access, SSH, PowerShell Remoting, or MCP runtime target operations.
- [ ] The verifier does not read credential environment variables.

### HANDOFF-07 Verification and Review

Current state: no v1.7 closeout artifacts exist.

Target state: local verification and independent review are recorded.

Acceptance:

- [ ] Targeted handoff tests pass.
- [ ] `npm run build` succeeds.
- [ ] `npm run verify:handoff` succeeds.
- [ ] `git diff --check`, `npm run typecheck`, `npm test`, and `npm run verify:rc` succeed.
- [ ] `01-01-SUMMARY.md`, `01-VERIFICATION.md`, and `01-REVIEW.md` record evidence.

## Boundaries

### In Scope

- Local JSON handoff report.
- RC preflight reuse.
- Delivery checklist.
- Documentation coverage check.
- Explicit release boundary reporting.
- macOS-local tests with injected dependencies.

### Out of Scope

- Real Workshop upload because v1.7 is handoff readiness only.
- Steam login or Steam Guard handling because credentials and account workflows remain manual and out of repository scope.
- Content encryption because packaging/signing/publishing remains deferred.
- Package signing because there is no distribution packaging slice yet.
- Credential, token, password, private key, private host, or private target storage.
- Remote Windows connection, SSH, PowerShell Remoting, Dota 2, Workshop Tools, Steam, network access, UI automation, or MCP runtime target operations.
- New gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime, or complex publishing automation.

## Edge Coverage

| Requirement | Edge | Resolution |
|-------------|------|------------|
| HANDOFF-01 | Script exists but points to source instead of built output | Covered by script string acceptance |
| HANDOFF-02 | RC fails after some commands pass | Covered by blocker aggregation acceptance |
| HANDOFF-03 | A required artifact is missing from the report | Covered by checklist item and missing item blockers |
| HANDOFF-04 | Docs mention commands but omit safe operation boundaries | Covered by required doc phrases and blocker checks |
| HANDOFF-05 | Report omits a prohibited publishing boundary | Covered by exact boundary label checks |
| HANDOFF-06 | Tests accidentally require real repo commands | Covered by injected RC verifier and command runner |

## Prohibitions

| Prohibition | Status | Verification |
|-------------|--------|--------------|
| Must not perform real Workshop upload | Resolved | Test and report boundary |
| Must not perform Steam login or Steam Guard handling | Resolved | Test and report boundary |
| Must not encrypt content | Resolved | Test and report boundary |
| Must not sign packages | Resolved | Test and report boundary |
| Must not store credentials or private target data | Resolved | RC scan and report boundary |
| Must not connect to remote Windows | Resolved | Local-only implementation and report boundary |
| Must not add gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, or publishing automation | Resolved | Scope review |

## Ambiguity Report

- Goal Clarity: 0.95
- Boundary Clarity: 0.95
- Constraint Clarity: 0.90
- Acceptance Criteria: 0.92
- Ambiguity: 0.07

The requirements are sufficiently clear for planning.

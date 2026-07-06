# Phase 1: Milestone Archive and Release Notes Readiness - SPEC

**Created:** 2026-07-06
**Status:** Locked for planning
**Source:** v1.8 requirements and current repository state

## Goal

Create a local, credential-free milestone closeout and release notes readiness report that lets an operator or future release reviewer understand what shipped from v1.2 through v1.7, which commits represent those slices, which local gates passed, which documents support handoff, which boundaries remain prohibited, and which residual items are non-blocking.

## Current State

- `npm run verify:rc` verifies release-candidate readiness through local plugin, examples, typecheck, test, build, and hygiene gates.
- `npm run verify:handoff` reuses RC verification and reports commit identity, delivery checklist, README/runbook coverage, workflow examples, and explicit release boundaries.
- README and `docs/operator-runbook.md` document local readiness, fixture workflow, optional remote smoke, cleanup, and credential boundaries.
- v1.2-v1.7 have completed commits and GSD artifacts, but there is no single closeout report that aggregates the milestone history into release-notes-ready form.

## Target State

- `npm run verify:milestone` emits a structured JSON milestone closeout readiness report from built output.
- The report includes the handoff preflight status, v1.2-v1.7 version inventory, commit range, commit SHAs, delivery summaries, verification status, documentation status, explicit release boundaries, remaining non-blocking items, evidence, warnings, blockers, paths, and command evidence where applicable.
- The command is deterministic and local-only: it does not call Dota 2, Workshop Tools, Steam, SSH, PowerShell Remoting, MCP runtime target operations, network services, or environment credentials.

## Requirements

### MILESTONE-01 Local Milestone Command

Current state: `package.json` has no `verify:milestone` script and no built milestone verifier entrypoint.

Target state: `package.json` defines `verify:milestone` as a built-output Node command.

Acceptance:

- [ ] `package.json` contains `"verify:milestone": "node ./dist/verify-milestone.js"`.
- [ ] The command prints JSON with `ok`, `milestone`, `commitRange`, `handoff`, `versions`, `documentation`, `boundaries`, `remainingNonBlockingItems`, `evidence`, `warnings`, `blockers`, and `paths`.
- [ ] The command exits non-zero when blockers exist.

### MILESTONE-02 Handoff Preflight

Current state: handoff readiness exists as its own gate.

Target state: milestone readiness reuses the handoff verifier and includes handoff status.

Acceptance:

- [ ] The milestone verifier invokes the handoff verifier before returning ready status.
- [ ] The report includes `handoff.ok`.
- [ ] Handoff blockers appear in milestone blockers with no secret values.
- [ ] Handoff command stdout and stderr are sanitized if they contain the repository root.

### MILESTONE-03 Version Inventory

Current state: v1.2-v1.7 history is distributed across roadmap, requirements, phase artifacts, and commits.

Target state: milestone closeout reports a fixed inventory for the completed release-readiness versions.

Acceptance:

- [ ] The report lists v1.2, v1.3, v1.4, v1.5, v1.6, and v1.7.
- [ ] Each version records title, commit SHA, goal, key delivery summary, verification status, docs/examples/runbook/handoff status where relevant, known boundary, and remaining non-blocking items.
- [ ] The report records the commit range from `ba6856f` through `7c0d3bf`.
- [ ] Missing version IDs, commit SHAs, delivery summaries, or verification status entries produce blockers.

### MILESTONE-04 Review Readiness Coverage

Current state: README and runbook cover handoff, but not milestone closeout.

Target state: README, operator runbook, and handoff report support release review and operator handoff.

Acceptance:

- [ ] README mentions `npm run verify:milestone`.
- [ ] README links the operator runbook and describes local-only verification boundaries.
- [ ] Operator runbook mentions `npm run verify:plugin`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone`.
- [ ] Operator runbook covers fixture workflow, optional remote smoke, cleanup, and credential/private target boundaries.
- [ ] Handoff readiness output includes delivery checklist, documentation coverage, and release boundaries.
- [ ] Missing coverage produces blockers with relative file paths.

### MILESTONE-05 Release Boundaries

Current state: RC and handoff gates list publishing boundaries.

Target state: milestone closeout repeats the release prohibitions for release-note reviewers.

Acceptance:

- [ ] Report lists no real Workshop upload.
- [ ] Report lists no Steam login.
- [ ] Report lists no Steam Guard handling.
- [ ] Report lists no content encryption.
- [ ] Report lists no package signing.
- [ ] Report lists no credential or private target storage.
- [ ] Report lists no remote Windows connection by the milestone command.

### MILESTONE-06 Local-Only Execution

Current state: handoff readiness is local-only.

Target state: milestone readiness preserves the same local-only property.

Acceptance:

- [ ] Tests prove the milestone verifier can run with an injected handoff verifier and command runner.
- [ ] The verifier does not require Dota 2, Steam, Workshop Tools, Windows, network access, SSH, PowerShell Remoting, or MCP runtime target operations.
- [ ] The verifier does not read credential environment variables.

### MILESTONE-07 Verification and Review

Current state: no v1.8 closeout artifacts exist.

Target state: local verification and independent review are recorded.

Acceptance:

- [ ] Targeted milestone tests pass.
- [ ] `npm run build` succeeds.
- [ ] `npm run verify:milestone` succeeds.
- [ ] `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, and `npm run verify:handoff` succeed.
- [ ] `01-01-SUMMARY.md`, `01-VERIFICATION.md`, and `01-REVIEW.md` record evidence.

## Boundaries

### In Scope

- Local JSON milestone closeout report.
- Handoff preflight reuse.
- v1.2-v1.7 release-readiness inventory.
- README, runbook, and handoff output coverage checks.
- Explicit release boundary reporting.
- macOS-local tests with injected dependencies.

### Out of Scope

- Real Workshop upload because v1.8 is closeout readiness only.
- Steam login or Steam Guard handling because account workflows remain manual and out of repository scope.
- Content encryption because packaging/signing/publishing remains deferred.
- Package signing because there is no distribution packaging slice yet.
- Credential, token, password, private key, private host, or private target storage.
- Remote Windows connection, SSH, PowerShell Remoting, Dota 2, Workshop Tools, Steam, network access, UI automation, or MCP runtime target operations.
- New gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime, or complex publishing automation.

## Edge Coverage

| Requirement | Edge | Resolution |
|-------------|------|------------|
| MILESTONE-01 | Script exists but points to source instead of built output | Covered by script string acceptance |
| MILESTONE-02 | Handoff fails after RC passed | Covered by blocker aggregation acceptance |
| MILESTONE-03 | A version has a title but no commit evidence | Covered by required inventory blockers |
| MILESTONE-04 | Docs mention milestone command but omit handoff/review support | Covered by required coverage terms and handoff output checks |
| MILESTONE-05 | Report omits a prohibited publishing boundary | Covered by exact boundary label checks |
| MILESTONE-06 | Tests accidentally run real repository commands | Covered by injected handoff verifier and command runner |

## Prohibitions

| Prohibition | Status | Verification |
|-------------|--------|--------------|
| Must not perform real Workshop upload | Resolved | Test and report boundary |
| Must not perform Steam login or Steam Guard handling | Resolved | Test and report boundary |
| Must not encrypt content | Resolved | Test and report boundary |
| Must not sign packages | Resolved | Test and report boundary |
| Must not store credentials or private target data | Resolved | RC/handoff scan and report boundary |
| Must not connect to remote Windows | Resolved | Local-only implementation review |
| Must not add gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, or publishing automation | Resolved | Scope review |

## Ambiguity Report

- Goal Clarity: 0.96
- Boundary Clarity: 0.96
- Constraint Clarity: 0.92
- Acceptance Criteria: 0.94
- Ambiguity: 0.06

The requirements are sufficiently clear for planning.

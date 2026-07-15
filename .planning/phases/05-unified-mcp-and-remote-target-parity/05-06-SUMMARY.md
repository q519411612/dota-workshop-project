---
phase: 05-unified-mcp-and-remote-target-parity
plan: 06
subsystem: release-candidate
tags: [typescript, mcp, parity, remote-windows, verification]

requires:
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 07
    provides: Loadable tracked MCP runtime import closure
provides:
  - Four-target semantic parity evidence across fixture, local adapter, mocked SSH, and mocked PowerShell
  - Checked operator guidance and schema-valid evidence-only workflow example
  - Deep independent review closure for target-native identity, topology, cleanup, and strict normalization
  - Complete repository and delivery-gate verification within the macOS contract-test boundary
affects: [milestone-audit, milestone-completion, release-candidate-preflight]

tech-stack:
  added: []
  patterns: [narrow semantic projector, target-native identity tuple, fail-closed cleanup evidence]

key-files:
  created: [.planning/phases/05-unified-mcp-and-remote-target-parity/05-06-SUMMARY.md]
  modified: [tests/release-candidate-parity.test.ts, tests/release-candidate-remote-script.test.ts, tests/release-candidate-result.test.ts, src/release-candidate-remote-script.ts, README.md, docs/operator-runbook.md, skills/dota2-workshop-tools/SKILL.md, skills/dota2-workshop-tools/references/remote-control.md]

key-decisions:
  - "Parity removes only target and transport execution metadata; artifact, blocker, path, cleanup, warning, and boundary semantics remain exact."
  - "Remote physical isolation requires reparse-free ancestry plus canonical volume GUID and target-native file ID tuples, with no lexical or identity fallback."
  - "Cleanup-time lease observation is side-effect-free and lease uncertainty emits only the strict cleanup-invalid shape and matching removal blocker."
  - "Fixture, local-adapter, mocked SSH, and mocked PowerShell results are contract evidence and do not claim real Windows runtime proof."

patterns-established:
  - "Remote path identity: compare leaf-to-root (volume GUID, file ID) chains before creation and cleanup."
  - "Cleanup domain consistency: finalize cleanup facts without mutating already-established artifact blockers."

requirements-completed: [RCCL-05]

completed: 2026-07-16
status: complete
---

# Phase 5 Plan 06: Cross-Target Parity and Verification Summary

**The public release-candidate preflight now has one strict evidence contract across fixture, local adapter, mocked SSH, and mocked PowerShell targets.**

## Accomplishments

- Consolidated the four-target golden parity matrix without hiding manifest, digest, ledger, coverage, blocker, operation, artifact, cleanup, path, warning, or boundary differences.
- Added and checked a schema-valid fixture workflow plus operator guidance for temporary target-local execution, explicit failures, no fallback, no retained candidate, and contract-only Windows evidence.
- Kept `dry_run_release_report` behavior unchanged while exposing the additive `preflight_release_candidate` operation through the tracked packaged MCP runtime.
- Closed every independent-review finding with atomic RED and corrective commits, including canonical remote digest projection, strict unknown-key rejection, source identity and topology stability, synchronous cleanup ownership, non-reparse Windows namespace aliases, volume-scoped file identities, and cleanup-domain consistency.
- Preserved the source-directory immutability boundary and prohibited Steam login, Workshop mutation/upload, credential handling, persistent archives, signing, encryption, compilation, repair, transfer, launch, and runtime-validation behavior.

## TDD and Review Evidence

- Initial responsibility-specific RED/GREEN work was completed in Plans 05-01 through 05-05 and packaged in 05-07.
- Deep-review remediation added four further RED groups and fixes:
  - `b177e74` / `9a39d1a`
  - `4b99be8` / `cb64c3f`
  - `4a114b3` / `fb787f5`
  - `86a23fd` / `f922407`
- The final independent review in `05-REVIEW.md` reports `status: clean` with zero Critical, Warning, or Info findings.
- Final independent review evidence: 88/88 focused tests, 303/303 complete tests, typecheck, packaged runtime invocation, and patch hygiene passed.

## Verification

- `npm test`: 28 files, 303/303 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:plugin`: `ok: true`.
- `npm run verify:same-machine-smoke`: harness ready with real Windows runtime evidence explicitly pending and non-blocking.
- `npm run verify:source-snapshot`: `ok: true`, no archive created.
- `npm run verify:install-simulation`: `ok: true`, isolated temporary root removed.
- `npm run verify:rc`: `ok: true`.
- `npm run verify:handoff`: `ok: true`.
- `npm run verify:milestone`: existing verifier returned `ok: true`.
- `git diff --check`: passed.
- The immutable Phase 5 start marker remained an ancestor of `HEAD`; graph hashes matched the read-only baseline before every commit; `.planning/graphs/` remained unstaged and excluded from all commits.

## Deviations from Plan

The planned parity and documentation work completed as designed. Independent review required additional fail-closed Windows identity and cleanup-shape hardening before closure; each confirmed defect received a focused RED test and isolated corrective commit.

## Boundary Statement

This completion is based on macOS fixtures, production-adapter tests, mocked remote transports, generated-script contract inspection, strict normalization, and packaged runtime invocation. It does not claim real Windows execution, Steam authentication, Workshop publishing, persistent candidate creation, source compilation, or source repair.

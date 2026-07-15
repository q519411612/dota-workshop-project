---
phase: 05-unified-mcp-and-remote-target-parity
plan: 04
subsystem: remote-release-candidate
tags: [powershell, ssh, windows, integrity, cleanup, tdd]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    provides: Canonical manifest, scan coverage, exact ledger, source stability, and verified cleanup contracts
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 02
    provides: Strict versioned release-candidate detail and invariant authority
provides:
  - One deterministic target-native PowerShell release-candidate lifecycle shared by SSH and PowerShell Remoting
  - One-shot private transport binding with closed completed, failed, uncertain, and configuration-failed outcomes
  - Shared policy constants and executable canonical digest vector coverage
affects: [05-05, remote-normalization, target-parity, mcp-preflight]

tech-stack:
  added: []
  patterns: [target-native evidence lifecycle, identical-script transport binding, finally-owned cleanup, closed transport outcome]

key-files:
  created: [src/release-candidate-remote-script.ts, src/release-candidate-remote-executor.ts, tests/release-candidate-remote-script.test.ts, tests/release-candidate-remote-executor.test.ts]
  modified: []

key-decisions:
  - "SSH and PowerShell Remoting receive identical generated lifecycle bytes; transport identity remains the binding and framing layer's responsibility."
  - "Remote process output is returned only after a clean zero exit with empty stderr; failures and uncertainty expose no private output, destination, or script bytes."
  - "Candidate creation identity is established before any post-create validation so finally owns the sole cleanup attempt."

patterns-established:
  - "Remote source entries are reparse-checked and identity-revalidated before readiness reads, baseline hashing, copying, and source-after hashing."
  - "Target-local JSON evidence contains semantic relative identities and fixed codes only; private roots and raw exceptions stay inside the script."

requirements-completed: [RCCL-03]

duration: 15min
completed: 2026-07-16
status: complete
---

# Phase 5 Plan 04: Target-Native Remote Lifecycle Summary

**SSH and PowerShell Remoting now execute one target-local PowerShell lifecycle that inventories, validates, copies, hashes, reconciles, reports, and removes a temporary release candidate without transferring addon state to the MCP host.**

## Accomplishments

- Generated a deterministic PowerShell lifecycle containing shared metadata keys, scan limits, release boundaries, canonical digest vectors, reparse and collision checks, exact required-path policy, streamed copy/hash operations, source-before/source-after comparison, manifest and topology reconciliation, sensitive scan coverage, and finally-owned cleanup.
- Added one executable transport binding for SSH and PowerShell Remoting. Both paths invoke identical script bytes exactly once using existing destination configuration and return a closed raw outcome for Plan 05-05 framing and normalization.
- Kept candidate and addon files entirely on the Windows target. No transfer, credential prompt/store, retry, fallback, archive, signing, encryption, compilation, repair, launch, Steam action, or Workshop mutation path exists.
- Ensured the generated lifecycle writes exactly one compact JSON document and suppresses incidental cmdlet output, raw exceptions, private roots, host/user facts, file contents, and matched sensitive values.
- Independently reviewed every state transition and transport branch, reproducing each confirmed issue with an atomic RED test before correction.

## Task Commits

1. **Task 1: Commit the failing target-native lifecycle specification** — `741119a`
2. **Task 2: Generate and bind the complete target-native lifecycle** — `7a51d48`
3. **Task 3: Independently review the generated remote state machine**
   - `b67dc54` — required path, source identity, topology, canonical shape, blocked-domain, cleanup-code, and process-exit RED coverage
   - `05c13e8` — metadata identity and sensitive filename RED coverage
   - `07c00ae` — executable PowerShell canonical-vector RED coverage
   - `8f73db2` — lifecycle policy and state-machine corrections
   - `2967cb2` — option-shaped destination RED coverage
   - `05686c8` — closed destination binding correction

## Files Created

- `src/release-candidate-remote-script.ts` — deterministic target-native lifecycle and shared policy/canonical vectors.
- `src/release-candidate-remote-executor.ts` — private one-shot SSH and PowerShell Remoting invocation binding.
- `tests/release-candidate-remote-script.test.ts` — lifecycle, policy, sole-output, no-transfer, source-safety, topology, canonical, and cleanup contract coverage.
- `tests/release-candidate-remote-executor.test.ts` — same-script invocation, closed outcome, no-credential, no-transfer, failure, uncertainty, and destination validation coverage.

## Independent Review

The review confirmed and corrected:

- Readiness path drift for addon-specific localization and `herolist.txt`.
- Missing root/ancestor reparse checks and immediate source identity revalidation before each source use.
- Sensitive credential-shaped source filenames reaching public relative evidence.
- Candidate topology reconciliation omitting generated structural ancestor directories.
- Ambiguous single-entry PowerShell JSON shape in canonical digest computation.
- Canonical vectors checking only text hashing instead of the generated manifest algorithm.
- Exceptional blocked evidence omitting the scan-coverage domain.
- Cleanup identity mismatch retaining a removal-failure code inconsistent with its facts.
- Numeric process exits becoming transport uncertainty instead of closed failure.
- SSH option-shaped destination values reaching process invocation.

Final review result: no unresolved confirmed issue.

## Deviations from Plan

None - the plan was executed as written, including the required independent RED-before-correction review loop.

## Issues Encountered

- The first RED fixture contained an incorrect hand-calculated canonical digest. The GREEN implementation computed the vector from the Phase 4 canonical JSON representation, and the test was corrected to the independently recomputed SHA-256 value.
- PowerShell is not installed in the macOS completion environment, so validation uses generated-script structure, exact policy vectors, injected executable transport seams, and repository adapter contracts as approved by the milestone boundary.

## Verification Evidence

- Final focused script, executor, and result suites: 30/30 passed.
- Final repository suite: 254/254 passed across 24 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; undeclared generated release-candidate distribution files were removed afterward.
- `verify:plugin`, `verify:same-machine-smoke`, `verify:source-snapshot`, `verify:install-simulation`, `verify:rc`, `verify:handoff`, and historical `verify:milestone`: passed.
- `git diff --check`: passed.
- Immutable Phase 5 graph baseline and start-marker guards passed before every commit and after final verification.
- The three user-owned `.planning/graphs/` modifications remained untouched, unstaged, and outside all commits.

## Evidence Boundary

The passing evidence is generated-script, macOS fixture, and mocked/injected transport contract evidence. It is not real Windows execution proof and does not claim NTFS, SSH, or PowerShell Remoting runtime validation.

## Self-Check: PASSED

- RED `741119a` precedes GREEN `7a51d48`.
- Every independently confirmed review defect has a preceding RED commit and passing regression coverage.
- `RCCL-03` is declared only by Plan 05-04 and this summary.
- No candidate artifact, credential, private target value, or persistent archive was created or retained.

---
*Phase: 05-unified-mcp-and-remote-target-parity*
*Completed: 2026-07-16*

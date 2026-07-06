# Phase 1: Windows Validation Closure - Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.14 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Use a user-provided Windows host with Dota 2 and Workshop Tools installed to collect sanitized validation evidence for the remaining Windows smoke gap, without storing credentials or private host data and without adding upload, encryption, or credential behavior.

## Background

v1.1 and v1.2 are complete. The project has strong fixture and remote Windows evidence, but planning artifacts still note that same-machine local Windows smoke was not separately recorded. The user has now provided a reachable Windows host for runtime validation. The next smallest useful slice is evidence closure: prove discovery and, if the environment permits, smoke validation through existing workflows. If the host blocks launch or log evidence, the phase must record the blocker explicitly rather than silently substituting a weaker result.

## Requirements

1. **Runtime-only target handling**: Treat the Windows host and password as ephemeral runtime input.
   - Current: Prior real Windows runs avoided storing private target data.
   - Target: v1.3 artifacts remain sanitized while commands may use runtime SSH.
   - Acceptance: Secret scan and review confirm no private host, username, password, token, key, Steam credential, or private target data was written.

2. **Environment discovery evidence**: Verify Dota and Workshop Tools paths on the Windows host.
   - Current: Prior remote runs proved these categories on earlier user-provided targets.
   - Target: This host is checked directly for Dota root, `dota2.exe`, and Workshop Tools-adjacent paths.
   - Acceptance: Verification artifact records sanitized path-category evidence or explicit missing-path failures.

3. **Existing workflow smoke evidence**: Exercise the smallest existing validation workflow that can run on the host.
   - Current: Existing tools support generation, launch, log reading, marker validation, cleanup, and dry-run release reports.
   - Target: Prefer a generated playable smoke with marker validation; if blocked, record blocker and run non-launch checks.
   - Acceptance: Success requires expected log/console markers. Fallback checks are labeled partial and do not claim runtime success.

4. **Safe cleanup evidence**: Avoid broad process side effects.
   - Current: `cleanup_playable_smoke` exists and requires addon-scoped matching.
   - Target: Any cleanup first inspects matching command lines and only stops known smoke addon processes.
   - Acceptance: Verification artifact records dry-run cleanup evidence or states no cleanup was needed.

5. **GSD closure artifacts**: Record evidence and independent review.
   - Current: v1.2 has verification/review artifacts.
   - Target: v1.3 has verification, review, and summary artifacts that state whether the Windows validation gap is closed.
   - Acceptance: Artifacts are committed and pushed with only sanitized evidence.

## Boundaries

**In scope:**

- Runtime SSH probing of the user-provided Windows host.
- Dota/Workshop path verification.
- Existing generated addon, smoke, validation, cleanup, and dry-run release report workflows where practical.
- Sanitized GSD evidence.

**Out of scope:**

- Real Workshop upload, Steam login, Steam Guard, encryption, or publish-state mutation.
- Writing host, username, password, private key, token, Steam credential, or private target details into the repository.
- UI automation or manual desktop control as the primary validation path.
- Stopping broad Dota/Steam processes unrelated to a known smoke addon.
- Claiming runtime validation without marker evidence.

## Acceptance Criteria

- [ ] SSH access is attempted using runtime-only credential handling.
- [ ] Dota root and Workshop Tools-adjacent path categories are verified or explicit failures are recorded.
- [ ] Generated addon smoke marker validation passes, or a partial fallback is documented with blocker evidence.
- [ ] Any cleanup is addon-scoped and starts with dry-run evidence.
- [ ] `git diff --check`, `npm run typecheck`, `npm test`, `npm run build`, and strict secret scan pass.
- [ ] `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` contain only sanitized evidence.

## Edge Coverage

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| credential leakage | R1/R5 | covered | Artifacts must be sanitized and secret scan must pass. |
| missing Windows paths | R2 | covered | Missing paths are explicit failures, not fallback success. |
| launch vs validation confusion | R3 | covered | Runtime success requires marker evidence. |
| cleanup side effects | R4 | covered | Cleanup must be addon-scoped and dry-run first. |
| partial validation | R3/R5 | covered | Fallback checks are labeled partial and cannot close runtime success. |

## Prohibitions (must-NOT)

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not store Windows password, private host, private username, tokens, private keys, or Steam credentials. | R1/R5 | resolved | verification: test |
| Must not perform Workshop upload, Steam login, encryption, or publish-state mutation. | R1/R3 | resolved | verification: judgment |
| Must not treat launch success as runtime validation success. | R3 | resolved | verification: judgment |
| Must not clean up broad unrelated Dota or Steam processes. | R4 | resolved | verification: judgment |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.90 | 0.75 | met | Close or explicitly characterize the Windows validation gap. |
| Boundary Clarity | 0.92 | 0.70 | met | No upload, credentials, encryption, UI automation, or broad cleanup. |
| Constraint Clarity | 0.84 | 0.65 | met | Runtime-only target handling and sanitized artifacts. |
| Acceptance Criteria | 0.86 | 0.70 | met | Path evidence, smoke evidence, cleanup evidence, and local checks are concrete. |
| Ambiguity | 0.14 | <=0.20 | met | Ready for planning. |

---

*Phase: 01-windows-validation-closure*
*Spec created: 2026-07-06*

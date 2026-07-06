# Requirements: v1.3 Windows Validation Closure

**Created:** 2026-07-06
**Milestone:** v1.3 Windows Validation Closure
**Status:** Complete

## Goal

Close the remaining real-Windows validation gap by recording sanitized evidence from a Windows host with Dota 2 and Workshop Tools installed, without storing credentials or private host data in the repository.

## Scope

### In Scope

- Runtime-only SSH access to a Windows host provided by the user.
- Dota install and Workshop Tools path discovery evidence.
- Addon generation, launch, log reading, validation, cleanup, or release dry-run evidence through the existing tool concepts where practical.
- Sanitized verification artifacts that prove what was checked without recording password, private host, private username, tokens, or Steam credential material.
- Explicit failure evidence if Windows discovery, launch, log reading, or validation fails.

### Out of Scope

- Storing SSH passwords, hostnames, usernames, Steam credentials, private keys, tokens, or private target data in repository files.
- Real Workshop upload, Steam login, Steam Guard, encryption, publish-state mutation, or signed upload package output.
- Desktop UI automation as a primary path.
- Broad process cleanup outside known addon-scoped smoke processes.
- Treating process launch as validation success without expected log or console evidence.

## Requirements

### VAL-01 Runtime-Only Target Handling

Use the provided Windows target only as runtime input.

Acceptance:

- No repository file contains the Windows password, private host, private username, Steam credentials, GitHub tokens, private keys, or private target details.
- Verification artifacts identify the target generically, such as `user-provided Windows host`.
- Any command transcript included in artifacts is sanitized.

### VAL-02 Environment Discovery Evidence

Verify the Windows host has a usable Dota 2 install and Workshop Tools paths.

Acceptance:

- Evidence includes Dota root discovery or explicit user-provided Dota root verification.
- Evidence includes `dota2.exe` path verification.
- Evidence includes at least one Workshop Tools-adjacent path, such as `vconsole2.exe`, `dota2cfg.exe`, `resourcecompiler.exe`, or installed template map evidence.
- Missing path failures are recorded with command/path category evidence.

### VAL-03 Existing Workflow Smoke Evidence

Exercise the smallest existing workflow that materially increases confidence.

Acceptance:

- Preferred path: run existing playable smoke or an equivalent generated-addon launch and marker validation through the Windows host.
- If launch is blocked by environment constraints, record the exact blocker and still run non-launch checks such as addon generation, inspection, and dry-run release report.
- Validation success requires expected log or console marker evidence, not launch success alone.

### VAL-04 Safe Cleanup Evidence

Clean up only known addon-scoped smoke processes when cleanup is needed.

Acceptance:

- Cleanup starts with dry-run matching evidence when a running process may block smoke.
- Execute cleanup only targets command lines matching the requested smoke addon name.
- Do not stop broad Dota, Steam, or unrelated processes.

### VAL-05 Verification Artifact

Record the validation result in GSD artifacts.

Acceptance:

- `01-VERIFICATION.md` records environment, smoke or fallback checks, cleanup, local automated verification, and residual risk.
- `01-REVIEW.md` records independent review of credential hygiene and evidence claims.
- `01-01-SUMMARY.md` records whether the same-machine/local-Windows gap is closed or remains partially open.

## Definition of Done

- [x] Windows host evidence is collected or explicit blocker evidence is recorded.
- [x] No credential or private target data is written to repository files.
- [x] Existing local automated verification still passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

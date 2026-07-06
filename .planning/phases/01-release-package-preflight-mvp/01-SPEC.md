# Phase 1: Release Package Preflight MVP - Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.12 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Agents can run a release/package dry-run preflight that reports addon metadata completeness, package readiness blockers, sensitive information findings, and Workshop upload boundaries without performing any real upload, encryption, credential handling, or build automation.

## Background

v1.1 shipped an inspection-only `inspect_workshop_preflight` tool for addon layout, Panorama, toolchain, and publishing blocker boundaries. v1.2 should tighten the release-readiness surface before any real Workshop upload automation. The next useful slice is one deterministic dry-run report that answers whether an addon is ready for manual release review and why, while preserving the existing fixture/local/remote target contract.

## Requirements

1. **Unified dry-run release tool**: Expose a release readiness operation through schemas, tool discovery, dispatcher routing, and MCP server registration.
   - Current: `inspect_workshop_preflight` reports broad publishing boundaries, but no release dry-run report exists.
   - Target: Callers invoke one operation for fixture, local, and remote targets.
   - Acceptance: Tests prove schema parsing, `toolNames` inclusion, and `handleTool` routing.

2. **Validation before inspection**: Validate addon names and target roots before filesystem reads or remote command construction.
   - Current: Existing tools validate addon names individually.
   - Target: Unsafe addon names, missing local roots, and missing remote `dotaRoot` fail with explicit errors and evidence.
   - Acceptance: Fixture/local/remote tests prove invalid input fails before reads or commands.

3. **Addon metadata completeness**: Inspect `addoninfo.txt` for publish-facing metadata.
   - Current: Generated metadata exists but is not release-gated for completeness.
   - Target: The report checks `addonSteamAppID`, `addontitle`, `addonAuthor`, and `addonDescription`.
   - Acceptance: Missing, empty, or placeholder values are blockers; present values are evidence.

4. **Package candidate preflight**: Inspect release candidate roots and required files without packaging.
   - Current: Addon inspection reports roots and gameplay files; preflight does not classify package blockers.
   - Target: The report identifies game/content addon roots, Lua entry, localization, map directory, and NPC KV support as release candidate inputs.
   - Acceptance: Missing critical inputs are blockers; optional files become warnings/evidence.

5. **Sensitive information scan**: Scan text-like addon files for obvious secret material.
   - Current: Project-level secret scans are manual verification steps.
   - Target: The dry-run report scans addon roots using bounded deterministic file rules.
   - Acceptance: Secret-like keys, passwords, tokens, private keys, Steam credentials, GitHub tokens, and host credential markers are blockers with redacted evidence.

6. **Dry-run release report semantics**: Return explicit blockers, warnings, and dry-run evidence.
   - Current: Preflight returns warnings but does not fail release readiness on blockers.
   - Target: `ok` is false when blockers exist and true only when no blockers are found.
   - Acceptance: Tests cover blocker and clean dry-run outcomes.

7. **Steam/encryption/upload boundary**: Keep upload automation outside this phase.
   - Current: Docs defer publishing, encryption, and credentials.
   - Target: The new tool and docs always state that Steam login, encryption, and Workshop upload are manual/out of scope.
   - Acceptance: Tool input schema accepts no credential fields; output warnings and docs include the boundary.

8. **Remote parity and docs**: Remote dry-run release reports match local categories, and docs explain usage.
   - Current: Remote preflight exists for the inspection-only tool.
   - Target: Remote release dry run uses command evidence and parsed JSON with no local fallback.
   - Acceptance: Remote command tests prove script content, command suppression on invalid input, parsed evidence, and documentation updates.

## Boundaries

**In scope:**

- One MCP operation: `dry_run_release_report`.
- Fixture, local, and remote target support through the existing target contract.
- Addon metadata completeness checks.
- Package candidate root/file checks.
- Bounded sensitive information scan over addon text files.
- Explicit blockers, warnings, paths, command evidence, and documentation.

**Out of scope:**

- Real Steam login, Workshop item creation/update, upload, publish-state mutation, or Steam Guard handling.
- Content encryption, key generation, encrypted output, or upload-ready archive signing.
- Credential, token, key, password, private host, or private target storage.
- TypeScript-to-Lua, React Panorama, npm, bundler, Hammer, or resource compiler execution.
- Treating dry-run success as runtime validation or upload success.
- Same-machine local Windows smoke as a blocking requirement.

## Constraints

- Keep local Windows and remote Windows behind the same MCP tool contract.
- Every MCP result includes target, operation, success state, evidence, warnings, paths, commands, and logs when applicable.
- Let missing metadata, missing files, and secret matches surface as explicit blockers.
- Do not silently infer release readiness from missing optional files.
- Fixture tests must run on macOS without a Dota install.

## Acceptance Criteria

- [ ] `dry_run_release_report` is exposed through schemas, dispatcher, server registration, and tool-name discovery.
- [ ] Invalid addon names and missing roots fail before reads or remote command construction.
- [ ] Metadata completeness blockers are reported for missing, empty, or placeholder `addoninfo.txt` values.
- [ ] Package candidate blockers are reported for missing critical roots/files.
- [ ] Sensitive information scan reports redacted blockers and bounded skip warnings.
- [ ] Clean fixture addons return `ok: true` with release report evidence and boundary warnings.
- [ ] Remote command construction and parsed evidence match local release report categories.
- [ ] README and skill references document the dry-run release workflow and publishing boundary.

## Edge Coverage

**Coverage:** 7/7 applicable edges resolved - 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| invalid input | R1/R2 | covered | Invalid addon and missing root inputs fail before reads or commands. |
| missing metadata | R3 | covered | Missing, empty, and placeholder metadata are blockers. |
| missing files | R4 | covered | Missing release-critical roots/files are blockers. |
| sensitive data | R5/R7 | covered | Secret-like findings are redacted blockers. |
| oversized/binary files | R5 | covered | Skipped files produce warnings rather than silent acceptance. |
| remote parity | R8 | covered | Remote tests assert script construction and parsed categories. |
| upload confusion | R6/R7 | covered | Output and docs state dry run is not upload/runtime validation. |

## Prohibitions (must-NOT)

**Coverage:** 6/6 applicable prohibitions resolved - 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not upload to Workshop or mutate publish state. | R7 | resolved | verification: test |
| Must not accept or store Steam, GitHub, Windows, remote, token, password, or key material. | R5/R7 | resolved | verification: test |
| Must not encrypt content or generate upload-ready signed artifacts. | R7 | resolved | verification: judgment |
| Must not run npm, TypeScript-to-Lua, React, bundlers, Hammer, or resource compiler. | R4/R7 | resolved | verification: test |
| Must not reveal full secret values in evidence. | R5 | resolved | verification: test |
| Must not treat dry-run success as runtime validation or Workshop publication success. | R6/R7 | resolved | verification: judgment |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.92 | 0.75 | met | One dry-run release report with defined blocker categories. |
| Boundary Clarity | 0.94 | 0.70 | met | Upload, encryption, credentials, toolchain execution, and local smoke closure are excluded. |
| Constraint Clarity | 0.86 | 0.65 | met | Shared target contract, no credentials, deterministic scans, fixture-first tests. |
| Acceptance Criteria | 0.88 | 0.70 | met | Schema, metadata, package, secret scan, remote, docs, and verification checks are concrete. |
| Ambiguity | 0.12 | <=0.20 | met | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Inspection-only preflight exists; stricter release dry-run report does not. |
| 2 | Simplifier | What is the smallest useful release-readiness slice? | One dry-run report tool with metadata, package, secret scan, and boundary evidence. |
| 3 | Boundary Keeper | What is not part of this slice? | No upload, encryption, credentials, build toolchains, or blocking local Windows smoke. |
| 4 | Failure Analyst | What would invalidate success? | Credential leakage, secret overexposure, missing metadata marked ready, remote drift, or dry run confused with publication. |

---

*Phase: 01-release-package-preflight-mvp*
*Spec created: 2026-07-06*

# Requirements: v1.2 Publishing Readiness

**Created:** 2026-07-06
**Milestone:** v1.2 Publishing Readiness
**Status:** Implemented

## Goal

Agents can produce a deterministic dry-run release readiness report for a generated Dota 2 Workshop addon before any real Workshop upload automation exists.

## Scope

### In Scope

- Release/package preflight checks that run on fixture, local Windows, and remote Windows targets through the existing MCP target contract.
- Addon metadata completeness checks for publish-facing fields that can be inspected without Steam credentials.
- Sensitive information scanning across addon source files and release-facing metadata.
- Dry-run release report evidence that lists package candidates, blockers, warnings, and explicit manual upload boundaries.
- Documentation that explains Steam login, encryption, Workshop upload, and credential storage are outside v1.2.

### Out of Scope

- Real Workshop upload, Steam login, Steam Guard, item creation, item update, or publish-state mutation.
- Content encryption, key generation, encrypted package output, or upload-ready archive signing.
- Storing Steam, GitHub, Windows, remote host, password, private key, or token material in the repository.
- Running TypeScript-to-Lua, React Panorama, npm, bundlers, resource compilation, or Hammer automation as part of release preflight.
- Requiring same-machine local Windows smoke before v1.2 can close.

## Requirements

### PUB-01 Unified Dry-Run Release Tool

Expose one MCP operation for release readiness dry runs across fixture, local, and remote targets.

Acceptance:

- The operation is present in schemas, tool discovery, dispatcher routing, and MCP server registration.
- Fixture/local and remote targets return the same `ToolResult` shape with target, operation, evidence, warnings, paths, commands, logs, and errors where applicable.
- Invalid addon names and missing roots fail before filesystem reads or remote command construction.

### PUB-02 Addon Metadata Completeness

Inspect publish-facing addon metadata without mutating files.

Acceptance:

- The report checks `addoninfo.txt` for required keys: `addonSteamAppID`, `addontitle`, `addonAuthor`, and `addonDescription`.
- Missing, empty, or placeholder metadata values are reported as blockers.
- Present metadata values are reported as evidence without rewriting the file.

### PUB-03 Package Candidate Preflight

Identify package candidate roots and release-facing assets without creating archives or encrypted output.

Acceptance:

- The report includes game and content addon roots, map directory, Lua entry, localization file, and known NPC KV files.
- Missing roots or critical files are blockers.
- Optional release-facing files such as Panorama and toolchain markers are warnings or evidence, not implicit readiness.
- No archive, zip, VPK, encryption, upload, or build command is executed.

### PUB-04 Sensitive Information Scan

Scan addon files for obvious sensitive material before a release candidate is reviewed.

Acceptance:

- The scanner inspects text-like files under the target addon roots with bounded file size and deterministic extension filters.
- Matches for token, password, secret, private key, Steam credential, GitHub token, host credential, or private key material are blockers with file evidence.
- Binary or oversized files are skipped with explicit warning evidence, not silently accepted.
- The scanner does not print full secret values.

### PUB-05 Dry-Run Release Report

Return a concise report suitable for manual review.

Acceptance:

- The result includes evidence lines for `release blockers`, `release warnings`, and `dry-run release report generated`.
- `ok` is false when blockers exist and true only when no blockers are found.
- Warnings remain visible even when the dry run passes.
- The report states that preflight is not runtime validation and does not prove Workshop publication.

### PUB-06 Publishing Boundary

Keep Steam, encryption, and upload behavior as explicit manual boundaries.

Acceptance:

- The tool accepts no credential, token, key, password, Steam account, GitHub token, or private host fields.
- The result always warns that Steam login, encryption, and Workshop upload are manual/out of scope.
- Documentation and skill guidance state that dry-run release report output must not be treated as upload success.

### PUB-07 Remote Parity

Remote release dry run must use the same logical checks through command evidence.

Acceptance:

- Remote command-construction tests prove invalid input suppresses command execution.
- Remote script output parses into the same blocker, warning, evidence, and path categories as local fixture checks.
- Remote failures return explicit command evidence rather than local fallback behavior.

### PUB-08 Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted tests, full tests, typecheck, build, and whitespace checks pass.
- A strict secret scan over tracked and untracked project files reports no stored credentials.
- GSD verification, summary, and independent review artifacts record what was checked and any residual risk.

## Definition of Done

- [x] v1.2 requirements and roadmap exist outside the v1.1 archive.
- [x] The dry-run release report tool is implemented and documented.
- [x] The implementation has fixture and remote-command tests.
- [x] Verification artifacts prove automated checks ran.
- [x] Independent review records findings before commit.

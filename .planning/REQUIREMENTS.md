# Requirements: v1.10 Release Bundle Manifest / Source Snapshot Dry Run

**Created:** 2026-07-07
**Milestone:** v1.10 Release Bundle Manifest / Source Snapshot Dry Run
**Status:** Complete

## Goal

Create a local, credential-free source snapshot manifest dry run for release handoff review. The manifest must enumerate source files with SHA-256 hashes, version data, verification results, boundary statements, generation time, and commit identity without creating an archive, signing content, encrypting content, uploading anything, or storing sensitive material.

## Scope

### In Scope

- A deterministic source snapshot manifest generator.
- A local `npm run verify:source-snapshot` command that emits structured JSON from built output.
- File inventory with repository-relative paths, byte sizes, and SHA-256 hashes.
- Version, generated time, commit SHA, commit branch, verification result summaries, and release boundary statements.
- Sensitive material scanning that blocks manifest readiness without echoing sensitive values.
- Tests for determinism, hash coverage, boundary coverage, and sensitive information exclusion.
- GSD verification and independent review artifacts.

### Out of Scope

- Archive creation, package signing, content encryption, package publishing, registry publishing, real Workshop upload, Steam login, Steam Guard handling, network access, remote Windows connections, SSH, PowerShell Remoting, UI automation, or credential handling.
- Reading ignored dependency/output trees as source snapshot content.
- Adding gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, unit/ability runtime behavior, or publishing automation capabilities.

## Requirements

### SNAPSHOT-01 Manifest Shape

Define a source snapshot manifest for dry-run release handoff.

Acceptance:

- The manifest records schema version, project name, version, generated time, commit SHA, branch, file entries, verification summaries, boundaries, warnings, and blockers.
- File entries include repository-relative path, byte size, and SHA-256 hash.
- Paths are sorted deterministically.
- Absolute repository paths are not emitted in manifest file entries.

### SNAPSHOT-02 Determinism

Make manifest generation deterministic for identical inputs.

Acceptance:

- Given the same root, generated time, commit data, and verification results, repeated generation returns identical JSON-serializable output.
- File ordering is stable across filesystems.
- Hashes are calculated from file bytes, not timestamps.

### SNAPSHOT-03 Hash Coverage

Ensure every included source file has hash evidence.

Acceptance:

- Every included file has a 64-character lowercase SHA-256 digest.
- Missing or unreadable required source areas produce blockers.
- The manifest includes source, tests, docs, skill, examples, plugin metadata, package metadata, and planning artifacts needed for handoff review.

### SNAPSHOT-04 Boundaries

Record release dry-run boundaries explicitly.

Acceptance:

- Boundaries include no archive created, no signing, no encryption, no upload, no Steam login, no Steam Guard handling, no credential storage, no remote Windows connection, and no global install.
- The command performs none of those actions.
- Missing boundaries produce blockers.

### SNAPSHOT-05 Sensitive Information Exclusion

Block sensitive material without leaking it.

Acceptance:

- Manifest generation scans included text files for credential, token, password, private key, private host, username, and private path indicators.
- Blockers report only relative path, field, and category.
- Manifest output does not include file content or sensitive values.

### SNAPSHOT-06 Local Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted source snapshot tests pass.
- `npm run build` succeeds.
- `npm run verify:source-snapshot` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone` succeed or record explicit blockers unrelated to this slice.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.10 requirements, roadmap, spec, and plan exist.
- [x] Source snapshot manifest generator exists.
- [x] Local tests cover determinism, hash coverage, boundaries, and sensitive material exclusion.
- [x] Local verifier command emits structured JSON.
- [x] Local verification passes.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

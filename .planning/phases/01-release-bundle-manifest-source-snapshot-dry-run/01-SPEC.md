# Phase 1: Release Bundle Manifest / Source Snapshot Dry Run - Spec

**Status:** Ready for implementation
**Date:** 2026-07-07

## Intent

Provide a release handoff manifest that describes the source snapshot an operator could review before any external delivery. The manifest is evidence only: it must not create an archive, sign files, encrypt content, publish packages, upload Workshop content, or mutate user/global environments.

## Functional Contract

- The generator emits a JSON-serializable manifest.
- The manifest includes schema version, project name, package version, generated time, commit SHA, branch, file entries, verification summaries, boundary statements, warnings, and blockers.
- File entries include repository-relative path, byte size, and SHA-256 digest.
- File entries are sorted by path.
- The same inputs produce the same manifest.
- Sensitive material findings produce blockers without including sensitive values.

## Source Coverage

The manifest should include source-controlled handoff material:

- Plugin metadata and MCP config.
- Package metadata and TypeScript config.
- Source files under `src/`.
- Tests under `tests/`.
- Skills and skill references.
- Docs and safe workflow examples.
- Planning artifacts needed to understand the release slice.

Generated dependency and cache trees are not source snapshot content.

## Boundary Contract

- No archive created.
- No package signing.
- No content encryption.
- No package or registry publish.
- No Workshop upload.
- No Steam login or Steam Guard handling.
- No credential storage.
- No remote Windows connection.
- No global install.

## Acceptance Checks

- Tests prove deterministic output for identical inputs.
- Tests prove every included file has SHA-256 coverage.
- Tests prove required boundaries exist.
- Tests prove sensitive material is blocked without value leakage.
- `npm run verify:source-snapshot` emits structured JSON and succeeds on the repository.

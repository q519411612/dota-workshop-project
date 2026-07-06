# Requirements: v1.11 Addon Metadata Polish

**Created:** 2026-07-07
**Milestone:** v1.11 Addon Metadata Polish
**Status:** Complete

## Goal

Polish generated addon metadata and dry-run release metadata checks so operators can see title, author, description, version, map name readiness, expected missing fields, placeholder blockers, and release blockers without touching Steam, Workshop upload, encryption, signing, or publish state.

## Scope

### In Scope

- Enhanced generated `addoninfo.txt` metadata for title, author, description, version, and map name.
- Dry-run metadata checks for title, author, description, version, default map, and maps entry.
- Placeholder detection for release metadata fields.
- Structured evidence lines that distinguish metadata evidence from release blockers.
- Tests for metadata generation, missing-field blockers, placeholder blockers, and report evidence.
- GSD verification and independent review artifacts.

### Out of Scope

- Real Workshop upload, publish-state mutation, Steam login, Steam Guard handling, content encryption, package signing, archive creation, registry publish, global installation, remote Windows connections, UI automation, or credential handling.
- Complex publishing automation or package release creation.
- Gameplay, Panorama, TypeScript-to-Lua, React, Excel-to-KV, or runtime ability expansion.

## Requirements

### META-01 Metadata Generation

Generate richer addon metadata.

Acceptance:

- Generated `addoninfo.txt` includes addon title.
- Generated `addoninfo.txt` includes addon author.
- Generated `addoninfo.txt` includes addon description.
- Generated `addoninfo.txt` includes addon version.
- Generated `addoninfo.txt` includes default map and maps entry.

### META-02 Metadata Readiness Checks

Validate release metadata in dry-run release reporting.

Acceptance:

- Dry-run release checks title, author, description, version, default map, and maps entry.
- Missing fields produce metadata blockers.
- Valid fields produce metadata evidence.
- Metadata blockers are included in release blocker counts.

### META-03 Placeholder Detection

Reject placeholder metadata values.

Acceptance:

- Placeholder title, author, description, version, default map, or maps entry values produce blockers.
- Placeholder blockers identify field name without leaking unrelated content.
- Placeholder checks remain local-only.

### META-04 Report Evidence

Make metadata report evidence reviewable.

Acceptance:

- Dry-run report includes evidence for metadata fields present.
- Dry-run report includes blockers for missing or placeholder metadata fields.
- Dry-run report includes release blocker count.
- Dry-run report remains a dry-run and does not upload, encrypt, sign, or package content.

### META-05 Local Verification and Review

Close the slice with automated verification and independent review.

Acceptance:

- Targeted addon metadata tests pass.
- `npm run build` succeeds.
- `git diff --check`, `npm run typecheck`, `npm test`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone` succeed.
- `01-VERIFICATION.md`, `01-REVIEW.md`, and `01-01-SUMMARY.md` record the outcome.

## Definition of Done

- [x] v1.11 requirements, roadmap, spec, and plan exist.
- [x] Generated addon metadata includes title, author, description, version, and map readiness fields.
- [x] Dry-run release metadata checks cover missing fields, placeholders, blockers, and evidence.
- [x] Local tests pass.
- [x] Independent review is recorded.
- [ ] Changes are committed and pushed.

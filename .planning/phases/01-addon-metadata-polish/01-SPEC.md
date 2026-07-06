# Phase 1: Addon Metadata Polish - Spec

**Status:** Ready for implementation
**Date:** 2026-07-07

## Intent

Improve addon metadata readiness before any release handoff. The generated template should include reviewable metadata, and the dry-run release report should identify missing or placeholder metadata fields without performing any publishing action.

## Functional Contract

- Generated `addoninfo.txt` includes `addontitle`, `addonAuthor`, `addonDescription`, `addonVersion`, `DefaultMap`, and `maps`.
- Dry-run release metadata checks validate those fields.
- Missing metadata fields produce release blockers.
- Placeholder metadata values produce release blockers.
- Valid metadata fields produce evidence lines.
- Release blocker counts include metadata blockers.

## Boundary Contract

- No Workshop upload.
- No Steam login or Steam Guard handling.
- No content encryption.
- No package signing.
- No archive creation.
- No registry or package publishing.
- No remote Windows connection.

## Acceptance Checks

- Tests prove generated metadata includes title, author, description, version, and map fields.
- Tests prove missing fields are blocked.
- Tests prove placeholder fields are blocked.
- Tests prove report evidence includes present metadata fields and release blocker count.

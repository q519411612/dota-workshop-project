# Phase 7 Research: Unified Export Cleanup and Remote Parity

## Architecture

- Add dedicated services instead of extending `runRemoteCommand`, because raw remote command evidence is not an acceptable trust boundary.
- Generate target-native PowerShell from shared constants for manifest version, boundary fields, digest projection, blocker codes, and handoff suffix.
- Parse exactly one framed JSON object, close every nested shape, recompute digests, and sanitize targets, commands, logs, and errors.
- Cleanup should use opened-handle or Windows file-identity observations before and after full inventory. Deletion authorization is invalidated by any identity or topology drift.
- Candidate removal and manifest removal are separate facts. Partial removal forces overall failure and reports which owned object remains.

## Compatibility

Existing `ToolResult.releaseCandidate` remains for preflight. Add export-specific optional fields without changing existing operation shapes when those fields are absent.


# Phase 9 Review: Runtime Placement MVP

**Date:** 2026-07-06
**Scope:** Runtime placement schema, local and remote addon generation, playable Lua renderer, smoke marker validation, tests, docs, and planning artifacts.

## Findings

### F1: Placement on `template: "minimal"` produced misleading evidence

Initial implementation accepted `placement` together with `template: "minimal"` and returned placement creation evidence even though the minimal Lua template does not render placement configuration.

Resolution:

- Added a failing fixture test for placement on the marker-only minimal template.
- Changed local and remote addon validation to reject placement unless the effective template is `playable`.
- Re-ran focused tests, typecheck, build, and full verification.

## Review Result

No unresolved implementation findings remain.

## Residual Risk

- Real Windows placement smoke has now been exercised through the remote SSH target adapter with runtime log marker evidence for placement configuration, origin, unit/team, and spawned unit.
- Runtime placement proves spawn intent and spawn execution through markers on launchable maps; it does not prove Hammer map spawn entity placement.

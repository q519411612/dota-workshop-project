# Milestones: Dota Workshop Project

## v1.1 Workshop MVP (Shipped: 2026-07-06)

**Delivered:** A usable Dota 2 Workshop Tools plugin slice that can generate, inspect, launch, smoke-test, clean up, and preflight minimal playable addons through a unified MCP interface.

**Work completed:** 13 delivery slices, 13 plans.

**Key accomplishments:**

- Packaged the project as a plugin with Dota 2 Workshop skill guidance and progressively loaded references.
- Built a typed MCP interface for fixture, local Windows, and remote Windows targets with explicit result evidence.
- Generated minimal and playable addon templates with runtime log marker validation.
- Proved real Windows runtime validation through the remote SSH target without storing private credentials.
- Added repeatable playable smoke orchestration and explicit addon-scoped cleanup controls.
- Added runtime placement, custom map preparation, score objective markers, and unit/ability KV scaffolding.
- Added inspection-only Panorama, toolchain, and publishing preflight reporting.
- Completed milestone audit with full requirement coverage and no open artifact debt.

**Archives:**

- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`
- Execution history: `.planning/milestones/v1.1-phases/`

**Verification:**

- Milestone audit passed with requirements `110/110`, delivery slices `13/13`, integration `8/8`, and flows `8/8`.
- Latest full suite before close: `npm run typecheck`, `npm test` with 94 tests, and `npm run build`.
- Graphify was refreshed locally after the audit commit; graph files intentionally remain uncommitted for HEAD freshness.

**Known residual items:**

- Same-machine local Windows smoke was not separately recorded; real Windows validation was performed through the remote target path.
- Publishing preflight is inspection-only; real upload, encryption, Steam credential handling, and full toolchain execution remain deferred.

**What's next:** Decide whether to close the local Windows smoke gap, then plan a publishing readiness milestone before any real Workshop upload automation.

---

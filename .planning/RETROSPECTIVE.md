# Retrospective: Dota Workshop Project

## Milestone: v1.1 Workshop MVP

**Shipped:** 2026-07-06
**Work completed:** 13 delivery slices, 13 plans

### What Was Built

- Plugin packaging with Dota 2 Workshop Tools skill guidance and references.
- Unified MCP operations for fixture, local Windows, and remote Windows targets.
- Minimal and playable addon generation with deterministic runtime marker validation.
- Real Windows smoke workflows for runtime validation, cleanup, placement, custom map preparation, score objectives, unit/ability scaffolding, and preflight inspection.
- Inspection-only boundaries for Panorama, toolchain markers, and publishing readiness.

### What Worked

- The shared target contract kept fixture, local, and remote behavior aligned.
- Evidence-rich MCP results made Windows validation auditable without storing private host or credential data.
- Runtime `console.log` marker validation was a stronger success signal than launch or process evidence alone.
- Small vertical slices made later features easier to validate on the same smoke path.

### What Was Inefficient

- Same-machine local Windows validation was not separately recorded before remote validation became the main real-Windows path.
- Manual remote smoke setup required careful process cleanup before repeat launches.
- The milestone grew across several v2.x capabilities before being archived, which made planning files large.

### Patterns Established

- Prefer deterministic file, process, command, and log evidence over desktop UI automation.
- Keep cleanup explicit, addon-scoped, and separate from smoke execution.
- Treat preflight as a boundary report until publishing credentials, encryption, and upload workflows have their own requirements.
- Leave graphify artifacts locally refreshed after the final commit instead of committing them and immediately making commit freshness stale.

### Key Lessons

- `-tools` opens the editor/tooling context, while non-tools custom game launch with `-condebug` is needed for Lua runtime marker evidence.
- `resourcecompiler.exe -game` must point at the `game/dota` directory, and the template map output is `<map>.vpk`.
- Custom ability runtime behavior should not be claimed from KV scaffold evidence alone.
- Publishing automation needs a separate readiness milestone before any real upload behavior.

### Cross-Milestone Trends

| Trend | Observation |
|-------|-------------|
| Validation | Runtime log markers remain the most reliable pass/fail evidence. |
| Scope | Small MCP-visible capability slices were easier to verify than broad Workshop automation. |
| Risk | Real publishing, encryption, Steam credentials, and UI generation remain high-risk boundaries. |

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

## Milestone: v1.13 — Local Install Simulation

**Shipped:** 2026-07-13
**Phases:** 2 | **Plans:** 3

### What Was Built

- A built local install simulation command with a structured result contract.
- An isolated temporary consumer layout for plugin, skill, MCP, package, and dist artifacts.
- Cleanup, environment non-mutation, sensitive-material, symbolic-link, and isolation evidence.
- Exact six-requirement traceability, expanded independent review, and a passing milestone audit.

### What Worked

- TDD exposed YAML/YML scanning and duplicate blocker gaps before implementation changes.
- Adversarial review found symbolic-link escape and non-isolated-copy failure paths that normal happy-path tests missed.
- Exact-set assertions kept requirements, verification, and summary metadata aligned.
- Independent integration and goal-backward verification separated runtime correctness from planning claims.

### What Was Inefficient

- The initial audit and review artifacts were too narrow, requiring a second closure loop for planning-evidence coverage.
- Reused numeric phase directories from earlier milestones confused generic milestone statistics and required scope correction.
- The older `verify:milestone` name can imply current authority even though its implementation remains scoped to v1.8.

### Patterns Established

- Validate canonical source paths and reject symbolic links before recursive copy.
- Fail closed on an unsafe simulation root while still returning structured cleanup and environment evidence.
- Compare requirement traceability as exact ordered sets, not loose presence checks.
- Treat milestone audit authority separately from older regression commands.

### Key Lessons

- Sensitive scanning must cover every copied text format, including metadata formats that are not primary source code.
- Independent reviews need the full declared artifact scope, not only implementation files.
- Archive tooling must scope repeated numeric phase directories by milestone identity rather than directory number alone.

### Cost Observations

- Model mix: not recorded.
- Sessions: not recorded.
- Notable: adversarial checks added a small amount of rework but closed three path-safety failures before archival.

---

## Cross-Milestone Trends

| Trend | Observation |
|-------|-------------|
| Validation | Runtime log markers remain the most reliable pass/fail evidence. |
| Scope | Small MCP-visible capability slices were easier to verify than broad Workshop automation. |
| Risk | Real publishing, encryption, Steam credentials, and UI generation remain high-risk boundaries. |
| Audit | Exact traceability plus adversarial integration checks catch gaps that green standard suites can miss. |

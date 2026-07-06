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

## v1.2 Publishing Readiness (Implemented: 2026-07-06)

**Goal:** Add a dry-run release/package readiness workflow before any real Workshop upload automation.

**Work completed:** One delivery slice, one plan.

**Key accomplishments:**

- Added `dry_run_release_report` through schemas, dispatcher, MCP server registration, and tool discovery.
- Added package candidate checks, addon metadata completeness checks, redacted sensitive information blockers, and release boundary warnings.
- Added remote command parity through the existing SSH/PowerShell adapter.
- Documented that Steam login, content encryption, Workshop upload, credential handling, and runtime validation are outside the dry-run report.

**Key boundaries:**

- No real Workshop upload.
- No Steam login or credential handling.
- No content encryption or signed upload package output.
- No stored Steam, GitHub, Windows, remote, token, password, or private key material.
- Same-machine local Windows smoke is optional and does not block the v1.2 mainline.

**Artifacts:**

- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- Phase: `.planning/phases/01-release-package-preflight-mvp/`

**Verification:**

- Targeted tests passed with 33 tests.
- Full suite passed with 100 tests.
- `npm run typecheck`, `npm run build`, `git diff --check`, and strict high-signal secret scan passed.

---

## v1.3 Windows Validation Closure (Implemented: 2026-07-06)

**Goal:** Collect sanitized evidence from a user-provided Windows host to close or characterize the remaining local/same-machine Windows smoke gap.

**Work completed:** One delivery slice, one plan.

**Key accomplishments:**

- Verified real Windows environment categories without storing private target details.
- Fixed remote log reading to suppress PowerShell progress output before JSON parsing.
- Ran a real playable smoke through the existing remote SSH target path and validated runtime markers.
- Ran dry-run release reporting without Steam login, encryption, upload, or publish-state mutation.
- Performed addon-scoped cleanup after dry-run evidence and confirmed no matching process remained.

**Key boundaries:**

- No stored Windows password, private host, private username, token, key, or Steam credential material.
- No real Workshop upload, Steam login, content encryption, or publish-state mutation.
- No broad process cleanup outside a known smoke addon.
- Runtime validation success requires expected log or console marker evidence.

**Artifacts:**

- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- Phase: `.planning/phases/01-windows-validation-closure/`

**Verification:**

- Targeted remote operation tests passed with 25 tests.
- `git diff --check`, typecheck, full test suite with 100 tests, build, and strict high-signal secret scan passed.
- Real Windows smoke addon `validation_closure_20260706_103317` passed runtime marker validation.

**Known residual item:**

- A separate same-machine Windows-local MCP server run remains optional and unproven; v1.3 closure relies on the remote SSH path to a real Windows host.

---

## v1.4 Plugin Install Handoff Readiness (Implemented: 2026-07-06)

**Goal:** Make plugin installation and operator handoff readiness verifiable from the repository.

**Work completed:** One delivery slice, one plan.

**Key accomplishments:**

- Added `npm run verify:plugin`.
- Added local readiness checks for plugin manifest, MCP config, package bin, built server entrypoint, skill references, README tool list, and skill tool list.
- Added tests that prove manifest, entrypoint, reference, and tool-list drift blockers.
- Corrected the skill MCP tool list to match the implemented `toolNames` registry.
- Documented plugin handoff readiness commands in README.

**Key boundaries:**

- No global plugin installation.
- No package registry publish.
- No archive signing or encrypted package output.
- No Steam login, Workshop upload, publish-state mutation, or credential storage.

**Artifacts:**

- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- Phase: `.planning/phases/01-plugin-install-handoff-readiness/`

**Verification:**

- Targeted verifier tests passed with 6 tests.
- `npm run build` passed.
- `npm run verify:plugin` passed.
- `git diff --check`, typecheck, full test suite with 106 tests, build, `verify:plugin`, and strict high-signal secret scan passed.

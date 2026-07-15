# Milestones: Dota Workshop Project

## v1.14 Workshop Addon Release Candidate Preflight (Shipped: 2026-07-15)

**Delivered:** One strict evidence-only release-candidate preflight across fixture, local Windows, SSH Windows, and PowerShell Remoting with deterministic manifests, source immutability, explicit failures, and verified cleanup.

**Phases completed:** 3 phases, 19 plans, 25 tasks

**Key accomplishments:**

- One structured readiness authority now serves future candidate assembly while preserving complete dry-run release results.
- Invalid or unsafe candidate inputs now stop at a typed, canonical precreation gate without creating temporary state.
- Both addon roots now produce one deterministic, collision-checked inventory that rejects unsafe identities and entry kinds before candidate creation.
- One canonically isolated target-local candidate now exists only inside an owned inspection callback and is removed after callback success or failure.
- Every accepted game and content source entry is explicitly reproduced under the fixed temporary candidate layout before callback inspection, with readiness and per-write safety gates.
- Candidate assembly now fails explicitly on observable source topology, identity, stat, kind, or byte drift while all candidate writes and cleanup remain outside the two source roots.
- Every accepted regular file now requires identity-bound streamed source-before, candidate, and source-after byte-count and SHA-256 equality at the final pre-cleanup boundary.
- Validated final candidate integrity facts now produce one deterministic versioned file manifest and one collision-free host-independent combined SHA-256.
- Final candidate observations now prove a deterministic one-to-one mapping from every accepted source file to exactly one manifest entry without losing duplicate occurrences.
- Every accepted regular file now has one deterministic scan class, while fatal text validation and binary-preserving manifest inclusion remain separate proof domains.
- Factory-owned candidate creation transfers cleanup ownership before provider post-create work, with exact one-attempt or truthful zero-attempt evidence.
- Final post-callback artifact truth now remains independently observable while verified cleanup is mandatory for overall success.
- The MCP server now exposes exactly one strict `preflight_release_candidate` operation across fixture, local, SSH, and PowerShell targets without changing the adjacent dry-run inspection route.
- Release-candidate preflight now has one strict immutable detail whose public success is computed from evidence rather than adapter narration.
- Release-candidate preflight now uses an exact safe input and boundary contract around one production fixture/local Node lifecycle with identity-bound creation, immutable sources, and truthful cleanup evidence.
- SSH and PowerShell Remoting now execute one target-local PowerShell lifecycle that inventories, validates, copies, hashes, reconciles, reports, and removes a temporary release candidate without transferring addon state to the MCP host.
- Remote release-candidate evidence now crosses the transport boundary only after exact framing, strict shared normalization, invariant recomputation, and whole-result disclosure checks.
- The public release-candidate preflight now has one strict evidence contract across fixture, local adapter, mocked SSH, and mocked PowerShell targets.
- The tracked MCP runtime now contains the minimal executable release-candidate import closure and is proven byte-identical to an isolated build before loading and invoking the operation from a Git-index-only export.

**Stats:**

- 103 files changed across the milestone commit range.
- 28,593 lines added and 324 lines removed.
- 26,574 TypeScript lines in `src/` and `tests/` at ship time.
- 3 phases, 19 plans, 25 tasks completed across 2026-07-15 and 2026-07-16.

**Git range:** `75e676e` → `a8f671c`

**Archives:**

- Roadmap: `.planning/milestones/v1.14-ROADMAP.md`
- Requirements: `.planning/milestones/v1.14-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.14-MILESTONE-AUDIT.md`
- Execution history: `.planning/milestones/v1.14-phases/`

**Verification:** 318/318 tests, 19/19 requirements, 17/17 integration links, 9/9 end-to-end flows, and a clean independent final review.

**What's next:** Define the next focused milestone with fresh requirements through `$gsd-new-milestone`.

---

## v1.13 Local Install Simulation (Shipped: 2026-07-13)

**Delivered:** An isolated local plugin install simulation with consumer-contract validation, fail-closed path safety, redacted YAML/YML scanning, deterministic cleanup, and complete milestone evidence.

**Phases completed:** 2 phases, 3 plans, 4 tasks

**Key accomplishments:**

- Added a built local verifier that copies install-facing plugin artifacts into an isolated temporary consumer layout.
- Validated manifest, MCP, package-bin, dist-entrypoint, skill, cleanup, and environment contracts with structured evidence.
- Added case-insensitive YAML/YML scanning, redacted sensitive blockers, and unique missing-file evidence.
- Rejected symbolic-link sources and unsafe non-isolated roots before copy or scan work.
- Closed exact six-requirement traceability with clean independent review, 9/9 goal verification, and a passing 6/6 milestone audit.

**Stats:**

- 26 files changed across the milestone commit range.
- 2,374 lines added and 68 lines removed.
- 11,627 TypeScript/JavaScript lines in `src/` and `tests/` at ship time.
- 2 phases, 3 plans, 4 tasks across 7 calendar days.

**Git range:** `44ea92d` → `f809f90`

**Archives:**

- Roadmap: `.planning/milestones/v1.13-ROADMAP.md`
- Requirements: `.planning/milestones/v1.13-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.13-MILESTONE-AUDIT.md`
- Execution history: `.planning/milestones/v1.13-phases/`

**What's next:** Define the next focused milestone with fresh requirements through `$gsd-new-milestone`.

---

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

---

## v1.5 Operator Runbook and Example Workflows (Implemented: 2026-07-06)

**Goal:** Add checked operator documentation and reusable safe workflow examples.

**Work completed:** One delivery slice, one plan.

**Key accomplishments:**

- Added `docs/operator-runbook.md`.
- Added schema-valid examples under `examples/workflows/`.
- Added tests for example presence, operation names, schema validity, forbidden private/credential-like material, and README links.
- Added README links to the runbook and examples.

**Key boundaries:**

- No real Windows smoke as a blocker.
- No real Workshop upload, Steam login, encryption, package signing, or publish-state mutation.
- No stored Steam, GitHub, Windows, remote, token, password, private key, private host, or private target material.

**Artifacts:**

- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- Phase: `.planning/phases/01-operator-runbook-example-workflows/`

**Verification:**

- Targeted examples tests passed with 4 tests.
- `git diff --check`, typecheck, full test suite with 110 tests, build, `verify:plugin`, and strict high-signal secret scan passed.

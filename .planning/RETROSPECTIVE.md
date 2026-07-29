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

## Milestone: v1.14 — Workshop Addon Release Candidate Preflight

**Shipped:** 2026-07-16
**Phases:** 3 | **Plans:** 19 | **Tasks:** 25

### What Was Built

- Exact two-root temporary candidate assembly with no heuristic omissions and no source writes.
- Streamed triple-integrity checks, canonical manifests, occurrence reconciliation, complete scan coverage, and verified cleanup precedence.
- One strict MCP operation across fixture, local Windows, SSH Windows, and PowerShell Remoting with no fallback or candidate transfer.
- A staged-index runtime closure plus checked examples and evidence-only operator guidance.

### What Worked

- Atomic RED→GREEN commits made every correctness change traceable.
- Independent review and integration-audit loops found path identity, cleanup, hostile normalization, final remote observation, and parity-oracle gaps that green suites initially missed.
- Fixed graph guards preserved unrelated user-owned planning graph changes through a long multi-plan execution.
- Fixture and adapter-contract evidence kept the milestone testable on macOS without overstating real Windows proof.

### What Was Inefficient

- Phase 5 required multiple re-review loops because Windows identity, final remote observation, and cleanup invariants were not modeled deeply enough in the initial tests.
- An inline integration audit was started before the mandated independent checker returned and had to be superseded by a gaps-found audit.
- Generic roadmap plan counting treated a non-execution planning artifact as a plan, requiring authoritative STATE and verification counts during closeout.

### Patterns Established

- Register cleanup ownership immediately at creation, before any fallible identity observation.
- Bind Windows path isolation and final candidate reads to volume GUID plus file ID identities; lexical paths and path-only reopen are insufficient.
- Keep one exported categorized sensitive-material policy authority for fixture, local, and generated remote behavior.
- Prove packaged behavior from staged Git-index bytes, not freshly generated worktree output.

### Key Lessons

- A passing full suite is not a substitute for adversarial integration review; every review finding needs its own RED evidence.
- Cleanup facts must be modeled as a separate strict domain and composed only after the single cleanup attempt settles.
- Contract evidence and real-runtime evidence must remain explicitly separate in both results and documentation.
- Milestone completion must wait for the independent integration checker, not only phase verification and local review.

### Cost Observations

- Model mix: not recorded.
- Sessions: one autonomous goal run with independent implementation, review, gap-review, and integration-checker agents.
- Notable: review-driven rework was substantial but closed every confirmed blocker before archival, ending at 318/318 tests and a clean 17/17 integration audit.

---

## Milestone: v1.15 — Verifiable Release Candidate Export and Handoff

**Shipped:** 2026-07-29
**Phases:** 3 | **Plans:** 6 | **Tasks:** 18

### What Was Built

- Independent `export_release_candidate` and `cleanup_exported_candidate` MCP operations across fixture, local Windows, SSH Windows, and PowerShell Remoting.
- Strict protected-path validation, same-filesystem owned staging, atomic no-replace promotion, and final identity, topology, and digest verification.
- A versioned external handoff with candidate identity, ownership, source and target boundaries, topology, file count, and combined SHA-256.
- Exact dry-run and execute cleanup with target-kind binding, handoff lease validation, tombstone revalidation, and separate absence proof.
- Hostile remote normalization, tracked runtime closure, a continuous v1.2-v1.15 closeout inventory, and complete milestone audit evidence.

### What Worked

- Reusing the v1.14 preflight implementation preserved complete file and integrity semantics without weakening its mandatory temporary cleanup contract.
- Modeling export, handoff publication, cleanup authorization, and partial cleanup as separate strict state machines made failures auditable.
- Multiple independent review passes exposed contradictions that ordinary green tests missed, especially around remote evidence, path identity, and publication failure state.
- Explicit graph-hash guards preserved unrelated user-owned planning output throughout the milestone.

### What Was Inefficient

- Review-driven hardening required several iterations because the initial design did not fully enumerate hostile result matrices and filesystem race outcomes.
- The milestone gate was initially updated to v1.15 without including the continuous v1.8-v1.14 history, producing a false completeness claim.
- Generic roadmap analysis counted `PLAN-CHECK.md` files as execution plans, so closeout readiness required authoritative summary and verification cross-checks.

### Patterns Established

- Persistent candidate export must remain independent from temporary preflight semantics.
- Final external handoff state and operation-owned temporary handoff cleanup are separate evidence domains.
- Local discovery must complete before protected-path validation whenever the Dota root is implicit.
- Milestone inventories that claim a continuous version range must validate exact order, count, duplicates, and gaps.
- Packaged runtime parity depends on staged Git-index bytes and must be checked after every tracked dist change.

### Key Lessons

- A no-replace filesystem operation is only one part of safety; identity, topology, digest, ownership, and truthful partial-state reporting remain necessary after mutation.
- Stable errors should preserve meaningful target diagnostics without exposing arbitrary dependency text or collapsing unrelated failures.
- Contract tests can close the milestone on macOS, but real Windows runtime evidence must remain explicitly unverified until actually collected.
- Independent review and integration audit should remain separate gates because they detect different classes of omissions.

### Cost Observations

- Model mix: not recorded.
- Sessions: one autonomous goal run with independent review, fix, re-review, and integration-audit loops.
- Notable: substantial adversarial rework closed every confirmed blocker before archival and raised the suite to 388 runnable tests.

---

## Cross-Milestone Trends

| Trend | Observation |
|-------|-------------|
| Validation | Runtime log markers remain the most reliable pass/fail evidence. |
| Scope | Small MCP-visible capability slices were easier to verify than broad Workshop automation. |
| Risk | Real publishing, encryption, Steam credentials, and UI generation remain high-risk boundaries. |
| Audit | Exact traceability plus adversarial integration checks catch gaps that green standard suites can miss. |
| Identity | Filesystem safety increasingly depends on canonical, target-native identity rather than lexical path checks. |
| Packaging | Executable runtime closure is strongest when verified from staged index bytes. |
| State models | Export, publication, authorization, deletion, and absence need separate closed evidence matrices. |

# Roadmap: Dota Workshop Project

**Created:** 2026-07-03
**Updated:** 2026-07-15
**Mode:** Vertical MVP
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## Milestones

- [x] **v1.1 Workshop MVP** — 13 delivery slices shipped on 2026-07-06. [Archive](milestones/v1.1-ROADMAP.md)
- [x] **v1.2 Publishing Readiness** — dry-run release/package readiness.
- [x] **v1.3 Windows Validation Closure** — sanitized real Windows evidence through the remote path.
- [x] **v1.4 Plugin Install Handoff Readiness** — local plugin readiness verification.
- [x] **v1.5 Operator Runbook and Example Workflows** — checked docs and safe examples.
- [x] **v1.6 Release Candidate Audit Gate** — local RC verification.
- [x] **v1.7 Release Handoff Bundle Readiness** — local handoff reporting.
- [x] **v1.8 Milestone Archive and Release Notes Readiness** — v1.2-v1.7 closeout reporting.
- [x] **v1.9 Same-Machine Windows Local Smoke Evidence** — local harness with runtime evidence separation.
- [x] **v1.10 Release Bundle Manifest / Source Snapshot Dry Run** — deterministic source snapshot manifest.
- [x] **v1.11 Addon Metadata Polish** — richer metadata and dry-run blockers.
- [x] **v1.12 Minimal Runtime Ability Proof** — explicit Lua ability marker proof harness.
- [x] **v1.13 Local Install Simulation** — isolated install consumption and audit closure. [Archive](milestones/v1.13-ROADMAP.md)
- [ ] **v1.14 Workshop Addon Release Candidate Preflight** — temporary two-root addon candidate assembly, integrity evidence, cleanup proof, and target parity.

## Phases

<details>
<summary>✅ v1.13 Local Install Simulation (Phases 1-2) — SHIPPED 2026-07-13</summary>

- [x] Phase 1: Local Install Simulation (1/1 plan) — completed 2026-07-07
- [x] Phase 2: Audit Gap Closure (2/2 plans) — completed 2026-07-13

Execution history: `.planning/milestones/v1.13-phases/`

</details>

### v1.14 Workshop Addon Release Candidate Preflight

- [x] **Phase 3: Safe Candidate Assembly** - Users can assemble an exact, isolated two-root candidate without unsafe entries or source mutation. (completed 2026-07-15)
- [x] **Phase 4: Integrity Manifest and Verified Cleanup** - Users receive deterministic byte-integrity evidence and proof that every temporary candidate was removed. (completed 2026-07-15)
- [ ] **Phase 5: Unified MCP and Remote Target Parity** - Users can run the preflight through every supported target contract with strict remote evidence and no fallback.

## Phase Details

### Phase 3: Safe Candidate Assembly

**Goal**: Users can safely assemble the complete `game` and `content` addon trees into an isolated temporary candidate while source data remains unchanged.
**Depends on**: Phase 2
**Requirements**: RCOP-02, RCFS-01, RCFS-02, RCFS-03, RCFS-04, RCFS-05
**Success Criteria** (what must be TRUE):

  1. An agent receives input or missing-root blockers before any candidate directory exists.
  2. An agent can inspect a temporary candidate containing every regular file and empty directory under the preserved `game/dota_addons/<addon>` and `content/dota_addons/<addon>` layout.
  3. An agent receives safe relative-path blockers for links, reparse points, special entries, escapes, traversal, absolute paths, and case-folded collisions, with no dereference or repair.
  4. An agent receives the established structure, metadata, placeholder, and redacted sensitive-material blockers without either source tree being modified.
  5. An agent receives an explicit failure when a source tree changes during assembly.

**Plans**: 6 plans

Plans:

- [x] 03-01: Extract shared release-readiness policy with exact dry-run compatibility.
- [x] 03-02: Gate invalid addon and source-root inputs before candidate creation.
- [x] 03-03: Reject unsafe filesystem entries and normalized path identities.
- [x] 03-04: Own a canonically isolated callback-scoped candidate lifetime.
- [x] 03-05: Assemble the complete fixed two-root addon layout.
- [x] 03-06: Detect source mutation, prove source immutability, and run the full quality gate.

### Phase 4: Integrity Manifest and Verified Cleanup

**Goal**: Users can trust that the candidate exactly matches stable source bytes and that no temporary candidate remains after any outcome.
**Depends on**: Phase 3
**Requirements**: RCIN-01, RCIN-02, RCIN-03, RCIN-04, RCIN-05, RCCL-01, RCCL-02
**Success Criteria** (what must be TRUE):

  1. An agent receives deterministic manifest entries for every candidate file with provenance, normalized path, byte count, and lowercase SHA-256, plus a host-independent combined digest.
  2. An agent receives a blocking result for any source-before, source-after, or candidate hash mismatch and for any missing, duplicate, or unexpected candidate entry.
  3. An agent can distinguish text, binary, unreadable, and oversized scan coverage without excluding legitimate binary files or accepting unscannable required text.
  4. An agent receives cleanup evidence after successful validation and every failure following candidate creation.
  5. An agent receives `ok: false` while still seeing the separate artifact-validation state whenever removal or post-cleanup absence cannot be proven.

**Plans**: 6 plans

Plans:

- [x] 04-01: Stream identity-bound file observations and require source-before/candidate/source-after equality.
- [x] 04-02: Produce the versioned ordinal manifest and host-independent canonical digest.
- [x] 04-03: Reconcile exact candidate occurrences before constructing manifest lookups.
- [x] 04-04: Report exhaustive text, binary, unreadable, and oversized scan coverage.
- [x] 04-05: Guarantee exactly one cleanup attempt after every stateful candidate creation outcome.
- [x] 04-06: Preserve artifact-validation truth while enforcing verified-cleanup precedence.

### Phase 5: Unified MCP and Remote Target Parity

**Goal**: Users can invoke one release-candidate preflight operation across fixture, local Windows, SSH Windows, and PowerShell Remoting with equivalent strict semantics.
**Depends on**: Phase 4
**Requirements**: RCOP-01, RCOP-03, RCOP-04, RCCL-03, RCCL-04, RCCL-05
**Success Criteria** (what must be TRUE):

  1. An agent can invoke `preflight_release_candidate` with a validated addon name through every supported target contract without changing `dry_run_release_report` behavior.
  2. An agent receives one versioned machine-readable result containing manifest, validation, blocker, path, command, log, warning, boundary, and cleanup evidence.
  3. An agent can confirm that remote candidates are assembled, validated, and removed on the Windows target and are never downloaded or retained by the MCP host.
  4. An agent receives explicit failure for malformed, incomplete, uncertain, or invariant-violating remote results, including zero-exit false success, with no local fallback.
  5. An agent can verify equivalent fixture, local, SSH, and PowerShell Remoting semantics on macOS fixtures while the result explicitly disclaims Steam/Workshop actions and real Windows runtime proof.

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 3. Safe Candidate Assembly | 6/6 | Complete    | 2026-07-15 |
| 4. Integrity Manifest and Verified Cleanup | 6/6 | Complete    | 2026-07-15 |
| 5. Unified MCP and Remote Target Parity | 0/TBD | Not started | - |

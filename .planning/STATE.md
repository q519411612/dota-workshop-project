---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Verifiable Release Candidate Export and Handoff
current_phase: null
status: Awaiting next milestone
last_updated: "2026-07-29T11:22:45.864Z"
last_activity: 2026-07-29
last_activity_desc: Milestone v1.15 completed and archived
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
  percent: 100
current_phase_name: null
---

# Project State: Dota Workshop Project

**Updated:** 2026-07-29

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-29)

**Core value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** Planning the next milestone from a fresh requirement slice.

## Archived Roadmap

| Milestone | Phases | Status | Archive |
|---|---|---|---|
| v1.13 Local Install Simulation | 1-2 | Shipped | `.planning/milestones/v1.13-ROADMAP.md` |
| v1.14 Workshop Addon Release Candidate Preflight | 3-5 | Shipped | `.planning/milestones/v1.14-ROADMAP.md` |
| v1.15 Verifiable Release Candidate Export and Handoff | 6-8 | Shipped | `.planning/milestones/v1.15-ROADMAP.md` |

## Current Position

Phase: Milestone v1.15 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-29 — Milestone v1.15 completed and archived

## Performance Metrics

| Metric | Value |
|---|---|
| Milestone phases | 3 |
| Completed phases | 3 |
| Requirements mapped | 24/24 |
| Plans completed | 6/6 |

## Accumulated Context

### Decisions In Effect

| Decision | Source |
|---|---|
| Build a thin vertical slice first | `.planning/PROJECT.md` |
| Package as a Codex plugin | `.planning/PROJECT.md` |
| Support both local Windows and remote Windows behind one MCP contract | `.planning/PROJECT.md` |
| Use SSH or PowerShell Remoting for remote Windows | `.planning/PROJECT.md` |
| Runtime validation launches without `-tools` and enables `-condebug` | Remote v1.1 investigation |
| Release readiness remains dry-run only before real Workshop upload automation | `.planning/MILESTONES.md` |
| Private Windows target details remain runtime-only and sanitized | v1.3 verification evidence |
| v1.4 handoff readiness is local-only and must not install globally or publish packages | `.planning/phases/01-plugin-install-handoff-readiness/01-VERIFICATION.md` |
| v1.5 examples must be schema-valid safe templates and must not store private target or credential material | `.planning/phases/01-operator-runbook-example-workflows/01-VERIFICATION.md` |
| v1.6 RC verification must not upload, log in, encrypt, sign, or run Windows smoke | `.planning/MILESTONES.md` |
| v1.7 handoff reporting aggregates RC evidence, delivery artifacts, documentation, and release boundaries | `.planning/phases/01-release-handoff-bundle-readiness/01-VERIFICATION.md` |
| v1.8 closeout reporting aggregates v1.2-v1.7 history, verification, boundaries, and remaining items | `.planning/MILESTONES.md` |
| Simulated install inputs reject symbolic links and unsafe isolation | `.planning/milestones/v1.13-MILESTONE-AUDIT.md` |
| v1.13 install simulation scans every copied supported text format without leaking matched values | `.planning/milestones/v1.13-MILESTONE-AUDIT.md` |
| v1.14 candidates are temporary, target-local, and include both addon roots without heuristic filtering | `.planning/milestones/v1.14-REQUIREMENTS.md` |
| Cleanup uncertainty forces overall failure while preserving artifact-validation state | `.planning/milestones/v1.14-REQUIREMENTS.md` |
| macOS fixtures close v1.14; real Windows evidence is optional and must not be claimed by contract tests | `.planning/milestones/v1.14-REQUIREMENTS.md` |
| Candidate creation registers an opaque cleanup identity synchronously before later adapter behavior can fail | Phase 4 deep-review remediation |
| Callback results are normalized to inert JSON-like evidence and cannot expose candidate paths or live capabilities | Phase 4 deep-review remediation |
| Sensitive source identities block before candidate creation or manifest projection | Phase 4 deep-review remediation |
| Retained export is an independent operation and never changes temporary preflight cleanup semantics | `.planning/milestones/v1.15-REQUIREMENTS.md` |
| Export root and destination are both explicit target-local inputs | `.planning/milestones/v1.15-REQUIREMENTS.md` |
| Cleanup requires exact path, target kind, identity, topology, ownership, manifest version, and combined digest agreement | `.planning/milestones/v1.15-REQUIREMENTS.md` |

### Research Inputs

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/DOTA2_WORKSHOP_API_V2.md`
- `.planning/research/GAMEPLAY_LOOP_API_NOTES.md`
- `.planning/research/v1.15-RELEASE-CANDIDATE-EXPORT.md`

### Verification Notes

- v1.5 shipped checked operator guidance, schema-valid workflow examples, and plugin verification.
- v1.6 shipped local RC verification with repository hygiene and publishing-boundary checks.
- v1.7 shipped local handoff verification with delivery, documentation, boundary, and sanitized report evidence.
- v1.8 shipped local milestone closeout verification for v1.2-v1.7 history and release-note readiness.
- v1.13 shipped the local install simulation verifier with 150/150 tests, clean independent review, and complete audit coverage.
- Real Windows remote smoke passed in v1.3; it remains optional supporting evidence, not part of the v1.14 completion gate.
- Local graphify freshness files under `.planning/graphs/` remain intentionally uncommitted and outside milestone planning scope.
- v1.14 must not perform Steam login, Workshop mutation or upload, archive creation, signing, encryption, credential handling, game launch, or runtime validation.
- Remote failures must remain explicit; local fallback is prohibited.
- Phase 3 and Phase 4 are verified complete with 13/13 owned requirements, clean independent review, source immutability, and cleanup absence evidence.
- Phase 5 is verified complete with 6/6 owned requirements, four-target contract parity, tracked runtime closure, and a clean independent review.
- v1.15 shipped with 24/24 requirements, 388/388 runnable tests, 17/17 integration links, 8/8 flows, and a clean independent deep review.
- Real Windows v1.15 export, normalization, reparse, atomic promotion, handoff lease, and cleanup evidence remains explicitly unverified and non-blocking.

### Todos

- Start the next milestone with fresh requirements.
- Preserve user-owned `.planning/graphs/` changes outside milestone commits.
- Collect sanitized real Windows v1.15 runtime evidence only if an approved credential-free target becomes available.

### Blockers

- None.

## Session Continuity

**Last completed action:** Audited and archived v1.15 with a clean independent review and passing integration audit.
**Next action:** Start a fresh milestone with `$gsd-new-milestone`.
**Resume context:** v1.14 and v1.15 archives are immutable; user-owned graph changes remain outside milestone commits.

---
*Last updated: 2026-07-29 after v1.15 milestone archival*

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

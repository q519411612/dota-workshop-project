---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Verifiable Release Candidate Export and Handoff
status: planning
current_phase: 6
current_phase_name: Safe Retained Candidate Export
last_updated: "2026-07-29T04:05:00.000Z"
last_activity: 2026-07-29
last_activity_desc: v1.15 requirements and roadmap defined
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Dota Workshop Project

**Updated:** 2026-07-29

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-29)

**Core value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** Specifying and planning safe retained candidate export before implementation.

## Archived Roadmap

| Milestone | Phases | Status | Archive |
|---|---|---|---|
| v1.13 Local Install Simulation | 1-2 | Shipped | `.planning/milestones/v1.13-ROADMAP.md` |
| v1.14 Workshop Addon Release Candidate Preflight | 3-5 | Shipped | `.planning/milestones/v1.14-ROADMAP.md` |

## Current Position

Phase: 6 of 8 (Safe Retained Candidate Export)
Plan: —
Status: Requirements and roadmap complete; specification pending
Last activity: 2026-07-29 — v1.15 requirements and roadmap defined

## Performance Metrics

| Metric | Value |
|---|---|
| Milestone phases | 3 |
| Completed phases | 0 |
| Requirements mapped | 24/24 |
| Plans completed | 0 |

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
| Retained export is an independent operation and never changes temporary preflight cleanup semantics | `.planning/REQUIREMENTS.md` |
| Export root and destination are both explicit target-local inputs | `.planning/REQUIREMENTS.md` |
| Cleanup requires exact path, ownership, manifest version, and combined digest agreement | `.planning/REQUIREMENTS.md` |

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

### Todos

- Complete Phase 6 specification, research grounding, and executable plans before code changes.
- Preserve user-owned `.planning/graphs/` changes outside milestone commits.

### Blockers

- None.

## Session Continuity

**Last completed action:** Defined v1.15 with 24 mapped requirements across Phases 6-8.
**Next action:** Complete Phase 6 specification, research, and planning.
**Resume context:** v1.14 remains archived; v1.15 adds independent retained export and strict cleanup operations.

---
*Last updated: 2026-07-29 after v1.15 roadmap definition*

## Operator Next Steps

- Specify and plan Phase 6 before implementation.

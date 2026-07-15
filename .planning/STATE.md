---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Workshop Addon Release Candidate Preflight
current_phase: 5
current_phase_name: Unified MCP and Remote Target Parity
status: planning
last_updated: "2026-07-15T17:46:14.499Z"
last_activity: 2026-07-15
last_activity_desc: Phase 4 complete, transitioned to Phase 5
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 12
  completed_plans: 12
  percent: 67
---

# Project State: Dota Workshop Project

**Updated:** 2026-07-15

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-15)

**Core value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** Phase 5 unified MCP registration and fixture/local/remote target parity.

## Archived Roadmap

| Milestone | Phases | Status | Archive |
|---|---|---|---|
| v1.13 Local Install Simulation | 1-2 | Shipped | `.planning/milestones/v1.13-ROADMAP.md` |

## Current Position

Phase: 5 of 5 (Unified MCP and Remote Target Parity)
Plan: Not started
Status: Ready for phase planning
Progress: [████████████████████] 12/12 completed plans
Last activity: 2026-07-15 — Phase 4 complete, transitioned to Phase 5

## Performance Metrics

| Metric | Value |
|---|---|
| Milestone phases | 3 |
| Completed phases | 2 |
| Requirements mapped | 19/19 |
| Plans completed | 12 |

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
| v1.14 candidates are temporary, target-local, and include both addon roots without heuristic filtering | `.planning/REQUIREMENTS.md` |
| Cleanup uncertainty forces overall failure while preserving artifact-validation state | `.planning/REQUIREMENTS.md` |
| macOS fixtures close v1.14; real Windows evidence is optional and must not be claimed by contract tests | `.planning/REQUIREMENTS.md` |
| Candidate creation registers an opaque cleanup identity synchronously before later adapter behavior can fail | Phase 4 deep-review remediation |
| Callback results are normalized to inert JSON-like evidence and cannot expose candidate paths or live capabilities | Phase 4 deep-review remediation |
| Sensitive source identities block before candidate creation or manifest projection | Phase 4 deep-review remediation |

### Research Inputs

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/DOTA2_WORKSHOP_API_V2.md`
- `.planning/research/GAMEPLAY_LOOP_API_NOTES.md`

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

### Todos

- Discuss and plan Phase 5 from the six remaining MCP and target-parity requirements.
- Preserve exact one-phase traceability while wiring fixture, local Windows, SSH Windows, and PowerShell Remoting to one result contract.

### Blockers

- None.

## Session Continuity

**Last completed action:** Closed Phase 4 after clean independent review and 5/5 verification.
**Next action:** Run `$gsd-discuss-phase 5 --auto`.
**Resume context:** Phase 5 owns the dedicated MCP schema/server route, fixture/local/SSH/PowerShell normalization, strict remote JSON evidence, and no-fallback parity.

---
*Last updated: 2026-07-15 after Phase 4 transition*

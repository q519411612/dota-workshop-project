---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Workshop Addon Release Candidate Preflight
status: planning
last_updated: "2026-07-15T02:38:06.740Z"
last_activity: 2026-07-15
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Dota Workshop Project

**Updated:** 2026-07-13

## Project Reference

See: `.planning/PROJECT.md`

**Core value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.
**Current focus:** Planning the next milestone after the v1.13 archive.

## Archived Roadmap

| Milestone | Phases | Status | Archive |
|---|---|---|---|
| v1.13 Local Install Simulation | 1-2 | Shipped | `.planning/milestones/v1.13-ROADMAP.md` |

## Decisions In Effect

| Decision | Source |
|----------|--------|
| Build a thin vertical slice first | `.planning/PROJECT.md` |
| Package as a Codex plugin | `.planning/PROJECT.md` |
| Support both local Windows and remote Windows | `.planning/PROJECT.md` |
| Use SSH or PowerShell Remoting for remote Windows | `.planning/PROJECT.md` |
| Keep one unified MCP tool interface | `.planning/PROJECT.md` |
| Start with a minimal runnable addon template | `.planning/PROJECT.md` |
| Runtime validation launches without `-tools` and enables `-condebug` | Remote v1.1 investigation |
| v1.2 release readiness must stay dry-run only before real Workshop upload automation | `.planning/MILESTONES.md` |
| v1.3 Windows validation details must stay runtime-only and sanitized from repository artifacts | `.planning/phases/01-windows-validation-closure/01-VERIFICATION.md` |
| v1.4 handoff readiness is local-only and must not install globally or publish packages | `.planning/phases/01-plugin-install-handoff-readiness/01-VERIFICATION.md` |
| v1.5 examples must be schema-valid safe templates and must not store private target or credential material | `.planning/phases/01-operator-runbook-example-workflows/01-VERIFICATION.md` |
| v1.6 RC gate must be local-only and must not perform upload, login, encryption, signing, Windows smoke, or remote smoke | `.planning/MILESTONES.md` |
| v1.7 handoff report must be local-only and must aggregate RC evidence, delivery checklist, docs coverage, and explicit release boundaries | `.planning/phases/01-release-handoff-bundle-readiness/01-VERIFICATION.md` |
| v1.8 milestone report must be local-only and must aggregate v1.2-v1.7 commits, delivery summaries, verification status, review docs, release boundaries, and remaining non-blocking items | `.planning/MILESTONES.md` |
| v1.13 install simulation must scan every copied text format covered by the plugin layout without leaking matched values | `.planning/milestones/v1.13-MILESTONE-AUDIT.md` |

## Research Inputs

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/DOTA2_WORKSHOP_API_V2.md`
- `.planning/research/GAMEPLAY_LOOP_API_NOTES.md`

## Verification Notes

- v1.5 shipped `docs/operator-runbook.md`, schema-valid workflow examples, and `verify:plugin`.
- v1.6 shipped `npm run verify:rc`, a structured RC verifier, command aggregation, repository hygiene scanning, publishing boundary checks, docs, and tests.
- v1.7 shipped `npm run verify:handoff`, a structured handoff verifier, delivery checklist reporting, documentation coverage checks, explicit release boundaries, and report path sanitization.
- v1.8 shipped `npm run verify:milestone`, a structured milestone closeout verifier, v1.2-v1.7 inventory, handoff preflight reuse, docs/handoff output checks, release boundary reporting, and remaining non-blocking item reporting.
- v1.13 shipped the local install simulation verifier and its audit-gap closure through the current `origin/main` baseline.
- The refreshed v1.13 milestone audit passes with 6/6 requirements, 2/2 phases, 6/6 integration connections, and 6/6 end-to-end flows.
- Local graphify freshness files under `.planning/graphs/` remain intentionally uncommitted and outside this closure scope.
- Real Windows remote smoke passed in v1.3; it remains optional supporting evidence, not part of this local milestone gate.

## Next Action

Run `$gsd-new-milestone` to define the next focused version and fresh requirements.

---
*Last updated: 2026-07-13 after the v1.13 milestone archive*

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-07-15 — Milestone v1.14 started

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

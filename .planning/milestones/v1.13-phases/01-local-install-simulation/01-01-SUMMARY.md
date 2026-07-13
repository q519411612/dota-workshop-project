---
phase: 01-local-install-simulation
plan: 01
subsystem: testing
tags: [install-simulation, plugin-layout, sensitive-scanning]
requires: []
provides:
  - Isolated local plugin install simulation
  - Consumer contract validation and cleanup evidence
  - Redacted sensitive-material scanning across copied text metadata
affects: [release-readiness, operator-handoff]
tech-stack:
  added: []
  patterns: [temporary-layout verification, category-only sensitive blockers]
key-files:
  created: [src/install-simulation.ts, src/verify-install-simulation.ts, tests/install-simulation.test.ts]
  modified: [package.json, README.md, docs/operator-runbook.md]
key-decisions:
  - "Simulate installation in a temporary root without global writes."
  - "Treat copied YAML/YML metadata as sensitive-scanning inputs."
patterns-established:
  - "Install-facing files are verified from the copied consumer layout."
requirements-completed: [INSTALL-01, INSTALL-02, INSTALL-03, INSTALL-04, INSTALL-05, INSTALL-06]
duration: 1 day
completed: 2026-07-13
status: complete
---

# Summary: Local Install Simulation

## Delivered

- Added `npm run verify:install-simulation`.
- Added a local install simulation module and CLI.
- Built a temporary simulation layout for plugin manifest, MCP config, package metadata, built dist entrypoint, and skill file.
- Added consumer contract checks for manifest paths, MCP entrypoint, package bin, dist entrypoint, and skill presence.
- Added cleanup evidence and selected environment non-mutation checks.
- Added sensitive-material scanning with category-only blocker output.
- Documented the simulation gate in README and the operator runbook.

## Verified

- Targeted install simulation tests passed.
- Full local test suite passed.
- Build, typecheck, install simulation, RC, handoff, and milestone gates passed.

## Boundary

- No global install, user config write, package publish, registry publish, archive creation, package signing, content encryption, Workshop upload, Steam login, Steam Guard handling, remote Windows connection, Dota runtime work, network access, or UI automation was added.
- Remaining real Windows evidence blockers are unchanged and must be closed only with real sanitized runtime logs.

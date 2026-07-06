# Phase 7 Review: Repeatable Playable Smoke Workflow

**Date:** 2026-07-04
**Scope:** `run_playable_smoke` orchestration, MCP exposure, fixture/remote tests, docs, and real Windows smoke evidence.

## Findings

### F1: Successful transcripts included every missing-marker retry

Initial real smoke passed, but the successful result evidence included many intermediate `missing marker` lines from validation polling. That made the transcript noisy and weakened the concise transcript requirement.

Resolution:

- Compacted successful and failed transcripts to keep create, inspect, launch, and final validation results.
- Kept retry count as evidence.
- Added a delayed-success test that proves retry command/log evidence is compacted while final marker evidence remains.

### F2: Repeat remote smoke can fail when a prior Dota process is still running

A repeat remote smoke failed with `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND` because Steam did not create a new Dota process whose command line matched the new addon while a previous smoke process was still active.

Resolution:

- Documented the failure mode in troubleshooting.
- Stopped only the known prior smoke process by matching its smoke addon command line during verification.
- Left automatic cleanup out of the workflow because broad process cleanup requires explicit user-controlled design.

## Review Result

No unresolved implementation findings remain.

## Residual Risk

- Repeated remote smoke runs may need explicit user-controlled process cleanup if Dota is already running from a prior smoke.
- Generated smoke addon files remain on the target by design.

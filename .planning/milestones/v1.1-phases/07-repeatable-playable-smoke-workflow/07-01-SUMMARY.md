# Phase 7 Summary: Repeatable Playable Smoke Workflow

**Status:** Complete
**Date:** 2026-07-04

## What Changed

- Added `run_playable_smoke` as a repeatable MCP workflow for playable addon smoke validation.
- Added `src/smoke.ts` to compose existing addon generation, inspection, runtime launch, and marker validation paths.
- Added default playable smoke marker construction and safe unique addon name generation.
- Added bounded validation polling so Dota runtime marker checks can wait for console log evidence after launch.
- Added compact smoke transcripts that keep create/inspect/launch/final-validation evidence and summarize retry count.
- Exposed the workflow through MCP schemas, dispatcher, and server registration.
- Added fixture and remote orchestration tests in `tests/smoke.test.ts`.
- Updated README and Dota skill references for repeatable local/remote smoke usage and troubleshooting.

## Verification Notes

- Fixture tests cover explicit addon names, generated smoke names, default gameplay markers, runtime launch command shape, missing-marker failure, delayed remote validation success, and MCP dispatcher exposure.
- Real Windows smoke passed with remote `interactiveTask`, game runtime mode, console logging, marker polling, and compact transcript output.
- A repeat run while a previous Dota smoke process was still active produced `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND`; the previous smoke process was stopped by matching its smoke addon command line, then the current build smoke passed.
- Generated target addon files were left on the Windows target for inspection; they are not part of this repository.

## Follow-Up Candidates

- Add explicit user-controlled smoke process cleanup options.
- Add custom map spawn-point validation.
- Add richer gameplay objective generation.

# Verification: Same-Machine Windows Local Smoke Evidence

status: passed
date: 2026-07-07

## Automated Checks

- `npm test -- tests/same-machine-smoke.test.ts` passed: 1 file, 4 tests.
- `npm run build` passed.
- `npm run verify:same-machine-smoke` passed with `status: harness_ready` and `runtimeEvidence: pending`.
- `git diff --check` passed.
- `npm run typecheck` passed.
- `npm test` passed: 16 files, 129 tests.
- `npm run verify:rc` passed.
- `npm run verify:handoff` passed.
- `npm run verify:milestone` passed.

## Evidence

- The first targeted test run failed because `src/same-machine-smoke.ts` did not exist, confirming the test was written before implementation.
- The verifier accepts harness-ready evidence without claiming runtime success.
- The verifier blocks `runtime_passed` artifacts that lack marker log evidence.
- The verifier accepts `runtime_passed` only when sanitized marker log lines include `[DOTA_WORKSHOP_MCP]` runtime evidence.
- The verifier rejects credential-like material and reports only field path plus category.

## Runtime Status

Real same-machine Windows runtime evidence was not collected in this macOS session. The local harness is ready, and runtime evidence remains pending until an actual Windows run provides sanitized marker logs.

## Boundaries

- No Workshop upload was attempted.
- No Steam login or Steam Guard handling was attempted.
- No content encryption or package signing was attempted.
- No remote Windows connection was attempted.
- No private Windows path, username, hostname, account, token, password, private key, or credential value was stored.

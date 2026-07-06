# Summary: Same-Machine Windows Local Smoke Evidence

status: complete
date: 2026-07-07

## Delivered

- Added `verify:same-machine-smoke` as a local built-output verifier command.
- Added a same-machine smoke evidence schema and verifier.
- Added status separation for `harness_ready`, `runtime_pending`, and `runtime_passed`.
- Added marker evidence gating so real runtime success requires sanitized `[DOTA_WORKSHOP_MCP]` log evidence.
- Added sanitizer coverage for credential-like values, private paths, private host/user/account fields, tokens, and keys.
- Added a same-machine Windows runbook for safe evidence collection.

## Verification

All targeted and repository gates passed locally. The first targeted test run failed before implementation because the verifier module did not exist, then passed after implementation.

## Remaining

Real same-machine Windows runtime evidence remains pending until a Windows machine with Dota 2 Workshop Tools is available and produces sanitized marker log evidence.

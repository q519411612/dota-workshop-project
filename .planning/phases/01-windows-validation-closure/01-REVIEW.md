# Independent Review: Windows Validation Closure

**Date:** 2026-07-06
**Reviewer stance:** independent evidence and hygiene review
**Result:** PASS

## Review Findings

No blocking issues found.

## Credential Hygiene

- Repository artifacts refer only to a user-provided Windows host.
- Artifacts do not include the Windows host address, username, password, Dota root path, tokens, private keys, Steam credentials, or private machine identifiers.
- Runtime connection data was supplied through temporary shell input and environment variables only.
- The validation artifact records path categories rather than private absolute paths.

## Evidence Claims

- Runtime success is supported by `run_playable_smoke` returning PASS after log marker validation.
- Launch success is not used as the only success criterion.
- The release dry-run failure is correctly classified as an expected publishing-readiness blocker for a generated smoke addon.
- Cleanup evidence includes dry-run matching before execute cleanup and final dry-run confirmation.

## Boundary Review

- No real Workshop upload was attempted.
- No Steam login, Steam Guard, encryption, or publish-state mutation was attempted.
- Cleanup did not target broad Dota or Steam process sets.
- The remaining same-machine distinction is stated explicitly: this validation used the remote SSH path to a real Windows host, not a Windows-local MCP server process.

## Local Code Review

The code change in `src/remote.ts` suppresses PowerShell progress output for remote log read scripts. This addresses the observed CLIXML progress pollution at the source, before JSON output is parsed.

The test change in `tests/remote-operations.test.ts` verifies the suppression intent without depending on shell-specific single-quote escaping.

Residual risk is low and limited to other PowerShell streams that might emit non-JSON data in future remote scripts.

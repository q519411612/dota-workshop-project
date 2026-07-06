# Verification: Windows Validation Closure

**Date:** 2026-07-06
**Status:** PASS
**Target label:** user-provided Windows host

## Scope Verified

- Runtime-only SSH access was used for this validation run.
- No Windows password, private host, private username, Steam credential, token, or private key was written to repository files.
- The Windows Dota install was verified through sanitized category checks:
  - Dota executable exists.
  - Resource compiler exists.
  - VConsole exists.
  - Game addon root exists.
  - Content addon root exists.
  - Steam app manifest exists.
- The playable smoke workflow created, inspected, launched, and validated addon `validation_closure_20260706_103317` on the Windows target.
- Runtime validation passed through expected Dota console markers, not launch success alone.
- Dry-run release reporting ran and returned publishing blockers without Steam login, encryption, upload, or publish-state mutation.
- Addon-scoped cleanup ran after dry-run matching and stopped only the matching Dota smoke process for the validation addon.
- A final dry-run cleanup confirmed no matching Dota smoke process remained.

## Runtime Evidence

The successful smoke run reported:

- `run_playable_smoke`: PASS
- `create_addon`: PASS
- `inspect_addon`: PASS
- `launch_custom_game`: PASS
- runtime log validation: PASS
- command evidence count: 4
- log source count: 7

The smoke warnings were expected:

- Generated smoke addon files were left on the target for inspection.
- Interactive launch completion still required log evidence.

## Release Dry Run Evidence

The dry-run release report returned `RELEASE_PREFLIGHT_BLOCKED`, which is expected for the generated smoke addon because publishing readiness is not the goal of this validation slice.

Package evidence categories included:

- Game addon root exists.
- Content addon root exists.
- Addon metadata exists.
- Lua entry exists.
- Localization file exists.
- Content maps directory exists.
- Hero list exists.
- Hero data exists.

Boundary warnings confirmed:

- Steam login is manual and out of scope.
- Content encryption is manual and out of scope.
- Workshop upload is not performed by dry run.
- Dry run does not prove runtime validation.

## Cleanup Evidence

Cleanup sequence:

1. Pre-smoke dry-run cleanup found no matching Dota smoke process for the validation addon.
2. Post-smoke dry-run cleanup found one matching Dota smoke process for the validation addon.
3. Execute cleanup stopped that matching Dota smoke process.
4. Confirmation dry-run cleanup found no matching Dota smoke process.

Cleanup boundaries:

- Cleanup targeted only Dota processes whose command line contained the requested addon name.
- Cleanup did not stop Steam processes.
- Cleanup did not delete generated smoke addon files.

## Local Automated Verification

- `npx vitest run tests/remote-operations.test.ts`: PASS, 25 tests.
- `git diff --check`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 100 tests.
- `npm run build`: PASS.
- Strict high-signal secret scan for the provided host address, username, password, private Dota root fragment, private key headers, and common GitHub token prefixes: PASS, no matches.

## Residual Risk

- This closes the real Windows runtime validation gap through the remote SSH path on a user-provided Windows host.
- It does not prove a separate same-machine run where the MCP server itself executes locally on Windows.
- It does not perform Workshop upload, Steam login, Steam Guard, content encryption, signed package output, or publish-state mutation.
- The generated smoke addon files intentionally remain on the Windows target for inspection.

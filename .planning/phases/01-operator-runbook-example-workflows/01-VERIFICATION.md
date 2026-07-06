# Verification: Operator Runbook and Example Workflows

**Date:** 2026-07-06
**Status:** PASS

## Scope Verified

- Added `docs/operator-runbook.md`.
- Added schema-valid example workflow files under `examples/workflows/`.
- Added tests that parse examples, validate operation names against `toolNames`, validate example inputs against existing schemas, scan examples/runbook for forbidden private or credential-like material, and verify README links.
- Added README links to the runbook and examples.
- No runtime MCP behavior, real Windows smoke, global install, upload, encryption, package signing, or publish-state mutation was added.

## TDD Evidence

Red:

- `npx vitest run tests/examples.test.ts` failed because `docs/operator-runbook.md`, example workflow files, and README links did not exist.

Green:

- `npx vitest run tests/examples.test.ts`: PASS, 4 tests.

## Example Evidence

Examples added:

- `examples/workflows/fixture-create-addon.json`
- `examples/workflows/fixture-preflight.json`
- `examples/workflows/fixture-release-dry-run.json`
- `examples/workflows/remote-playable-smoke.template.json`

The remote example is a placeholder template and does not contain private target details.

## Residual Risk

- v1.5 does not execute real Windows smoke.
- v1.5 does not prove global plugin installation.
- v1.5 does not prove Workshop publication.
- Examples are operator templates; runtime targets still must be supplied outside repository files.

## Final Verification

- `git diff --check`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 110 tests.
- `npm run build`: PASS.
- `npm run verify:plugin`: PASS.
- Strict high-signal secret scan for the provided host address, username, password, private Dota root fragment, private key headers, and common GitHub token prefixes: PASS, no matches.

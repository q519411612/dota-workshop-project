# Summary: Operator Runbook and Example Workflows

**Date:** 2026-07-06
**Status:** Complete

## What Changed

- Added a checked operator runbook.
- Added fixture and remote-template workflow examples.
- Added tests that schema-validate examples and scan runbook/examples for forbidden private or credential-like material.
- Added README links to runbook and examples.

## Outcome

Operators now have a documented safe path for:

- Local build and plugin readiness verification.
- Fixture addon generation and inspection.
- Optional runtime-provided remote smoke.
- Explicit addon-scoped cleanup.
- Workshop preflight and dry-run release review.

## Verification

- Targeted examples test passed.
- `git diff --check`, typecheck, full test suite with 110 tests, build, `verify:plugin`, and strict high-signal secret scan passed.

# Phase 1: Operator Runbook and Examples — Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Operators can follow `docs/operator-runbook.md` and reuse schema-valid examples in `examples/workflows/` without storing credentials, relying on launch-only evidence, or performing real Workshop upload behavior.

## Background

The project now has validated MCP operations, a plugin readiness verifier, and README sections for individual tools. What is missing is an operator-level path that stitches the safe pieces together and machine-checkable examples that future agents can reuse without inventing JSON payloads or accidentally committing private target details.

## Requirements

1. **Runbook**: Add a safe operator runbook.
   - Current: README documents tools individually but does not provide one ordered operator path.
   - Target: `docs/operator-runbook.md` explains build, plugin verification, fixture flow, optional remote smoke, cleanup, preflight, dry-run release review, and safety boundaries.
   - Acceptance: Test confirms the runbook exists and contains required commands and boundary statements.

2. **Workflow examples**: Add reusable example workflow payloads.
   - Current: README contains inline snippets but no checked example directory.
   - Target: `examples/workflows/` contains fixture create, fixture preflight, fixture release dry-run, and remote playable smoke template examples.
   - Acceptance: Test discovers the expected example files.

3. **Schema validation**: Validate example inputs against source schemas.
   - Current: Inline snippets are not automatically validated.
   - Target: Each example has `operation` and `input`, operation exists in `toolNames`, and input passes the matching schema.
   - Acceptance: Test validates every JSON example with the schema map.

4. **Safety scan**: Prevent private or credential-like material in examples and runbook.
   - Current: No dedicated runbook/example scan exists.
   - Target: Tests scan `docs/operator-runbook.md` and every example for known private target fragments, IP address, password/token/private key patterns, and Steam credential strings.
   - Acceptance: Test fails on forbidden patterns and passes on placeholder-only examples.

5. **Discoverability**: Link runbook and examples from README.
   - Current: README does not mention `docs/operator-runbook.md` or `examples/workflows/`.
   - Target: README has a section linking both and stating examples are safe templates, not upload automation.
   - Acceptance: Test confirms README links and boundary text.

6. **No behavior expansion**: Keep the phase documentation/example-only.
   - Current: Existing MCP operations are sufficient for examples.
   - Target: No new MCP operation, upload behavior, encryption, package signing, global install, or remote execution is added.
   - Acceptance: Review confirms changes are docs/examples/tests only.

## Boundaries

**In scope:**

- `docs/operator-runbook.md`.
- `examples/workflows/*.json`.
- `tests/examples.test.ts`.
- README discoverability links.
- GSD verification, review, and summary artifacts.

**Out of scope:**

- Real Windows smoke execution — optional for operators, not part of this slice.
- Real Workshop upload, Steam login, Steam Guard, encryption, publish-state mutation, package signing, or archive creation.
- Storing private host/user/password/token/key/Steam credential material.
- New gameplay, UI, TypeScript-to-Lua, React Panorama, Excel-to-KV, or ability runtime features.
- Global plugin installation or registry publishing.

## Constraints

- Examples must use placeholder values for remote targets.
- Fixture examples must be runnable without Dota 2 or Windows.
- Runtime validation success must be described as marker/log evidence, not process launch alone.
- No silent fallback in tests: missing docs, malformed examples, unknown operations, schema failures, and forbidden patterns are test failures.

## Acceptance Criteria

- [ ] `docs/operator-runbook.md` exists and includes the required workflow order.
- [ ] `examples/workflows/fixture-create-addon.json`, `fixture-preflight.json`, `fixture-release-dry-run.json`, and `remote-playable-smoke.template.json` exist.
- [ ] Every example operation exists in `toolNames`.
- [ ] Every example input validates against the matching schema.
- [ ] Tests scan runbook and examples for forbidden private/credential material.
- [ ] README links to the runbook and examples and states they are safe templates, not upload automation.

## Edge Coverage

**Coverage:** 4/4 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| malformed input | R3 | covered | Tests parse every example JSON and validate schemas. |
| unknown operation | R3 | covered | Tests compare operation names against `toolNames`. |
| secret leakage | R4 | covered | Tests scan docs/examples for private and credential-like patterns. |
| missing artifact | R1-R2-R5 | covered | Tests assert required docs/examples/README links exist. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not store credentials, tokens, private keys, private hosts, passwords, or private target fragments. | R4 | resolved | verification: test |
| Must not perform real Workshop upload, Steam login, Steam Guard, encryption, or publish-state mutation. | R6 | resolved | verification: judgment |
| Must not add new MCP operations or runtime behavior in this slice. | R6 | resolved | verification: judgment |
| Must not treat process launch as validation success. | R1 | resolved | verification: judgment |
| Must not silently accept missing docs, malformed examples, unknown operations, schema failures, or forbidden patterns. | R1-R4 | resolved | verification: test |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.90 | 0.75 | met | Docs/examples/tests are concrete. |
| Boundary Clarity | 0.95 | 0.70 | met | Explicitly docs/examples/tests only. |
| Constraint Clarity | 0.88 | 0.65 | met | No credentials, upload, install, runtime expansion. |
| Acceptance Criteria | 0.86 | 0.70 | met | Required files and schema/safety checks are exact. |
| Ambiguity | 0.11 | <=0.20 | met | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What is missing after v1.4? | Operator-level docs and checked examples are missing. |
| 2 | Simplifier | What is the smallest useful slice? | Docs, JSON examples, and tests only. |
| 3 | Boundary Keeper | What stays out? | Runtime behavior, upload, credentials, install, publishing. |
| 4 | Failure Analyst | What broken output matters? | Invalid JSON, schema drift, unknown operations, private data, launch-only validation wording. |

---

*Phase: 01-operator-runbook-example-workflows*
*Spec created: 2026-07-06*
*Next step: implement 01-01 plan*

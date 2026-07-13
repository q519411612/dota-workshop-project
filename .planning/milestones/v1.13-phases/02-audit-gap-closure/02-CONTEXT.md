# Phase 2: Audit Gap Closure — Context

## Phase Boundary

Close only the blockers and traceability gaps recorded in `.planning/v1.13-MILESTONE-AUDIT.md`. Preserve the existing install simulation contract and safety boundaries.

## Decisions

- **D-01:** Recognize `.yaml` and `.yml` through case-insensitive extension normalization in the existing explicit text allowlist.
- **D-02:** Regression tests must exercise the real copied path `skills/dota2-workshop-tools/agents/openai.yaml`, assert a redacted blocker, and prove the synthetic value is absent from serialized output.
- **D-03:** Missing required entries must produce one blocker per code/path pair; cleanup must still run after blockers.
- **D-04:** REQUIREMENTS, VERIFICATION, and SUMMARY artifacts must explicitly map INSTALL-01 through INSTALL-06 for the milestone audit three-source check.
- **D-05:** STATE and ROADMAP must identify v1.13 Phase 2 without rewriting historical milestone sections.
- **D-06:** Existing `.planning/graphs/` modifications are user-owned and must remain untouched.

## the agent's Discretion

- Whether extension normalization uses `extname()` or the existing suffix extraction, provided behavior is deterministic and case-insensitive.
- Whether blocker deduplication is implemented at insertion time or through a local uniqueness helper, provided result ordering stays stable.
- Exact formatting of traceability and evidence tables, provided requirement IDs and evidence are machine-searchable.

## Canonical References

- `.planning/v1.13-MILESTONE-AUDIT.md`
- `.planning/phases/02-audit-gap-closure/02-SPEC.md`
- `src/install-simulation.ts`
- `tests/install-simulation.test.ts`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/01-local-install-simulation/01-VERIFICATION.md`
- `.planning/phases/01-local-install-simulation/01-01-SUMMARY.md`

## Specific Ideas

- Use a test fixture that writes both YAML variants and includes one uppercase extension case.
- Keep sensitive scanning fail-closed for recognized text formats and keep results value-free.
- Verify requirement metadata with the existing GSD `summary-extract` command.

## Deferred Ideas

- Detecting text content by byte heuristics instead of an extension allowlist.
- Adding archive, signing, publishing, global install, or Windows runtime behavior.
- Redesigning the older `verify:milestone` command beyond documenting that it remains scoped to v1.8.

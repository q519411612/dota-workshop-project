# Phase 2: Audit Gap Closure — Specification

**Created:** 2026-07-13
**Ambiguity score:** 0.05 (gate: ≤ 0.20)
**Requirements:** 4 locked

## Goal

The v1.13 install simulation rejects sensitive material in every copied YAML/YML text input, preserves deterministic cleanup and blocker evidence, and has complete requirement traceability for milestone re-audit.

## Background

The install simulation copies the complete Dota Workshop skill directory, including `agents/openai.yaml`. Its text allowlist currently excludes `.yaml` and `.yml`, so a credential marker in copied YAML returns `ok: true`. Existing tests cover Markdown only. The v1.13 audit also found no requirement traceability table, no per-requirement verification entries, missing summary frontmatter, and stale v1.8 project state.

## Requirements

1. **Copied YAML sensitive scanning**: Every copied `.yaml` and `.yml` file is scanned with case-insensitive extension matching.
   - Current: YAML and YML files are copied but skipped by the text allowlist.
   - Target: Credential-like content in YAML or YML produces `SIM_SENSITIVE_MATERIAL_FOUND` with category and relative path only.
   - Acceptance: Tests using the real `skills/dota2-workshop-tools/agents/openai.yaml` path fail the simulation without exposing the synthetic matched value.

2. **Deterministic blocker and cleanup evidence**: Blocker paths remain structured, non-duplicated, and self-cleaning.
   - Current: Missing `dist/index.js` can emit `SIM_DIST_INDEX_MISSING` twice.
   - Target: Each missing required entry produces one blocker code while cleanup succeeds on both sensitive-input and missing-file failures.
   - Acceptance: Tests assert one missing-dist blocker and `cleanup.removed: true` for every modeled failure path.

3. **Requirement traceability**: INSTALL-01 through INSTALL-06 are explicitly mapped across requirements, verification, and summary artifacts.
   - Current: The milestone audit treats all six requirements as orphaned from phase verification.
   - Target: Requirements have a traceability table, verification has per-requirement status and evidence, and summary frontmatter declares completed requirement IDs.
   - Acceptance: A text check finds every INSTALL ID in the traceability table and verification table, and summary extraction returns all six IDs.

4. **Current milestone state**: Project state and roadmap consistently identify v1.13 and the audit closure work.
   - Current: `STATE.md` identifies v1.8 while `ROADMAP.md` identifies v1.13.
   - Target: State reports v1.13, Phase 2, and the closure objective without changing archived milestone content.
   - Acceptance: GSD milestone initialization resolves v1.13 and Phase 2 after the planning artifacts are written.

## Boundaries

**In scope:**

- YAML/YML extension recognition and redacted sensitive-material blockers.
- Regression tests using copied skill metadata paths.
- Local duplicate blocker removal for missing required entries.
- Requirement traceability, verification, summary, roadmap, and state updates.
- Fresh local build, tests, release gates, review, and milestone audit.

**Out of scope:**

- Scanning arbitrary binary or unknown file formats — the verifier keeps an explicit text allowlist.
- New install or publishing behavior — this phase only closes audited gaps.
- Global installation, user config mutation, Windows access, network access, or UI automation — existing safety boundaries remain unchanged.
- Graphify freshness file updates — existing user-owned changes remain untouched.

## Constraints

- Code identifiers and user-facing API names remain English.
- Sensitive values must never appear in blockers, evidence, logs, or test failure output.
- The fix must be test-first and limited to the diagnosed root cause and local duplicate evidence.
- Existing structured result fields and command behavior remain compatible.

## Acceptance Criteria

- [ ] Lowercase and uppercase YAML/YML copied inputs are scanned.
- [ ] A synthetic credential in the real copied YAML metadata path returns `ok: false` and one redacted sensitive blocker.
- [ ] The synthetic matched value is absent from serialized results.
- [ ] Sensitive and missing-file failure paths remove the simulation root.
- [ ] Missing `dist/index.js` emits `SIM_DIST_INDEX_MISSING` exactly once.
- [ ] INSTALL-01 through INSTALL-06 appear in requirements traceability and verification evidence.
- [ ] Summary metadata declares INSTALL-01 through INSTALL-06 complete.
- [ ] GSD initialization resolves milestone v1.13 and current Phase 2.
- [ ] Targeted tests, full tests, typecheck, build, release gates, review, and milestone audit pass.

## Edge Coverage

**Coverage:** 5/5 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| representation | R1 | covered | Test both `.yaml` and `.yml` with case-insensitive extension matching. |
| confidentiality | R1 | covered | Assert serialized results omit the synthetic matched value. |
| failure cleanup | R2 | covered | Assert cleanup removal on sensitive and missing-file blockers. |
| duplicate evidence | R2 | covered | Assert the missing-dist blocker count is exactly one. |
| state consistency | R4 | covered | Query GSD initialization after state and roadmap updates. |

## Prohibitions (must-NOT)

**Coverage:** 4/4 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT include matched sensitive values in results or logs. | R1 | resolved | test: `tests/install-simulation.test.ts` |
| MUST NOT silently classify YAML/YML as non-text copied inputs. | R1 | resolved | test: `tests/install-simulation.test.ts` |
| MUST NOT add global install, user config, network, Windows, or publishing behavior. | R2 | resolved | judgment review of the scoped diff |
| MUST NOT modify `.planning/graphs/` files. | R4 | resolved | judgment review of worktree status |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.98 | 0.75 | ✓ | Audit gives a reproducible failure and closure target. |
| Boundary Clarity | 0.95 | 0.70 | ✓ | New features and external operations are explicitly excluded. |
| Constraint Clarity | 0.90 | 0.65 | ✓ | Redaction, compatibility, TDD, and scope constraints are explicit. |
| Acceptance Criteria | 0.95 | 0.70 | ✓ | Each functional and traceability outcome has a pass/fail check. |
| **Ambiguity** | **0.05** | **≤0.20** | ✓ | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exact failure was reproduced? | Copied YAML containing a synthetic credential returns `ok: true`. |
| 2 | Simplifier | What is the irreducible closure scope? | YAML/YML scanning, regression tests, traceability, and state sync. |
| 3 | Boundary Keeper | What adjacent work stays excluded? | New install features, external operations, unknown binary scanning, and graph refresh. |
| 4 | Failure Analyst | Which silent failures invalidate closure? | Value leakage, skipped YAML variants, duplicate blockers, failed cleanup, and stale milestone routing. |

---

*Phase: 02-audit-gap-closure*
*Spec created: 2026-07-13*
*Next step: `$gsd-plan-phase 2 --skip-research`*

# Phase 6 Spec: Safe Retained Candidate Export

**Goal:** Retain a v1.14-equivalent validated addon candidate at an explicit target-local destination through a fail-closed staging and atomic-promotion lifecycle.

## Ambiguity Report

| Dimension | Score |
|---|---:|
| Goal clarity | 0.98 |
| Boundary clarity | 0.97 |
| Constraint clarity | 0.95 |
| Acceptance clarity | 0.96 |

**Weighted ambiguity:** 0.04 — ready for planning.

## Locked Requirements

- `export_release_candidate` is additive and independent. `preflight_release_candidate` keeps its exact input, temporary candidate, mandatory cleanup, result, and boundary semantics.
- Input requires `target`, `addonName`, `exportRoot`, and `destination`; all paths are target-local.
- `destination` is an absent direct child of canonical `exportRoot`; the derived sibling handoff path is also absent.
- Export root, ancestors, staging, destination, and final candidate reject path escape, links, junctions, reparse points, case-fold conflicts, unknown types, and protected roots.
- Candidate assembly and validation reuse the complete v1.14 policy with no include/exclude heuristics.
- Staging is created under the export root. Promotion is one rename or directory move to the absent destination.
- A post-promotion inspection recomputes identity, complete manifest, and combined digest before success.
- Failure cleanup owns staging and temporary handoff state only. A promoted destination is never treated as generic temporary cleanup state.
- The external handoff manifest is version `1.0` and binds candidate, manifest, source, target, boundary, promotion, and ownership facts.

## Acceptance Criteria

1. A valid fixture source exports to an absent destination with exact file coverage, combined digest, ownership evidence, and external handoff manifest.
2. Existing or dangerous paths fail before promotion and are not modified.
3. Source or candidate mutation, digest disagreement, or promotion failure yields explicit blockers and truthful cleanup evidence.
4. A successful destination remains after the operation and is byte-identical to the validated staging candidate.
5. Existing preflight regression tests and exact boundary assertions remain green without expectation changes.

## Exclusions

No remote adapter, public MCP registration, exported-candidate deletion, archive, upload, credentials, source repair, or real Windows proof is owned by this phase.


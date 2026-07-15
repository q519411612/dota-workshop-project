---
phase: 03-safe-candidate-assembly
verified: 2026-07-15T10:04:30Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 3: Safe Candidate Assembly Verification Report

**Phase Goal:** Users can safely assemble the complete `game` and `content` addon trees into an isolated temporary candidate while source data remains unchanged.
**Verified:** 2026-07-15T10:04:30Z
**Status:** passed
**Re-verification:** Yes — after independent review fixes through `65a1f48`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Input and missing-root blockers are returned before candidate creation. | ✓ VERIFIED | `prepareReleaseCandidateInput` validates the addon, Dota root, repository root, temp parent, and both derived addon roots before `withAssembledReleaseCandidate` can inventory or acquire a lease. The parameterized zero-creation test covers invalid, missing, non-directory, unreadable, and canonical-escape cases. |
| 2 | The callback sees an exact fixed two-root candidate containing every regular file and empty directory. | ✓ VERIFIED | Inventory includes files and directories without extension, hidden-file, generated-file, timestamp, or ignore heuristics. Assembly creates the fixed `game/dota_addons/<addon>` and `content/dota_addons/<addon>` prefixes, materializes every sorted inventory entry, and reconciles the exact resulting tree before callback. The complete-layout fixture verifies binary bytes, dotfiles, extensionless files, generated-looking files, nested empty directories, deterministic ordering, and callback ordering. |
| 3 | Unsafe entries and identities fail with safe relative evidence and are not dereferenced, repaired, or followed by creation. | ✓ VERIFIED | The precreation inventory classifies each entry through the injected non-follow adapter, canonicalizes accepted entries, rejects symbolic links, reparse points, special/unknown entries, escapes, absolute/traversing/separator-ambiguous identities, and emits every case-fold collision member in deterministic order. Windows without an explicitly reparse-aware classifier fails closed. |
| 4 | Established structure, metadata, placeholder, and redacted sensitive-material policy is shared without source mutation or dry-run drift. | ✓ VERIFIED | `dryRunReleaseReport` and candidate readiness both call `evaluateReleaseReadiness`. Exact dry-run characterization tests and policy redaction tests pass. Candidate readiness uses identity-bound, size-gated reads and blocks missing/wrong-kind required paths, incomplete/placeholder metadata, sensitive content, and unreadable/oversized required text before creation. |
| 5 | Source changes during assembly fail explicitly and neither source tree is written or repaired. | ✓ VERIFIED | Baseline observations include roots, topology, kind, canonical identity, stat fields, and exact bytes. Rewalks occur before creation, before/after assembly, before inspection, and after callback; each materialized entry is observed immediately before and after use. Tests inject add/remove/rename/retype/link/truncate/same-length byte changes at five checkpoints and receive `SOURCE_CHANGED_DURING_ASSEMBLY` with one mutation attempt and one cleanup. Source snapshots remain identical across success, copy failure, callback failure, and removal failure. |

**Score:** 5/5 truths verified (0 present but behavior-unverified; no regressions)

### Review-Fix Verification

| Finding | Final-Code Evidence | Fresh Behavioral Evidence | Status |
|---|---|---|---|
| CR-01 — hostile adapter result normalization | Guarded parsers validate directory predicates, canonical absolute paths, and plain directory-name arrays. They catch raw adapter exceptions, throwing getters/proxies/iterators, reject malformed/non-callable/non-boolean results, and are wired into input validation, inventory, and candidate-root validation. | `normalizes hostile filesystem results at preparation boundaries` and `normalizes hostile filesystem results at inventory and lifecycle boundaries` passed. Stable blockers contain no injected private adapter values, and candidate creation is not reached for precreation/inventory failures. | ✓ VERIFIED |
| CR-02 — exact duplicates and mixed collisions | Inventory counts exact name occurrences before traversal, emits one deterministic `exact-duplicate` blocker per duplicated identity, skips duplicated entries before classification/materialization, and still adds distinct spellings to the global case-fold group. | Forward/reversed root duplicates, nested duplicates, and a spelling that is both duplicated and part of a case-fold group all passed with complete deterministic evidence and zero candidate creation. | ✓ VERIFIED |
| CR-03 — shared credential-safe sanitizer | `sanitizeRelativeEvidenceIdentity` is exported by the pure readiness policy and used by public accepted inventory entries, every inventory blocker, and candidate-root entry evidence. Candidate assembly retains internal raw identities, so redaction does not alter source lookup or destination mapping. | Accepted, unsafe, escaped, unreadable, invalid, exact-duplicate, and case-fold outcomes redact runtime-built password-shaped identities. GitHub PAT-shaped and password-category fixtures prove parity with readiness findings. | ✓ VERIFIED |

`03-REVIEW.md` is clean after the fixes and `03-REVIEW-FIX.md` records all three findings as fixed. Those reports were treated as review leads; the statuses above come from final source inspection and fresh tests.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/release-candidate.ts` | Validated input, safe inventory, isolated lifecycle, exact assembly, cleanup, and source-stability service | ✓ VERIFIED | 1,528 substantive lines; exports the validated-state, inventory, lifecycle capability, and callback-scoped assembly APIs. The final code includes hostile-result parsers, exact-duplicate detection, and shared public-path sanitization. Production code imports no source-tree write primitive; all candidate writes and cleanup are capability-bound. |
| `src/release-readiness.ts` | One deterministic structured readiness policy and shared evidence sanitizer | ✓ VERIFIED | 334 substantive lines; validates canonical policy identities, required kinds, metadata, placeholders, scan states, redacted paths, and deterministic ordering, and exports the common sanitizer consumed by candidate inventory. |
| `src/preflight.ts` | Compatibility renderer for `dry_run_release_report` | ✓ VERIFIED | Delegates policy decisions to `evaluateReleaseReadiness`; representative whole-result characterization remains green. |
| `tests/release-candidate.test.ts` | macOS fixture and adapter-contract behavioral evidence | ✓ VERIFIED | 28 tests cover all creation, identity, layout, lifecycle, cleanup, capability, mutation, hostile-result, duplicate, mixed-collision, and shared-sanitizer invariants. |
| `tests/release-readiness.test.ts` | Shared-policy determinism and redaction evidence | ✓ VERIFIED | 8 tests cover ordered findings, invalid inputs, required text, and secret/private-path non-serialization. |
| `tests/preflight.test.ts` | Existing dry-run compatibility evidence | ✓ VERIFIED | 11 tests cover dispatch, complete and blocked results, placeholders, sensitive content, unreadable required text, and pre-filesystem input rejection. |
| `dist/release-candidate.js` | Build output for the internal Phase 3 service | ✓ VERIFIED | Produced by the passing TypeScript build and intentionally remains untracked pending later distribution integration; it is not registered as a public tool. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/preflight.ts` | `src/release-readiness.ts` | `evaluateReleaseReadiness` | ✓ WIRED | Existing dry-run observations flow through the shared policy and compatibility renderer. |
| `src/release-candidate.ts` | `src/addon.ts` | `validateAddonName` | ✓ WIRED | Addon validation is the first input gate. |
| Validated input | Source inventory | Opaque branded filesystem capability | ✓ WIRED | Inventory can only consume the validated state and uses its bound classifier, directory reader, and canonicalizer. |
| Source inventory | Fixed candidate paths | Identity-bound `materializeCandidateEntry` | ✓ WIRED | Fixed directories and every inventory entry flow to exact destination identities; strict capability results are parsed fail-closed. |
| Expected candidate tree | Inspection callback | `reconcileCandidateTree` then stability check | ✓ WIRED | Callback runs only after exact reconciliation and a final pre-review source check. |
| Baseline source observations | Per-use and lifecycle re-observations | `verifySourceStability` and `verifySourceEntryObservation` | ✓ WIRED | Topology and exact observation comparisons produce the explicit source-changed blocker without retry. |
| Candidate lease | Cleanup | `finally` + `cleanupCandidateLease` | ✓ WIRED | Every acquired lease is cleaned exactly once; malformed, exceptional, incomplete, or forged cleanup results fail closed. |

### Data-Flow Trace

| Flow | Source | Consumer | Status |
|---|---|---|---|
| Request to validated roots | `ReleaseCandidateInput` | `prepareReleaseCandidateInput` | ✓ FLOWING |
| Canonical source identities | `inventoryReleaseCandidateSources` | readiness, baseline observation, materialization, exact reconciliation | ✓ FLOWING |
| Candidate content | accepted source entry capability | lease-bound materializer under fixed destination identity | ✓ FLOWING |
| Source-stability evidence | baseline topology/stat/identity/bytes | repeated observation comparisons | ✓ FLOWING |
| Callback result | reconciled temporary candidate | final source rewalk, then caller | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 3 fixture, review-fix, and compatibility behavior | `npm test -- tests/release-candidate.test.ts tests/release-readiness.test.ts tests/preflight.test.ts` | 3 files, 47 tests passed | ✓ PASS |
| Complete repository regression | `npm run verify:rc` (single embedded full-suite run) | 20 files, 188 tests passed; plugin, examples, typecheck, build, and repository scan passed; 0 warnings/blockers | ✓ PASS |
| Source snapshot dry run and prohibited-operation boundaries | `npm run verify:source-snapshot` | `ok: true`; manifest generated in memory; explicit no archive/signing/encryption/upload/login/credential/global-install boundaries | ✓ PASS |
| Temporary lifecycle cleanup precedent | `npm run verify:install-simulation` | `ok: true`; cleanup attempted and removed | ✓ PASS |
| Patch hygiene | `git diff --check` | Exit 0 | ✓ PASS |

### Probe Execution

No Phase 3 plan declares a shell probe, and no `probe-*.sh` is part of its completion contract. Behavioral fixture and adapter-contract tests are the approved completion gate.

## Requirements Coverage and Unique Traceability

| Requirement | Owning Plan | Owning Summary | Status | Evidence |
|---|---|---|---|---|
| RCOP-02 | 03-02 | 03-02 | ✓ SATISFIED | Exhaustive precreation input/root blockers and zero-creation assertions. |
| RCFS-01 | 03-04 | 03-04 | ✓ SATISFIED | Canonical temp isolation, owned lease, post-create identity checks, callback-scoped cleanup. |
| RCFS-02 | 03-05 | 03-05 | ✓ SATISFIED | Exact fixed two-root all-file/all-directory layout, including empty directories and binary/hidden/extensionless/generated-looking files. |
| RCFS-03 | 03-03 | 03-03 | ✓ SATISFIED | Non-follow classification, canonical containment, unsafe-kind/path rejection, deterministic global case-fold collisions. |
| RCFS-04 | 03-01 | 03-01 | ✓ SATISFIED | Shared readiness policy, exact dry-run compatibility, safe redacted findings. |
| RCFS-05 | 03-06 | 03-06 | ✓ SATISFIED | Fail-closed topology/identity/stat/byte mutation detection and source snapshot immutability. |

Each requirement appears in exactly one Phase 3 plan frontmatter and exactly one Phase 3 summary `requirements-completed` declaration. No orphaned or duplicate Phase 3 ownership was found.

## Anti-Pattern and Boundary Scan

| Check | Result | Severity | Impact |
|---|---|---|---|
| `TODO`, `FIXME`, `XXX`, `HACK`, placeholder/stub implementation markers | No actionable production marker found | None | No completion blocker. Metadata placeholder literals are policy data and tests, not stubs. |
| Hostile adapter result leakage or accidental truthiness | Guarded parsing at all reviewed filesystem observation boundaries | None | Malformed and exceptional values normalize to stable blockers without raw exception/private-value serialization. |
| Duplicate identity elision | Exact occurrence accounting precedes traversal; mixed groups retain all distinct spellings | None | Duplicate entries cannot be silently collapsed by `Set` or materialized. |
| Divergent sensitive-path classifiers | Candidate evidence imports the readiness policy sanitizer | None | One sensitive-pattern authority handles accepted entries and all blocker paths. |
| Silent fallback | No fallback path found | None | Missing/incomplete identity-bound lifecycle capability returns `IDENTITY_BOUND_CLEANUP_REQUIRED` or `IDENTITY_BOUND_ASSEMBLY_REQUIRED` before creation. Windows without reparse awareness returns `WINDOWS_REPARSE_CLASSIFIER_REQUIRED`. |
| Raw source writes or repair | No write/repair primitive in production candidate service | None | Source roots are only inventoried and observed; fixture tests prove unchanged bytes/topology across success and failures. |
| Sensitive error or path leakage | No raw exception forwarding; unsafe/private identities are categorized or redacted | None | Serialization tests reject injected secret values and private roots. |
| Phase 4 manifest/integrity ownership | Not implemented or claimed | None | No candidate manifest, SHA-256 reconciliation, scan-coverage accounting, or versioned cleanup result was added. |
| Phase 5 public integration ownership | Not implemented or claimed | None | No `preflight_release_candidate` schema, server registration, fixture/local/remote dispatcher, or common public result integration exists yet. |
| Prohibited release mutation | No Steam login, Workshop item mutation/upload, persistent archive, signing, encryption, compilation, or source repair path found | None | v1.14 boundary remains intact. |
| User-owned graph files | Modified working-tree graph files remain unstaged and no Phase 3 commit contains `.planning/graphs/` | None | Existing user changes were preserved and excluded. |

## Disconfirmation Pass

- **Potential partial requirement:** A real production identity-bound filesystem adapter is absent. This remains intentional Phase 3 evidence scope, not a hidden fallback: default and incomplete adapters fail before creation. The approved completion gate is macOS fixture behavior plus strict adapter-contract tests; Phase 5 owns target integration.
- **Potential misleading test:** The new hostile-value, duplicate, and sanitizer tests were not accepted merely because they passed. The verification confirmed their parsers, occurrence accounting, mixed-group ordering, and shared sanitizer are called by the final production paths, while raw inventory stays internal to materialization.
- **Potential uncovered error path:** Real hostile filesystem races and actual Windows reparse/junction observation are still not proven by macOS fixture adapters. CR-01 closes hostile *adapter-result normalization*, not external kernel/filesystem race safety. Unsupported production capability remains an explicit precreation failure, and real Windows evidence is not a v1.14 completion requirement.

## Deferred Boundaries

| Item | Addressed In | Evidence |
|---|---|---|
| Deterministic manifest, SHA-256 integrity, scan coverage, versioned validation/blocker/cleanup evidence | Phase 4 | Roadmap Phase 4 owns Candidate Integrity Preflight. |
| Dedicated MCP operation, schemas, fixture/local/SSH/PowerShell target parity, public common result envelope, explicit no-mutation evidence | Phase 5 | Roadmap Phase 5 owns Workshop Addon Release Candidate Preflight Integration. |

These are planned later-phase deliverables, not missing Phase 3 behavior, and are not claimed by this report.

## Adapter-Contract Evidence Boundary and Residual Risks

- The controlled macOS fixture adapter proves the identity-bound contract, strict result normalization, deterministic layout, callback ordering, source immutability, and cleanup behavior. It is not a production materialization primitive and does not establish immunity to a hostile external filesystem race.
- Real Windows reparse/junction behavior is not exercised. Windows operation without a declared reparse-aware classifier fails closed, and real Windows evidence is explicitly outside the milestone completion gate.
- The internal service is not yet exposed through MCP or local/remote adapters. This is Phase 5 scope and prevents Phase 3 from overstating target parity.
- `dist/release-candidate.js` is untracked build output. It is outside Phase 3 commits and does not create public registration or distribution claims.

## Human Verification Required

None. The user explicitly approved macOS fixture and adapter-contract evidence as the completion gate, and all behavior-dependent truths have passing automated tests.

## Gaps Summary

No Phase 3 gaps found. CR-01, CR-02, and CR-03 are independently verified against final code through `65a1f48`; all five roadmap success criteria and all six uniquely owned requirements remain verified. The phase goal is achieved within its documented adapter-contract boundary and is ready for Phase 4.

---

_Verified: 2026-07-15T10:04:30Z_
_Verifier: generic-agent workaround for gsd-verifier_

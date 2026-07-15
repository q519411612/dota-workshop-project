---
phase: 04-integrity-manifest-and-verified-cleanup
verified: 2026-07-15T17:44:12Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 4: Integrity Manifest and Verified Cleanup Verification Report

**Phase Goal:** Users can trust that the candidate exactly matches stable source bytes and that no temporary candidate is presented as safely removed unless cleanup is verified.
**Verified:** 2026-07-15T17:44:12Z
**Status:** passed
**Re-verification:** Yes — rerun against `main` HEAD `eba0cd179c4ae96294a9e4f9e51951be0bb5cd6f` after deep-review remediation

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Every candidate file receives deterministic provenance, normalized path, byte count, lowercase SHA-256, and one host-independent combined digest. | ✓ VERIFIED | Final production code projects the manifest only from accepted inventory identities and the final post-callback candidate observations. It uses explicit ordinal root/path comparison and SHA-256 of the fixed UTF-8 nested-array encoding. The independently transcribed canonical vector, delimiter-collision case, shuffled enumeration, alternate separator/temp-root/metadata, and locale-hostility fixtures pass. |
| 2 | Any source-before, candidate, or source-after mismatch and every missing, duplicate, unexpected, wrong-root, wrong-kind, or unobserved occurrence blocks manifest success. | ✓ VERIFIED | The lifecycle captures source-before before creation, observes candidate before callback use, then freshly collects candidate and source-after observations after callback settlement. Candidate occurrences remain an ordinal list until exact counts and discrepancy evidence are complete; manifest projection follows only a bijective ledger and final topology reconciliation. Mutation and non-bijective matrices pass. |
| 3 | Scan coverage distinguishes text, binary, unreadable, and oversized files without removing legitimate binary content or accepting unscannable required text. | ✓ VERIFIED | `release-candidate.ts` calls the shared readiness and coverage policy for every accepted regular file. Text uses bounded bytes and fatal UTF-8 decoding; binary bypasses decoding but remains in integrity, ledger, and manifest domains. Exact four-class coverage, binary inclusion, required unreadable/invalid/oversized blockers, sanitization, and source immutability tests pass. |
| 4 | Every stateful candidate acquisition outcome produces explicit cleanup evidence, and every valid lease reaches one cleanup attempt. | ✓ VERIFIED | Factory-owned one-shot creation registers opaque identity before returning a token, retains already-started asynchronous creation even when the provider throws or returns malformed data, rejects reentry/concurrent/late use, and routes valid leases through one cleanup call. The acquisition and post-create fault matrix verifies exact attempt counts, callback counts, cleanup-capable filesystem absence, and explicit zero-attempt uncertainty only when no usable identity exists. |
| 5 | Cleanup uncertainty or failure forces overall failure without erasing final artifact-validation truth or exposing a stale value/path. | ✓ VERIFIED | Overall success is the conjunction of completed operation, passed final artifact validation, and verified cleanup. Strict cleanup normalization requires one attempt plus literal identity/removal/absence proof. Cleanup-only failure preserves passed artifact evidence; artifact plus cleanup failure preserves both domains; all failures omit callback value and candidate path. Deep-review regressions additionally prove recursive inspection-value normalization, closed type constraints, sensitive source-identity rejection before manifest projection, and aligned operation/blocker failure codes. |

**Score:** 5/5 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/release-candidate.ts` | Identity-bound streamed integrity, exact ledger, canonical manifest, final artifact composition, and verified-cleanup precedence | ✓ VERIFIED | 2,892 lines at the verified HEAD. Exports the lifecycle, streamed observation seams, closed inspection-evidence types, and failure-code domain; `withAssembledReleaseCandidate` wires preparation, readiness, source-before capture, acquisition, assembly, normalized post-callback evidence, final manifest projection, one cleanup funnel, and final result precedence. No stub or fallback implementation found. |
| `src/release-readiness.ts` | Shared scan classification, required-text policy, deterministic coverage, and evidence sanitizer | ✓ VERIFIED | 444 substantive lines. Imported and called by the candidate lifecycle. Coverage uses guarded snapshots, exact counts, complete lists, ordinal pre-redaction order, and stable invalid-input blockers. |
| `tests/release-candidate.test.ts` | Behavioral fixture and hostile-adapter evidence for all five roadmap truths | ✓ VERIFIED | 50 tests, including streamed hashing, final triple ordering, canonical vectors, occurrence-ledger discrepancies, four-class coverage, exactly-once cleanup, result precedence, source-tree snapshots, registered cleanup ownership, recursive inspection-value normalization, compile-time evidence constraints, sensitive identity rejection, and aligned failure codes. |
| `tests/release-readiness.test.ts` | Pure shared-policy coverage and hostile-input evidence | ✓ VERIFIED | 11 tests, including exact coverage aggregation, redaction ordering, getter/proxy normalization, and sanitized exceptional outcomes. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Accepted source identity and opaque candidate lease | Source-before/candidate/source-after integrity observations | Adapter-opened bounded async byte streams and strict versioned parsing | ✓ WIRED | Orchestration receives normalized facts, not raw paths, file handles, or complete file buffers. Final candidate/source observations are fresh after callback settlement. |
| Final validated integrity facts | Manifest entries and combined SHA-256 | Inventory provenance, ordinal sorting, fixed nested JSON arrays | ✓ WIRED | Projection occurs only after final equality and a valid candidate ledger; excluded host/temp/locale fields are not read into canonical identity. |
| Raw candidate observation occurrences | Unique manifest lookup | Count and classify before constructing the accepted map | ✓ WIRED | Duplicate, missing, unexpected, wrong-root, wrong-kind, and unobserved evidence survives deterministic reconciliation. |
| Accepted regular-file inventory | Scan coverage and readiness blockers | Identity-bound bounded reads plus shared readiness/coverage policy | ✓ WIRED | Classification affects scanning only. Binary, unreadable, and oversized files remain expected integrity/manifest entries; required unscannable text blocks before creation. |
| Acquired lease outcome | Cleanup evidence and overall result | One `finally` call, guarded normalization, explicit success conjunction | ✓ WIRED | Passed or blocked artifact truth is composed before cleanup; cleanup failure is appended as removal evidence and cannot return a value. |

### Data-Flow Trace

| Flow | Source | Consumer | Status |
|---|---|---|---|
| Stable byte baseline | Accepted inventory through `observeAcceptedSource` | Final candidate and source-after exact comparisons | ✓ FLOWING |
| Candidate file occurrences | Lease-bound `observeCandidate` | Occurrence ledger, triple comparison, manifest projection | ✓ FLOWING |
| Canonical artifact identity | Final bijective candidate observations | Versioned manifest and combined digest | ✓ FLOWING |
| Scan observations | Accepted inventory through bounded read capability | Shared readiness blockers and four-class coverage | ✓ FLOWING |
| Final artifact and operation states | Post-callback evidence composition | Cleanup precedence and caller-visible result | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Final source-before/candidate/source-after equality after callback | `npm test -- tests/release-candidate.test.ts -t "reobserves triple integrity after inspection before cleanup"` | 1/1 passed | ✓ PASS |
| Deterministic manifest and host-independent digest | `npm test -- tests/release-candidate.test.ts -t "builds deterministic canonical release candidate manifests"` | 1/1 passed | ✓ PASS |
| Exact occurrence ledger and empty-directory composition | `npm test -- tests/release-candidate.test.ts -t "rejects non-bijective candidate integrity ledgers"` | 1/1 passed | ✓ PASS |
| Complete scan coverage and required-text policy | `npm test -- tests/release-readiness.test.ts tests/release-candidate.test.ts -t "reports complete release candidate scan coverage"` | 3/3 passed | ✓ PASS |
| Exactly-once post-create cleanup ownership | `npm test -- tests/release-candidate.test.ts -t "cleans every post-create outcome exactly once"` | 1/1 passed | ✓ PASS |
| Artifact/operation/cleanup precedence | `npm test -- tests/release-candidate.test.ts -t "preserves final artifact truth across callback and cleanup failures"` | 1/1 passed | ✓ PASS |
| Direct cleanup exception normalization | `npm test -- tests/release-candidate.test.ts -t "normalizes a directly thrown cleanup failure without leaking the exception"` | 1/1 passed | ✓ PASS |
| Separate artifact and cleanup blockers | `npm test -- tests/release-candidate.test.ts -t "separates blocked artifact evidence from cleanup failure evidence"` | 1/1 passed | ✓ PASS |
| Deeply frozen independent blocker snapshots | `npm test -- tests/release-candidate.test.ts -t "freezes independent blocker snapshots across every lifecycle domain"` | 1/1 passed | ✓ PASS |
| Deep-review cleanup and inspection remediation | focused callback isolation, post-create cleanup, sensitive identity, and safe evidence type matrix | 4/4 passed | ✓ PASS |
| Phase 4 integrity and cleanup criteria matrix | focused triple integrity, manifest, ledger, coverage, source immutability, and cleanup precedence matrix | 6/6 passed | ✓ PASS |
| Phase 4 source regression | `npm test -- tests/release-candidate.test.ts tests/release-readiness.test.ts` | 61/61 passed | ✓ PASS |
| Complete repository regression | `npm test` | 20 files, 213/213 tests passed | ✓ PASS |
| Static type safety | `npm run typecheck` | Exit 0 | ✓ PASS |
| Build | `npm run build` | Exit 0; generated untracked candidate build was removed afterward | ✓ PASS |
| Plugin/fixture/source-snapshot/install/RC/handoff gates | `verify:plugin`, `verify:same-machine-smoke`, `verify:source-snapshot`, `verify:install-simulation`, `verify:rc`, `verify:handoff` | All returned `ok: true`; same-machine status is explicitly `harness_ready` with runtime evidence pending, source-snapshot records prohibited-operation boundaries, and install simulation proves temporary cleanup | ✓ PASS |
| Patch hygiene | `git diff --check` | Exit 0 | ✓ PASS |

## Deep-Review Remediation Re-verification

- Registered creation remains cleanup-owned after malformed, throwing, or asynchronously settling acquisition providers; cleanup executes exactly once and the candidate root is absent afterward.
- Callback output is recursively normalized into inert readonly evidence. Candidate roots, absolute source paths, functions, live instances, hostile getters, and hostile proxies fail closed without returning a value or leaking private paths.
- The exported callback/result type contract rejects unsupported `void`, function, instance, bigint, and symbol evidence while accepting nested safe evidence.
- Credential-shaped source identities block before candidate creation and manifest projection, return only redacted relative evidence, and leave source trees byte-for-byte unchanged.
- Unsafe inspection values use `CANDIDATE_INSPECTION_VALUE_UNSAFE` consistently in operation and blocker domains; callback exceptions retain `CANDIDATE_INSPECTION_FAILED`.

### Probe Execution

No Phase 4 plan declares a shell probe, and no `probe-*.sh` is part of this phase contract. The approved completion evidence is macOS fixture and adapter-contract behavior.

## Requirements Coverage and Unique Traceability

| Requirement | Owning Plan | Owning Summary | Status | Evidence |
|---|---|---|---|---|
| RCIN-01 | 04-01 | 04-01 | ✓ SATISFIED | Bounded streamed SHA-256, exact final triple equality, callback mutation/throw ordering, malformed-observation failure, and no retry/repair tests. |
| RCIN-02 | 04-02 | 04-02 | ✓ SATISFIED | Version `1.0` manifest entry for every validated candidate file with only provenance, normalized path, exact bytes, and lowercase SHA-256. |
| RCIN-03 | 04-02 | 04-02 | ✓ SATISFIED | Fixed nested-array canonical UTF-8 representation, ordinal ordering, independent digest vector, delimiter separation, and host/path/locale permutations. |
| RCIN-04 | 04-03 | 04-03 | ✓ SATISFIED | Occurrence-first exact ledger, complete deterministic discrepancy categories, and independent final tree reconciliation including empty directories. |
| RCIN-05 | 04-04 | 04-04 | ✓ SATISFIED | Exact four-class counts/lists, binary inclusion, fatal UTF-8, required unscannable-text blockers, and sanitized evidence. |
| RCCL-01 | 04-05 | 04-05 | ✓ SATISFIED | Factory-owned acquisition, retained in-flight ownership, reentry protection, one valid-lease cleanup funnel, and truthful zero/one-attempt evidence. |
| RCCL-02 | 04-06 | 04-06 | ✓ SATISFIED | Separate immutable operation/artifact/cleanup domains, strict cleanup proof, failed-overall precedence, evidence retention, and value/path withholding. |

Each requirement appears in exactly one Phase 4 plan frontmatter and exactly one Phase 4 summary `requirements-completed` declaration. No orphaned or duplicate Phase 4 requirement ownership was found.

## Anti-Patterns and Boundary Scan

| Check | Result | Severity | Impact |
|---|---|---|---|
| `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or implementation placeholder | No actionable production debt marker | None | Placeholder strings are release-metadata policy values and test fixtures, not incomplete implementations. |
| Whole-file integrity buffering | No production whole-file integrity buffer | None | Integrity uses bounded async chunks; text scanning alone uses bounded bytes under the explicit scan limit. |
| Map-before-occurrence-counting | Not present in candidate occurrence reconciliation | None | Candidate duplicates cannot silently overwrite each other. Source observations are one identity-bound call per already unique accepted inventory entry. |
| Locale- or delimiter-dependent manifest identity | Not present | None | Explicit ordinal comparison and nested JSON arrays are used. |
| Silent fallback, retry, recopy, or repair | Not found | None | Unsupported capabilities and malformed facts return explicit blockers; cleanup is not retried and raw-path removal is not substituted. |
| Source-tree write or automatic compilation/repair | Not found | None | Source trees are observed/read only; snapshot fixtures remain unchanged across success and failure paths. |
| Phase 5 public integration | Not added or claimed | None | No `preflight_release_candidate` MCP/schema/server/remote route exists yet; target parity remains Phase 5 scope. |
| Prohibited release mutation | Not found | None | No Steam login, Workshop mutation/upload, persistent archive, signing, encryption, credential handling, game launch, runtime validation, candidate transfer, or retention behavior was introduced. |
| User-owned graph changes | Preserved and unstaged | None | `.planning/graphs/GRAPH_REPORT.md`, `graph.html`, and `graph.json` were not read for evidence, edited, staged, or committed by this verification. |
| Review artifacts outside verification ownership | Preserved | None | Existing `04-REVIEW.md` and `04-REVIEW-FIX.md` worktree changes were not edited or staged by this verification. |

## Disconfirmation Pass

- **Potential partial requirement:** A malformed/out-of-contract creator can create state without returning a cleanup-capable identity. The result does not claim removal: it records zero attempts, failed cleanup, and overall `ok: false`. This is the fail-closed RCCL-02 boundary, not successful cleanup evidence; all supported registered identities are cleaned once.
- **Potential misleading test:** The canonical-vector fixture supplies controlled digest facts rather than deriving every vector from fixture bytes. This does not stand alone: the streamed hashing test proves the production digest primitive, and the final triple lifecycle test proves final candidate/source observations feed manifest projection only after equality.
- **Potential uncovered external path:** Actual hostile filesystem races and real Windows reparse/cleanup behavior are not proven. The phase explicitly uses macOS fixture and strict adapter-contract evidence as its completion gate, fails closed on missing capability, and makes no real-Windows claim.

## Human Verification Required

None. Every behavior-dependent integrity, ordering, cleanup, and state-transition truth has a passing automated fixture or adapter-contract test. Real Windows runtime evidence is explicitly not required and is not claimed.

## Gaps Summary

No Phase 4 gaps found at HEAD `eba0cd1`. All five roadmap success criteria and all seven uniquely owned requirements are supported by substantive, wired implementation and fresh behavioral evidence. The phase goal is achieved within the documented macOS fixture and adapter-contract boundary and is ready for Phase 5 integration.

---

_Verified: 2026-07-15T17:44:12Z_
_Verifier: independent post-remediation verification_

---
phase: 05-unified-mcp-and-remote-target-parity
reviewed: 2026-07-15T20:49:26Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - README.md
  - docs/operator-runbook.md
  - examples/workflows/fixture-release-candidate-preflight.json
  - skills/dota2-workshop-tools/SKILL.md
  - skills/dota2-workshop-tools/references/remote-control.md
  - src/release-candidate-node.ts
  - src/release-candidate-remote-executor.ts
  - src/release-candidate-remote-script.ts
  - src/release-candidate-remote.ts
  - src/release-candidate-result.ts
  - src/release-candidate.ts
  - src/result.ts
  - src/schemas.ts
  - src/server.ts
  - src/tools.ts
  - src/types.ts
  - tests/examples.test.ts
  - tests/packaged-release-candidate-runtime.test.ts
  - tests/plugin.test.ts
  - tests/preflight-release-candidate.test.ts
  - tests/release-candidate-node.test.ts
  - tests/release-candidate-parity.test.ts
  - tests/release-candidate-remote-executor.test.ts
  - tests/release-candidate-remote-script.test.ts
  - tests/release-candidate-remote.test.ts
  - tests/release-candidate-result.test.ts
  - tests/release-candidate.test.ts
  - tests/result.test.ts
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-15T20:49:26Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The remediation closes the previous digest-shape, exact blocker preservation, addon binding, structured pre-invocation evidence, and strict unknown-key findings. Source ancestor checks and candidate file-ID checks are now fail-closed without dynamic type compilation. Focused Phase 5 tests pass 82/82 and typecheck passes.

Three remote filesystem lifecycle defects remain. They occur in state transitions that the current generated-script substring tests do not execute: ownership can still be lost immediately after directory creation, source topology is never re-walked after assembly, and temporary/source disjointness remains lexical rather than canonical.

### Prior Finding Disposition

- Previous CR-01: closed; PowerShell now hashes `["1.0", [[root,path,bytes,sha256], ...]]` and checks the shared vector.
- Previous CR-02: closed; recognized lifecycle failures add exact stable blocker codes and safe relative identities before aborting.
- Previous CR-03: substantially closed for file reads; source ancestors and file IDs are revalidated before use. The separate topology-mutation issue below remains.
- Previous CR-04: closed for the broad replacement window; cleanup rechecks target-native candidate identity before removal.
- Previous CR-05: partially closed; bidirectional comparisons exist, but they do not use canonical filesystem identities. See CR-03 below.
- Previous CR-06: closed; paths, manifest entries, coverage, and requested addon identity must agree.
- Previous CR-07: closed; known pre-invocation failures now return valid operation, artifact, cleanup, execution, path, blocker, and boundary evidence.
- Previous WR-01: closed; exact own-key allowlists cover the detail and nested evidence domains.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Candidate ownership is lost when identity acquisition fails after creation

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:79,88-89,102,115`
**Impact:** `New-CandidateRoot` creates the directory and only then calls required `fsutil` identity acquisition inside its return value. If `fsutil` fails, returns an unexpected format, or becomes unavailable for that new directory, `Stop-ReleaseCandidate` throws before `$created`, `$candidateRoot`, or `$candidateIdentity` are assigned by the caller. The `finally` guard then sees no owned candidate, leaves cleanup as `not-reached`, and leaks the created directory. This violates synchronous cleanup ownership, fail-closed identity behavior, and cleanup evidence after every post-creation outcome.
**Fix:** Prove the target-native identity capability before creating any candidate, then register the created path in script-owned lifecycle state immediately after `CreateDirectory` and before any later operation can throw. If identity capture still fails, return truthful `CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE` or equivalent residue evidence and overall failure; never report cleanup `not-reached` after directory creation.

### CR-02: Remote source mutation checks omit directory topology

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:74-76,83,100-106`
**Impact:** The initial inventory records files and directories, but `Assert-SourceStable` rechecks only files. The lifecycle never re-walks the two source roots after materialization. A file or empty directory can be added or removed after inventory, or an empty directory can be replaced, without changing any recorded file observation. The operation can then report a passed artifact and stable source even though the source topology changed and the candidate no longer represents the final source tree.
**Fix:** Capture stable directory identities as well as file identities, and perform an exact final re-inventory of both roots before artifact success. Compare the ordinal `(root, relative path, kind, identity)` occurrence set against the accepted inventory and emit `SOURCE_CHANGED_DURING_ASSEMBLY` for additions, removals, kind changes, or directory replacement.

### CR-03: Temporary/source isolation compares lexical aliases instead of canonical locations

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:64-65,79-82`
**Impact:** `Test-PathsDisjoint` uses only `Path.GetFullPath`, which normalizes syntax but does not resolve junctions or other reparse aliases. The temporary parent is not checked for reparse ancestry or resolved to a canonical provider location. A runtime TEMP path that is a junction into the Dota tree can therefore appear lexically disjoint while the candidate is physically created inside the protected Dota/source boundary. Candidate ownership checks repeat the same lexical containment assumption.
**Fix:** Resolve the temp parent, Dota root, addon roots, and candidate through reparse-aware canonical filesystem observations before comparison. Reject any ambiguous or reparse-bearing temp ancestry, and require bidirectional disjointness between the canonical locations before creation and again before cleanup.

---

_Reviewed: 2026-07-15T20:49:26Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

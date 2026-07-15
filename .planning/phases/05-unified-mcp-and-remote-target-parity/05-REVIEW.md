---
phase: 05-unified-mcp-and-remote-target-parity
reviewed: 2026-07-15T20:31:51Z
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
  critical: 7
  warning: 1
  info: 0
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-15T20:31:51Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The public MCP schema is additive and strict, the dry-run route remains separate, the common envelope is packaged from the staged source closure, and the operator documentation states the intended contract-only boundary accurately. However, the target-native remote implementation does not satisfy that documented contract. Seven confirmed correctness or filesystem-safety defects must be fixed before Phase 5 can close. The focused Phase 5 suite passed 76/76 during review, which demonstrates that the current substring and hand-authored-payload tests do not exercise the defective generated lifecycle semantics.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Remote manifests use a different canonical digest algorithm

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:6-21,78-79,99`
**Impact:** The TypeScript authority hashes `JSON.stringify(["1.0", entries.map([root,path,bytes,sha256])])`, while the generated PowerShell hashes an array of rows shaped as `[entry.schemaVersion,root,path,bytes,sha256]`. Therefore a genuine successful remote lifecycle produces a `combinedSha256` that `normalizeReleaseCandidateDetail` rejects. The embedded vector validates only the incorrect PowerShell representation, so real SSH and PowerShell success cannot normalize successfully even though mocked tests pass.
**Fix:** Generate the PowerShell canonical payload from the same exported TypeScript vector: an outer schema-version element followed by an array of four-field entry rows. Add a test that feeds the generated algorithm's output into `computeReleaseCandidateCombinedDigest` vectors rather than asserting only generated string fragments.

### CR-02: Remote exceptions erase the required blocker code and relative-path evidence

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:68-79,103-105`
**Impact:** Reparse points, source mutation, integrity mismatches, ledger failures, topology failures, and isolation failures throw specific stable codes, but the sole catch block discards every thrown code and emits `SOURCE_OBSERVATION_FAILED` in category `remote-script`, without the affected relative path. This breaks RCFS-03, RCFS-05, RCIN-01/04, RCCL-04, and the promised fixture/local/remote blocker parity. Operators cannot distinguish an unsafe link from a changed source or integrity failure.
**Fix:** Make each validation boundary add its exact sanitized blocker before aborting, including the safe relative identity when known. Use a closed internal failure record or typed code-to-category mapping; the catch block should preserve only recognized stable facts and map truly unexpected exceptions to a separate sanitized internal-failure code without exposing raw exception text.

### CR-03: Nested directory reparse replacement can escape the source root

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:68-70,92,95-98`
**Impact:** `Assert-SafeSourceTree` checks reparse attributes once, but later inventory, readiness reads, hashing, and copying validate only the leaf `FileInfo`. If a normal nested directory is replaced by a junction after the initial scan, descendant leaf files are not themselves reparse points and their lexical `FullName` still appears below the addon root. The lifecycle can then read and copy files outside the source root, violating no-dereference, containment, sensitive-data, and source-immutability guarantees.
**Fix:** Immediately before every read, hash, and copy, walk and revalidate the complete source ancestor chain for directory kind, no reparse attribute, canonical containment, and stable identity. Bind the opened file to the accepted observation using target-native file identity; do not set `contained` or `identityMatched` from lexical path checks alone.

### CR-04: Cleanup identity is only a reusable leaf name

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:73-74,107`
**Impact:** The remote lifecycle records only the random directory leaf and treats equality with `GetFileName(candidateRoot)` as identity proof. If the owned directory is removed and replaced at the same path before `finally`, cleanup recursively removes the replacement and reports verified absence. This can delete unrelated data and falsely claim exactly-once cleanup of the original candidate.
**Fix:** Capture a stable target-native directory identity at creation and revalidate that identity, directory kind, reparse state, canonical parent, and canonical path immediately before removal. On any mismatch, return `CANDIDATE_IDENTITY_MISMATCH` and do not recursively remove the replacement.

### CR-05: Remote temporary placement is not checked against the Dota source tree

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:73-74,85-94`
**Impact:** `Assert-CandidateRoot` proves only that the candidate is beneath `GetTempPath()`. It never proves that the temp parent or candidate is disjoint from `dotaRoot`, `gameAddonRoot`, and `contentAddonRoot`. A target configured with a Dota root equal to or containing the Windows temp directory creates the candidate inside a protected source boundary, contrary to RCFS-01 and the immutable-source contract.
**Fix:** Canonicalize the temp parent and candidate, then require bidirectional disjointness from the Dota root and both addon roots before any materialization. Reject with the existing isolation blocker before using the candidate.

### CR-06: The invariant authority accepts mixed or unrelated addon identities

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-result.ts:474-503,672-683,836-854`
**Impact:** Manifest validation checks only the broad `game/dota_addons/` or `content/dota_addons/` prefix. It does not require all entries, coverage paths, and `paths.gameAddon`/`paths.contentAddon` to name the same validated addon. A hostile remote payload can combine files from different addons, provide unrelated path evidence, recompute a valid digest, and still normalize to `ok: true`.
**Fix:** Derive one addon identity from the two path roots, require both roots to use the same valid addon name, require every manifest and coverage path to be a descendant of its exact root, and pass the requested addon name into remote normalization so payload identity must equal the invocation identity.

### CR-07: Pre-invocation remote failures omit the required structured lifecycle evidence

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote.ts:83-97`
**Impact:** Missing Dota root, invalid destination, and direct invalid-addon failures attach `normalizeReleaseCandidateDetail({})`, producing a normalization-failure sentinel with no operation state, artifact state, cleanup-not-reached proof, safe paths, execution state, or mandatory boundaries. These are known precreation failures, not malformed evidence, and the result violates the Phase 5 rule that success and failure preserve versioned machine-readable detail and explicit boundary evidence.
**Fix:** Construct a valid precreation detail with `operation:not-reached`, `artifactValidation:not-reached`, the specific configuration blocker, `cleanup:not-reached`, sanitized requested paths when the addon is valid, failed/not-started execution evidence, and the complete immutable boundary object. Reserve normalization failure for genuinely malformed unknown payloads.

## Warnings

### WR-01: Unknown payload fields are silently projected away

**Severity:** WARNING
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-result.ts:357-423,426-764`
**Impact:** Except for `boundaries`, normalization reads recognized properties but never rejects extra own keys on the detail or nested domains. A hostile remote document can therefore carry undeclared fields and still be accepted after those fields are silently dropped. This weakens the promised exact versioned schema and violates the no-repair trust-boundary rule, making future producer/consumer drift invisible.
**Fix:** Define the allowed own-key set for every versioned object and reject unknown string or symbol keys before projection. Explicitly permit only intentional non-authoritative fields such as the producer's top-level `ok`, if that field remains part of the wire schema.

---

_Reviewed: 2026-07-15T20:31:51Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

---
phase: 05-unified-mcp-and-remote-target-parity
reviewed: 2026-07-15T20:59:27Z
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
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-15T20:59:27Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The latest remediation closes two of the three findings from the preceding review. Candidate ownership is now registered immediately after directory creation, so failed identity acquisition produces truthful residue evidence instead of `not-reached` cleanup. The source inventory now includes root and nested directory identities and performs an exact final file/directory topology re-inventory before success.

Canonical temporary/source isolation remains incomplete because the lease stabilizes lexical aliases independently without proving that their target-native locations are disjoint. A second blocker appears in the cleanup call chain: lease revalidation uses the normal lifecycle abort helper inside `finally`, which mutates blockers after artifact evidence has been finalized and makes the emitted payload fail strict normalization.

Focused release-candidate tests pass 85/85. The complete repository suite passes 300/300, `npm run typecheck` passes, and `git diff --check` passes. These gates do not execute the generated PowerShell lifecycle and therefore do not exercise either failing state transition.

### Prior Finding Disposition

- Previous CR-01 (candidate ownership after creation): closed. `$script:candidateRoot` and `$script:candidateCreated` are assigned before required identity acquisition, and the identity-unavailable cleanup shape is accepted by the strict normalizer.
- Previous CR-02 (source directory topology): closed. Both source roots and all nested directories carry target-native identities; exact final inventories detect additions, removals, kind changes, and identity replacement.
- Previous CR-03 (canonical temporary/source isolation): remains open as CR-01 below. Reparse rejection closes junction-based aliases, but lexical paths plus independently stable file IDs do not close non-reparse Windows namespace aliases.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Isolation lease does not prove canonical locations are disjoint

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:71-73`
**Impact:** `Assert-NoReparseAncestry` rejects junctions and other reparse-bearing ancestors, but `New-IsolationLease` still records `Path.GetFullPath` strings and one file ID per named path. `Test-IsolationLease` compares the strings lexically and only verifies that each path retains its own previous identity; it never proves that the temp and protected paths refer to disjoint target-native locations. Windows namespace aliases that do not appear as filesystem reparse points, such as a `SUBST` drive or an alternate volume path, can name the same directory tree with different lexical prefixes. For example, a temp path under a substituted drive that maps into the Dota tree passes the no-reparse and lexical-disjoint checks while the candidate is physically created inside the protected source boundary. This violates RCFS-01 canonical isolation and leaves candidate cleanup containment based on the same alias.
**Fix:** Acquire target-native canonical volume/path observations that resolve drive and volume aliases, or construct and compare ancestor identity chains. Require the temp parent and candidate chain to be physically disjoint from the Dota, game, and content chains before creation and again before cleanup. Reject the operation when canonical resolution or identity-chain proof is unavailable.

### CR-02: Cleanup lease failure makes the final payload internally inconsistent

**Severity:** BLOCKER
**File:** `/Volumes/移动硬盘/dota-workshop-project/src/release-candidate-remote-script.ts:73,123`
**Impact:** Cleanup calls `Test-IsolationLease` inside `finally` and catches its exception to set `$leaseValid = $false`. However, `Test-IsolationLease` fails through `Stop-ReleaseCandidate`, which first appends `TEMP_PARENT_NOT_ISOLATED` or `SOURCE_ENTRY_UNSAFE` to the shared blocker list. Artifact evidence was finalized before entering `finally`. On a previously passed artifact, the strict normalizer rejects the new non-removal blocker because passed artifacts permit only removal, transport, or matching inspection blockers. On a previously blocked artifact, the new blocker is absent from the frozen `artifactValidation.blockers` list, so exact blocked-domain consistency also fails. The script then adds `CANDIDATE_CLEANUP_RESULT_INVALID`, but the emitted document normalizes to `RELEASE_CANDIDATE_DETAIL_INVALID`, losing the intended lifecycle and cleanup evidence precisely when isolation changes during cleanup.
**Fix:** Make cleanup lease validation non-throwing and side-effect-free, returning a typed observation without calling `Add-Blocker` or `Stop-ReleaseCandidate`. In `finally`, translate a failed observation only into the cleanup failure code and matching `removal` blocker, preserving the already-finalized artifact domain. Add strict-normalizer regression cases for lease failure after both passed and blocked artifact outcomes.

---

_Reviewed: 2026-07-15T20:59:27Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

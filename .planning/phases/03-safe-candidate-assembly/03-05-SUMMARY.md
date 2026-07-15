---
phase: 03-safe-candidate-assembly
plan: 05
subsystem: release-candidate
tags: [typescript, vitest, filesystem, deterministic-copy, readiness-policy]

requires:
  - phase: 03-safe-candidate-assembly
    provides: Validated source handle, complete safe inventory, and identity-bound candidate lease lifecycle
provides:
  - Exact game and content addon trees beneath the temporary candidate
  - Complete regular-file and empty-directory reproduction without inclusion heuristics
  - Per-write source reclassification, canonical containment, and destination isolation checks
  - Shared readiness blockers before candidate creation
affects: [03-safe-candidate-assembly, source-stability, integrity-manifest, verified-cleanup]

tech-stack:
  added: []
  patterns: [explicit per-entry assembly, exclusive destination creation, adapter-bound source observations]

key-files:
  created: [.planning/phases/03-safe-candidate-assembly/03-05-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Require explicit adapter capabilities for readiness reads, directory creation, and exclusive file copying; missing capabilities fail before candidate creation."
  - "Reclassify and canonicalize each source immediately before its candidate mkdir or copy, and validate every destination parent inside the canonical candidate."
  - "Run shared release readiness against the accepted inventory before creating the candidate, returning only redacted policy blockers."

patterns-established:
  - "Fixed candidate prefixes are created explicitly, followed by sorted inventoried directories and files with no name, extension, ignore, timestamp, hidden, or generated-file exclusion."
  - "Inspection begins only after complete assembly; any write or destination-identity failure skips inspection and still runs lease cleanup."

requirements-completed: [RCFS-02]

duration: 65min
completed: 2026-07-15
status: complete
---

# Phase 3 Plan 05: Complete Two-Root Assembly Summary

**Every accepted game and content source entry is explicitly reproduced under the fixed temporary candidate layout before callback inspection, with readiness and per-write safety gates.**

## Performance

- **Duration:** 65 min
- **Started:** 2026-07-15T07:19:57Z
- **Completed:** 2026-07-15T07:40:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Reproduced exact `game/dota_addons/<addon>` and `content/dota_addons/<addon>` trees, including hidden, binary, extensionless, ignore-named, generated-looking, old-timestamp, nested, and empty-directory entries.
- Added immediate source kind and canonical-containment revalidation before every directory creation and file copy, plus candidate-parent canonical checks and unexpected-destination rejection.
- Evaluated structure, metadata, placeholder, and redacted sensitive-material readiness through `evaluateReleaseReadiness` before candidate creation.
- Ensured copy and destination failures skip the inspection callback, serialize only stable blockers, and preserve the identity-bound cleanup lifecycle.
- Proved the leased candidate root is exactly empty before the first assembly write; rogue files, directories, and symbolic links produce deterministic safe-identity blockers while remaining present until lease cleanup.
- Replaced raw readiness reads and candidate pathname writes with a factory-branded identity-bound assembly capability; incomplete capabilities fail before source reads or candidate creation.
- Added no-follow, size-first accepted-source observations, lease-bound exclusive materialization, and exact structural reconciliation before callback inspection.
- Enforced required file/directory kinds and guarded every hostile assembly-capability result behind strict sanitized parsers.
- Required every readable-source result to prove exact UTF-8 byte equality before metadata or sensitive-content policy evaluation.
- Kept source trees read-only and avoided recursive copy, retry, repair, filtering, generation, archive, manifest, hash, MCP, and remote behavior.

## Task Commits

1. **Specify complete fixed-layout assembly** - `5cfd11a` (test)
2. **Align prior lifecycle fixtures with complete readiness and assembly capabilities** - `2bf967a` (test)
3. **Cover shared readiness blocker categories and redaction** - `6705bfb` (test)
4. **Implement explicit directory and file assembly** - `250228c` (feat)
5. **Reject non-empty leased candidate roots** - `e2a7730`, `8c64699` (test), `ba52dc6` (fix)
6. **Require no-follow source observations** - `e4d880d` (test)
7. **Require lease-bound materialization and reconciliation** - `591269d` (test)
8. **Exercise strict capability contracts and hostile results** - `df835ce` (test)
9. **Bind source reads, destination writes, and exact-tree inspection to the opaque lease capability** - `b77c830` (fix)
10. **Prove incomplete identity-bound assembly capabilities fail before creation** - `b18e105` (test)
11. **Reject mismatched readable byte claims** - `ac59703` (test), `4d4b424` (fix)

## Files Created/Modified

- `tests/release-candidate.test.ts` - Complete-layout byte/directory fixtures, shuffled enumeration, copy failure, destination alias, readiness blocking, redaction, and cleanup assertions.
- `src/release-candidate.ts` - Shared precreation readiness observations and explicit safe mkdir/copy assembly inside the bound candidate lease.
- `.planning/phases/03-safe-candidate-assembly/03-05-SUMMARY.md` - Execution, TDD, review, and verification record.

## Decisions Made

- Bound readiness readers, directory creation, and copy operations from the validated filesystem adapter rather than bypassing the adapter with later direct operations.
- Used exclusive default file creation and explicit non-recursive directory creation so unexpected candidate entries block instead of being overwritten or merged.
- Preserved formal manifests, source-after final rewalk, hashes, scan-coverage payloads, and versioned cleanup evidence for their owning plans and phases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Unexpected candidate contents] Require an empty leased root before assembly**
- **Found during:** Independent specification review after initial completion.
- **Issue:** Per-destination checks prevented overwrite and escape but did not reject unrelated entries already present elsewhere in the leased root, so the callback could observe rogue content.
- **Fix:** Enumerate the canonical root before every assembly operation, require it to be exactly empty, sort all unexpected identities ordinally, sanitize unsafe identities, and return `CANDIDATE_ROOT_NOT_EMPTY` without deleting or repairing entries before lease cleanup.
- **Files modified:** `tests/release-candidate.test.ts`, `src/release-candidate.ts`.
- **Verification:** RED returned success and invoked inspection with `rogue-file`; GREEN blocks files, directories, and symbolic links before all mkdir/copy calls, preserves each rogue through cleanup entry, calls cleanup exactly once, and exposes stable sorted identities.
- **Committed in:** `e2a7730`, `8c64699`, `ba52dc6`.

**2. [Rule 1 - Source dereference] Replace stale-path readiness reads with no-follow accepted-source observations**
- **Found during:** Independent quality review.
- **Issue:** Separate size and content calls could follow a source file swapped to a symbolic link after inventory.
- **Fix:** Added one bound `readAcceptedSourceFile` operation that must prove identity, regular-file kind, containment, and size before returning content; malformed or incomplete proof fails closed.
- **Verification:** RED swapped `addoninfo.txt` to an external sentinel and the legacy path read reached creation; GREEN returns `SOURCE_FILE_IDENTITY_CHANGED`, never invokes the legacy reader, and serializes neither external content nor private paths.
- **Committed in:** `e4d880d`, `df835ce`, `b77c830`.

**3. [Rule 2 - Size boundary] Gate required metadata size before allocation**
- **Found during:** Independent quality review.
- **Issue:** Metadata content was allocated before the scan size gate.
- **Fix:** The accepted-source operation receives the maximum byte limit and returns a strict oversized state without content; duplicate policy findings are canonicalized.
- **Verification:** Oversized `addoninfo.txt` produces one existing `REQUIRED_TEXT_OVERSIZED` blocker and the raw reader remains uncalled.
- **Committed in:** `e4d880d`, `df835ce`, `b77c830`.

**4. [Rule 1 - Destination identity] Replace pathname check/write seams with one lease-bound materialization operation**
- **Found during:** Independent quality review.
- **Issue:** Parent validation followed by later `mkdir`/`copyFile` left a replacement window and exposed raw destination write methods to the lifecycle.
- **Fix:** Candidate materialization now accepts only the opaque lease, validated input, accepted source identity, fixed destination identity, and expected kind; the lifecycle accepts success only when the adapter capability reports complete identity, exclusive-creation, containment, and kind proof.
- **Verification:** The old raw writer would create an outside sentinel, while GREEN calls only the bound operation, returns `CANDIDATE_DESTINATION_IDENTITY_MISMATCH`, writes no sentinel, skips callback, and cleans once.
- **Committed in:** `591269d`, `df835ce`, `b77c830`.

**5. [Rule 2 - Exact candidate structure] Reconcile expected and actual trees before callback**
- **Found during:** Independent quality review.
- **Issue:** A rogue entry injected after the initial empty-root check could survive into callback inspection.
- **Fix:** Build the complete expected structural set from fixed prefixes and inventory, then require a lease-bound deterministic exact-tree reconciliation before callback.
- **Verification:** Mid-assembly rogue injection returns `CANDIDATE_TREE_UNEXPECTED`; callback remains zero, rogue remains until cleanup entry, and cleanup executes exactly once.
- **Committed in:** `591269d`, `df835ce`, `b77c830`.

**6. [Rule 2 - Required kind contract] Distinguish required files from directories**
- **Found during:** Independent quality review.
- **Issue:** Presence-only readiness accepted a directory at the Lua entry path and a file at the maps directory path.
- **Fix:** Shared readiness observations now carry actual and expected kinds and emit `REQUIRED_PATH_WRONG_KIND`.
- **Verification:** Both wrong-kind fixtures block before candidate creation or callback while existing preflight behavior remains unchanged.
- **Committed in:** `e4d880d`, `df835ce`, `b77c830`.

**7. [Rule 1 - Readable-result integrity] Verify declared size against exact UTF-8 bytes**
- **Found during:** Strict adapter-result review.
- **Issue:** A readable result could claim a small size while returning truncated, oversized, or multibyte content; policy scanning would trust and process inconsistent content.
- **Fix:** Require `Buffer.byteLength(content, "utf8")` to equal the declared size before metadata parsing or sensitive-content scanning.
- **Verification:** RED accepted both truncated ASCII and multibyte content containing a secret beyond the claimed prefix; GREEN returns only `SOURCE_READ_RESULT_INVALID`, never creates a candidate, and never serializes the secret.
- **Committed in:** `ac59703`, `4d4b424`.

---

**Total deviations:** 7 auto-fixed correctness and safety issues.
**Impact on plan:** Corrections close RCFS-02 source-read, destination-write, and exact-tree gaps without adding hashes, manifests, source-after final mutation semantics, remote behavior, or formal cleanup-evidence scope.

## TDD Gate Compliance

- RED command failed with `CANDIDATE_INSPECTION_FAILED` because the callback observed a candidate without the required fixed directories and files.
- RED commit `5cfd11a` precedes implementation commit `250228c`.
- GREEN proves byte-identical binary copying, all inclusion categories, nested empty directories, shuffled enumeration, cleanup after copy failure, destination escape prevention, and callback-after-completion ordering.
- Review RED commit `e2a7730` proves a rogue leased-root file previously survived into a successful callback; fix `ba52dc6` requires an empty root before assembly.
- Capability RED commits `e4d880d` and `591269d` prove stale source reads, raw destination writes, wrong required kinds, and mid-assembly rogue injection before fix `b77c830`.
- Readable-integrity RED `ac59703` proves inconsistent declared sizes reached policy evaluation before fix `4d4b424`.

## Independent Review

- Reviewed destination containment and overwrite behavior, per-write source reclassification, precreation readiness/redaction, callback ordering, and cleanup ownership independently after implementation.
- The reviews found and corrected the non-empty root plus five identity/capability gaps. Re-review confirmed lifecycle code has no raw source-read or destination-write seam, every strict result is guarded, and no private source path, credential value, recursive copy, retry, repair, or source mutation path remains.

## Verification Evidence

- Focused complete-layout test: 1/1 passed.
- Candidate lifecycle suite: 22/22 passed.
- Readiness and preflight regression suites: 19/19 passed.
- Full repository suite: 182/182 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- User-owned `.planning/graphs/` modifications remained unstaged and unchanged by this plan.
- The pre-existing untracked `dist/release-candidate.js` build output remained unstaged because this plan does not own distribution integration.

## Issues Encountered

- The first destination-alias assertion incorrectly expected zero earlier in-candidate copies even though deterministic content assembly precedes the attacked game destination. The assertion was narrowed to the actual invariant: every attempted destination stayed inside the owned candidate, the repository received no write, inspection was skipped, and cleanup removed the partial candidate.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-06 can add the final source-after topology rewalk and mutation detection without changing fixed-layout assembly or candidate ownership.
- Phase 4 can consume the complete candidate tree for deterministic manifests, byte hashes, scan coverage, and versioned cleanup evidence.

## Adapter Contract Evidence Boundary

- The lifecycle tests validate the opaque identity-bound assembly contract and strict result normalization only.
- The controlled macOS fixture materializer uses pathname operations inside a deterministic test adapter. It does not prove safety against hostile external filesystem races and is not a production materialization primitive.
- Default or incomplete Node adapters fail with `IDENTITY_BOUND_ASSEMBLY_REQUIRED` before candidate creation instead of claiming unsupported safety.
- Fixture evidence does not establish real Windows or reparse-point runtime behavior; v1.14 completion relies on the approved macOS fixture and adapter-contract gate.

## Self-Check: PASSED

- Source, test, and summary files exist.
- RED and GREEN commits are present in order.
- RCFS-02 is exercised by macOS fixtures without requiring Dota or Windows.
- No graph, persistent candidate, archive, credential, MCP, remote, manifest, hash, or source-repair change is included.

---
*Phase: 03-safe-candidate-assembly*
*Completed: 2026-07-15*

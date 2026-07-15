---
phase: 04-integrity-manifest-and-verified-cleanup
plan: 02
subsystem: release-candidate
tags: [typescript, manifest, sha256, canonical-json, ordinal-order]

requires:
  - phase: 04-integrity-manifest-and-verified-cleanup
    plan: 01
    provides: Final validated source-before, candidate-after, and source-after integrity triples
provides:
  - Schema-versioned manifest entries for every validated candidate file
  - Ordinal root/path ordering derived from accepted inventory provenance
  - Collision-free canonical combined SHA-256 over fixed nested JSON arrays
affects: [04-integrity-manifest-and-verified-cleanup, inclusion-ledger, cleanup-evidence, public-preflight]

tech-stack:
  added: []
  patterns: [fixed-field manifest projection, host-independent canonical digest]

key-files:
  created: [.planning/phases/04-integrity-manifest-and-verified-cleanup/04-02-SUMMARY.md]
  modified: [src/release-candidate.ts, tests/release-candidate.test.ts]

key-decisions:
  - "Project manifest identity only after final candidate and source observations match the source-before baseline."
  - "Derive root and normalized candidate-relative path from accepted inventory, while taking byte count and digest only from normalized final candidate observations."
  - "Hash UTF-8 JSON of [version, [[root,path,bytes,sha256],...]] after explicit ordinal root/path sorting."
  - "Keep occurrence-ledger, scan coverage, cleanup-domain evidence, public MCP routing, and remote transport in their later plans."

patterns-established:
  - "Manifest entries expose only schemaVersion, root, path, bytes, and lowercase sha256."
  - "Combined artifact identity excludes absolute roots, temp names, timestamps, permissions, locale, host/target fields, warnings, blockers, coverage, and cleanup state."

requirements-completed: [RCIN-02, RCIN-03]

duration: 15min
completed: 2026-07-15
status: complete
---

# Phase 4 Plan 02: Canonical Candidate Manifest Summary

**Validated final candidate integrity facts now produce one deterministic versioned file manifest and one collision-free host-independent combined SHA-256.**

## Accomplishments

- Added immutable manifest entry and result contracts with schema version `1.0`.
- Projected one entry per accepted regular file from accepted inventory provenance and final normalized candidate observations.
- Sorted entries with explicit ordinal comparison over root and candidate-relative path without locale-sensitive comparison.
- Defined the combined digest as SHA-256 of the UTF-8 JSON value `["1.0", [[root,path,bytes,sha256],...]]`.
- Preserved exact callback result behavior while attaching manifest evidence only after callback settlement, source stability, final candidate integrity, and source-after integrity all pass.
- Added an independent fixed canonical byte string and known SHA-256 vector covering delimiter-like content, quotes, a control character, Unicode, shuffled observations, alternate temporary roots, and hostile irrelevant metadata.
- Added an explicit adversarial pair whose delimiter-joined serialization collides while the fixed nested-JSON representation and digests remain distinct.
- Proved source canonical-path separator style, permissions, timestamps, locale environment, temporary root, target metadata, and observation order do not affect manifest identity.
- Reused the strict 04-01 observation parser so unsafe identities, malformed counts or digests, missing observations, duplicates, hostile getters, proxies, iterators, and thenables cannot reach manifest projection.

## TDD Evidence

- RED: `npm test -- tests/release-candidate.test.ts -t "builds deterministic canonical release candidate manifests"` failed because the successful lifecycle result had no manifest.
- GREEN: the same focused command passed after final-triple manifest projection was implemented.
- The initial independently transcribed expected digest was corrected to the SHA-256 produced from the asserted fixed canonical UTF-8 string before the production commit.

## Commits

1. `29753dc` - `test(04-02): require canonical candidate manifest`
2. `8787265` - `test(04-02): correct independent digest vector`
3. `283eecc` - `test(04-02): type manifest fixture lookup`
4. `220a923` - `feat(04-02): produce canonical candidate manifest`
5. `c679bdb` - `test(04-02): prove canonical digest separation`

## Verification Evidence

- Focused canonical manifest test: 1/1 passed.
- Release-candidate and source-snapshot compatibility suites: 37/37 passed.
- Focused collision and host-independence vectors: 2/2 passed.
- Full repository suite: 194/194 passed across 20 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; generated untracked `dist/release-candidate.js` was removed after verification.
- `npm run verify:rc`: passed every plugin, example, typecheck, test, build, repository scan, warning, and blocker gate.
- `git diff --check`: passed.

## Self-Review

- Confirmed manifest projection occurs after the final candidate and source-after observations and never consumes the pre-callback candidate snapshot.
- Confirmed every projected root/path comes from accepted inventory and every byte count/digest comes from a normalized final candidate observation already matched to source-before and source-after.
- Confirmed no delimiter concatenation, object-record canonicalization, `localeCompare`, raw/absolute path hashing, host metadata, timestamp, permission, cleanup, coverage, archive, signing, encryption, upload, source mutation, compile, retry, recopy, repair, public MCP, or remote behavior was added.
- Confirmed duplicate candidate observations remain explicit 04-01 integrity blockers before any map projection; 04-02 does not introduce silent last-write-wins behavior. The richer occurrence ledger remains owned by 04-03.
- Confirmed existing `.planning/graphs/` modifications remained unstaged and were neither changed nor committed.

## Next Plan Readiness

- Plan 04-03 can compare accepted-source, candidate-observation, and manifest occurrences without changing the manifest encoding.
- Later cleanup-domain work can retain this manifest as artifact evidence without adding cleanup fields to the combined digest.

## Self-Check: PASSED

- RCIN-02 and RCIN-03 are implemented and covered by fixed-vector, permutation, adversarial-path, hostile-metadata, regression, typecheck, build, and quality-gate evidence.
- Only scoped source, test, and summary files were committed; user-owned graph changes remain untouched.

---
*Phase: 04-integrity-manifest-and-verified-cleanup*
*Completed: 2026-07-15*

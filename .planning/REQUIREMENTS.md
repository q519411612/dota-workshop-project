# Requirements: Dota Workshop Project v1.15

**Defined:** 2026-07-29
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## v1.15 Requirements

### Export Contract and Isolation

- [x] **EXPT-01**: Operator can invoke an independent `export_release_candidate` operation with a unified target, addon name, explicit target-local export root, and explicit target-local destination without changing `preflight_release_candidate` behavior.
- [x] **EXPT-02**: Operator receives an explicit failure when the destination or derived handoff manifest already exists, with no overwrite, repair, alternate target, or fallback attempt.
- [x] **EXPT-03**: Operator can export only to a canonical absolute destination that is a direct child of the canonical export root and is disjoint from Dota roots, addon source trees, the repository, volume roots, user or system roots, and other protected locations.
- [x] **EXPT-04**: Operator receives an explicit failure for parent traversal, path escape, symbolic links, junctions, reparse points, case-fold identity collisions, or unknown filesystem entry types in the export boundary or candidate tree.

### Candidate Integrity and Promotion

- [x] **INTG-01**: Export reuses v1.14 complete game/content file coverage, source immutability checks, sensitive-content validation, three-way byte and SHA-256 equality, deterministic manifest ordering, inclusion reconciliation, and combined digest computation.
- [x] **INTG-02**: Export assembles and validates the candidate in an operation-owned staging directory under the export root so staging and destination are on the same filesystem.
- [x] **INTG-03**: Export promotes a fully validated staging directory to the absent destination with one recorded atomic rename or directory-move operation and verifies the promoted identity and manifest digest afterward.
- [x] **INTG-04**: Export fails without mixed-state retry when source observations change, candidate observations change, the final digest differs, or promotion cannot be proven.
- [x] **INTG-05**: Export failure cleanup removes only staging state and temporary manifest state owned by the current invocation and reports whether each owned item was removed and proven absent.

### Handoff and Ownership

- [x] **HAND-01**: Successful export creates a versioned handoff manifest outside the candidate directory at a deterministic sibling path.
- [x] **HAND-02**: The handoff manifest contains candidate identity, addon name, manifest version, combined SHA-256, file count, source identities, target identity category, canonical export root and destination, creation operation, boundary declarations, and ownership evidence.
- [x] **HAND-03**: The public result exposes normalized `manifest`, `ownership`, and `cleanup` evidence together with target, operation, success, evidence, warnings, paths, commands, and logs.
- [x] **HAND-04**: Fixture, local Windows, SSH Windows, and PowerShell Remoting return the same normalized export contract, and remote candidates remain only on the target Windows host.

### Strict Export Cleanup

- [x] **CLEN-01**: Operator can invoke an independent `cleanup_exported_candidate` operation with target, export root, destination, ownership identifier, manifest version, combined SHA-256, and an explicit dry-run or execute mode.
- [x] **CLEN-02**: Cleanup validates the canonical path boundary, candidate identity, external handoff manifest identity, ownership identifier, manifest version, complete candidate digest, and absence of unsafe path types before permitting deletion.
- [x] **CLEN-03**: Dry-run performs the complete authorization check without deleting or modifying the candidate or handoff manifest and reports whether execute mode would be permitted.
- [x] **CLEN-04**: Execute deletes only the exactly matched candidate directory and its exactly matched external handoff manifest, then reports separate removal and absence evidence for both.
- [x] **CLEN-05**: Cleanup refuses deletion on any mismatch, malformed or hostile result, unknown partial state, reparse or identity change, and never falls back, repairs, retries into mixed state, or broadens the deletion target.
- [x] **CLEN-06**: SSH and PowerShell cleanup execute entirely on the target Windows host without transferring candidate files or private connection data to the MCP host.

### Verification and Boundaries

- [x] **VERI-01**: macOS fixture tests cover success, existing targets, dangerous paths, source mutation, candidate mutation, digest mismatch, promotion failure, partial-state cleanup failure, cleanup authorization mismatch, and hostile remote results.
- [x] **VERI-02**: Contract tests prove equivalent fixture, local Windows, SSH, and PowerShell semantics and prove no regression to `preflight_release_candidate` or existing MCP tools.
- [x] **VERI-03**: Typecheck, full tests, build, plugin verification, release gates, examples, documentation, and packaged runtime verification pass for the new operations.
- [x] **VERI-04**: Real Windows export, normalization, reparse, promotion, and cleanup evidence is recorded only when a real Windows target is available; otherwise each item is explicitly marked unverified.
- [x] **BNDR-01**: The milestone performs no Steam login, Steam Guard handling, Workshop item creation or mutation, upload, Valve compatibility claim, archive, compression, signing, encryption, cross-host candidate transfer, source repair, or credential storage.

## Future Requirements

### Publishing

- **PUBL-01**: Operator can create or modify a Workshop item after a separately approved credential and publishing design.
- **PUBL-02**: Operator can upload a Valve-compatible package only after official payload semantics are independently verified.

### Artifact Formats

- **ARTF-01**: Operator can optionally archive, sign, encrypt, or transfer candidates after separate requirements define formats and key handling.

## Out of Scope

| Feature | Reason |
|---|---|
| Steam login, Steam Guard, credentials | External account and secret handling is not required for safe target-local export. |
| Workshop project creation, mutation, or upload | v1.15 stops at retained candidate handoff. |
| Valve upload compatibility guarantee | The retained two-root directory is not claimed to be an official upload payload. |
| Archive, compression, signing, or encryption | These require separate format, trust, and key-management designs. |
| Cross-host candidate transfer | Remote candidates must remain on the target Windows host. |
| Automatic overwrite or source repair | Existing or ambiguous state must fail closed. |
| Heuristic include or exclude rules | Complete file coverage remains authoritative. |
| Panorama, TypeScript-to-Lua, React, Excel-to-KV, gameplay expansion | Unrelated to the focused export and handoff boundary. |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| EXPT-01 | Phase 6 | Complete |
| EXPT-02 | Phase 6 | Complete |
| EXPT-03 | Phase 6 | Complete |
| EXPT-04 | Phase 6 | Complete |
| INTG-01 | Phase 6 | Complete |
| INTG-02 | Phase 6 | Complete |
| INTG-03 | Phase 6 | Complete |
| INTG-04 | Phase 6 | Complete |
| INTG-05 | Phase 6 | Complete |
| HAND-01 | Phase 6 | Complete |
| HAND-02 | Phase 6 | Complete |
| HAND-03 | Phase 7 | Complete |
| HAND-04 | Phase 7 | Complete |
| CLEN-01 | Phase 7 | Complete |
| CLEN-02 | Phase 7 | Complete |
| CLEN-03 | Phase 7 | Complete |
| CLEN-04 | Phase 7 | Complete |
| CLEN-05 | Phase 7 | Complete |
| CLEN-06 | Phase 7 | Complete |
| VERI-01 | Phase 8 | Complete |
| VERI-02 | Phase 8 | Complete |
| VERI-03 | Phase 8 | Complete |
| VERI-04 | Phase 8 | Complete |
| BNDR-01 | Phase 8 | Complete |

**Coverage:**
- v1.15 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-07-29*
*Last updated: 2026-07-29 after v1.15 verification and clean independent review*

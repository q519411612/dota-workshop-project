# Requirements: Dota Workshop Project

**Defined:** 2026-07-15
**Milestone:** v1.14 Workshop Addon Release Candidate Preflight
**Core Value:** AI can reliably create and validate a minimal playable Dota 2 Workshop addon through one documented skill and one MCP tool interface.

## v1.14 Requirements

### MCP Contract and Boundaries

- [x] **RCOP-01**: An AI agent can invoke a dedicated `preflight_release_candidate` MCP operation with a validated addon name through fixture, local Windows, SSH Windows, or PowerShell Remoting targets without changing `dry_run_release_report` behavior.
- [x] **RCOP-02**: An AI agent receives explicit input and source-root blockers before any temporary candidate directory is created when the addon name, target root, game addon root, or content addon root is invalid or missing.
- [x] **RCOP-03**: An AI agent receives versioned machine-readable manifest, validation, blocker, path, command, log, warning, and cleanup details in the common MCP result envelope.
- [x] **RCOP-04**: An AI agent receives explicit evidence that candidate preflight performed no Steam login, Workshop item creation or mutation, upload, archive creation, signing, encryption, game launch, or runtime validation, and the operation schema exposes no credential fields.

### Candidate Assembly and Filesystem Safety

- [x] **RCFS-01**: An AI agent can assemble a candidate only under a target-local temporary directory whose canonical path is outside the Dota root, both source addon roots, and the project repository.
- [x] **RCFS-02**: An AI agent receives a candidate layout preserving `game/dota_addons/<addon>` and `content/dota_addons/<addon>` with every regular source file and empty directory included without ignore-file, extension, timestamp, or hidden-file heuristics.
- [x] **RCFS-03**: An AI agent receives explicit relative-path blockers for symbolic links, junctions, other Windows reparse points, special or unknown filesystem entries, root escapes, absolute candidate paths, parent traversal, or case-folded path collisions, with no dereference or repair.
- [x] **RCFS-04**: An AI agent receives the existing required-structure, addon metadata, placeholder-value, and redacted sensitive-material blockers through shared policy that remains consistent with existing release preflight behavior.
- [x] **RCFS-05**: An AI agent receives an explicit source-changed failure if either addon source tree changes during assembly, and the operation never writes to or repairs either source tree.

### Integrity Manifest and Audit Evidence

- [x] **RCIN-01**: An AI agent receives a blocker unless each copied file has identical source-before, source-after, and candidate SHA-256 values.
- [x] **RCIN-02**: An AI agent receives a schema-versioned manifest entry for every candidate file containing root provenance, normalized candidate-relative path, byte count, and lowercase SHA-256 in deterministic ordinal order.
- [x] **RCIN-03**: An AI agent receives a canonical combined digest derived only from fixed manifest fields and unaffected by path separators, enumeration order, absolute paths, temporary directory names, timestamps, permissions, locale, or host identity.
- [x] **RCIN-04**: An AI agent receives a blocker unless every accepted source file maps to exactly one candidate manifest entry and no candidate entry is missing, duplicated, or unexpected.
- [x] **RCIN-05**: An AI agent receives explicit scan-coverage counts and safe relative-path categories for text, binary, unreadable, and oversized inputs; legitimate binary files remain included and hashed, while required text-like files that cannot be fully scanned block success.

### Cleanup, Target Parity, and Failure Semantics

- [x] **RCCL-01**: An AI agent receives cleanup evidence after every outcome following candidate creation, including validation blockers, copy errors, hashing errors, and successful artifact validation.
- [x] **RCCL-02**: An AI agent receives `ok: false` whenever candidate removal fails, cleanup is unverified, or post-cleanup absence cannot be proven, while artifact-validation state remains separately observable.
- [x] **RCCL-03**: An AI agent can preflight a remote candidate entirely on its Windows target and receives only sanitized structured evidence rather than a downloaded or retained candidate artifact.
- [x] **RCCL-04**: An AI agent receives an explicit remote failure for malformed or incomplete versioned JSON, missing required evidence, transport uncertainty, or zero-exit commands that do not satisfy success invariants, with no local fallback.
- [x] **RCCL-05**: An AI agent can verify on macOS fixtures that fixture, local Windows, SSH Windows, and PowerShell Remoting contracts normalize to equivalent manifest, blocker, cleanup, and boundary semantics without claiming real Windows runtime proof.

## Future Requirements

### Candidate Lifecycle Hardening

- **RCFT-01**: An operator can retain a candidate at an explicit destination after ownership, overwrite, expiry, and cleanup policies are defined.
- **RCFT-02**: An operator can apply a versioned configurable inclusion policy after real addon evidence shows that complete regular-file inclusion is unsuitable.
- **RCFT-03**: An operator can discover and explicitly clean stale remote candidates after real transport interruption demonstrates a recurring orphan scenario.
- **RCFT-04**: An operator can record sanitized real Windows parity evidence for reparse-point, canonicalization, transport, and cleanup behavior.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Steam login or credential handling | Introduces private credentials and a different security boundary. |
| Workshop item creation, mutation, or upload | Changes external state and requires a separately approved workflow. |
| Persistent candidate, archive, signing, encryption, or transfer | Conflicts with the selected temporary and inspectable candidate boundary. |
| Automatic build, compilation, source conversion, metadata repair, or generated release assets | Candidate preflight must validate exact on-disk inputs without mutating source trees. |
| Heuristic include or exclude rules | Extension and ignore-file guesses can silently omit required Dota assets. |
| Candidate upload or download across remote transport | Adds persistence, bandwidth, integrity, and cleanup semantics outside v1.14. |
| Codex plugin distribution artifacts | This milestone targets Dota Workshop addon trees only. |
| Mandatory real Windows evidence | macOS fixture and adapter contract tests are the selected v1.14 completion gate. |

## Traceability

Traceability is populated during roadmap creation. Each v1.14 requirement must map to exactly one roadmap phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RCOP-01 | Phase 5 | Complete |
| RCOP-02 | Phase 3 | Complete |
| RCOP-03 | Phase 5 | Complete |
| RCOP-04 | Phase 5 | Complete |
| RCFS-01 | Phase 3 | Complete |
| RCFS-02 | Phase 3 | Complete |
| RCFS-03 | Phase 3 | Complete |
| RCFS-04 | Phase 3 | Complete |
| RCFS-05 | Phase 3 | Complete |
| RCIN-01 | Phase 4 | Complete |
| RCIN-02 | Phase 4 | Complete |
| RCIN-03 | Phase 4 | Complete |
| RCIN-04 | Phase 4 | Complete |
| RCIN-05 | Phase 4 | Complete |
| RCCL-01 | Phase 4 | Complete |
| RCCL-02 | Phase 4 | Complete |
| RCCL-03 | Phase 5 | Complete |
| RCCL-04 | Phase 5 | Complete |
| RCCL-05 | Phase 5 | Complete |

**Coverage:**

- v1.14 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-16 after Phase 5 final review remediation*

# Project Research Summary

**Project:** Dota Workshop Project
**Domain:** Temporary Dota Workshop addon release-candidate assembly and preflight
**Researched:** 2026-07-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

Milestone v1.14 is a narrow artifact-safety capability inside the existing Codex plugin: a dedicated MCP operation assembles both `game/dota_addons/<addon>` and `content/dota_addons/<addon>` into an isolated target-local temporary directory, validates the exact copied bytes, returns durable structured evidence, and then verifies removal. The candidate directory is intentionally ephemeral; the manifest, blockers, integrity facts, and cleanup state are the product. This operation must remain separate from the inspection-only `dry_run_release_report`.

The recommended implementation adds no dependencies. Fixture and local targets should share a Node.js/TypeScript lifecycle built from explicit sorted traversal, `lstat`/`realpath` containment checks, `copyFile`, streaming SHA-256, and `finally` cleanup. Remote Windows should use the existing command adapter with a target-native PowerShell lifecycle that returns the same strict, versioned payload. Shared pure policy should keep metadata, sensitive-material, manifest, blocker, and boundary semantics aligned without pretending Node and PowerShell share executable filesystem code.

The dominant risks are false success: link or reparse-point escape, source mutation between scan and copy, partial copies, host-bound manifests, skipped sensitive scans, malformed remote success payloads, and unverified cleanup. The design must therefore freeze success invariants before implementation, validate immediately before use, hash candidate bytes, reject incomplete evidence, sanitize the whole result, and never fall back between targets. No Steam login, Workshop mutation/upload, persistent archive, signing, encryption, credentials, compilation, repair, or candidate retention belongs in this milestone.

## Key Findings

### Recommended Stack

The current stack already contains all required primitives. The change is primarily a new domain service plus shared policy factoring, not a new packaging subsystem or dependency upgrade. Detailed evidence is in [STACK.md](./STACK.md).

**Core technologies:**

- Node.js `>=20`: explicit temporary-directory, traversal, copy, cleanup, containment, and hashing operations with standard-library APIs.
- TypeScript `5.9.3`: shared candidate payload, blocker, manifest, cleanup, and policy types within the existing ESM project.
- MCP TypeScript SDK `1.29.0` with Zod `3.25.76`: dedicated operation registration, strict input validation, and structured results through the current server contract.
- Existing PowerShell command adapter: target-native remote Windows assembly without installing Node or copying addon files back to the MCP host.
- Vitest `3.2.6`: deterministic macOS fixture completion gate and mocked local/remote semantic parity tests.

No new runtime or development package is recommended. Existing preflight, source-snapshot, and install-simulation logic should contribute pure reusable policy and proven patterns while retaining their current behavior.

### Expected Features

The feature baseline is strongly grounded in the existing repository contracts, while exact official Valve upload-payload semantics remain intentionally unclaimed. Detailed analysis is in [FEATURES.md](./FEATURES.md).

**Must have:**

- A dedicated unified MCP operation accepting only target and validated addon name; existing dry-run behavior remains inspection-only.
- Both addon roots required and reproduced beneath one isolated target-local temporary root.
- Include every regular file deterministically, preserve empty directories, and reject links, Windows reparse points, special entries, escapes, and case-folded collisions.
- Reuse existing required-structure, release metadata, placeholder, and redacted sensitive-material policy without automatic repair.
- Verify source-before, source-after, and candidate byte identity; any mutation, copy gap, or mismatch blocks success.
- Return a versioned, path-independent manifest with root provenance, normalized path, byte count, lowercase SHA-256, per-root totals, and a canonical combined digest.
- Return structured validation, blocker, scan-coverage, boundary, command/log, path, and cleanup evidence; required facts cannot exist only in prose.
- Run cleanup after every post-creation outcome, verify absence, and make residue or unknown cleanup state an overall failure.
- Preserve fixture, local Windows, SSH Windows, and PowerShell Remoting semantics without claiming real Windows runtime validation from mocks.

**Should have:**

- Evidence that survives candidate deletion without retaining a stale or sensitive artifact.
- Cross-root provenance and a canonical digest stable across separators, temporary roots, enumeration order, and hosts.
- Explicit source-mutation detection and exact inclusion-ledger reconciliation.
- Honest scan-coverage accounting for binary and text-like files, with unscannable required text blocking rather than warning into success.

**Defer:**

- Persistent candidates, archives, signing, encryption, file transfer, and configurable inclusion policies.
- Steam/Workshop authentication, item creation or mutation, and upload.
- Build, compilation, source conversion, metadata repair, or generated release assets.
- Stale remote-candidate cleanup and real Windows parity evidence unless later evidence justifies a separate hardening slice.
- Codex plugin distribution artifacts.

### Architecture Approach

The architecture should use one public contract with target-native implementations: fixture/local invoke a Node candidate lifecycle; remote Windows invokes a generated PowerShell lifecycle; both normalize through one strict payload-to-`ToolResult` transformation. Shared policy defines stable codes, manifest identity, metadata and sensitive classifications, cleanup semantics, and immutable boundary statements. The candidate service owns the complete create–validate–copy–hash–cleanup lifecycle, while MCP registration, dispatcher, result builders, docs, and examples expose it without changing adjacent operations. Detailed component and data-flow guidance is in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**

1. Public input and result contract — strict target/addon schema, versioned manifest, blockers, cleanup states, boundary statements, and computed success invariants.
2. Shared candidate policy — required roots and metadata, text/binary scan rules, path normalization, collision rules, stable blocker codes, and sanitized evidence fields.
3. Fixture/local lifecycle — explicit safe traversal, exact inclusion ledger, isolated copy, source/candidate hash comparison, assembled-candidate validation, and verified cleanup.
4. Remote Windows adapter — equivalent PowerShell behavior, shared policy literals where practical, one sanitized JSON payload, strict parsing, and no adapter fallback.
5. MCP and documentation integration — operation registration, dispatcher routing, structured result preservation, examples, tool-list drift checks, and operator boundaries.

### Critical Pitfalls

The full failure catalogue is in [PITFALLS.md](./PITFALLS.md). The most roadmap-relevant risks are:

1. **Pre-scan treated as atomic proof** — revalidate entry type and containment immediately before copying, compare stable source observations with candidate hashes, and fail rather than retry on mutation.
2. **Link, reparse-point, or containment escape** — reject links and all relevant Windows reparse entries before reading; use canonical relative containment, never lexical prefix checks.
3. **Partial copy presented as complete** — reconcile every accepted source file with exactly one candidate manifest entry and block on any missing root, read, copy, collision, or unexpected destination entry.
4. **Host-bound or incomplete manifest identity** — normalize paths before ordinal sorting and hash only canonical path/root/byte/hash fields, excluding timestamps, absolute paths, target data, and temp names.
5. **Sensitive or private data leaked through evidence** — emit only categories, stable codes, fields, and safe relative paths; sanitize blockers, exceptions, commands, stdout/stderr, paths, warnings, and logs as one serialized result.
6. **Cleanup or remote success trusted without proof** — verify candidate absence, strictly validate the entire versioned remote payload, recompute success from invariants, and fail on residue, malformed JSON, missing facts, or transport uncertainty.
7. **Scope creep into publishing** — assert that schemas and generated commands contain no credential, login, upload, archive, signing, encryption, compilation, retention, or repair behavior.

## Implications for Roadmap

The roadmapper should assign actual phase numbers. Research supports the following capability order.

### Capability: Public Contract and Shared Policy

**Rationale:** Every later implementation depends on one definition of success, path identity, scan coverage, blockers, cleanup precedence, and immutable boundaries. Freezing this first prevents Node and PowerShell implementations from inventing incompatible semantics.

**Delivers:** Dedicated input schema; typed operation details; versioned manifest and canonical digest definition; stable blocker/error codes; strict success invariants; shared metadata, placeholder, sensitive-scan, path, and boundary policy; backward-compatible structured result passthrough.

**Addresses:** Dedicated MCP operation, deterministic evidence, shared readiness validation, scan-coverage honesty, and explicit non-publishing boundaries.

**Avoids:** False success, evidence-only manifests, host-bound identity, policy duplication, oversized-text ambiguity, sensitive-value leakage, and schema-level scope creep.

### Capability: Fixture and Local Candidate Lifecycle

**Rationale:** Deterministic fixtures are the milestone completion gate and provide the safest place to prove exact-copy, TOCTOU, isolation, source invariance, and mandatory-cleanup semantics before transport complexity is introduced.

**Delivers:** Node target-native lifecycle for fixture/local targets; both-root assembly; sorted explicit traversal; link/special-entry rejection; exact inclusion ledger; source-before/source-after/candidate hash equality; candidate validation; manifest generation; verified cleanup on success, blockers, and injected failures.

**Uses:** Node filesystem/path/crypto APIs, shared policy, Vitest failure seams, and existing source-snapshot/install-simulation patterns.

**Avoids:** Recursive-copy escapes, mixed-state candidates, partial success, memory-heavy hashing, source mutation, hidden cleanup failures, and secret-bearing error output.

### Capability: Unified MCP Surface and Remote Windows Parity

**Rationale:** Remote implementation should follow a proven contract and local semantic fixture matrix. Target-native PowerShell is necessary because files remain on the Windows target, but it must not weaken validation or become a second policy authority.

**Delivers:** MCP registration and dispatcher path; strict remote PowerShell lifecycle; versioned JSON parsing; command/log evidence; reparse-point enforcement; semantic golden parity across fixture/local/mocked remote targets; explicit transport, parse, cleanup, and no-fallback failures.

**Addresses:** One operation across fixture, local Windows, SSH, and PowerShell Remoting with identical normalized manifest, blocker, cleanup, and boundary semantics.

**Avoids:** Zero-exit false success, loose defaults, local/remote drift, private path/output leakage, remote candidate transfer, and claims of real Windows evidence from mocks.

### Capability: Integration, Guidance, and Independent Audit

**Rationale:** Public documentation should follow the stable operation, and closure must independently examine the highest-risk filesystem and remote-command boundaries rather than relying only on happy-path tests.

**Delivers:** Fixture workflow example, README/skill/reference/runbook updates, tool-list and schema drift checks, end-to-end fixture invocation, complete test/build verification, and an independent review record focused on links/reparse points, containment, mutation, redaction, strict remote parsing, cleanup, and scope boundaries.

**Addresses:** Discoverability, operator expectations, accurate claims, and milestone verification without a real Windows dependency.

**Avoids:** Documentation calling a removed path a usable artifact, MCP surface drift, omitted failure details, publishing creep, and overstated Windows validation.

### Capability Ordering Rationale

- Contract and policy precede implementations because all success and parity assertions depend on stable machine-readable semantics.
- Fixture/local lifecycle precedes remote work because it establishes the behavioral oracle and exercises safety failures without transport uncertainty.
- Remote parity follows the local oracle and shares a semantic fixture matrix, reducing drift while preserving target-native execution.
- Documentation and independent audit follow the stable end-to-end operation so examples describe actual behavior and closure focuses on boundary proof.

### Research Flags

Capabilities likely needing deeper planning research:

- **Remote Windows parity:** PowerShell handling of junctions and other reparse points, canonical path behavior, transport interruption, and cleanup evidence needs careful implementation-specific validation. Real Windows remains optional for v1.14, so any claim must distinguish mocked contract proof from runtime proof.
- **Sensitive scan coverage policy:** Planning must explicitly classify accepted binary assets versus text-like files that must be fully scanned, including size limits, invalid encodings, and unreadable inputs. Silent sampling is not acceptable.
- **Manifest response scale:** Large addon manifests may approach remote output or MCP payload limits. If limits are required, define explicit blocking limits rather than truncating entries.

Capabilities with established patterns that normally do not need additional research:

- **Public contract and shared policy:** Existing schemas, result builders, preflight rules, source manifests, and path-safety tests provide strong repository-specific precedents.
- **Fixture/local lifecycle:** Node standard-library APIs and the repository's source-snapshot and install-simulation implementations establish the core mechanics; planning should emphasize adversarial fixtures rather than broad research.
- **MCP/docs integration and audit:** Registration, dispatcher, plugin/tool-list drift, example validation, and independent-review workflows already exist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Installed versions and integration seams were verified directly; no new dependency is necessary. Windows minimum-runtime behavior remains a contract-test concern rather than a stack choice. |
| Features | MEDIUM | Requirements are strongly grounded in user scope and shipped repository behavior, but current official Valve publishing documentation was unavailable. No exact upload-payload claim is made. |
| Architecture | HIGH | Existing target routing, remote adapter, result envelope, source manifest, preflight, and temporary install patterns provide direct project evidence. |
| Pitfalls | HIGH for fixture/local; MEDIUM for Windows specifics | Repository tests and implementation expose the main risks; junction/reparse behavior and transport-loss cleanup require Windows-focused validation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Exact Valve upload semantics:** Official current publishing documentation could not be verified. Keep v1.14 explicitly as an auditable preparation boundary, not proof that the two-root candidate is Valve's final upload payload.
- **Binary versus text scan policy:** Requirements must define what “sensitive-content validated” means for legitimate binary assets, oversized text-like files, invalid UTF-8, and unreadable entries. Recommended default: include and hash legitimate binary-classified files, but block any required text-like file that cannot be fully scanned.
- **Cleanup precedence:** Confirm that verified cleanup failure or remote cleanup uncertainty forces `ok: false` while preserving whether artifact validation itself passed. Research strongly recommends this fail-closed model.
- **Windows reparse and canonicalization parity:** Mocked contract tests can close v1.14, but they cannot establish real NTFS/PowerShell behavior. Record this limitation and collect sanitized Windows evidence later when available.
- **TOCTOU limits:** Ordinary path APIs cannot create a perfectly atomic snapshot of a mutable tree. The defensible boundary is immediate revalidation, stable source observations, destination hashing, explicit source-changed failure, and no retry into a mixed candidate.
- **Manifest scale:** Do not truncate. If output limits become real, introduce explicit file/count/byte blockers or a separately designed evidence transport in a later milestone.

## Sources

### Primary (HIGH confidence)

- Repository `.planning/PROJECT.md` — milestone goal, target contracts, completion gate, constraints, and exclusions.
- Repository `src/preflight.ts` and tests — current metadata, placeholder, sensitive scan, dry-run, and redaction policy.
- Repository `src/source-snapshot.ts` and tests — normalized relative paths, deterministic ordering, SHA-256, and source evidence patterns.
- Repository `src/install-simulation.ts` and tests — temporary isolation, link rejection, containment, cleanup, and sensitive-material precedents.
- Repository `src/schemas.ts`, `src/tools.ts`, `src/server.ts`, `src/types.ts`, `src/result.ts`, `src/remote.ts`, and related tests — MCP registration, unified routing, result envelope, PowerShell execution, and remote parsing seams.
- Repository `.planning/milestones/v1.13-REQUIREMENTS.md` — prior fail-closed temporary-layout and cleanup requirements.
- [Node.js 20 File System documentation](https://nodejs.org/docs/latest-v20.x/api/fs.html) — `mkdtemp`, `lstat`, `realpath`, `readdir`, `copyFile`, and `rm` contracts.
- [Node.js 20 Crypto documentation](https://nodejs.org/docs/latest-v20.x/api/crypto.html) — streaming SHA-256 through `createHash`.
- [MCP TypeScript SDK v1.29.0 server documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md) — tool registration, schemas, structured content, and error signaling.
- [Microsoft file attribute constants](https://learn.microsoft.com/windows/win32/fileio/file-attribute-constants) — Windows reparse-point attribute semantics.

### Secondary (MEDIUM confidence)

- Installed dependency metadata and declarations — exact TypeScript, Zod, SDK, Vitest, and Node type compatibility in the current passing repository.
- [XavierCHN/x-template](https://github.com/XavierCHN/x-template) — current community evidence for separated game/content trees and distinct production preparation workflows.

### Tertiary (LOW confidence)

- [bmddota/barebones](https://github.com/bmddota/barebones/tree/source2) — older community evidence for game/content layout and classic KeyValues metadata.
- Valve Developer Community publishing documentation — access was not available through the configured research route; exact Workshop upload semantics remain unresolved and outside v1.14 claims.

---
*Research completed: 2026-07-15*
*Ready for roadmap: yes*

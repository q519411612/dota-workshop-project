# Feature Research

**Domain:** Temporary Dota 2 Workshop addon release-candidate preflight
**Researched:** 2026-07-15
**Confidence:** MEDIUM

## Scope Baseline

This is a subsequent-milestone feature slice, not a new publishing system. The project already has addon-name validation, fixture/local/remote target contracts, `dry_run_release_report`, package and metadata blockers, redacted sensitive-material scanning, deterministic source-manifest SHA-256 logic, structured MCP evidence, and temporary install-simulation cleanup. v1.14 should reuse or extract those capabilities instead of introducing parallel validators.

The user-selected candidate contains both addon roots:

- `game/dota_addons/<addon>/` — runtime-facing files.
- `content/dota_addons/<addon>/` — editable Workshop source assets.

This research does not claim that both trees form Valve's exact upload payload. The milestone is an auditable preparation boundary before any upload design, and current official Valve publishing documentation could not be verified through the available automated channel.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Testable behavior |
|---------|--------------|------------|-------------------|
| Dedicated MCP operation | Assembly mutates temporary filesystem state and is materially different from the inspection-only `dry_run_release_report`. | MEDIUM | A new operation is registered in schema, dispatcher, server, tool documentation, and fixture examples; it does not alter `dry_run_release_report`. |
| Validate before mutation | Invalid addon names, missing target roots, or missing addon roots must fail before a candidate directory is created. | LOW | Fixture/local/remote return explicit error codes and zero assembly actions for invalid input. Both `game` and `content` addon roots are required. |
| Isolated temporary layout | A release candidate must never be assembled inside either source tree or another repository/install path. | MEDIUM | Candidate root is created under the target's temporary directory, resolves outside the Dota root and both source roots, and contains `game/dota_addons/<addon>` plus `content/dota_addons/<addon>`. |
| Deterministic inclusion policy | Reviewers must know exactly what entered the candidate; ignore-file or extension guesses can silently omit required Dota assets. | MEDIUM | Recursively include every regular file under both selected addon roots. Preserve normalized relative paths and empty directory structure. Do not apply `.gitignore`, extension allowlists, timestamp filters, or hidden-file heuristics. Every included file appears once in the manifest. |
| Fail-closed exclusion policy | Links and special filesystem entries can escape the addon boundary or behave differently across macOS and Windows. | HIGH | Never follow symbolic links, junctions, or other Windows reparse points. Reject them with relative-path blockers. Reject sockets, devices, FIFOs, and unknown entry types. Reject `..`, absolute paths, root escapes, and case-folded relative-path collisions. No heuristic repair or dereferencing. |
| Reuse existing readiness blockers | Assembly must not weaken the already shipped package, metadata, and sensitive-material checks. | MEDIUM | Existing required-file checks, classic/KV-compatible metadata policy as currently supported, placeholder blockers, and redacted sensitive scans execute against the source/candidate through shared validation logic. Blocker output never includes matched secret values. |
| Byte-identical copy verification | A directory that was copied successfully is not necessarily a trustworthy candidate if the source changed mid-run or a file was altered during assembly. | HIGH | Hash source bytes before and after copying and hash candidate bytes; any mismatch or source mutation blocks the operation. Copy errors are explicit and never converted to warnings. |
| Versioned deterministic manifest | A preflight needs durable evidence after its temporary directory is deleted. | MEDIUM | Return a schema-versioned manifest containing normalized candidate-relative path, root kind (`game` or `content`), byte count, and lowercase SHA-256 for every file. Sort by a specified ordinal comparison. Return per-root counts/bytes and a combined digest computed only from canonical manifest fields, excluding timestamps and absolute temporary paths. |
| Structured validation evidence | A caller must distinguish assembly, validation, and cleanup rather than infer success from prose. | MEDIUM | The operation-specific result adds structured `manifest`, `validation`, and `cleanup` data while retaining common `target`, `operation`, `ok`, `evidence`, `warnings`, `paths`, `commands`, and `logs`. Evidence reports source roots, temporary root, inclusion counts, blockers, scan coverage, and boundary statements. |
| Cleanup on every outcome | Temporary release files must not remain after success or a known validation/copy failure. | HIGH | Cleanup runs from `finally`; result reports candidate creation, cleanup attempt, cleanup success, and post-cleanup nonexistence. Cleanup failure makes `ok: false` even when artifact validation passed. |
| Fixture/local/remote contract parity | A unified MCP feature is incomplete if remote Windows changes semantics or evidence shape. | HIGH | The same input fields, normalized manifest paths, blocker categories, hash algorithm, boundary warnings, and cleanup states apply to fixture, local Windows, SSH Windows, and PowerShell Remoting. Remote assembly happens on the remote target and does not download the candidate. |
| Explicit non-publishing boundaries | “Release candidate” must not imply release or validation success beyond the artifact. | LOW | Every result states that no archive, signing, encryption, Steam login, Workshop mutation, upload, runtime launch, or runtime validation occurred. No credential fields exist in the input schema. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Evidence survives candidate deletion | Reviewers receive a complete manifest and cleanup proof without retaining an artifact that can drift or leak. | MEDIUM | Manifest data is returned in the MCP result, not stored only inside the deleted candidate. |
| Cross-root provenance | A duplicate-looking path is attributable to the runtime or source tree, eliminating ambiguity in reviews. | LOW | Candidate-relative paths retain the full `game/dota_addons/...` or `content/dota_addons/...` prefix and a root-kind field. |
| Source-mutation detection | Detects TOCTOU changes while files are being assembled rather than blessing a mixed snapshot. | HIGH | Before/after source hashes and candidate hash must agree for each copied file. |
| Scan-coverage accounting | Makes sensitive scanning honest for binary, oversized, or unsupported files instead of claiming universal inspection. | MEDIUM | Report scanned/skipped counts and relative paths/categories; current known text checks remain blockers, while unscannable binary coverage is explicit. A future requirement may promote selected skips to blockers. |
| Cleanup as a release gate | Treats failure to remove temporary content as a first-class artifact failure. | MEDIUM | Particularly valuable for remote hosts where an otherwise successful command can leave material behind. Transport loss reports cleanup as unverified, never successful. |
| Canonical cross-platform digest | Fixture evidence can predict Windows evidence despite separator, locale, timestamp, and temporary-root differences. | HIGH | Use `/` paths, raw file bytes, fixed field order, fixed separators, and ordinal sorting. Do not hash JSON serialization, absolute paths, timestamps, mtimes, or platform permissions. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Steam login, item creation, mutation, or upload | Feels like the natural next action after “release candidate.” | Introduces credentials, account state, irreversible external effects, and a substantially different threat model. | End with an explicit preflight result and boundary evidence. Design upload only in a later milestone. |
| Persistent candidate or archive | Lets an operator inspect or transfer files later. | Conflicts with the selected temporary-candidate scope and creates staleness, cleanup, storage, and leakage risks. | Return manifest, hashes, blockers, and cleanup evidence; rerun deterministically when inspection is needed. |
| Signing or encryption | Sounds like stronger release security. | Requires key/credential handling and obscures the inspectable candidate boundary. | Hash raw files with SHA-256 and explicitly state that signing/encryption did not occur. |
| Automatic build, compilation, or source-to-runtime conversion | Could make source trees “release ready” in one call. | Mixes toolchain execution with artifact assembly, makes fixture tests non-deterministic, and can mutate addon roots. | Require callers to build beforehand; inventory and validate the exact files already present. |
| Heuristic include/exclude rules | Avoids copying editor debris or large files. | Dota assets are extension-diverse; guesses can silently omit required content and drift between adapters. | Include all regular files under the two roots and explicitly block unsafe entry types. Add only a reviewed, versioned policy in a later milestone. |
| Following or flattening links | Convenient for projects that link shared assets. | Can copy files outside the addon boundary, leak private data, create cycles, and diverge on Windows junctions. | Reject the entry with relative-path/type evidence and require the operator to materialize intended assets. |
| Automatic metadata repair | Lets the preflight pass without manual edits. | Hides the original blocker and can rewrite classic KeyValues/KV3 metadata incorrectly. | Report field-specific blockers and preserve the source untouched. |
| Best-effort success after partial copy, scan, hash, or cleanup | Produces a report even when something failed. | A partial candidate cannot support a trustworthy manifest. | Fail explicitly; retain partial evidence and cleanup state, but never mark the operation successful. |
| Candidate upload/download across the remote transport | Makes remote artifacts locally accessible. | Adds transfer semantics, bandwidth, persistence, and another copy that needs integrity and cleanup guarantees. | Assemble, hash, validate, and delete on the Windows target; return only structured evidence. |
| Private host or credential persistence | Simplifies repeat remote runs. | Violates repository and project security constraints. | Keep target configuration runtime-only and redact command/log evidence. |

## Feature Dependencies

```text
Dedicated operation schema and common result contract
    └──requires──> validated addon name and resolved target root
                         └──requires──> both source roots and shared readiness validation

Safe candidate assembly
    └──requires──> deterministic traversal and fail-closed entry policy
                         └──requires──> temporary-root isolation

Deterministic manifest
    └──requires──> safe candidate assembly
                         └──requires──> byte-identical source/candidate verification

Successful operation
    └──requires──> readiness checks + manifest validation + verified cleanup

Remote parity
    └──requires──> canonical manifest rules + equivalent Windows reparse-point checks

Persistent artifact ──conflicts──> mandatory temporary cleanup
Upload/authentication ──conflicts──> credential-free preflight boundary
Heuristic exclusion ──conflicts──> complete deterministic inventory
```

### Dependency Notes

- **Shared readiness validation precedes assembly:** package, metadata, and secret blockers should come from extracted common logic so the existing dry run and new operation cannot disagree silently.
- **Safe traversal precedes copying:** path containment and entry-type decisions must be made with non-following metadata calls (`lstat`/Windows reparse-point inspection), not after a recursive copy has dereferenced content.
- **Manifest requires a completed candidate:** hash the copied bytes, then compare them to stable source hashes; do not construct the manifest solely from the source and assume the copy matches.
- **Cleanup is part of success:** a valid candidate plus failed cleanup is an overall failure with `artifactValid: true` and `cleanup.ok: false`, not an ambiguous warning.
- **Remote parity depends on canonicalization:** PowerShell and Node implementations must share golden fixtures for normalized paths, ordinal ordering, blockers, and canonical digest inputs.

## MVP Definition

### Launch With (v1.14)

- [ ] Dedicated `assemble_release_candidate_preflight`-style MCP operation with fixture/local/remote routing and no credential fields.
- [ ] Strict validation of addon name, roots, structure, existing release metadata, sensitive material, path containment, links/reparse points, special entries, and case collisions.
- [ ] Isolated temporary candidate containing both full addon tree prefixes and every regular source file.
- [ ] Source-before/source-after/candidate SHA-256 equality checks plus sorted, schema-versioned manifest and canonical digest.
- [ ] Structured blocker, boundary, path, command/log, scan-coverage, and cleanup evidence.
- [ ] `finally` cleanup with post-removal verification; cleanup failure or unknown remote cleanup state blocks success.
- [ ] macOS fixture tests proving deterministic behavior and golden parity contracts for local/remote adapters without requiring a real Windows host.

### Add After Validation (Later Milestones)

- [ ] Optional retained candidate — only after defining explicit destination ownership, overwrite policy, expiry, and cleanup responsibilities.
- [ ] Versioned user-configurable inclusion policy — only after real addon evidence proves include-all regular files is operationally unsuitable.
- [ ] Stale remote-candidate discovery/cleanup — only if real transport interruption demonstrates recoverable orphan directories are a recurring problem.
- [ ] Real Windows parity evidence — useful hardening, but intentionally not a v1.14 completion gate.

### Future Consideration

- [ ] Archive generation, signing, encryption, or transfer — separate artifact lifecycle and security design.
- [ ] Steam/Workshop authentication and upload — separate external-state milestone with credentials, confirmation, rollback, and audit requirements.
- [ ] Toolchain builds or compilation — separate deterministic build contract rather than hidden preflight behavior.
- [ ] Codex plugin distribution artifacts — explicitly outside this Dota addon candidate slice.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dedicated unified MCP operation | HIGH | MEDIUM | P1 |
| Deterministic include-all traversal | HIGH | MEDIUM | P1 |
| Link/reparse/special-entry rejection and isolation | HIGH | HIGH | P1 |
| Existing readiness validation reuse | HIGH | MEDIUM | P1 |
| Byte-identical copy and deterministic manifest | HIGH | HIGH | P1 |
| Verified cleanup on success and failure | HIGH | HIGH | P1 |
| Fixture/local/remote parity fixtures | HIGH | HIGH | P1 |
| Scan-coverage accounting | MEDIUM | MEDIUM | P2 |
| Real Windows evidence | MEDIUM | HIGH | P2 |
| Retained candidate or custom exclusion policy | LOW | HIGH | P3 |
| Upload/authentication/signing/encryption | OUT OF SCOPE | HIGH | P3 |

**Priority key:**
- P1: Required for v1.14 completion.
- P2: Valuable hardening after the core contract is stable.
- P3: Later milestone or explicit anti-scope for v1.14.

## Ecosystem Evidence Comparison

| Capability | Existing project | Barebones template | Current x-template | v1.14 approach |
|------------|------------------|--------------------|--------------------|----------------|
| Game/content separation | Unified tools already resolve installed `game/dota_addons/<addon>` and `content/dota_addons/<addon>`. | Repository exposes both installed addon roots. | Repository keeps `game/` and `content/` source trees and installation/publish scripts stage them into an addon. | Preserve both full root prefixes inside one temporary candidate. |
| Addon metadata | Existing dry run validates release-facing fields and placeholders in `addoninfo.txt`. | Uses classic KeyValues. | Uses KV3 metadata. | Reuse current project policy; do not auto-convert formats. Any broader KV3 support must be explicit and tested. |
| Build/publish preparation | Existing preflight inspects toolchain markers but does not run them. | Mostly direct Lua/runtime and content layout. | Production scripts compile/bundle before publish. | Assembly does not build; it validates the exact on-disk inputs supplied by the caller. |
| Manifest and cleanup | Source snapshot and install simulation already establish sorted SHA-256 evidence and temporary cleanup precedent. | No equivalent candidate evidence contract identified. | Publish automation is broader and coupled to build/publish workflow. | Add operation-specific manifest, integrity, and cleanup evidence without publishing. |

## Sources

### Project evidence (HIGH confidence for integration and existing behavior)

- `.planning/PROJECT.md` — confirmed v1.14 goal, selected scope, target parity, and explicit boundaries.
- `.planning/milestones/v1.13-REQUIREMENTS.md` — established temporary-layout, symbolic-link, isolation, sensitive-material, and cleanup precedent.
- `src/preflight.ts`, `tests/preflight.test.ts` — current package, metadata, sensitive scan, and dry-run boundary behavior.
- `src/source-snapshot.ts`, `tests/source-snapshot.test.ts` — sorted relative file manifest, raw-byte SHA-256, and redaction precedent.
- `src/install-simulation.ts`, `tests/install-simulation.test.ts` — isolated temporary copy, fail-closed links, cleanup, and path-safety precedent.
- `src/schemas.ts`, `src/tools.ts`, `src/server.ts`, `src/remote.ts`, `src/types.ts`, `tests/remote-operations.test.ts` — unified fixture/local/remote MCP routing and common result evidence.

### Upstream ecosystem evidence (LOW confidence for official Workshop semantics; useful corroboration only)

- [bmddota/barebones](https://github.com/bmddota/barebones/tree/source2) — game/content addon tree and classic KeyValues metadata example; repository's last push is old, so it is not treated as current official guidance.
- [XavierCHN/x-template](https://github.com/XavierCHN/x-template) — actively updated game/content source layout, KV3 metadata, and separate development/production preparation scripts.
- Valve Developer Community Workshop documentation was attempted through the configured research seam, but the Brave provider had no API key and prior project research records an Anubis challenge on direct access. Exact official upload-payload claims are therefore deliberately excluded.

### Confidence note

Overall confidence is **MEDIUM**: expected operation behavior is strongly grounded in the repository's shipped contracts and the user's explicit scope, while Dota layout examples are cross-checked against two community templates. Confidence is not HIGH because current official Valve publishing documentation was not available, so this document does not prescribe a real Workshop upload payload.

---
*Feature research for: v1.14 Workshop Addon Release Candidate Preflight*
*Researched: 2026-07-15*

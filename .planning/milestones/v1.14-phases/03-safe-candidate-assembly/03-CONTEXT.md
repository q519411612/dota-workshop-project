# Phase 3: Safe Candidate Assembly - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the fixture/local filesystem lifecycle that validates an addon name and both source roots before creating an isolated target-local temporary candidate, then reproduces the complete `game/dota_addons/<addon>` and `content/dota_addons/<addon>` trees without mutating either source. This phase establishes safe assembly and source-stability behavior; deterministic integrity manifests, mandatory cleanup proof, MCP registration, and remote Windows parity remain in Phases 4 and 5.

</domain>

<decisions>
## Implementation Decisions

### Validation and creation ordering
- Validate the addon name, target root, game addon root, and content addon root before creating any candidate directory.
- Return explicit structured blockers for invalid or missing inputs; do not create partial candidates and do not fall back to another target.
- Keep `dry_run_release_report` inspection-only and introduce a separate candidate lifecycle seam for later MCP integration.
- Candidate creation is permitted only after canonical containment proves the temporary root is outside the Dota root, both addon roots, and the repository.

### Traversal and candidate layout
- Use explicit deterministic traversal rather than recursive-copy heuristics so every entry is classified before use.
- Include every regular file, hidden file, and empty directory without ignore-file, extension, timestamp, or generated-file filtering.
- Preserve exactly the `game/dota_addons/<addon>` and `content/dota_addons/<addon>` layout under one isolated temporary root.
- Treat candidate paths as normalized relative identities; absolute paths and parent traversal are blockers.

### Filesystem safety and source stability
- Reject symbolic links, junction/reparse-point equivalents exposed by the adapter, special or unknown entries, canonical escapes, and case-folded collisions without dereferencing or repair.
- Revalidate entry type and containment immediately before reading or copying; detect source changes during assembly and fail explicitly rather than retrying into mixed state.
- Never compile, generate, repair, rename, or otherwise modify either source tree.
- Provide injectable filesystem seams only where required for deterministic mutation and failure tests; production behavior remains strict.

### Shared readiness policy
- Reuse or extract the established required-structure, addon metadata, placeholder, and redacted sensitive-material policy instead of maintaining a divergent candidate-only copy.
- Block unsafe or unscannable required text inputs with safe relative-path/category evidence and never expose matched sensitive values.
- Keep boundary evidence explicit: no Steam login, Workshop mutation or upload, credentials, archive, signing, encryption, game launch, or runtime validation.
- Phase completion relies on macOS fixtures and adapter-contract tests; no real Windows claim is introduced here.

### the agent's Discretion
- Internal module and helper names may follow existing TypeScript conventions, provided responsibilities remain separated between pure policy, traversal/assembly, and result normalization.
- Test fixtures and fault-injection shapes may be chosen for clarity as long as tests observe a failing RED state before production implementation.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/install-simulation.ts` contains established temporary isolation, explicit link rejection, containment, cleanup, and redacted sensitive-material patterns.
- `src/source-snapshot.ts` contains deterministic normalized traversal, SHA-256, and source evidence patterns that later integrity work can reuse.
- `src/preflight.ts` contains required structure, release metadata, placeholder, and sensitive-material readiness behavior that must remain consistent.
- `src/result.ts` and `src/types.ts` define the common result envelope and structured detail extension points.

### Established Patterns
- Fixture and local targets run deterministic Node filesystem operations while remote targets use a target-native command adapter behind the same public contract.
- Failures are explicit and evidence-bearing; target or transport failures do not silently fall back.
- Tests use temporary macOS fixtures and verify sensitive values never appear in serialized results.

### Integration Points
- Add the safe candidate domain service alongside existing preflight and install-simulation services.
- Extract shared pure policy only where needed to preserve existing `dry_run_release_report` behavior.
- Phase 4 will extend the lifecycle with manifest, hash reconciliation, scan coverage, and verified cleanup; Phase 5 will connect schemas, dispatcher, server registration, and remote adapters.

</code_context>

<specifics>
## Specific Ideas

- The research recommendation of sorted `lstat`/`realpath` traversal plus explicit `copyFile` is the implementation baseline.
- Candidate evidence is the product; the temporary directory itself must not become a retained artifact.
- Source mutation tests must prove explicit failure and source immutability rather than relying only on final file comparisons.

</specifics>

<deferred>
## Deferred Ideas

- Deterministic manifest entries, combined digest, full inclusion-ledger reconciliation, scan-coverage accounting, and cleanup precedence belong to Phase 4.
- MCP registration, fixture/local/SSH/PowerShell normalization, strict remote JSON parsing, and no-fallback parity belong to Phase 5.
- Persistent candidates, archives, signing, encryption, credentials, Steam/Workshop actions, upload/download, compilation, source repair, and mandatory real Windows evidence remain outside v1.14.

</deferred>

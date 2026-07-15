# Phase 4: Integrity Manifest and Verified Cleanup - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Phase 3 identity-bound candidate lifecycle with deterministic byte-integrity, inclusion-ledger, scan-coverage, artifact-validation, and cleanup evidence. The lifecycle must prove every accepted source file has identical source-before, source-after, and candidate bytes, produce a path-independent versioned manifest and combined digest, and prove candidate absence after every post-creation outcome. Public MCP registration and remote Windows transport remain Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Integrity observation and manifest identity
- Hash source-before, candidate, and source-after bytes through identity-bound adapter operations; any mismatch or missing observation blocks success without retry or repair.
- Manifest entries contain only schema version, root provenance, normalized candidate-relative path, byte count, and lowercase SHA-256; absolute paths, temp names, timestamps, permissions, locale, target identity, and host identity are excluded.
- Sort entries by deterministic ordinal root/path identity and derive the combined digest from an unambiguous canonical serialization of fixed fields.
- Legitimate binary files remain included and hashed exactly like text files.

### Inclusion ledger and structural reconciliation
- Every accepted source file maps to exactly one candidate manifest entry; missing, duplicate, unexpected, wrong-kind, or unobserved entries are blocking.
- Preserve empty directories in structural reconciliation, but manifest file entries remain one-per-regular-file.
- Do not truncate manifests or evidence. Any future scale limit must be an explicit blocker, not partial success.
- Do not infer success from adapter exit or narration; strict versioned observations must satisfy all invariants.

### Scan coverage
- Report explicit counts and safe relative-path categories for fully scanned text, included binary, unreadable, and oversized inputs.
- Text-like required files must be fully readable and scannable; unreadable, invalid, or oversized required text blocks success.
- Binary-classified files are included and hashed without text scanning; classification never controls inclusion.
- Reuse the shared Phase 3 sensitive-material policy and sanitizer; no matched value, private absolute path, or raw adapter exception may enter evidence.

### Artifact validation and cleanup precedence
- Track artifact validation separately from overall operation success so valid bytes remain observable even when cleanup later fails.
- After candidate creation, cleanup is attempted exactly once for success, validation blockers, callback failures, copy/read/hash failures, and malformed adapter results.
- Cleanup success requires strict identity match, removal, and post-cleanup absence proof from the identity-bound adapter contract.
- Removal failure, missing proof, malformed/exceptional result, or unknown cleanup state always forces overall failure and withholds any usable candidate path/value.

### Scope and evidence boundary
- macOS fixture and adapter-contract tests are the Phase 4 completion gate; do not claim hostile external-race or real Windows runtime proof.
- Keep default/incomplete adapters fail-closed; never silently substitute host filesystem behavior.
- Do not expose an MCP tool, schema, dispatcher route, remote PowerShell lifecycle, or public common result envelope yet; those belong to Phase 5.
- No Steam login, Workshop mutation/upload, credentials, persistent archive, signing, encryption, compilation, source repair, candidate retention, or file transfer.

### the agent's Discretion
- Internal manifest/ledger/coverage type names and canonical serialization format may follow existing TypeScript conventions if the encoding is versioned, unambiguous, deterministic, and independently tested.
- Fault-injection checkpoints and controlled fixture capability shapes may be chosen for clear RED tests, provided they never weaken the production fail-closed contract.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/release-candidate.ts` provides the opaque validated handle, complete inventory, identity-bound lifecycle/assembly capabilities, exact structural reconciliation, repeated source observation, and strict cleanup parser.
- `src/release-readiness.ts` provides shared required-structure, metadata, placeholder, scan-state, sensitive classification, deterministic finding order, and safe relative evidence sanitization.
- `src/source-snapshot.ts` provides existing normalized SHA-256 and deterministic manifest precedents, but its host-bound source-snapshot contract must not be reused verbatim.
- `tests/release-candidate.test.ts` contains controlled macOS capability fixtures and adversarial result/failure seams.

### Established Patterns
- External adapter values are hostile until parsed inside one guarded normalization boundary; getter, Proxy, iterator, thenable, malformed discriminant, and raw exception paths fail sanitized.
- Default or incomplete capabilities fail before candidate creation; tests explicitly distinguish semantic adapter-contract proof from real-host atomicity claims.
- TDD evidence records the expected RED before minimal GREEN, followed by focused and full quality gates.

### Integration Points
- Extend the internal candidate lifecycle result with manifest, validation, blocker, coverage, and cleanup domain details without publishing it through MCP.
- Extend the identity-bound capability factory with byte-observation and cleanup-proof operations rather than reintroducing raw path reads/writes/removal.
- Phase 5 will normalize these strict domain details into the common MCP result and implement target-native remote parity.

</code_context>

<specifics>
## Specific Ideas

- Canonical combined digest input should use length-delimited or otherwise collision-free serialization, not delimiter joining that can be ambiguous.
- Cleanup evidence must survive candidate deletion and must not contain a stale path presented as a usable artifact.
- Tests should permute enumeration/order and temporary root names to prove manifest/digest independence from host details.

</specifics>

<deferred>
## Deferred Ideas

- MCP schema/server/dispatcher exposure, fixture/local/SSH/PowerShell normalization, strict remote JSON payload parsing, and no-fallback transport failures belong to Phase 5.
- Real Windows reparse/canonicalization/cleanup evidence remains optional and must not be inferred from macOS adapters.
- Persistent candidates, archives, signing, encryption, upload/download, credentials, compilation, repair, and retention remain outside v1.14.

</deferred>

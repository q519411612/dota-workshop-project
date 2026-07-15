# Phase 5: Unified MCP and Remote Target Parity - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose the verified Phase 3–4 release-candidate lifecycle as one dedicated `preflight_release_candidate` MCP operation across fixture, local Windows, SSH Windows, and PowerShell Remoting targets. This phase owns the public schema, common structured result, production fixture/local adapter, target-native remote PowerShell lifecycle, strict remote normalization, parity fixtures, operator guidance, and end-to-end macOS verification. It must not change `dry_run_release_report` semantics or expand candidate preflight into publishing, persistent packaging, source transformation, or real Windows runtime proof.

</domain>

<decisions>
## Implementation Decisions

### Public MCP contract and structured evidence
- Register exactly one new operation named `preflight_release_candidate` in the schema, dispatcher, server, advertised tool list, documentation, and examples. Its input contains only the existing target contract and a validated addon name; it adds no password, token, secret, Steam, Workshop item, upload, archive, signing, encryption, retention, build, repair, or caller-selected temporary-path field.
- Keep `dry_run_release_report` inspection-only and behaviorally unchanged. The new operation is the only public route that creates a temporary addon candidate.
- Extend the common MCP result with one immutable, schema-versioned release-candidate detail object. Both success and failure preserve structured operation state, artifact validation, manifest, inclusion ledger, scan coverage, blockers, cleanup, safe path identities, execution evidence, warnings, and boundaries rather than flattening required facts into prose.
- Compute top-level `ok` from the normalized invariants, never from an adapter exit code or a supplied `ok` flag. Success requires passed artifact validation, a complete valid manifest and ledger, no blockers, every mandatory boundary statement, and verified exactly-once cleanup with post-removal absence.

### Fixture and local Windows execution
- Fixture and local targets use the same Node/TypeScript production lifecycle and Phase 4 identity-bound contracts; fixture mode changes only target-root injection for deterministic macOS tests and does not use a reduced fake algorithm.
- Resolve the fixture root or local `dotaRoot`, repository root, and target-native temporary parent internally. Callers cannot choose a candidate destination, retain a candidate, or bypass canonical isolation checks.
- Supply a production identity-bound filesystem adapter that performs the complete Phase 3–4 create, materialize, observe, reconcile, validate, and verified-cleanup lifecycle. Local Windows must use reparse-aware classification and fail before creation when that capability is absent or uncertain.
- Return only durable evidence after cleanup. Safe relative source/candidate identities may be reported, but no successful result exposes a live candidate capability or presents the removed temporary root as a usable artifact; source trees remain read-only and byte-for-byte unchanged on every outcome.

### Remote target-native lifecycle and transport evidence
- SSH and PowerShell Remoting execute one generated target-native PowerShell lifecycle entirely on the Windows target. It validates both installed addon roots, creates one target-local temporary candidate, assembles and validates it, emits evidence, and verifies removal in `finally`; addon files and candidate artifacts are never copied to or retained by the MCP host.
- The remote script emits exactly one compact versioned JSON document on stdout and never emits file contents, matched sensitive values, credentials, private absolute paths, or unsanitized exception text. Shared policy constants, blocker codes, boundary values, canonical manifest rules, and scan limits are generated from the TypeScript policy where practical and otherwise covered by exact parity tests.
- Remote command evidence retains the transport, outcome, exit code, and a sanitized command description or redacted template. Returned target, path, command, stdout, stderr, warning, error, and log fields must not reveal host names, usernames, private roots, credential-shaped values, or raw script failures.
- Transport authorization is external runtime configuration. Candidate preflight never accepts, loads, stores, prompts for, or synthesizes credentials; its PowerShell Remoting path must not introduce `-Credential` prompting or credential-store access, and its SSH path may use only the existing runtime destination locator.

### Strict parsing, failure semantics, and no fallback
- Treat remote JSON as hostile unknown input. Require the exact supported schema version and all mandatory nested fields, validate discriminants and closed codes, normalized paths, ordinal manifest ordering, lowercase SHA-256 format, counts, ledger consistency, scan coverage, boundary completeness, operation/artifact/cleanup consistency, and recompute the canonical combined digest and final success invariants locally.
- A nonzero exit, executor exception, timeout or other transport uncertainty, empty or extra non-JSON output, malformed JSON, unsupported version, missing fact, inconsistent blocker, invalid digest, cleanup uncertainty, or zero-exit false success returns an explicit sanitized remote failure. No case retries, repairs, invokes fixture/local assembly, or trusts narration as proof.
- If transport fails after remote creation may have occurred, report cleanup as unknown/unverified and force overall failure. Do not issue a speculative broad cleanup command without an opaque verified identity; stale-remote-candidate discovery and cleanup remain a future requirement.
- Preserve independent artifact-validation truth when valid evidence exists, but cleanup failure or uncertainty always wins overall precedence. Failed normalization must not fabricate manifest, path, cleanup, or boundary facts that were not strictly proven.

### Cross-target parity and completion evidence
- Use one semantic golden matrix to compare fixture, local, mocked SSH, and mocked PowerShell Remoting results after removing only target-specific execution metadata. Equivalent inputs must normalize to identical manifest, digest, ledger, scan coverage, blocker codes/order, artifact state, cleanup state, safe paths, and boundary semantics.
- Cover success plus invalid input, missing roots, link/reparse/special entry, source mutation, metadata and sensitive blockers, unreadable/oversized required text, integrity/ledger mismatch, cleanup failure, malformed/incomplete JSON, invalid version, invalid digest, executor failure, and zero-exit invariant failure. Every post-run fixture asserts source immutability and absence or truthful cleanup uncertainty.
- macOS fixture, local-adapter, mocked SSH, and mocked PowerShell contract tests are the v1.14 completion gate. Results and documentation explicitly label them as contract evidence and do not claim real Windows reparse, canonicalization, transport, or cleanup runtime validation.
- Update the checked fixture workflow, README, skill guidance, remote-control reference, operator runbook, schema/example drift tests, and plugin verification so the operation is discoverable and its temporary evidence-only boundary is unambiguous.

### Scope and immutable release boundary
- Every normalized result states that no Steam login, Workshop item creation or mutation, upload, archive, signing, encryption, game launch, runtime validation, compilation, source conversion, metadata repair, persistent candidate, or file transfer occurred.
- The operation validates the exact existing `game` and `content` source trees. It never generates, compiles, fixes, renames, filters, or writes source files, and it never silently omits regular files through extension, ignore-file, timestamp, or hidden-file heuristics.
- A manifest and cleanup proof are the deliverable; the temporary candidate is not. Documentation must not describe a deleted path as upload-ready material or claim that the two-root layout is Valve's official upload payload.
- Existing user-owned `.planning/graphs/` changes remain outside Phase 5 implementation, verification, and commits.

### the agent's Discretion
- Internal module boundaries, type names, strict-schema implementation, PowerShell script composition helpers, sanitized command wording, and fixture-builder organization may follow existing TypeScript conventions as long as the locked public contract and failure invariants remain exact.
- Plans may split MCP surface, Node adapter, remote lifecycle, strict normalization, parity tests, and documentation into independently testable TDD slices while keeping each of RCOP-01, RCOP-03, RCOP-04, RCCL-03, RCCL-04, and RCCL-05 owned by exactly one plan and summary.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/release-candidate.ts` exports the Phase 3–4 validated input, identity-bound adapter factory, complete lifecycle result domains, versioned manifest, exact inclusion ledger, scan coverage, blocker types, cleanup evidence, and `withAssembledReleaseCandidate` orchestration.
- `src/release-readiness.ts` owns shared metadata, placeholder, sensitive-material, text/binary classification, scan limits, safe relative evidence, and deterministic blocker policy.
- `src/schemas.ts`, `src/tools.ts`, and `src/server.ts` provide the established target schema, dispatch routing, MCP registration, tool list, and structured-content seams.
- `src/types.ts` and `src/result.ts` provide the common result envelope and builders that can be extended to preserve operation-specific structured details.
- `src/remote.ts` provides injectable SSH/PowerShell execution, quoting, command evidence, and target-native script-builder precedents, while its existing optional-field JSON parsing is deliberately too loose for this operation.

### Established Patterns
- Fixture and local operations share Node behavior; remote operations execute target-native PowerShell through the existing transport adapter and never fall back locally after remote failure.
- Public operations return common `target`, `operation`, `ok`, `evidence`, `warnings`, `paths`, `commands`, and `logs` fields, and MCP `structuredContent` mirrors the serialized result.
- Plugin verification compares the canonical `toolNames` list with README and skill tool lists, while example tests validate workflow inputs against operation schemas.
- Remote tests inject executors and assert constructed command behavior without requiring a real Windows host; release-candidate tests already provide adversarial identity-bound fixture seams and source snapshots.

### Integration Points
- Add the public input schema and inferred type beside the existing dry-run schema, route it in `handleTool`, register it in `createServer`, and add it to the canonical tool list without changing the adjacent dry-run route.
- Add a production fixture/local identity-bound filesystem adapter around the existing release-candidate lifecycle rather than embedding MCP concerns into the Phase 4 domain core.
- Add a dedicated remote preflight entry point, PowerShell lifecycle builder, strict payload parser/normalizer, and whole-result sanitizer alongside current remote operations.
- Extend result typing/builders only enough to preserve the new versioned detail object on success and failure, then update result, remote-operation, tool, server, example, and plugin drift tests.

</code_context>

<specifics>
## Specific Ideas

- The normalized remote payload should be judged by the same invariant validator used for local details; adapter-specific code may produce facts but must not be a second authority for success.
- Sanitized command evidence should prove which transport and operation ran without echoing a private destination, absolute Dota path, full generated script, or raw remote JSON.
- Parity comparison should ignore only execution metadata such as target kind and command transport; artifact, blocker, cleanup, path-identity, and boundary domains must compare exactly.
- The checked fixture example should demonstrate that the returned manifest and cleanup evidence are the durable output and that no candidate remains to upload afterward.

</specifics>

<deferred>
## Deferred Ideas

- Real Windows runtime evidence for NTFS reparse points, canonical paths, SSH/PowerShell interruption, and cleanup remains optional follow-up evidence and cannot be inferred from macOS contract tests.
- Stale remote candidate discovery or cleanup after transport interruption remains RCFT-03 and requires real recurring orphan evidence plus a separately designed identity and ownership policy.
- Candidate retention, caller-selected destinations, archives, signing, encryption, upload/download, Steam/Workshop authentication or mutation, credential handling, compilation, source conversion, metadata repair, generated release assets, configurable inclusion rules, and official Valve upload-payload claims remain outside v1.14.

</deferred>

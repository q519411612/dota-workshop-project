# Phase 5: Unified MCP and Remote Target Parity - Research

**Researched:** 2026-07-16
**Domain:** Unified MCP exposure, production fixture/local lifecycle, target-native remote lifecycle, hostile payload normalization, and semantic parity
**Confidence:** HIGH for repository architecture and contract design; MEDIUM for unexecuted real-Windows behavior

## User Constraints

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

### Deferred Ideas
- Real Windows runtime evidence for NTFS reparse points, canonical paths, SSH/PowerShell interruption, and cleanup remains optional follow-up evidence and cannot be inferred from macOS contract tests.
- Stale remote candidate discovery or cleanup after transport interruption remains RCFT-03 and requires real recurring orphan evidence plus a separately designed identity and ownership policy.
- Candidate retention, caller-selected destinations, archives, signing, encryption, upload/download, Steam/Workshop authentication or mutation, credential handling, compilation, source conversion, metadata repair, generated release assets, configurable inclusion rules, and official Valve upload-payload claims remain outside v1.14.

## Summary

Phase 5 should add a thin public integration layer around the already-verified Phase 3–4 domain, not duplicate its local policy. The public path needs three new authorities: a production identity-bound Node filesystem adapter for fixture/local execution, one strict versioned detail normalizer that computes success from facts, and one target-native PowerShell implementation whose JSON is validated by that same normalizer. Existing `schemas.ts`, `tools.ts`, `server.ts`, and result builders are straightforward registration seams; existing remote payload parsing is intentionally too permissive and must not be reused as the release-candidate trust boundary. [VERIFIED: `05-CONTEXT.md`, `src/release-candidate.ts`, `src/schemas.ts`, `src/tools.ts`, `src/server.ts`, `src/result.ts`, `src/remote.ts`]

The production fixture/local adapter should implement the exact `createIdentityBoundCandidateLifecycle` capability rather than exposing raw path helpers to orchestration. It should use the fixture root or supplied local `dotaRoot`, `process.cwd()` as the repository boundary, and the target runtime's `os.tmpdir()` as the internally selected temporary parent. Source reads and hashes should remain opened-handle operations; candidate creation must be unique, materialization exclusive, reconciliation exhaustive, and cleanup one-shot with an explicit absence check. On `win32`, source classification must use a reparse-aware target-native observation and reject the request before creation if that observation cannot be established. [VERIFIED: Phase 3–4 context, `ReleaseCandidateFilesystem`, `IdentityBoundCandidateLifecycle`, Phase 4 verification, `05-CONTEXT.md`]

Remote execution needs a dedicated executor path rather than `runRemoteCommand`, because the current common remote helper places destination, host, username, full script, stdout, and stderr in returned command/log evidence and its PowerShell transport may add `-Credential`. The new path should keep the executable command private, return only a fixed sanitized description plus transport and exit outcome, never echo raw stdout/stderr, and map transport uncertainty to a versioned cleanup-unknown failure without issuing a second cleanup command. [VERIFIED: `src/remote.ts` `runRemoteCommand` and `buildRemoteCommand`; locked remote evidence and credential decisions]

**Primary recommendation:** implement one shared `normalizeReleaseCandidateDetail(unknown)` invariant authority, feed it both the Phase 4 local lifecycle projection and the strict remote JSON payload, and derive `ToolResult.ok` only from the normalized detail. [VERIFIED: `05-CONTEXT.md`; Phase 4 three-domain result and canonical manifest contracts]

## Phase Requirements

| ID | Planning implication |
|---|---|
| RCOP-01 | Add one schema, dispatcher branch, server registration, canonical tool-list entry, checked example, and exact compatibility characterization proving `dry_run_release_report` does not change. [VERIFIED: `.planning/REQUIREMENTS.md`, current registration seams] |
| RCOP-03 | Add one immutable schema-versioned detail object to the common result envelope and preserve it on success, artifact failure, cleanup failure, and remote normalization failure when facts are actually proven. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-CONTEXT.md`] |
| RCOP-04 | Make the boundary set mandatory structured data, not optional warning prose, and prove the public input schema has no credential or mutation fields. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-CONTEXT.md`] |
| RCCL-03 | Execute one complete candidate lifecycle on the remote Windows target and return only sanitized evidence; do not transfer candidate bytes to the MCP host. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-CONTEXT.md`] |
| RCCL-04 | Reject every transport, JSON, version, shape, digest, ledger, coverage, cleanup, and invariant inconsistency with no retry or local fallback. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-CONTEXT.md`] |
| RCCL-05 | Use one golden semantic matrix for fixture, local adapter, mocked SSH, and mocked PowerShell Remoting, while explicitly labeling the evidence as contract-only. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-CONTEXT.md`] |

## Architectural Responsibility Map

| Capability | Primary owner | Secondary owner | Required boundary |
|---|---|---|---|
| Public input contract and registration | `schemas.ts`, `tools.ts`, `server.ts` | docs/examples/plugin verifier | Only `target` plus `addonName`; `dry_run_release_report` remains unchanged. [VERIFIED: current MCP seams, `05-CONTEXT.md`] |
| Local/fixture target resolution | New public preflight service | environment conventions | Inject fixture root or local `dotaRoot`; resolve repository and temp parent internally. [VERIFIED: current `targetRoot` convention and locked decision] |
| Production filesystem operations | New Node adapter module | `release-candidate.ts` domain | Adapter owns handles, identity checks, exclusive materialization, reparse classification, and removal proof; domain owns sequencing and policy. [VERIFIED: Phase 4 capability contract] |
| Semantic detail projection | New result-detail module | `release-candidate.ts` types | Remove callback values/live paths; retain operation, artifact, ledger, coverage, blocker, cleanup, boundary, and safe identity facts. [VERIFIED: Phase 4 result contract, deep-review remediation] |
| Invariant normalization | New pure strict normalizer | local projector and remote parser | One authority recomputes manifest digest and top-level success; adapters cannot declare success. [VERIFIED: locked decision] |
| Remote lifecycle execution | New target-native PowerShell builder | dedicated SSH/PS executor | All file operations remain on Windows; stdout is one compact JSON document; host sees no candidate bytes. [VERIFIED: locked decision] |
| Transport sanitization | Dedicated preflight executor | shared target/evidence sanitizer | Private command and raw streams stay internal; public command/log/target fields use fixed safe descriptions. [VERIFIED: locked decision; current remote leakage seam] |
| Cross-target parity | Golden semantic fixture matrix | focused target tests | Strip only execution metadata; compare every artifact, cleanup, blocker, safe-path, and boundary fact. [VERIFIED: locked decision] |

## Standard Stack

### Core

| API/library | Version | Use | Prescription |
|---|---:|---|---|
| Node.js built-ins: `node:fs/promises`, `node:fs`, `node:path`, `node:os`, `node:crypto`, `node:child_process` | Project requires `>=20` | Production fixture/local adapter, temp-root selection, hashing, exclusive file creation, cleanup proof, and local Windows reparse probe | Use built-ins only; add no dependency. [VERIFIED: `package.json`, current filesystem and remote code] |
| TypeScript | `5.9.3` declared | Closed discriminated states, immutable detail types, target-specific executor contracts, exhaustive normalization | Keep schema and domain types explicit; do not use an open `Record<string, unknown>` as the final detail contract. [VERIFIED: `package.json`, current repository conventions] |
| Zod | `^3.25.76` | Public input schema and strict remote payload shape validation | Use strict nested schemas as an initial shape gate, then run semantic invariant checks; Zod parse success alone does not prove digest, ordering, count, or state consistency. [VERIFIED: `package.json`, current schemas, locked invariant requirements] |
| Vitest | `^3.2.4` | TDD, hostile payload matrices, adapter fault injection, golden parity, docs/schema drift | Reuse current injected executor and temporary fixture patterns. [VERIFIED: `package.json`, Phase 3–4 tests, remote tests] |
| Target-native Windows PowerShell/.NET | Existing remote transport | Remote enumeration, reparse attributes, FileStream hashing/copying, SHA-256, JSON emission, and cleanup | Generate one noninteractive script with `ErrorActionPreference = Stop`; suppress all incidental pipeline output and emit one final compact JSON document. [VERIFIED: existing PowerShell-builder pattern and locked remote design] |

### Existing repository assets to reuse

- `withAssembledReleaseCandidate` is the only local lifecycle orchestrator; do not reproduce its sequence in the MCP service. [VERIFIED: `src/release-candidate.ts`, Phase 4 verification]
- `createIdentityBoundCandidateLifecycle` is the production adapter factory contract; implement it in a new non-test module. [VERIFIED: `src/release-candidate.ts`]
- `evaluateReleaseReadiness`, `evaluateReleaseScanCoverage`, `isReleaseTextPath`, `MAX_SECRET_SCAN_BYTES`, and `sanitizeRelativeEvidenceIdentity` are the shared local policy authorities. [VERIFIED: `src/release-readiness.ts`]
- The manifest canonical input is `JSON.stringify(["1.0", entries.map(({root,path,bytes,sha256}) => [root,path,bytes,sha256])])`, hashed as UTF-8 SHA-256 after ordinal root/path ordering. Export one pure helper or constant-backed function so the public normalizer and remote parity tests do not transcribe it independently. [VERIFIED: Phase 4 tests and verification]
- `toolNames`, README/skill list checks, example-schema mapping, and `asToolContent` already provide discoverability and structured-content drift gates. [VERIFIED: `src/tools.ts`, `tests/plugin.test.ts`, `tests/examples.test.ts`]

### Package Legitimacy Audit

No new package is required or recommended, so no package-legitimacy or registry action is applicable. [VERIFIED: `package.json`, available built-in and repository capabilities]

## Public Contract and Detail Shape

Define `PreflightReleaseCandidateInputSchema` as exactly `{ target: TargetSchema, addonName: z.string().min(1) }`; do not extend it with a temporary path, retention flag, build flag, repair flag, upload field, credential field, or remote authorization field. Add the operation beside `DryRunReleaseReportInputSchema`, but characterize the old schema and complete old results before modifying dispatcher code. [VERIFIED: locked public contract, current schema layout]

Extend `ToolResult` with one optional operation-specific object, recommended as `releaseCandidate?: ReleaseCandidateDetail`. Existing result builders should accept and pass through this field only when supplied, so every existing operation retains byte-equivalent object shape. The detail should be deeply immutable in production and in its exported TypeScript contract. [VERIFIED: current `ToolResult`, result builders, exact compatibility requirement]

Recommended detail domains:

| Field | Required semantics |
|---|---|
| `schemaVersion` | Exact supported version, initially `"1.0"`. [VERIFIED: all Phase 4 evidence versions] |
| `operation` | Closed `not-reached`, `completed`, or `failed` state with closed failure code. [VERIFIED: `ReleaseCandidateOperationEvidence`] |
| `artifactValidation` | Closed `not-reached`, `blocked`, or `passed`; passed includes manifest, ledger, and scan coverage; blocked preserves proven ledger/coverage when available. [VERIFIED: `ReleaseCandidateArtifactValidation`] |
| `manifest` | Present only when artifact validation passed; entries contain fixed fields only and are ordinal. [VERIFIED: Phase 4 manifest contract] |
| `inclusionLedger` | Present whenever strictly proven; counts must agree with manifest and discrepancy state. [VERIFIED: Phase 4 ledger contract] |
| `scanCoverage` | Present whenever strictly proven; counts equal list lengths and total equals all four categories. [VERIFIED: `ReleaseScanCoverage`] |
| `blockers` | Closed code/category/path/count facts in deterministic order; relative paths pass the shared sanitizer and absolute paths are rejected. [VERIFIED: Phase 3–4 blocker contracts] |
| `cleanup` | Exact attempted/attempt-count/status/verified identity-removal-absence facts, plus `unknown` for transport uncertainty at the public remote boundary. [VERIFIED: Phase 4 cleanup contract and locked remote uncertainty rule] |
| `paths` | Only durable safe identities such as `game/dota_addons/<addon>` and `content/dota_addons/<addon>`; never a live or deleted absolute candidate root. [VERIFIED: locked durable-evidence boundary] |
| `execution` | `fixture`, `local`, `ssh`, or `powershell`; remote includes only sanitized description and exit outcome. [VERIFIED: locked command evidence rule] |
| `boundaries` | Mandatory fixed booleans/statements covering every prohibited action and the contract-only Windows evidence disclaimer. [VERIFIED: RCOP-04 and locked scope] |

Use a fixed boundary object rather than a free-form string array. The required false facts are: Steam login, Workshop creation, Workshop mutation, upload, archive, signing, encryption, game launch, runtime validation, compilation, source conversion, metadata repair, persistent candidate, and file transfer. Also state that the candidate was temporary, source trees were not modified, the deliverable is evidence, and real Windows runtime behavior is not proven by fixture/adapter tests. [VERIFIED: `05-CONTEXT.md`]

## Strict Normalization and Success Invariants

The normalizer must accept `unknown`, catch getter/proxy/schema exceptions, snapshot only recognized fields, reject unknown discriminants/codes, and return either a deeply frozen valid detail or a stable sanitized normalization failure. Never patch malformed data into a valid shape. [VERIFIED: Phase 3–4 hostile adapter normalization pattern and no-repair rule]

Apply these checks after strict shape parsing:

1. Require exact schema versions at detail, manifest, every manifest entry, ledger, coverage, and cleanup domains. [VERIFIED: locked version requirement]
2. Require each manifest path to be a safe forward-slash relative identity with the correct `game/dota_addons/<addon>/` or `content/dota_addons/<addon>/` prefix and matching root provenance. Reject absolute, drive, UNC, empty-segment, dot, parent, or backslash identities. [VERIFIED: Phase 3 path policy and Phase 4 manifest identity]
3. Require safe integer byte counts and lowercase 64-hex SHA-256 values. [VERIFIED: Phase 4 strict observation contract]
4. Require exact ordinal `(root,path)` order and no duplicate path occurrences. [VERIFIED: Phase 4 manifest/ledger contract]
5. Recompute the combined digest locally from the fixed nested-array canonical form and require equality. [VERIFIED: RCIN-03 and locked remote normalization]
6. Require `expectedFileCount`, `observedFileCount`, and `matchedFileCount` to equal the manifest entry count on artifact success. Blocked states must not assert a bijection inconsistent with blocker facts. [VERIFIED: Phase 4 ledger semantics]
7. Require each coverage count to equal its complete path-list length, all category lists to be ordinal and non-overlapping, and `totalFileCount` to equal the sum. On artifact success, translate manifest identities to coverage identities and require complete one-to-one coverage. [VERIFIED: Phase 4 exhaustive coverage semantics]
8. Require artifact `passed` to have no blockers, a manifest, a bijective ledger, and complete coverage. Require artifact `blocked` to have at least one artifact blocker and no manifest. [VERIFIED: Phase 4 three-domain result]
9. Require cleanup `verified` to mean exactly one attempt, identity matched, removal true, and absence true. Cleanup failed or unknown forces overall failure. [VERIFIED: RCCL-02, RCCL-04]
10. Require every boundary field and its exact safe value. Missing or contradictory boundaries invalidate the payload. [VERIFIED: RCOP-04]
11. Compute top-level success as `operation.completed && artifactValidation.passed && blockers.length === 0 && cleanup.verified && boundaries complete`; ignore any supplied payload `ok`. [VERIFIED: locked success rule]

Normalization failures should expose only stable categories such as `REMOTE_RELEASE_CANDIDATE_PAYLOAD_INVALID`, `REMOTE_RELEASE_CANDIDATE_VERSION_UNSUPPORTED`, `REMOTE_RELEASE_CANDIDATE_DIGEST_INVALID`, `REMOTE_RELEASE_CANDIDATE_INVARIANT_FAILED`, and `REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN`. Do not return raw Zod issues containing private input values and do not preserve unvalidated nested facts. [VERIFIED: project explicit-error/redaction rules and locked remote failure semantics]

## Production Fixture and Local Adapter Design

Create a new production adapter module that returns a complete `ReleaseCandidateFilesystem` with `candidateLifecycle`. Fixture and local callers must use this same module; target kind changes only the injected Dota root and platform/reparse capability. [VERIFIED: locked fixture/local parity]

Recommended operation mapping:

| Domain capability | Production implementation |
|---|---|
| `lstat`, `realpath`, `readDirectory` | Bind Node built-ins; return directory names only and let the domain validate hostile/unsafe identities. [VERIFIED: Phase 3 contract] |
| `classifySourceEntry` | On non-Windows, `lstat` without following. On Windows, query target-native file attributes and classify any `ReparsePoint` before file/directory classification; if the probe or query is unavailable/ambiguous, fail precreation and never mark `reparsePointAware`. [VERIFIED: locked local Windows rule; current fail-closed marker] |
| candidate creation | `mkdtemp(join(os.tmpdir(), prefix))`, immediately canonicalize, register opaque identity before returning, and let Phase 3 isolation validation reject unsafe temp placement. [VERIFIED: Phase 3–4 creation ownership] |
| source bounded scan | Open read-only without following where supported, verify file kind/containment, inspect size before allocation, return bytes only below the scan limit for text paths, and return binary/oversized/unreadable states exactly. [VERIFIED: Phase 4 scan contract and fixture helper precedent] |
| source/candidate integrity | Feed opened-handle chunk streams into `observeIdentityBoundIntegrityStream`; never give raw paths or whole-file buffers to orchestration. [VERIFIED: Phase 4 production hash primitive] |
| materialization | Validate canonical parent identity, create directories without overwrite, open destination files exclusively, copy from an opened accepted source identity, close handles, and revalidate resulting kind/containment. [VERIFIED: Phase 3 capability and fixture adapter pattern] |
| exact reconciliation | Explicitly walk and classify every candidate occurrence, retain duplicates until comparison, and return missing/unexpected/wrong-kind/invalid-identity issues. [VERIFIED: Phase 3–4 reconciliation contract] |
| cleanup | Remove the opaque owned candidate exactly once without `force` masking, then prove `lstat` reports absence; return strict identity/removal/absence facts. [VERIFIED: Phase 4 cleanup contract] |

The public local/fixture service should call `withAssembledReleaseCandidate` with an inspection callback that returns only a fixed inert marker such as `{ inspected: true }`. It should then discard that callback value and project the lifecycle domains into `ReleaseCandidateDetail`. This avoids returning a stale deleted root or inventing an additional artifact authority. [VERIFIED: Phase 4 callback-value remediation and locked durable-evidence rule]

Source immutability tests must snapshot both source trees before and after every success/failure scenario, including adapter exceptions and cleanup failure. Candidate absence must be asserted after every locally created candidate outcome. [VERIFIED: Phase 3–4 established tests and RCCL-05 matrix]

## Target-Native Remote PowerShell Design

Build one generated script for both SSH and PowerShell Remoting. Transport changes only invocation; the script and semantic JSON contract remain identical. [VERIFIED: locked remote parity]

The script should use this state flow:

1. Set noninteractive/silent preferences and initialize one versioned result state without writing to the pipeline. [VERIFIED: exact-one-JSON requirement]
2. Validate addon name and both installed addon roots before candidate creation. [VERIFIED: RCOP-02 inherited contract]
3. Explicitly inventory both roots in ordinal identity order, classify reparse/special entries before recursion, reject collisions/escapes, collect required-readiness and scan facts, and capture source-before topology/integrity. [VERIFIED: Phase 3–4 policy sequence]
4. Select the Windows target temporary directory internally, create one unique child, canonicalize it outside protected roots, and record an opaque in-script identity. [VERIFIED: RCFS-01 and locked remote design]
5. Materialize the fixed two-root layout using exclusive target-local file operations, then reconcile exact topology and file occurrences. [VERIFIED: RCFS-02, RCIN-04]
6. Compute candidate and source-after SHA-256 observations, exact manifest, ledger, coverage, and canonical combined digest from the same fixed policy constants. [VERIFIED: Phase 4 contracts]
7. In `finally`, attempt removal once only when creation identity exists, prove absence, compose cleanup precedence, sanitize the structured result, and emit one `ConvertTo-Json -Compress` document at sufficient depth. [VERIFIED: RCCL-01–04 and locked stdout rule]

Use .NET `FileStream` and `SHA256` for streamed hashing/copying, explicit ordinal sorting, `[IO.FileAttributes]::ReparsePoint` for reparse classification, and `[IO.Path]`/resolved provider paths for canonical containment. Suppress `New-Item`, `Remove-Item`, `Get-ChildItem`, and helper return output with assignment or `Out-Null`. Never emit `$_.Exception.Message`, `ScriptStackTrace`, file content, match content, absolute roots, environment/user/host values, or the generated script. [VERIFIED: locked evidence boundary; existing PowerShell builder shows the integration seam]

The script should emit complete evidence for expected policy blockers with process exit `0`; a nonzero exit is reserved for transport/script uncertainty and cannot represent a trustworthy complete lifecycle result. This keeps normal artifact blockers distinct from executor failure and lets the host parse complete evidence only when transport completed. [VERIFIED: locked separation of artifact truth and transport uncertainty]

Do not add a second post-failure cleanup command. If the transport fails after creation may have begun, the host lacks the opaque in-script identity and must report cleanup unknown/unverified. [VERIFIED: locked stale-candidate boundary]

## Dedicated Remote Executor and Sanitizer

Do not route this operation through `runRemoteCommand`. Add a preflight-specific executor that keeps private invocation fields internal and accepts injection for tests. Its public command evidence should be a fixed description such as `ssh remote-target preflight_release_candidate <redacted-script>` or `powershell-remoting remote-target preflight_release_candidate <redacted-script>`, plus exit outcome only. [VERIFIED: current `runRemoteCommand` leakage and locked sanitized-command rule]

For SSH, use only the existing target host/optional username as the runtime destination locator; do not load keys or credentials. For PowerShell Remoting, invoke the configured host without `-Credential`, username prompting, credential-store calls, or synthesized authorization. The current generic `buildRemoteCommand` behavior that appends `-Credential` when username exists must not be reused for this operation. [VERIFIED: `src/remote.ts`; locked authorization rule]

Sanitize the public target independently of the input target: fixture may return `{kind:"fixture", root:"[redacted]"}`, local may omit `dotaRoot`, and remote should preserve only kind/transport with fixed redacted name/host and no username or root. Paths are allowlisted relative identities, not generic redactions of arbitrary absolute paths. Logs contain only stable lifecycle categories, never raw stdout/stderr. [VERIFIED: locked returned-field rule and common target shape]

Apply the shared credential-segment sanitizer to all relative identity fields before serialization. For PowerShell, generate the exact secret-pattern/category and relative-segment policy from exported TypeScript constants where practical; otherwise maintain a single explicit parity fixture that feeds all credential-shaped categories through local and remote normalization and requires identical safe output. A final whole-result audit should reject, not heuristically repair, any private absolute path or credential-shaped value outside designated safe relative fields. [VERIFIED: Phase 3–4 sanitizer authority, locked remote policy parity, no-repair rule]

## Semantic Parity Matrix

Compare a canonical semantic projection that removes only `target`, transport command description, exit code, and contract-evidence label. Do not remove blockers, warnings, paths, operation state, artifact state, manifest, digest, ledger, coverage, cleanup, or boundaries. [VERIFIED: locked parity definition]

| Scenario | Fixture/local expectation | Mocked SSH/PowerShell expectation |
|---|---|---|
| success | Same passed artifact, manifest/digest, bijective ledger, complete coverage, verified cleanup, fixed boundaries, and no retained root. [VERIFIED: Phase 4 success contract] | Same semantic detail after strict host normalization; remote execution metadata differs only by transport. [VERIFIED: RCCL-05] |
| invalid addon or missing root | Precreation blocker, zero creation, cleanup not reached. [VERIFIED: RCOP-02] | Same semantic blocker; command construction may be skipped for invalid addon, while missing remote roots are target-native complete blockers if the script runs. [VERIFIED: locked remote lifecycle] |
| link/reparse/special/collision/escape | Deterministic safe blocker before materialization. [VERIFIED: RCFS-03] | Identical blocker code/order/path semantics from PowerShell attributes and path policy. [VERIFIED: RCCL-05] |
| source mutation | Artifact blocked, one cleanup, source not repaired. [VERIFIED: RCFS-05, RCIN-01] | Same target-native semantic result; no retry or recopy. [VERIFIED: locked remote rule] |
| metadata/sensitive/unreadable/oversized | Shared blocker/warning/coverage semantics, no secret values. [VERIFIED: RCFS-04, RCIN-05] | Same policy constants and safe paths; no contents/matches emitted. [VERIFIED: locked remote policy] |
| integrity/ledger mismatch | No manifest, complete deterministic discrepancy evidence, cleanup attempted once. [VERIFIED: RCIN-01–04] | Same normalized facts and overall failure. [VERIFIED: RCCL-04–05] |
| cleanup failure | Artifact truth preserved, overall false, no value/path. [VERIFIED: RCCL-02] | Same when complete JSON proves cleanup failure; transport loss instead reports cleanup unknown. [VERIFIED: RCCL-03–04] |
| malformed/version/digest/invariant payload | Not applicable to direct local facts; shared normalizer fixture rejects constructed invalid detail. [VERIFIED: locked one-normalizer design] | Explicit sanitized remote failure, no trusted nested facts, no fallback. [VERIFIED: RCCL-04] |
| executor throw/nonzero/timeout/extra output | Not applicable to direct local execution. [VERIFIED: target distinction] | Transport uncertain, cleanup unknown, overall false, raw output suppressed, no speculative cleanup. [VERIFIED: RCCL-04] |

## TDD Plan Implications

Use six independently reviewable slices with unique requirement ownership:

1. **MCP surface and compatibility — RCOP-01:** RED tests for schema, dispatcher, server/tool-list, structuredContent, example mapping, and complete `dry_run_release_report` compatibility; then add only registration/routing. [VERIFIED: current integration seams]
2. **Versioned detail and invariant authority — RCOP-03, RCOP-04:** RED matrices for immutable success/failure detail, mandatory boundaries, recomputed success, hostile shapes, canonical digest, ledger/coverage consistency, and no credential fields; then add pure schemas/normalizer/result projection. [VERIFIED: locked contract]
3. **Production fixture/local adapter:** RED tests that use the production adapter on macOS fixtures for complete lifecycle, source snapshots, exclusive creation, durable evidence, absence, and Windows reparse capability rejection; then implement the adapter without a fake algorithm. This plan is enabling infrastructure and need not duplicate requirement ownership. [VERIFIED: locked adapter decision]
4. **Target-native remote lifecycle — RCCL-03:** RED script/executor tests proving one target-local lifecycle, no transfer, no credential behavior, one compact JSON, finally cleanup, and sanitized command evidence; then implement the script builder and dedicated executor. [VERIFIED: locked remote design]
5. **Hostile remote normalization — RCCL-04:** RED matrices for nonzero/throw/timeout, empty/extra/malformed JSON, unsupported version, missing fields, invalid paths/digests/counts/order/boundaries, cleanup uncertainty, and zero-exit false success; then wire the shared normalizer with no fallback. [VERIFIED: locked strict parsing]
6. **Golden parity, docs, and end-to-end gate — RCCL-05:** RED semantic matrix across fixture, local adapter, mocked SSH, and mocked PowerShell; add docs/examples/plugin drift coverage and explicit contract-only disclaimers; run all quality gates. [VERIFIED: locked completion evidence]

Every implementation slice should commit the failing RED before GREEN, run focused tests, then run the complete suite and project verifiers. Review fixes require their own reproduced RED. [VERIFIED: root AGENTS instructions and Phase 3–4 execution pattern]

## Common Pitfalls

### Trusting adapter or payload success

The current remote preflight parsers accept optional fields and use payload `ok`/`error` directly. Reusing this shape would permit zero-exit false success, missing evidence, invalid digests, and cleanup contradictions. Use the new strict detail normalizer and recompute success. [VERIFIED: `RemotePreflightPayload` and current parse branches; RCCL-04]

### Leaking through the common result envelope

Even a clean detail can leak through `target`, `paths`, `commands`, `logs`, or `error.message`. The existing remote helper records full commands, stdout/stderr, target name, host, username, and roots. Sanitize every public envelope field for this operation and keep private transport state internal. [VERIFIED: `src/remote.ts`; locked returned-field rule]

### Treating cleanup failure as an artifact failure

Cleanup failure must not erase a valid manifest, and a valid manifest must not override cleanup failure. Preserve the independent artifact domain and force overall false. [VERIFIED: Phase 4 verification]

### Returning a deleted candidate path

The successful deliverable is the manifest plus cleanup proof. Never put the temporary root into `paths`, evidence, callback output, warnings, logs, or docs as an upload-ready location. [VERIFIED: locked release boundary and Phase 4 deep-review fix]

### Remote policy drift

A handwritten PowerShell copy of metadata keys, text extensions, scan limits, blocker codes, and canonical digest rules can drift. Export/generate constants where possible and require exact golden parity for everything else. [VERIFIED: local shared-policy constants and locked remote parity]

### Incidental PowerShell output

Uncaptured cmdlet output creates extra stdout and must invalidate the result. Assign or pipe every cmdlet result deliberately, and make the final compact JSON the sole pipeline output. [VERIFIED: exact-one-document rule]

### Reusing generic PowerShell credential behavior

The current generic transport can render `-Credential <username>`. Candidate preflight explicitly forbids prompting/loading/synthesizing credentials, so it requires a separate invocation path. [VERIFIED: `buildRemoteCommand`, `05-CONTEXT.md`]

### Claiming real Windows proof

Mocked PowerShell and a macOS production-adapter fixture prove contract behavior, not actual NTFS reparse, transport interruption, or Windows cleanup semantics. Keep the disclaimer in every normalized result and operator document. [VERIFIED: locked completion boundary]

### Broad catch-and-redact recovery

Do not turn malformed facts into defaults or scan arbitrary error text with heuristic replacements. Return stable category-only failures and omit unproven facts. [VERIFIED: no-silent-fallback/no-heuristic-repair rules]

## Validation Architecture

### Focused automated layers

- Schema/dispatcher/server tests: exact input fields, tool discoverability, `structuredContent`, and unchanged dry-run behavior. [VERIFIED: existing schema/tool/server patterns]
- Result-normalizer tests: strict versions, closed codes, deep freeze, safe target/path/evidence, manifest recomputation, ledger/coverage consistency, cleanup precedence, and boundary completeness. [VERIFIED: locked invariants]
- Production-adapter tests: real macOS filesystem fixtures through the production adapter, source snapshots, candidate absence, fault injection, and precreation capability failure. [VERIFIED: approved completion gate]
- PowerShell builder tests: stable generated policy constants, no credential flags/stores, one final JSON emission path, target-local temp/finally cleanup, no transfer commands, and no raw exception serialization. [VERIFIED: locked remote architecture]
- Remote contract tests: injected SSH/PowerShell executors for success, complete blocker payloads, malformed output, nonzero/throw/timeout, sanitizer attacks, and no local lifecycle invocation. [VERIFIED: current remote executor-test pattern]
- Golden parity tests: one scenario factory and semantic projector across all four target contracts. [VERIFIED: RCCL-05]
- Docs/plugin tests: checked fixture example, README, skill, remote reference, runbook, tool-list drift, forbidden credential patterns, and contract-only evidence language. [VERIFIED: current plugin/examples verifier patterns]

### Full quality gate

Run focused Phase 5 tests, `npm test`, `npm run typecheck`, `npm run build`, `npm run verify:plugin`, `npm run verify:same-machine-smoke`, `npm run verify:source-snapshot`, `npm run verify:install-simulation`, `npm run verify:rc`, `npm run verify:handoff`, the historical `npm run verify:milestone`, and `git diff --check`. Remove generated untracked `dist/release-candidate.js` after builds and keep `.planning/graphs/` untouched and unstaged. [VERIFIED: user task, Phase 3–4 verification practice, current package scripts]

### Security verification

Security enforcement is active for this phase. The relevant checks are strict input validation and closed schemas, safe error/log output, sensitive-data non-disclosure, filesystem path/resource safety, transport boundary separation, and API invariant enforcement. Tests should cover each field of the common envelope, not only the nested detail. [VERIFIED: AGENTS.md, locked remote sanitizer and filesystem constraints]

ASVS-aligned concerns for planning are: validation/sanitization, stored/returned data protection, error/log handling, file/resource handling, and API/web-service integrity. This phase does not claim formal ASVS certification; the categories are used only as a completeness checklist against the repository's explicit security boundary. [VERIFIED: project security requirements; no external compliance claim]

### Runtime State Inventory

This is not a rename/refactor phase. Existing tool names remain stable, `dry_run_release_report` remains registered and unchanged, the new operation is additive, no persisted runtime state is migrated, and no external credential/configuration store is introduced. [VERIFIED: `05-CONTEXT.md`]

## Project Constraints (from AGENTS.md)

- Keep v1 focused on plugin packaging, skill guidance, MCP schemas, addon generation/validation, local Windows, and remote Windows; defer TypeScript-to-Lua, React Panorama, Excel-to-KV, Workshop publishing, gameplay generators, and UI automation unless the roadmap changes. [VERIFIED: `AGENTS.md`]
- Return explicit failures with path/command evidence and never silently fall back for discovery, execution, launch, or validation. [VERIFIED: `AGENTS.md`]
- Use English identifiers and user-facing API names; use Chinese comments only when non-obvious logic needs clarification. [VERIFIED: `AGENTS.md` and root instructions]
- Prefer deterministic filesystem/process/command/log operations over desktop UI automation. [VERIFIED: `AGENTS.md`]
- Keep local and remote Windows behind the same MCP contracts and include target, operation, success, evidence, warnings, paths, commands, and logs when applicable. [VERIFIED: `AGENTS.md`]
- Never store GitHub tokens, remote credentials, Steam credentials, machine passwords, or private host data. [VERIFIED: `AGENTS.md`]
- Keep schema, fixture, and template tests runnable on macOS without Dota; validate real Dota paths before any real Windows launch; do not equate launch with validation. [VERIFIED: `AGENTS.md`]
- Run an independent review and record verification before closing implementation. [VERIFIED: `AGENTS.md`]
- State the approach before coding, use Spec Coding and TDD, reproduce bugs before fixing, iterate in low-coupling independently verifiable slices, and keep implementation and review separate. [VERIFIED: root AGENTS instructions]
- Let failures surface early; do not add fallback, defensive defaults, heuristic repair, retry-based recovery, or post-processing patches. [VERIFIED: root AGENTS instructions]
- Preserve minimum runnable/verifiable/reversible quality and prioritize critical paths and high-risk changes. [VERIFIED: root AGENTS instructions]
- Never run `/init`; do not use development-progress labels or AI product names in comments, commit messages, or PR text. [VERIFIED: root AGENTS instructions]
- Preserve existing `.planning/graphs/` modifications and exclude them from all Phase 5 changes and commits. [VERIFIED: user task and current `git status --short`]
- Do not push, open a PR, log into Steam, mutate Workshop state, upload, handle credentials, create persistent archives, sign, encrypt, compile/repair source, or perform destructive Git operations. [VERIFIED: user task and milestone scope]

## Resolved Open Questions

| Question | Resolution |
|---|---|
| Is a new package required? | No. Existing Node built-ins, Zod, TypeScript, Vitest, and target-native PowerShell cover the phase. [VERIFIED: repository stack and required architecture] |
| Should local/fixture use a simplified fake lifecycle? | No. Both use one production Node adapter and the Phase 4 orchestrator; only root/platform injection differs. [VERIFIED: locked decision] |
| Who chooses the candidate directory? | The adapter chooses `os.tmpdir()`/target temp internally and creates one unique child; callers never supply or retain it. [VERIFIED: locked decision and Phase 3 isolation contract] |
| How should local Windows prove reparse awareness without a native package? | Use a target-native Windows attribute observation and only set `reparsePointAware` after the capability succeeds; otherwise fail before creation. [VERIFIED: locked fail-closed rule; no new dependency decision] |
| Should the remote path call the local lifecycle after failure? | Never. Transport or payload failure is final and cleanup is unknown when identity was not proven. [VERIFIED: RCCL-04] |
| Can remote payload `ok` be trusted? | No. It may be omitted from the semantic authority or treated as non-authoritative; host normalization recomputes success. [VERIFIED: locked success rule] |
| Should complete artifact blockers use nonzero process exit? | No. A complete versioned blocker payload should exit zero; nonzero means transport/script uncertainty. [VERIFIED: artifact/transport separation derived from locked semantics] |
| What path evidence is safe? | Allowlisted normalized relative source/candidate identities only. Never expose absolute roots or the temporary candidate root. [VERIFIED: locked evidence boundary] |
| How is canonical digest parity maintained? | Export one TypeScript canonical helper/constants and test PowerShell output against exact vectors and the host recomputation. [VERIFIED: Phase 4 canonical contract and locked parity] |
| What is the completion proof? | macOS fixture, production local-adapter, mocked SSH, and mocked PowerShell contract tests plus full repository gates and docs; no real Windows claim. [VERIFIED: user task and `05-CONTEXT.md`] |

## Don't Hand-Roll

- Do not create a second local readiness, sanitizer, manifest, ledger, scan, or cleanup policy; reuse/export the Phase 3–4 authorities. [VERIFIED: shared-policy requirement]
- Do not use recursive copy as the lifecycle implementation; retain explicit classification, exclusive materialization, and exact reconciliation. [VERIFIED: Phase 3 contract]
- Do not parse remote payloads with `JSON.parse(...) as SomeType` plus optional fields; use strict shape plus semantic normalization. [VERIFIED: current weakness and RCCL-04]
- Do not return raw executor commands/stdout/stderr and then redact strings afterward; separate private invocation from public evidence at the type boundary. [VERIFIED: locked sanitizer design]
- Do not invent a retained archive, candidate download, cleanup retry, orphan scan, credential helper, build step, or source repair. [VERIFIED: milestone exclusions]

## Sources

### Primary repository evidence

- `AGENTS.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/research/SUMMARY.md`, and `05-CONTEXT.md` — milestone boundary, requirements, completion gate, and locked decisions. [VERIFIED: repository]
- Phase 3 context, research, six summaries, review/verification — validated input ordering, unsafe-entry handling, exact assembly, source immutability, sanitizer, and adapter-contract limitations. [VERIFIED: repository]
- Phase 4 context, research, six summaries, review/verification — streamed integrity, canonical manifest, occurrence ledger, coverage, acquisition ownership, cleanup precedence, and safe callback evidence. [VERIFIED: repository]
- `src/release-candidate.ts` and `src/release-readiness.ts` — current domain types, capabilities, policy constants, canonical evidence, sanitizer, and lifecycle orchestration. [VERIFIED: repository]
- `src/schemas.ts`, `src/tools.ts`, `src/server.ts`, `src/types.ts`, `src/result.ts` — public schema, registration, dispatcher, common envelope, and structuredContent seams. [VERIFIED: repository]
- `src/remote.ts`, `tests/remote.test.ts`, and `tests/remote-operations.test.ts` — injectable remote executor and PowerShell builder precedents plus the current permissive/leaky result boundary that must be isolated from this operation. [VERIFIED: repository]
- `tests/release-candidate.test.ts`, `tests/release-readiness.test.ts`, `tests/result.test.ts`, `tests/examples.test.ts`, and `tests/plugin.test.ts` — adversarial lifecycle fixtures, result expectations, example-schema mapping, and documented tool-list drift gates. [VERIFIED: repository]
- `package.json` — Node 20+, TypeScript, Zod, Vitest, MCP SDK, and all quality-gate commands; no new dependency required. [VERIFIED: repository]

### External sources

No external documentation was necessary for the planning questions because the phase is constrained by locked repository contracts and existing installed APIs. Real Windows runtime behavior remains explicitly unverified and is not claimed. [VERIFIED: research scope and completion boundary]

## Metadata

**Confidence breakdown:**

- Public MCP integration: HIGH — exact seams and drift tests exist. [VERIFIED: repository]
- Fixture/local production architecture: HIGH for the contract; MEDIUM for actual Windows reparse behavior until real runtime evidence exists. [VERIFIED: Phase 3–4 adapter boundary]
- Remote script and normalization architecture: HIGH for the locked contract and mocked execution seams; MEDIUM for live transport/NTFS behavior. [VERIFIED: repository and locked evidence boundary]
- Parity and test architecture: HIGH — required semantic matrix and current fixture/executor patterns are explicit. [VERIFIED: `05-CONTEXT.md`, tests]

**Research date:** 2026-07-16
**Valid until:** 2026-08-15; refresh if the Phase 4 domain types, remote executor, public target schema, or Phase 5 context changes. [VERIFIED: repository-local research metadata]

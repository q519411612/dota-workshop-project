# Phase 4: Integrity Manifest and Verified Cleanup - Research

**Researched:** 2026-07-15
**Domain:** Identity-bound byte integrity, deterministic manifests, exact inclusion ledgers, scan coverage, and mandatory verified cleanup
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- MCP schema/server/dispatcher exposure, fixture/local/SSH/PowerShell normalization, strict remote JSON payload parsing, and no-fallback transport failures belong to Phase 5.
- Real Windows reparse/canonicalization/cleanup evidence remains optional and must not be inferred from macOS adapters.
- Persistent candidates, archives, signing, encryption, upload/download, credentials, compilation, repair, and retention remain outside v1.14.
</user_constraints>

## Summary

Phase 4 should extend the existing opaque lease with two strict identity-bound observation capabilities: a streaming source-file integrity observation and a lease-bound candidate-file integrity observation. The adapter must open the accepted identity without following links, stream bytes into Node's SHA-256 implementation, count the exact streamed bytes, and return only a versioned observation whose identity, kind, and containment facts are all `true`. The orchestrator must parse every property inside the existing guarded normalization style and reject malformed objects, getters, proxies, iterators, thenables, impossible byte counts, non-lowercase/non-64-hex digests, missing identities, and duplicate identities. It must never fall back to raw path reads. [VERIFIED: `04-CONTEXT.md`, current `src/release-candidate.ts`, Phase 3 review and verification]

The manifest should be derived only after exact structural reconciliation and a one-to-one inclusion-ledger comparison. Use the already normalized candidate-relative identity and root provenance from the accepted inventory, sort by ordinal `(root, path)`, and hash a canonical UTF-8 JSON array made only from the schema version and fixed entry tuples. JSON arrays preserve field order and escape string boundaries, avoiding delimiter collisions without adding a package. Candidate observations, source-before observations, and source-after observations must agree on identity, byte count, and digest for every regular file; directories remain in structural reconciliation but never become manifest entries. [VERIFIED: RCIN-01 through RCIN-04, `04-CONTEXT.md`; CITED: https://nodejs.org/docs/latest-v20.x/api/crypto.html]

The lifecycle result must stop treating cleanup failure as a replacement for artifact outcome. Represent overall operation state, artifact-validation state, and cleanup evidence as separate immutable domains, then compute overall success from invariants: artifact validation passed, the inspection/callback path completed, and cleanup proved identity match, removal, and absence. A cleanup failure must preserve a previously passed artifact-validation record but force overall `ok: false` and remove any callback value or candidate path. Every branch after a valid lease is acquired must pass through one `finally` cleanup call, including strict-parser failures and thrown adapter operations. [VERIFIED: RCCL-01, RCCL-02, `04-CONTEXT.md`, current cleanup overwrite at `withAssembledReleaseCandidate`]

**Primary recommendation:** Add a versioned integrity-observation and cleanup-evidence state machine inside `release-candidate.ts`, keep hashing and candidate access inside the identity-bound adapter, and prove it with an adversarial macOS fixture matrix before any Phase 5 public or remote integration. [VERIFIED: phase boundary and current architecture]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Identity-bound source/candidate SHA-256 | Filesystem adapter | Domain service | Only the adapter owns an opened source identity or candidate lease; the domain service strictly parses observations and compares invariants. [VERIFIED: Phase 3 opaque capability contract and `04-CONTEXT.md`] |
| Manifest ordering and canonical digest | Domain service | Filesystem adapter | Canonical identity is pure host-independent data; adapters must not become policy authorities. [VERIFIED: RCIN-02, RCIN-03] |
| Inclusion ledger and structural reconciliation | Domain service | Filesystem adapter | The adapter observes the candidate; the service independently compares all expected and observed identities and retains empty-directory reconciliation. [VERIFIED: RCIN-04 and locked decisions] |
| Scan coverage and sensitive findings | Shared readiness policy | Filesystem adapter | `release-readiness.ts` already owns classification, required-text, sensitive matching, and sanitizer policy; adapters only return bounded observations. [VERIFIED: current `src/release-readiness.ts`, Phase 3 verification] |
| Cleanup execution and absence proof | Filesystem adapter | Domain service | Removal and absence are target-native identity operations; the service validates the entire result and applies overall-success precedence. [VERIFIED: existing lease cleanup contract, RCCL-01, RCCL-02] |

## Project Constraints (from AGENTS.md)

- Keep code identifiers and user-facing API names in English; add Chinese comments only for non-obvious logic. [VERIFIED: `AGENTS.md`]
- Prefer deterministic filesystem/process operations over UI automation and surface explicit errors with evidence; do not add fallback or heuristic repair. [VERIFIED: `AGENTS.md` and root project instructions]
- Do not store credentials, private host data, Steam data, tokens, or passwords. [VERIFIED: `AGENTS.md`]
- Keep schema, fixture, and template tests runnable on macOS without Dota; real Windows evidence is not the Phase 4 gate. [VERIFIED: `AGENTS.md`, `04-CONTEXT.md`]
- Keep fixture/local/remote behind one eventual contract, but do not expose MCP or remote behavior until Phase 5. [VERIFIED: `AGENTS.md`, roadmap ownership]
- Use TDD, reproduce failures before repair, run an independent review before closure, and keep changes runnable, verifiable, and reversible. [VERIFIED: root project instructions]
- Never compile or repair addon source as part of this feature, and never add Steam/Workshop mutation, upload, archive, signing, encryption, credential, retention, or transfer behavior. [VERIFIED: task boundary, `04-CONTEXT.md`]
- Preserve the user-owned `.planning/graphs/` modifications and do not include them in commits. [VERIFIED: task instruction and current `git status --short`]
- Do not use `/init`, destructive Git operations, AI product names, or development-progress labels in code comments, commits, or PR text. [VERIFIED: root project instructions]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| RCIN-01 | Block unless source-before, source-after, and candidate SHA-256 match for every copied file. | Identity-bound streaming observations, strict triple comparison, and no retry/repair sequence. |
| RCIN-02 | Return a schema-versioned, ordinal manifest entry per candidate file with provenance, normalized path, bytes, and lowercase SHA-256. | Fixed manifest types, strict digest grammar, inventory-derived identity, and ordinal tuple sorting. |
| RCIN-03 | Return a canonical combined digest independent of host/path/enumeration metadata. | Canonical UTF-8 JSON array of version plus fixed entry tuples only. |
| RCIN-04 | Block missing, duplicate, unexpected, or unmapped candidate entries. | Independent expected/observed multiset ledger plus existing structural reconciliation. |
| RCIN-05 | Report text, binary, unreadable, and oversized coverage while retaining binary and blocking unscannable required text. | Shared policy extension, fatal UTF-8 decode, exact coverage records, and inclusion/scan separation. |
| RCCL-01 | Return cleanup evidence after every post-creation outcome. | Single lease-acquisition boundary and one unconditional cleanup attempt in `finally`. |
| RCCL-02 | Force overall failure for unverified cleanup while retaining artifact-validation state. | Three-domain result model and explicit precedence matrix. |
</phase_requirements>

Descriptions above are copied from `.planning/REQUIREMENTS.md` in condensed form without changing their semantics. [VERIFIED: `.planning/REQUIREMENTS.md`]

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard Here |
|---|---|---|---|
| Node.js `node:crypto` `createHash("sha256")` and streams | Project requires `>=20`; local runtime v26.3.0 | Incremental SHA-256 without buffering complete addon files | Built in, already used for source snapshots, and accepts streamed chunks without a package. [VERIFIED: `package.json`, runtime probe, `src/source-snapshot.ts`; CITED: https://nodejs.org/docs/latest-v20.x/api/crypto.html] |
| Node.js file handles/streams and `TextDecoder` fatal UTF-8 | Project requires `>=20` | Bind reads to opened identities, count bytes, and distinguish invalid text from successfully scanned text | Existing fixtures already use no-follow `open`; fatal decoding prevents replacement-character acceptance of invalid required text. [VERIFIED: `tests/release-candidate.test.ts`; CITED: https://nodejs.org/docs/latest-v20.x/api/fs.html and https://nodejs.org/docs/latest-v20.x/api/util.html] |
| TypeScript | 5.9.3 installed | Versioned discriminated states, strict observations, ledgers, and result precedence | Current compiler and repository convention. [VERIFIED: `package-lock.json`] |
| Vitest | 3.2.6 installed | TDD fixture permutations and hostile adapter-result tests | Current suite already has controlled lifecycle and fault-injection seams. [VERIFIED: `package-lock.json`, `tests/release-candidate.test.ts`] |

### Supporting

| Existing asset | Purpose | Required use |
|---|---|---|
| `ReleaseCandidateSourceEntry` inventory | Canonical root/path/kind authority | Derive expected file identities and manifest provenance; never trust adapter-returned absolute paths. [VERIFIED: current source] |
| `createIdentityBoundCandidateLifecycle` | Opaque lease-to-target identity binding | Add source and candidate integrity operations here so raw paths never escape into orchestration. [VERIFIED: current source, locked decision] |
| `evaluateReleaseReadiness` and `sanitizeRelativeEvidenceIdentity` | Shared metadata, sensitive scan, required-text, and evidence redaction policy | Extend coverage reporting around this policy without duplicating regex or path sanitization. [VERIFIED: Phase 3 review] |
| Existing cleanup parser | Stable removal failure codes and identity/absence invariants | Preserve codes but return evidence instead of erasing artifact state. [VERIFIED: current `parseCandidateCleanupResult`] |

**Installation:** None. Phase 4 needs no new package. [VERIFIED: built-in coverage and user instruction]

## Package Legitimacy Audit

Not applicable: no external package is installed or recommended. [VERIFIED: Standard Stack]

## Architecture Patterns

### Lifecycle and Evidence Flow

```text
validated input + accepted inventory
                |
                v
identity-bound source-before hash observations
                |
                v
acquire opaque candidate lease  <---- post-create boundary
                |
                v
assemble + exact structural reconciliation
                |
                v
lease-bound candidate ledger/hash observations
                |
                v
identity-bound source-after hash observations
                |
                v
strict triple equality + exact inclusion ledger + scan coverage
                |
                v
artifactValidation = passed | blocked | not-reached
                |
                v
inspection/callback and final integrity revalidation
                |
                v
exactly one cleanup attempt + strict absence proof
                |
                v
overall ok = operation passed AND artifact passed AND cleanup verified
```

The adapter owns byte access; the domain service owns policy, comparison, canonicalization, and success. No public MCP or remote tier is introduced. [VERIFIED: Phase 3 architecture and `04-CONTEXT.md`]

### Recommended Project Structure

```text
src/
├── release-candidate.ts   # lifecycle, strict observation parsers, ledger, manifest, precedence
├── release-readiness.ts   # shared scan classification, required-text policy, sanitizer
└── source-snapshot.ts     # precedent only; do not reuse its host-bound manifest contract
tests/
├── release-candidate.test.ts
└── release-readiness.test.ts
```

Keep Phase 4 internal. A small pure manifest helper may be extracted from `release-candidate.ts` only if tests show that it reduces coupling; do not create a public schema module before Phase 5. [VERIFIED: locked phase boundary]

### Pattern 1: Strict Versioned Integrity Observation

Define one fixed observation version and accept only plain, fully validated facts:

```typescript
type FileIntegrityObservation = Readonly<{
  schemaVersion: "1.0";
  root: "game" | "content";
  path: string;
  bytes: number;
  sha256: string;
  identityMatched: true;
  kindMatched: true;
  contained: true;
}>;
```

The actual type name is discretionary, but the parser must require an exact supported version, a known root, the expected normalized path, a non-negative safe-integer byte count, `/^[0-9a-f]{64}$/`, and all three identity invariants. Unknown fields may be rejected to keep the adapter contract closed and version upgrades explicit. [VERIFIED: locked strict-versioned observation decision and existing guarded parser pattern]

The adapter should stream an opened file identity into `createHash("sha256")`, increment its own byte count from chunks, and compare before/after file-handle stats where available. It returns no raw bytes, absolute path, file handle, timestamp, mode, target identity, or exception. Source-before, candidate, and source-after must use the same observation shape and parser, with source operations bound to validated accepted entries and candidate operations bound to the opaque lease. [CITED: https://nodejs.org/docs/latest-v20.x/api/crypto.html; VERIFIED: scope exclusions and existing lease binding]

### Pattern 2: Triple Observation Sequence Without Retry

Capture one source-before observation for every inventory file before candidate creation. After exact assembly, obtain the complete candidate observation ledger through the lease and then obtain source-after observations through the validated source capability. Compare `(root, path, bytes, sha256)` exactly for all three sets. Any missing observation, parser failure, count mismatch, byte-count mismatch, or digest mismatch sets artifact validation to blocked; never recopy, retry, repair, or select a later observation as the baseline. [VERIFIED: RCIN-01 and locked no-retry decision]

Because the existing callback can observe or alter candidate state, run the candidate/source integrity comparison at the last point before cleanup as well as before callback use, or constrain the callback to read-only evidence produced by the integrity service. The safer incremental change is to retain callback compatibility and perform final lease-bound candidate plus source-after observations after it; callback failure still records artifact state as blocked and enters cleanup. [VERIFIED: current callback lifecycle and `04-CONTEXT.md` cleanup requirement]

### Pattern 3: Independent Exact Inclusion Ledger

Build `expectedFiles` from inventory entries where `kind === "file"`. Parse the adapter's candidate observation array without inserting directly into a `Map`: first retain every occurrence, sort by ordinal root/path, count exact occurrences, and then compare against expected identities. Emit deterministic blockers for missing, duplicate, unexpected, wrong-root/path, wrong-kind/unobserved, and invalid observations. Only after duplicate accounting may a unique lookup map be created. [VERIFIED: RCIN-04 and Phase 3 duplicate-review lesson]

Keep `reconcileCandidateTree` for every file and directory, including fixed prefixes and empty directories. Integrity ledger success and structural reconciliation success are separate required predicates: hashes cannot prove empty directories, while tree kinds cannot prove bytes. [VERIFIED: locked empty-directory decision]

Recommended evidence fields are `expectedFileCount`, `observedFileCount`, `matchedFileCount`, and deterministic blocker arrays. Do not truncate paths or entries; sanitize every emitted path through the shared sanitizer after internal comparison so redaction cannot collapse distinct internal identities. [VERIFIED: locked no-truncation and sanitizer decisions; Phase 3 internal/raw versus public/sanitized pattern]

### Pattern 4: Collision-Free Canonical Manifest Serialization

Use an array-only canonical form so key order and delimiter escaping cannot vary:

```typescript
const canonical = JSON.stringify([
  "1.0",
  entries.map(({ root, path, bytes, sha256 }) => [root, path, bytes, sha256])
]);
const combinedSha256 = createHash("sha256").update(canonical, "utf8").digest("hex");
```

Before serialization, sort entries with an explicit ordinal comparator over root then path; never use `localeCompare`. The combined digest includes only the schema version and fixed manifest fields. It excludes generated time, addon absolute root, temp root, target/host, permissions, timestamps, warnings, blockers, cleanup, scan coverage, and enumeration order. JSON array grammar makes adjacent strings and field boundaries unambiguous, unlike delimiter joining. [VERIFIED: RCIN-02, RCIN-03, `04-CONTEXT.md`; CITED: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify]

Test the canonical helper independently with delimiter/control/Unicode-containing safe relative identities, shuffled input, Windows-style source path fixtures normalized before entry creation, different temp roots, different host metadata, and duplicate rejection before hashing. [VERIFIED: phase specifics and digest exclusions]

### Pattern 5: Scan Coverage Is Not Inclusion Policy

For every accepted regular file, record exactly one coverage classification:

| Coverage class | Inclusion/hash | Text scan | Outcome |
|---|---|---|---|
| `text` | included and hashed | complete fatal UTF-8 decode and sensitive scan | evidence unless sensitive content blocks |
| `binary` | included and hashed | not decoded | evidence/warning only |
| `unreadable` | remains expected in ledger | not complete | blocker when required text; explicit warning/category otherwise |
| `oversized` | included and hashed | intentionally not complete | blocker when required text; explicit warning/category otherwise |

This table restates the locked policy: file extension/classification affects scanning only, never candidate inclusion or hashing. [VERIFIED: RCIN-05 and `04-CONTEXT.md`]

Extend the shared policy output or add a pure coverage aggregator beside it. Coverage should return total counts plus sorted sanitized relative-path lists for all four classes. Treat invalid UTF-8 as an explicit unreadable/invalid-text outcome by decoding with fatal mode; do not accept replacement characters as a complete scan. Reuse `MAX_SECRET_SCAN_BYTES`, `isReleaseTextPath`, required-text identities, sensitive categories, and `sanitizeRelativeEvidenceIdentity`. [VERIFIED: current readiness assets and locked invalid-text behavior; CITED: https://nodejs.org/docs/latest-v20.x/api/util.html]

The current `readAcceptedSourceFile` returns a hard lifecycle failure for read errors, so it cannot produce complete unreadable coverage. Phase 4 should version and broaden that identity-bound scan observation to distinguish `readable`, `oversized`, `unreadable`, and `invalid-encoding` without including raw errors; malformed observation objects remain adapter-contract failures. [VERIFIED: current `AcceptedSourceReadResult` and `parseAcceptedSourceRead`]

### Pattern 6: Artifact/Cleanup Precedence State Machine

Use separate result domains:

```typescript
type ArtifactValidation =
  | { status: "not-reached"; blockers: Blocker[] }
  | { status: "blocked"; blockers: Blocker[]; manifest?: Manifest; coverage?: ScanCoverage }
  | { status: "passed"; blockers: []; manifest: Manifest; coverage: ScanCoverage };

type CleanupEvidence = {
  attempted: boolean;
  attempts: 0 | 1;
  status: "not-required" | "verified" | "failed";
  identityMatched?: boolean;
  removed?: boolean;
  absent?: boolean;
  code?: string;
};
```

The exact names are discretionary. The invariants are not: before lease acquisition cleanup is `not-required`; after acquisition it is attempted once; verified cleanup requires all three booleans true; any false, missing, malformed, exceptional, unknown, or unsupported result is failed. Overall `ok` is true only when the operation path and artifact validation passed and cleanup is verified. [VERIFIED: RCCL-01, RCCL-02, locked decisions]

| Artifact validation | Cleanup | Overall | Artifact evidence retained | Candidate path/value returned |
|---|---|---|---|---|
| passed | verified | true | yes | no usable candidate artifact |
| passed | failed/unknown | false | yes, still `passed` | no |
| blocked/not-reached | verified | false | yes | no |
| blocked/not-reached | failed/unknown | false | yes | no |

This precedence matrix must be table-tested for success, readiness blocker after create, source-before/candidate/source-after hash failure, mismatch, copy failure, reconciliation failure, callback failure, malformed/throwing observation, cleanup false result, malformed cleanup, throwing cleanup, and absence-unverified cleanup. [VERIFIED: `04-CONTEXT.md` enumerated branches]

### Pattern 7: One Post-Creation Exit Funnel

After a valid opaque lease is acquired, initialize artifact and operation failure state, execute every post-create action inside `try`, normalize exceptions to stable codes, and call cleanup exactly once in `finally`. Merge cleanup evidence after `finally`; never return from inside a way that bypasses merge, and never call cleanup a second time to obtain better evidence. [VERIFIED: RCCL-01 and existing `finally` pattern]

Lease acquisition itself must be a strict boundary. The adapter factory should not expose a created directory without a cleanup-capable identity. If acquisition creates state and then cannot return a valid lease, the adapter operation must return versioned failure plus its own strict cleanup evidence or fail the overall operation as cleanup unknown; it may not report a precreation failure. Add a fixture case for a malformed/throwing acquisition result after simulated creation so the contract cannot silently orphan state. [VERIFIED: cleanup-after-creation requirement and current unparsed `created.identity`/`inspectionRoot` risk]

### Anti-Patterns to Avoid

- **Hashing raw paths in the domain service:** breaks identity binding and can reintroduce link/race/path escape behavior. [VERIFIED: locked adapter decision]
- **Keeping `bytes` in source observations:** current Phase 3 observations buffer entire files; Phase 4 requires streaming digests and exact byte counts instead. [VERIFIED: current `AcceptedSourceObservationResult`, user instruction]
- **Hashing during copy only:** one copy-time digest does not prove final candidate bytes or source-after bytes. [VERIFIED: RCIN-01]
- **Turning observations into a `Map` before duplicate counting:** silently overwrites duplicates. [VERIFIED: RCIN-04 and Phase 3 duplicate review]
- **Hashing `JSON.stringify` of object records:** object construction order can become an accidental protocol dependency; fixed nested arrays are narrower and explicit. [VERIFIED: canonical-field requirement]
- **Joining fields with `|`, newline, NUL, or path separators:** source identities can contain delimiter-like characters, creating ambiguous encodings. [VERIFIED: phase specific idea]
- **Using `localeCompare`:** locale is explicitly excluded from identity. [VERIFIED: RCIN-03]
- **Treating binary as skipped:** binary is included and hashed; only text scanning is skipped. [VERIFIED: RCIN-05]
- **Using UTF-8 replacement decoding as complete scan evidence:** invalid required text must block. [VERIFIED: locked scan decision]
- **Replacing artifact blockers with cleanup blockers:** loses the separate validation state required by RCCL-02. [VERIFIED: current overwrite behavior and RCCL-02]
- **Returning callback value after cleanup failure:** it can present stale or unsafe candidate data as usable. [VERIFIED: locked cleanup precedence]
- **Retrying hash/copy/cleanup:** retries can mix source states or weaken exactly-once cleanup evidence. [VERIFIED: locked no-retry decision]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| SHA-256 | Custom digest or shell command | Node `createHash("sha256")` over identity-bound streams | Built-in, incremental, lowercase hex output, no subprocess/path disclosure. [CITED: https://nodejs.org/docs/latest-v20.x/api/crypto.html] |
| File identity access | Domain-level `readFile(candidatePath)` | Existing opaque accepted-entry and lease-bound capability pattern | Keeps source/candidate access behind validated identity. [VERIFIED: Phase 3 architecture] |
| Canonical serialization | Delimiter concatenation or key-sorting framework | Fixed nested JSON arrays and UTF-8 bytes | Unambiguous field boundaries with no new dependency. [VERIFIED: RCIN-03 and discretion] |
| Duplicate reconciliation | `Set`/`Map` insertion alone | Occurrence list, ordinal sort, count, then unique lookup | Preserves exact duplicate evidence. [VERIFIED: Phase 3 review lesson] |
| UTF-8 validation | Replacement decoding or regex heuristics | Fatal `TextDecoder` | Invalid required text cannot masquerade as scanned. [CITED: https://nodejs.org/docs/latest-v20.x/api/util.html] |
| Secret matching/redaction | New regexes or value snippets | `release-readiness.ts` policy and sanitizer | One authority and no matched-value leakage. [VERIFIED: Phase 3 review] |
| Cleanup success | Process exit, narration, or path assumption | Strict lease identity + removed + absent observation | RCCL-02 requires proof, not intention. [VERIFIED: requirement] |

**Key insight:** Manifest generation is the final projection of independently proven identity, topology, bytes, and cleanup states; it must not itself be treated as proof. [VERIFIED: requirement decomposition]

## Common Pitfalls

### Pitfall 1: Whole-File Memory Retention
**What goes wrong:** Large accepted binary files are buffered multiple times for source stability and hashing. [VERIFIED: current observations retain `Uint8Array` bytes]
**Why it happens:** Phase 3 compares byte arrays as a strong fixture-era stability check. [VERIFIED: `sameSourceObservation`]
**How to avoid:** Replace file-byte observation with streamed byte count plus SHA-256 while retaining metadata/identity facts for directories. [VERIFIED: locked streaming requirement]
**Warning signs:** `readFile` or `Uint8Array.from(bytes)` occurs in production integrity observation. [VERIFIED: current implementation seam]

### Pitfall 2: Candidate Digest Captured Too Early
**What goes wrong:** The manifest describes candidate bytes before reconciliation or callback, while later mutation is not detected. [VERIFIED: current callback occurs before final source-only stability check]
**Why it happens:** Hashing is attached to copy rather than final artifact validation. [VERIFIED: RCIN-01 decomposition]
**How to avoid:** Observe candidate through the lease after structural reconciliation and at the final pre-cleanup validation point. [VERIFIED: locked artifact-validation boundary]
**Warning signs:** Candidate hash is returned directly by `materializeCandidateEntry`. [VERIFIED: adapter roles]

### Pitfall 3: Duplicate Observations Collapse
**What goes wrong:** Two candidate entries with the same identity become one manifest entry. [VERIFIED: RCIN-04 risk]
**Why it happens:** A map is used as the first parser data structure. [VERIFIED: Phase 3 exact-duplicate remediation]
**How to avoid:** Count raw strict observations before creating unique maps. [VERIFIED: recommended ledger]
**Warning signs:** `new Map(observations.map(...))` appears before duplicate validation. [VERIFIED: deterministic parser concern]

### Pitfall 4: Combined Digest Includes Host State
**What goes wrong:** Identical addon trees produce different digests under different temp roots, separators, timestamps, or hosts. [VERIFIED: RCIN-03]
**Why it happens:** The full result or object graph is serialized. [VERIFIED: excluded-field list]
**How to avoid:** Construct the canonical nested array explicitly from version/root/path/bytes/digest only. [VERIFIED: locked fields]
**Warning signs:** `generatedAt`, absolute path, cleanup, target, warnings, or stats appear in the canonical helper signature. [VERIFIED: excluded-field list]

### Pitfall 5: Invalid UTF-8 Counts as Scanned
**What goes wrong:** Required text contains undecodable bytes but is accepted after replacement decoding. [VERIFIED: locked invalid-text blocker]
**Why it happens:** `readFile(path, "utf8")` does not express fatal decoding in the existing fixture helper. [VERIFIED: current fixture reader]
**How to avoid:** Read bounded bytes identity-bound and use fatal decoding; return a stable invalid-text state with no raw bytes. [CITED: https://nodejs.org/docs/latest-v20.x/api/util.html]
**Warning signs:** Coverage marks text complete solely because a JavaScript string was returned. [VERIFIED: scan invariant]

### Pitfall 6: Cleanup Overwrites Artifact State
**What goes wrong:** A valid manifest disappears when removal fails, so callers cannot distinguish invalid artifact from valid artifact/failed cleanup. [VERIFIED: current `cleanupFailure ?? outcome`, RCCL-02]
**Why it happens:** Cleanup is modeled as another lifecycle blocker rather than a separate state domain. [VERIFIED: current types]
**How to avoid:** Merge cleanup evidence with artifact state and recompute only overall `ok`. [VERIFIED: precedence matrix]
**Warning signs:** A cleanup parser returns the same union type as artifact validation or replaces `outcome`. [VERIFIED: current implementation]

### Pitfall 7: Creation Throws After State Exists
**What goes wrong:** The orchestrator labels the result `CANDIDATE_CREATION_FAILED` without cleanup evidence even though the adapter created a directory. [VERIFIED: possible at current unguarded creation boundary; fixture contract must address it]
**Why it happens:** Cleanup ownership begins only after destructuring a successful creation result. [VERIFIED: current `createCandidateLease` flow]
**How to avoid:** Make acquisition return a strict lease-or-versioned-created-failure contract and test post-create malformed/throwing results. [VERIFIED: RCCL-01]
**Warning signs:** `createCandidateLease` can call host creation before an opaque identity is stored. [VERIFIED: existing factory order]

## Code Examples

### Streaming Hash Observation Inside the Adapter

```typescript
const hash = createHash("sha256");
let bytes = 0;
for await (const chunk of openedIdentityStream) {
  const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  bytes += data.byteLength;
  hash.update(data);
}
return { bytes, sha256: hash.digest("hex") };
```

The real adapter must surround this with no-follow identity opening, containment/kind checks, and strict sanitized failure mapping; the domain service must not receive the stream or handle. [CITED: https://nodejs.org/docs/latest-v20.x/api/crypto.html; VERIFIED: Phase 3 adapter boundary]

### Exact Triple Comparison

```typescript
const identity = `${expected.root}\u0000${expected.path}`;
const before = uniqueSourceBefore.get(identity);
const candidate = uniqueCandidate.get(identity);
const after = uniqueSourceAfter.get(identity);
if (!before || !candidate || !after ||
    before.bytes !== candidate.bytes || candidate.bytes !== after.bytes ||
    before.sha256 !== candidate.sha256 || candidate.sha256 !== after.sha256) {
  blockers.push(integrityMismatch(expected));
}
```

The NUL in this internal lookup key is not a serialization format; canonical manifest serialization remains the fixed JSON array. Internal lookup happens only after path validation and duplicate counting. [VERIFIED: recommended ledger distinction]

### Overall Result Merge

```typescript
const ok = operationPassed
  && artifactValidation.status === "passed"
  && cleanup.status === "verified";

return {
  ok,
  artifactValidation,
  cleanup,
  ...(ok ? { value: safeInspectionValue } : {})
};
```

Do not include a candidate root in `safeInspectionValue`; on any cleanup failure omit the value entirely. [VERIFIED: cleanup precedence decision]

## Validation Strategy

Nyquist validation artifacts are explicitly disabled in `.planning/config.json`, so no separate Validation Architecture section or Wave 0 artifact is required. TDD and phase verification remain mandatory under the user and project instructions. [VERIFIED: `.planning/config.json`, task instruction]

Plan focused RED/GREEN groups in this order:

1. Strict versioned source/candidate observation parser and streaming-digest grammar, including hostile getters/proxies/iterators/thenables and non-64-hex/uppercase/unsafe-count cases. [VERIFIED: existing hostile-parser pattern and RCIN-01]
2. Pure manifest canonicalization and host-independence permutations, including delimiter/control/Unicode paths, shuffled enumeration, alternate temp roots, separators, timestamps, modes, and locale changes. [VERIFIED: RCIN-02, RCIN-03]
3. Inclusion-ledger matrix for missing, exact duplicate, unexpected, wrong-kind, unobserved, wrong-root/path, and empty-directory reconciliation. [VERIFIED: RCIN-04]
4. Scan-coverage matrix for fully scanned text, legitimate binary, optional/required unreadable, optional/required oversized, invalid UTF-8, and sensitive text; assert every accepted file is still hashed and evidence is sanitized. [VERIFIED: RCIN-05]
5. Triple equality and mutation checkpoints before source-before, during copy, before candidate observation, before source-after, during callback, and before final cleanup; assert no retry or source write. [VERIFIED: RCIN-01 and source immutability]
6. Cleanup precedence table across every post-create success/failure plus malformed/exceptional acquisition and cleanup; assert exactly one call and separate artifact state. [VERIFIED: RCCL-01, RCCL-02]
7. Focused regression `npm test -- tests/release-candidate.test.ts tests/release-readiness.test.ts tests/preflight.test.ts tests/source-snapshot.test.ts`, then `npm run typecheck`, `npm run build`, `npm test`, `npm run verify:rc`, `npm run verify:source-snapshot`, `npm run verify:install-simulation`, and `git diff --check`. [VERIFIED: package scripts and Phase 3 gate pattern]

The fixture must vary enumeration order and temp-root name while holding logical content constant, and must prove manifest plus combined digest equality. It must also snapshot both source trees before and after success, validation blocker, hash failure, copy failure, callback failure, and cleanup failure. [VERIFIED: phase specifics and existing source snapshot test helper]

## Security Domain

Security enforcement is not disabled in `.planning/config.json`, so the applicable filesystem-integrity controls must remain explicit. [VERIFIED: `.planning/config.json`]

### Applicable ASVS Categories

| ASVS Category | Applies | Control |
|---|---|---|
| V2 Authentication | no | No identity/login surface is in Phase 4. [VERIFIED: scope boundary] |
| V3 Session Management | no | No session exists. [VERIFIED: scope boundary] |
| V4 Access Control | yes, filesystem capability | Opaque validated source handles and candidate leases prevent unvalidated raw-path authority. [VERIFIED: Phase 3 architecture] |
| V5 Validation and Sanitization | yes | Strict versioned parser, normalized relative identities, safe integer/digest grammar, exact ledgers, and shared sanitizer. [VERIFIED: locked decisions] |
| V6 Cryptography | yes, integrity only | Node SHA-256; no signing, encryption, or custom cryptography. [VERIFIED: RCIN requirements and scope] |
| V7 Error Handling and Logging | yes | Stable codes and safe relative categories; never serialize raw adapter exceptions, matched values, or private absolute paths. [VERIFIED: locked sanitizer decision] |
| V12 Files and Resources | yes | No-follow identity-bound access, exact topology, full inclusion ledger, cleanup once, and absence proof. [VERIFIED: Phase 3 and Phase 4 requirements] |

### Threat Patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| File swapped between path check and hash | Tampering | Hash through the opened identity-bound adapter operation and compare source-before/source-after/candidate. [VERIFIED: locked design] |
| Candidate observation omitted or duplicated | Tampering/Repudiation | Strict occurrence ledger before map construction. [VERIFIED: RCIN-04] |
| Host metadata changes digest | Repudiation | Canonical fixed-field serialization only. [VERIFIED: RCIN-03] |
| Secret leaks through error/path | Information disclosure | Shared sanitizer and stable error categories; serialization tests with runtime-built secrets. [VERIFIED: Phase 3 pattern] |
| Cleanup narration claims success | Spoofing/Repudiation | Require identityMatched, removed, and absent true in a strict versioned result. [VERIFIED: RCCL-02] |
| Oversized content causes memory pressure | Denial of service | Stream all hashes; size-gate text scanning; never truncate manifest evidence. [VERIFIED: locked streaming and scale decisions] |

## Environment Availability

Step 2.6 is skipped: Phase 4 adds code and macOS fixtures using the existing Node/TypeScript/Vitest environment and has no external service, Windows host, Dota installation, CLI, or new dependency requirement. Local Node v26.3.0 satisfies the declared Node `>=20` engine. [VERIFIED: runtime probe, `package.json`, phase completion boundary]

## Assumptions Log

No `[ASSUMED]` claims are used. Repository facts were inspected directly, and API behavior recommendations cite official runtime documentation. [VERIFIED: Sources below]

## Open Questions

None requiring product input. The phase CONTEXT locks canonical fields, scan behavior, cleanup precedence, evidence boundary, and scope. The planner may choose internal type names and fault-injection shapes only. [VERIFIED: `04-CONTEXT.md`]

## Sources

### Primary (HIGH confidence)

- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and `.planning/research/SUMMARY.md` — milestone scope, exact requirements, ownership, completion boundary, and prior architecture research. [VERIFIED: repository inspection]
- `.planning/phases/04-integrity-manifest-and-verified-cleanup/04-CONTEXT.md` — locked Phase 4 decisions and deferred scope. [VERIFIED: repository inspection]
- `.planning/phases/03-safe-candidate-assembly/03-CONTEXT.md`, `03-RESEARCH.md`, `03-VERIFICATION.md`, `03-REVIEW.md`, and `03-REVIEW-FIX.md` — inherited adapter, duplicate, sanitizer, source-stability, cleanup, and evidence-boundary lessons. [VERIFIED: repository inspection]
- `src/release-candidate.ts`, `src/release-readiness.ts`, `src/source-snapshot.ts`, and their tests — current identity-bound seams, whole-byte observation, policy classification, manifest precedent, strict-parser style, fault fixtures, and cleanup overwrite behavior. [VERIFIED: repository inspection]
- [Node.js 20 Crypto documentation](https://nodejs.org/docs/latest-v20.x/api/crypto.html) — incremental hashing and SHA-256 digest API. [CITED: official Node.js documentation]
- [Node.js 20 File System documentation](https://nodejs.org/docs/latest-v20.x/api/fs.html) — file handles, streams, and filesystem operations. [CITED: official Node.js documentation]
- [Node.js 20 Util documentation](https://nodejs.org/docs/latest-v20.x/api/util.html) — `TextDecoder` fatal decode behavior. [CITED: official Node.js documentation]
- [MDN `JSON.stringify`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) — JSON array serialization behavior. [CITED: MDN reference]

### Secondary (MEDIUM confidence)

- Installed package metadata and runtime probes — TypeScript 5.9.3, Vitest 3.2.6, Node v26.3.0, npm 11.16.0. [VERIFIED: local environment]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing built-ins and exact installed versions were verified; no dependency choice remains. [VERIFIED: runtime and package metadata]
- Architecture: HIGH — Phase 3 exposes the exact opaque adapter and cleanup seams, and Phase 4 decisions are locked. [VERIFIED: source and CONTEXT]
- Pitfalls: HIGH — each principal risk is visible in current code or explicit requirements and has a fixture-test seam. [VERIFIED: source, tests, requirements]
- Real Windows behavior: not claimed — macOS fixture and adapter-contract evidence is the completion boundary. [VERIFIED: `04-CONTEXT.md`]

**Research date:** 2026-07-15
**Valid until:** 2026-08-14

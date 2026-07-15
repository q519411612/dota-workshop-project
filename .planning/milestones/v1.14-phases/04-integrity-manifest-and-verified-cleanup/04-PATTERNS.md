# Phase 4: Integrity Manifest and Verified Cleanup - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 4 proposed modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/release-candidate.ts` | domain service / identity-bound provider | streaming and batch file-I/O lifecycle | current `src/release-candidate.ts`, with `src/source-snapshot.ts` as manifest precedent | exact self-pattern plus partial manifest match |
| `src/release-readiness.ts` | domain policy / utility | observations to deterministic findings and coverage | current `src/release-readiness.ts` | exact self-pattern |
| `tests/release-candidate.test.ts` | lifecycle / hostile-adapter contract test | temporary fixture, fault injection, cleanup verification | current `tests/release-candidate.test.ts` | exact self-pattern |
| `tests/release-readiness.test.ts` | pure policy unit test | table input to deterministic structured result | current `tests/release-readiness.test.ts` plus `tests/source-snapshot.test.ts` | exact self-pattern plus manifest assertion match |

Phase 4 does not need a public schema, MCP, dispatcher, remote, or PowerShell file. Research recommends keeping the manifest, inclusion ledger, observation parser, and precedence state machine internal to `release-candidate.ts`. Extract a focused internal pure module only if test pressure demonstrates that the lifecycle file cannot keep canonical serialization independently testable; do not invent a public module pre-Phase 5.

## Pattern Assignments

### `src/release-candidate.ts` (domain service / identity-bound provider, streaming and batch file-I/O)

**Primary analog:** current `src/release-candidate.ts`

#### Imports and dependency direction (`src/release-candidate.ts:1-12`)

```typescript
import { lstat, mkdtemp, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Stats } from "node:fs";
import { validateAddonName } from "./addon.js";
import {
  evaluateReleaseReadiness,
  isReleaseTextPath,
  MAX_SECRET_SCAN_BYTES,
  sanitizeRelativeEvidenceIdentity,
  type ReleaseReadinessFinding,
  type ReleaseReadinessInput
} from "./release-readiness.js";
```

Keep Node built-ins first, `.js` ESM imports, and one-way dependency from lifecycle to pure readiness policy. Add `createHash` from `node:crypto` only in the layer that owns canonical manifest digesting. The domain service must not import raw source/candidate read primitives; byte access remains adapter-owned.

#### Opaque identity-bound capability (`src/release-candidate.ts:228-256`, `258-305`)

```typescript
export type IdentityBoundCandidateLifecycle = Readonly<{
  [identityBoundCandidateLifecycleBrand]: true;
  identityBoundCleanup: true;
  identityBoundAssembly: boolean;
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<Readonly<{
    inspectionRoot: string;
    lease: ReleaseCandidateLease;
  }>>;
  cleanupCandidateLease(lease: ReleaseCandidateLease): Promise<CandidateLeaseCleanupResult>;
  readAcceptedSourceFile(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry,
    maxBytes: number
  ): Promise<AcceptedSourceReadResult>;
  observeAcceptedSourceEntry(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry
  ): Promise<AcceptedSourceObservationResult>;
  inspectCandidateRoot(lease: ReleaseCandidateLease): Promise<CandidateRootInspectionResult>;
  materializeCandidateEntry(
    lease: ReleaseCandidateLease,
    input: ValidatedReleaseCandidateInput,
    operation: CandidateMaterializationOperation
  ): Promise<CandidateMaterializationResult>;
  reconcileCandidateTree(
    lease: ReleaseCandidateLease,
    expected: CandidateExpectedEntry[]
  ): Promise<CandidateTreeReconciliationResult>;
}>;

const identities = new WeakMap<ReleaseCandidateLease, TIdentity>();
// ...
const lease = Object.freeze({ [releaseCandidateLeaseBrand]: true as const });
identities.set(lease, created.identity);
return Object.freeze({ inspectionRoot: created.inspectionRoot, lease });
```

Add source-file and lease-bound candidate-file integrity observations to this same capability factory. Continue hiding adapter identities in a `WeakMap`; do not expose candidate paths or let orchestration hash raw paths. Incomplete/default capability variants must remain fail-closed.

#### One post-creation exit funnel (`src/release-candidate.ts:515-579`)

```typescript
const observations = await captureSourceObservations(prepared.value, inventory.entries, lifecycle);
if (!observations.ok) return observations;
// ... all precreation gates precede lease acquisition
let created: Awaited<ReturnType<BoundCandidateLifecycle["createCandidateLease"]>>;
try {
  created = await lifecycle.createCandidateLease(prepared.value);
} catch {
  return lifecycleBlocked("CANDIDATE_CREATION_FAILED", "creation");
}

let outcome: ReleaseCandidateLifecycleResult<T>;
let cleanupFailure: ReleaseCandidateLifecycleResult<never> | undefined;
try {
  outcome = await inspectCandidateLease(/* bound lease and accepted inventory */);
} finally {
  cleanupFailure = await parseCandidateCleanupResult(
    async () => await lifecycle.cleanupCandidateLease(created.lease)
  );
}
return cleanupFailure ?? outcome;
```

Preserve the single lease-acquisition boundary and exactly one cleanup call in `finally`, but replace the current overwrite-only return with the Phase 4 three-domain result: operation outcome, `artifactValidation`, and `cleanup`. Cleanup failure must force overall failure while retaining whether artifact validation passed. No callback value or usable candidate path may survive failed/unknown cleanup.

#### Strict guarded normalization (`src/release-candidate.ts:1173-1203`)

```typescript
async function parseCandidateCleanupResult(
  cleanup: () => Promise<CandidateLeaseCleanupResult>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await cleanup();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_CLEANUP_RESULT_INVALID", "removal");
    }

    const ok = Reflect.get(result, "ok");
    const removed = Reflect.get(result, "removed");
    const absent = Reflect.get(result, "absent");
    const identityMatched = Reflect.get(result, "identityMatched");
    if (ok === true && removed === true && absent === true && identityMatched === true) {
      return undefined;
    }
    // ... validate the closed failure code union
  } catch {
    return lifecycleBlocked("CANDIDATE_CLEANUP_RESULT_INVALID", "removal");
  }
  return lifecycleBlocked("CANDIDATE_CLEANUP_RESULT_INVALID", "removal");
}
```

Copy this guarded boundary for every versioned integrity observation and candidate observation collection: await inside `try`, reject null/non-object, access hostile properties through guarded `Reflect.get`, validate exact literals and safe integers, and map all exceptional/malformed cases to stable sanitized blockers. For arrays, preserve occurrences before constructing any `Map`; getters, proxies, iterators, thenables, malformed discriminants, uppercase/non-64-hex digests, and impossible byte counts must fail closed.

#### Independent topology reconciliation (`src/release-candidate.ts:215-226`)

```typescript
export type CandidateTreeReconciliationResult =
  | Readonly<{ ok: true; exact: true; identityMatched: true }>
  | Readonly<{
      ok: false;
      code: "CANDIDATE_TREE_MISMATCH" | "CANDIDATE_TREE_RECONCILIATION_FAILED";
      issues?: Array<Readonly<{
        code: "CANDIDATE_TREE_MISSING" | "CANDIDATE_TREE_UNEXPECTED" | "CANDIDATE_TREE_WRONG_KIND" | "CANDIDATE_TREE_IDENTITY_INVALID";
        path: string;
        kind?: "file" | "directory";
      }>>;
    }>;
```

Retain this as a separate required predicate from the integrity ledger. It proves fixed prefixes and empty directories; hashes cannot. Add a file-only expected/observed occurrence ledger derived from accepted inventory, rejecting missing, duplicate, unexpected, wrong-kind, or unobserved entries before unique lookup construction.

#### Manifest precedent only (`src/source-snapshot.ts:137-179`, `259-267`)

```typescript
const bytes = await readFile(absolutePath);
snapshotFiles.push({
  path: file,
  bytes: bytes.byteLength,
  sha256: createHash("sha256").update(bytes).digest("hex")
});
// ...
files: snapshotFiles.sort((left, right) => comparePath(left.path, right.path)),

function comparePath(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
```

Reuse lowercase SHA-256 grammar, forward-slash relative identities, and explicit ordinal comparison. Do **not** copy whole-file buffering, host filesystem reads, generated timestamps, commit/branch, absolute roots, or object-record serialization. Phase 4 entries are fixed `{schemaVersion, root, path, bytes, sha256}` facts and the combined digest should hash a fixed nested-array JSON serialization after root/path ordinal sorting.

### `src/release-readiness.ts` (domain policy / utility, transform)

**Analog:** current `src/release-readiness.ts`

#### Closed scan observation union (`src/release-readiness.ts:84-103`)

```typescript
export type ReleaseReadinessInput = {
  requiredPaths: Array<{
    label: RequiredPathLabel;
    present: boolean;
    kind?: "file" | "directory";
    expectedKind?: "file" | "directory";
  }>;
  metadata:
    | { state: "missing" }
    | { state: "readable"; content: string }
    | { state: "oversized" | "unreadable"; path: string };
  scanRoots: Array<{
    root: ScanRootIdentity;
    files: Array<
      | { relativePath: string; state: "text"; content: string; requiredText?: boolean }
      | { relativePath: string; state: "non-text"; requiredText?: boolean }
      | { relativePath: string; state: "oversized" | "unreadable"; requiredText?: boolean }
    >;
  }>;
};
```

Version/broaden the observation state deliberately to distinguish fully scanned text, included binary, unreadable, oversized, and invalid encoding where necessary. Classification controls scanning only: every regular file still participates in assembly and integrity hashing.

#### Deterministic classification and required-text precedence (`src/release-readiness.ts:195-251`)

```typescript
if (file.state === "text") {
  for (const category of sensitiveCategories(file.content)) {
    findings.push({ code: "SENSITIVE_MATERIAL", category, disposition: "blocker", path });
  }
  return;
}

if (file.state === "non-text") {
  findings.push({ code: "NON_TEXT_INCLUDED", category: "non-text", disposition: "warning", path });
  return;
}

findings.push(
  file.requiredText === true
    ? { code: "REQUIRED_TEXT_UNREADABLE", category: "unreadable-required-text", disposition: "blocker", path }
    : { code: "TEXT_UNREADABLE", category: "unreadable", disposition: "warning", path }
);
```

Build scan coverage from the same canonical observations rather than duplicating extension, required-text, or sensitivity rules. Return exact counts and sorted safe paths for each category. Invalid required UTF-8 must be a blocker, not successful replacement-character decoding.

#### Sanitized evidence after internal comparison (`src/release-readiness.ts:254-269`)

```typescript
function safeFindingPath(path: string): string | undefined {
  if (path.length === 0 || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(path)) {
    return undefined;
  }
  if (path.includes("\\") || path.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return undefined;
  }
  return sanitizeRelativeEvidenceIdentity(path);
}

export function sanitizeRelativeEvidenceIdentity(identity: string): string {
  return identity
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => (sensitiveCategories(segment).length > 0 ? "[redacted]" : segment))
    .join("/");
}
```

Keep raw validated identities for exact ledger comparison, then sanitize only emitted evidence. Never compare redacted identities because distinct source paths can collapse to the same public string.

#### Locale-independent stable order (`src/release-readiness.ts:300-324`)

```typescript
return [...input].sort((left, right) => {
  const leftKey = scanFileSortKey(left);
  const rightKey = scanFileSortKey(right);
  for (let index = 0; index < leftKey.length; index += 1) {
    const comparison = compareOrdinal(leftKey[index], rightKey[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
});

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
```

Use this comparator for coverage and blocker ordering. Never use `localeCompare` in manifest identity or evidence order.

### `tests/release-candidate.test.ts` (lifecycle / hostile-adapter contract test, fixture and fault injection)

**Analog:** current `tests/release-candidate.test.ts`

#### macOS no-follow fixture capability (`tests/release-candidate.test.ts:143-167`)

```typescript
const handle = await open(
  join(sourceRoot, ...relativePath.split("/")),
  filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW
);
try {
  const info = await handle.stat();
  if (!info.isFile()) return { ok: false as const, code: "SOURCE_FILE_IDENTITY_CHANGED" as const };
  if (info.size > maxBytes) return { ok: true as const, state: "oversized" as const, size: info.size, identityMatched: true as const, kindMatched: true as const, contained: true as const };
  return { ok: true as const, state: "readable" as const, size: info.size, content: await handle.readFile("utf8"), identityMatched: true as const, kindMatched: true as const, contained: true as const };
} finally {
  await handle.close();
}
```

Extend this controlled capability with streaming SHA-256 source and lease-bound candidate observations. Count chunks/bytes in the adapter and return strict facts only. Tests should vary enumeration and temporary roots while asserting identical manifest/digest.

#### Injectable identity-bound lifecycle (`tests/release-candidate.test.ts:204-210`, `301-338`)

```typescript
function createFixtureIdentityBoundCandidateLifecycle<TIdentity extends object>(operations: {
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<{ inspectionRoot: string; identity: TIdentity }>;
  cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
  // focused operation overrides
}) { /* defaults */ }

const expectedMap = new Map(expected.map((entry) => [entry.path, entry.kind]));
const actualMap = new Map(actual.map((entry) => [entry.path, entry.kind]));
// compare missing, wrong-kind, and unexpected topology
```

Preserve default-realistic operations plus narrow overrides/checkpoints. For the new integrity ledger, deliberately do **not** copy the `Map`-first fixture pattern: retain occurrence arrays and test duplicates before constructing lookup maps.

#### Exactly-once cleanup assertions (`tests/release-candidate.test.ts:1191-1211`, `1566-1613`)

```typescript
expect(successfulResult).toEqual({ ok: true, value: "inspected" });
expect(successfulLifecycle.createCandidateLease).toHaveBeenCalledTimes(1);
expect(successfulLifecycle.cleanupCandidateLease).toHaveBeenCalledTimes(1);
expect(successfulLifecycle.writes.map(({ operation }) => operation)).toEqual(["create", "remove"]);
await expect(lstat(successfulRoot)).rejects.toMatchObject({ code: "ENOENT" });

expect(result).toEqual({
  ok: false,
  blockers: [{ code: "CANDIDATE_CLEANUP_RESULT_INVALID", category: "removal" }]
});
expect(JSON.stringify(result)).not.toContain(fixture.root);
expect(JSON.stringify(result)).not.toContain("private-value");
```

Turn these into a precedence table covering artifact passed/blocked/not-reached against cleanup verified/failed/malformed/throwing/absence-unverified. Assert one cleanup attempt for success, copy/read/hash failure, mismatch, reconciliation failure, callback failure, and hostile results; assert zero only before actual creation. Verify valid manifest/coverage evidence remains visible after cleanup failure while callback values and usable candidate locations do not.

#### One-shot mutation/fault matrix (`tests/release-candidate.test.ts:2899-2981`)

```typescript
type MutationCheckpoint = "lease" | "before-copy" | "after-copy" | "reconcile" | "callback";
// ... each scenario calls mutateOnce()
expect(result, scenario.name).toEqual({
  ok: false,
  blockers: [{ code: "SOURCE_CHANGED_DURING_ASSEMBLY", category: "assembly" }]
});
expect(mutationAttempts, scenario.name).toBe(1);
expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
```

Reuse this table-driven checkpoint style for source-before, candidate, source-after, and final revalidation. Add missing/duplicate/unexpected observations, byte-count/digest mismatches, binary bytes, invalid UTF-8, unreadable/oversized text, shuffled order, temp-root independence, malformed collection iterators, and cleanup precedence. Never retry, recopy, repair, or take a second cleanup observation.

### `tests/release-readiness.test.ts` (pure policy unit test, transform)

**Analogs:** current `tests/release-readiness.test.ts` and `tests/source-snapshot.test.ts`

Use direct literal `ReleaseReadinessInput` fixtures, exact structured-result equality, reversed-input equality, and serialized redaction assertions. The existing readiness suite establishes the crucial invariant:

```typescript
const ordered = evaluateReleaseReadiness(input([first, second]));
const reversed = evaluateReleaseReadiness(input([second, first]));

expect(reversed).toEqual(ordered);
expect(JSON.stringify(ordered)).not.toContain(firstCredential);
expect(JSON.stringify(ordered)).not.toContain(secondCredential);
```

Use the snapshot suite's digest grammar and path-independence assertion (`tests/source-snapshot.test.ts:46-60`) without inheriting its host metadata:

```typescript
expect(paths).toEqual([...paths].sort());
expect(paths.every((path) => !path.startsWith(root))).toBe(true);
expect(manifest.manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
```

Add pure coverage cases ensuring each accepted regular file has exactly one classification, binary remains included, required invalid/unreadable/oversized text blocks, and safe path lists remain ordinal and untruncated.

## Shared Patterns

### Strict external-result boundary

**Source:** `src/release-candidate.ts:1173-1203`
**Apply to:** source integrity, candidate integrity, collection parsing, cleanup proof.

All adapter values are hostile until parsed. Catch invocation, await, getters/proxies, iterators, and field access; accept only exact supported versions and closed literals. Raw exceptions or adapter-provided narration never enter evidence.

### Raw identity internally, sanitized identity externally

**Source:** `src/release-readiness.ts:254-269`
**Apply to:** manifest/ledger blockers, scan coverage, cleanup evidence.

Perform exact comparisons before redaction. Emit only safe root-relative identities, stable codes, counts, and categories. Do not emit matched content, absolute paths, target/host identity, temp names, or exception messages.

### Ordinal deterministic ordering

**Source:** `src/release-readiness.ts:300-324`; `src/source-snapshot.ts:259-267`
**Apply to:** manifest entries, occurrence ledger, coverage lists, blockers.

Sort explicit root/path tuples with `<`/`>` comparisons. Do not use filesystem enumeration order or locale-sensitive comparison.

### Separate proof domains

**Sources:** `src/release-candidate.ts:215-226`, `515-579`
**Apply to:** topology, byte integrity, readiness/coverage, cleanup.

Tree reconciliation proves directories and kinds; the occurrence ledger proves one candidate file per accepted source file; triple hashes prove byte identity; readiness proves metadata and scan policy; cleanup proves identity-bound removal and absence. Overall success requires all domains, but one domain's evidence must not overwrite another's state.

## Do Not Copy

- `src/source-snapshot.ts` host-bound `readFile` hashing, timestamp/commit/branch fields, selected-source traversal, or manifest object serialization.
- `src/install-simulation.ts` recursive `cp`, optional cleanup, cleanup inferred only through `access`, or its result's retained temporary path.
- Current Phase 3 whole-byte `AcceptedSourceObservationResult.bytes`; Phase 4 requires streamed digest plus exact byte count.
- Any `Map`/`Set` insertion before duplicate occurrence accounting.
- Current cleanup-overwrites-outcome return, which loses artifact-validation state.
- UTF-8 replacement decoding, binary-as-skipped inclusion, delimiter-joined canonicalization, `localeCompare`, retries, fallback host reads, or source repair.

## No Analog Found

No required file lacks an analog. There is no existing exact collision-free combined-manifest serializer or three-domain artifact/cleanup result; implement those inside `src/release-candidate.ts` from the fixed nested-array serialization and precedence matrix in `04-RESEARCH.md`, while preserving the analog boundaries above.

## Metadata

**Analog search scope:** `src/`, `tests/`, Phase 3 patterns/review/verification, Phase 4 context/research
**Strong analog files read:** `src/release-candidate.ts`, `src/release-readiness.ts`, `src/source-snapshot.ts`, `src/install-simulation.ts`, `tests/release-candidate.test.ts`, `tests/release-readiness.test.ts`, `tests/source-snapshot.test.ts`, `tests/install-simulation.test.ts`
**Pattern extraction date:** 2026-07-15

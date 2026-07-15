# Phase 3: Safe Candidate Assembly - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 6 proposed files
**Analog families found:** 5 / 5 requested areas

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/release-readiness.ts` | domain policy / utility | file-I/O observations to structured findings | `src/preflight.ts` | exact policy source; extraction target |
| `src/release-candidate.ts` | domain service / provider | callback-scoped file-I/O lifecycle | `src/install-simulation.ts` plus `src/source-snapshot.ts` | composite role match |
| `src/preflight.ts` | service / compatibility renderer | request-response over filesystem inspection | current `src/preflight.ts` plus `src/result.ts` | exact self-pattern |
| `tests/release-readiness.test.ts` | unit/fixture test | fixture input to deterministic policy result | `tests/preflight.test.ts` plus `tests/source-snapshot.test.ts` | composite role match |
| `tests/release-candidate.test.ts` | lifecycle/adapter-contract test | temporary fixture setup, callback inspection, teardown | `tests/install-simulation.test.ts` plus `tests/source-snapshot.test.ts` | composite role match |
| `tests/preflight.test.ts` | characterization/regression test | fixture target to public `ToolResult` | current `tests/preflight.test.ts` plus `tests/result.test.ts` | exact self-pattern |

## Strong Analog Families

### 1. Temporary isolation and explicit filesystem blockers

**Source:** `src/install-simulation.ts`

Use its Node built-in import style, compact domain-owned result types, canonical containment helpers, non-dereferencing link check, safe relative evidence, and `finally`-owned removal. Do not copy its creation order or recursive-copy call.

**Imports and internal result shape** (`src/install-simulation.ts:1-24`):

```typescript
import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

export type InstallSimulationBlocker = {
  code: string;
  message: string;
  path?: string;
  category?: string;
};

export type InstallSimulationResult = {
  ok: boolean;
  evidence: string[];
  warnings: string[];
  blockers: InstallSimulationBlocker[];
  paths: Record<string, string>;
  cleanup: InstallSimulationCleanup;
};
```

**Callback-lifetime precursor and cleanup ownership** (`src/install-simulation.ts:75-124`):

```typescript
try {
  const canonicalRoot = await canonicalPath(root);
  const canonicalSimulationRoot = await realpath(simulationRoot);
  if (isPathInside(canonicalSimulationRoot, canonicalRoot)) {
    blockers.push({
      code: "SIM_ROOT_NOT_ISOLATED",
      message: "Install simulation root must not be inside the repository source tree.",
      path: "simulationRoot"
    });
  } else {
    evidence.push("install simulation root is isolated");
    await copySimulationEntries(root, canonicalRoot, simulationRoot, blockers);
  }
} finally {
  if (cleanupEnabled) {
    await rm(simulationRoot, { recursive: true, force: true });
    cleanup.removed = !(await pathExists(simulationRoot));
  }
}
```

Phase 3 should retain the ownership shape but move all input/root/canonical checks before `mkdtemp`, invoke the inspection callback only after both trees are assembled, and always remove after callback success or failure.

**Link rejection and canonical containment** (`src/install-simulation.ts:155-194`):

```typescript
const stats = await lstat(path);
const relativePath = toRelativePath(root, path);
if (stats.isSymbolicLink()) {
  blockers.push({
    code: "SIM_SYMBOLIC_LINK_UNSUPPORTED",
    message: "Simulation source contains a symbolic link.",
    path: relativePath
  });
  return false;
}

const resolvedPath = await realpath(path);
if (!isPathAtOrInside(resolvedPath, canonicalRoot)) {
  blockers.push({
    code: "SIM_SOURCE_OUTSIDE_ROOT",
    message: "Simulation source resolves outside the repository root.",
    path: relativePath
  });
  return false;
}
```

**Containment and normalized evidence helpers** (`src/install-simulation.ts:365-375`):

```typescript
function isPathInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

function isPathAtOrInside(child: string, parent: string): boolean {
  return child === parent || isPathInside(child, parent);
}

function toRelativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}
```

**Do not copy:** `createSimulationRoot` at lines 127-130 creates the temporary directory before validation, and `cp(..., { recursive: true })` at lines 150-151 bypasses Phase 3's required per-entry classify/revalidate/copy gates.

### 2. Deterministic relative identity and byte observation

**Source:** `src/source-snapshot.ts`

Use its forward-slash identities, locale-independent comparator, stable structured blocker fields, explicit byte reads, and fixture-controlled determinism. Extend the traversal model to include directories; do not copy its file-only filtering.

**Structured file and blocker observations** (`src/source-snapshot.ts:19-48`):

```typescript
export type SourceSnapshotFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type SourceSnapshotBlocker = {
  code: string;
  path?: string;
  field: string;
  category: string;
};

export type SourceSnapshotManifestResult = {
  ok: boolean;
  manifest: SourceSnapshotManifest;
};
```

**Explicit byte observation and safe sensitive evidence** (`src/source-snapshot.ts:137-156`):

```typescript
const files = await collectSourceFiles(root);
const snapshotFiles: SourceSnapshotFile[] = [];
for (const file of files) {
  const absolutePath = join(root, file);
  const bytes = await readFile(absolutePath);
  snapshotFiles.push({
    path: file,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });

  const sensitive = await scanFileForSensitiveMaterial(absolutePath);
  if (sensitive) {
    blockers.push({
      code: "SENSITIVE_MATERIAL_FOUND",
      path: file,
      field: "content",
      category: sensitive
    });
  }
}
```

Phase 3 may use stat/byte observations for source-change detection, but deterministic SHA-256 reconciliation and manifests remain Phase 4 scope.

**Sorted traversal and normalized identity** (`src/source-snapshot.ts:219-267`):

```typescript
const entries = await readdir(absolutePath, { withFileTypes: true });
for (const entry of entries.sort((left, right) => comparePath(left.name, right.name))) {
  const childPath = `${sourcePath}/${entry.name}`;
  if (entry.isDirectory()) {
    await collectPath(root, childPath, files);
  } else if (entry.isFile()) {
    files.push(toRepositoryPath(childPath));
  }
}

function comparePath(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function toRepositoryPath(path: string): string {
  return path.split(sep).join("/");
}
```

**Do not copy:** the current walker uses `stat`, trusts `Dirent` for child types, omits empty directories, and skips selected names. Candidate assembly must use adapter `lstat` classification, preserve every accepted directory/file, and revalidate immediately before each use.

### 3. Readiness policy and compatibility renderer

**Source:** `src/preflight.ts`

This is the authoritative extraction source for `release-readiness.ts`. Keep metadata keys, placeholder classification, required-path order, text extension policy, scan limit, secret labels, evidence ordering, warning ordering, blocker count, and public `ToolResult` behavior character-for-character compatible.

**Imports and public request-response convention** (`src/preflight.ts:1-15`):

```typescript
import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { validateAddonName } from "./addon.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { Target, ToolResult } from "./types.js";
```

**Validation before filesystem inspection** (`src/preflight.ts:106-132`):

```typescript
const operation = "dry_run_release_report";
const nameValidation = validateAddonName(input.addonName);
if (!nameValidation.ok) {
  return createFailureResult({
    target: input.target,
    operation,
    error: {
      code: "INVALID_ADDON_NAME",
      message: nameValidation.error ?? "Invalid addon name."
    },
    evidence: [`rejected release report addon name: ${input.addonName}`]
  });
}

const root = targetRoot(input.target);
if (!root) {
  return createFailureResult({
    target: input.target,
    operation,
    error: {
      code: "TARGET_ROOT_REQUIRED",
      message: "Release dry run requires a fixture root or target Dota root."
    },
    evidence: ["target did not include a Dota root"]
  });
}
```

**Compatibility-sensitive orchestration and rendering** (`src/preflight.ts:134-171`):

```typescript
const paths = preflightPaths(root, input.addonName);
const blockers: string[] = [];
const warnings = releaseBoundaryWarnings();
const evidence: string[] = [];

await appendPackageReadiness(evidence, blockers, paths);
await appendMetadataReadiness(evidence, blockers, paths.addonInfo);
await appendSecretScan(evidence, blockers, warnings, paths.gameAddon, paths.gameAddon);
await appendSecretScan(evidence, blockers, warnings, paths.contentAddon, paths.contentAddon);

evidence.push(`release blockers: ${blockers.length}`);
evidence.push(`release warnings: ${warnings.length}`);
evidence.push("dry-run release report generated");
evidence.push("no package archive created");
evidence.push("no content encryption performed");
evidence.push("no Workshop upload attempted");
evidence.push("release dry run is not runtime validation");
evidence.push(...blockers);
```

**Required structure and metadata policy** (`src/preflight.ts:272-323`):

```typescript
for (const [label, path] of requiredPaths) {
  if (await pathExists(path)) {
    evidence.push(`package evidence: ${label} exists`);
  } else {
    blockers.push(`package blocker: ${label} missing`);
  }
}

const metadata = parseAddonInfo(await readFile(addonInfoPath, "utf8"));
for (const key of RELEASE_METADATA_KEYS) {
  const value = metadata.get(key.toLowerCase());
  if (value === undefined) {
    blockers.push(`metadata blocker: ${key} missing`);
  } else if (PLACEHOLDER_VALUES.has(value.trim().toLowerCase())) {
    blockers.push(`metadata blocker: ${key} placeholder`);
  } else {
    evidence.push(`metadata evidence: ${key} present`);
  }
}
```

**Redacted scan result** (`src/preflight.ts:336-360`):

```typescript
const relativePath = normalizeRelativePath(relative(relativeRoot, file));
const extension = extname(file).toLowerCase();
if (!TEXT_SCAN_EXTENSIONS.has(extension)) {
  warnings.push(`secret scan skipped non-text file: ${relativePath}`);
  continue;
}

const info = await stat(file);
if (info.size > MAX_SECRET_SCAN_BYTES) {
  warnings.push(`secret scan skipped oversized file: ${relativePath}`);
  continue;
}

const content = await readFile(file, "utf8");
for (const { label, pattern } of SECRET_PATTERNS) {
  if (pattern.test(content)) {
    blockers.push(`secret blocker: ${relativePath} matches ${label}`);
  }
}
```

The extracted pure policy should return structured findings. `preflight.ts` remains the compatibility renderer that converts those findings back into the exact established evidence strings and public success/failure envelope.

### 4. Stable result envelope and target discrimination

**Sources:** `src/result.ts`, `src/types.ts`

Use this family only at the existing preflight boundary in Phase 3. The candidate lifecycle should keep an internal domain result until Phase 5 adds public MCP details and remote parity.

**Constructor defaults** (`src/result.ts:17-41`):

```typescript
export function createSuccessResult(input: SuccessInput): ToolResult {
  return {
    ok: true,
    target: input.target,
    operation: input.operation,
    evidence: input.evidence ?? [],
    warnings: input.warnings ?? [],
    paths: input.paths ?? {},
    commands: input.commands ?? [],
    logs: input.logs ?? []
  };
}

export function createFailureResult(input: FailureInput): ToolResult {
  return {
    ok: false,
    target: input.target,
    operation: input.operation,
    error: input.error,
    evidence: input.evidence ?? [],
    warnings: input.warnings ?? [],
    paths: input.paths ?? {},
    commands: input.commands ?? [],
    logs: input.logs ?? []
  };
}
```

**Target union and complete result fields** (`src/types.ts:1-20`, `src/types.ts:35-50`):

```typescript
export type FixtureTarget = {
  kind: "fixture";
  root: string;
};

export type LocalTarget = {
  kind: "local";
  dotaRoot?: string;
};

export type RemoteTarget = {
  kind: "remote";
  name: string;
  transport: "ssh" | "powershell";
  host: string;
  username?: string;
  dotaRoot?: string;
};

export type ToolResult = {
  ok: boolean;
  target: Target;
  operation: string;
  evidence: string[];
  warnings: string[];
  paths: Record<string, string>;
  commands: CommandEvidence[];
  logs: LogEvidence[];
  error?: ToolError;
};
```

### 5. macOS fixture and lifecycle test conventions

**Sources:** `tests/install-simulation.test.ts`, `tests/source-snapshot.test.ts`, `tests/preflight.test.ts`, `tests/result.test.ts`

Use `mkdtemp` beneath `tmpdir`, build the smallest explicit tree, clean it with `rm` in `finally` or `afterEach`, and assert observable contract state rather than internal helper calls except where Phase 3 explicitly injects adapter spies/checkpoints.

**Fixture creation and unconditional teardown** (`tests/install-simulation.test.ts:11-65`, `tests/install-simulation.test.ts:85-105`):

```typescript
async function createInstallFixture(options: {
  omitDistIndex?: boolean;
  skillContent?: string;
  skillFiles?: Record<string, string>;
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "dota-install-fixture-"));
  // Build only the directories and files required by the case.
  return root;
}

const root = await createInstallFixture();
const tempParent = await mkdtemp(join(tmpdir(), "dota-install-parent-"));
try {
  const result = await simulateLocalInstall({ root, tempParent });
  expect(result.ok).toBe(true);
  expect(result.cleanup.removed).toBe(true);
  await expect(access(result.paths.simulationRoot)).rejects.toThrow();
} finally {
  await rm(root, { recursive: true, force: true });
  await rm(tempParent, { recursive: true, force: true });
}
```

**Redaction assertion** (`tests/install-simulation.test.ts:127-149`):

```typescript
const result = await simulateLocalInstall({ root, tempParent });
const serialized = JSON.stringify(result);

expect(result.blockers).toContainEqual(expect.objectContaining({
  code: "SIM_SENSITIVE_MATERIAL_FOUND",
  path: "skills/dota2-workshop-tools/SKILL.md",
  category: "credential"
}));
expect(serialized).not.toContain(secretValue);
```

**Link target non-disclosure** (`tests/install-simulation.test.ts:185-205`):

```typescript
expect(result.blockers).toContainEqual(expect.objectContaining({
  code: "SIM_SYMBOLIC_LINK_UNSUPPORTED",
  path: "dist/index.js"
}));
expect(serialized).not.toContain(secretValue);
expect(serialized).not.toContain(externalRoot);
```

**Deterministic output and relative sorted identities** (`tests/source-snapshot.test.ts:26-60`):

```typescript
expect(second).toEqual(first);
expect(first.ok).toBe(true);

const paths = manifest.manifest.files.map((file) => file.path);
expect(paths).toEqual([...paths].sort());
expect(paths.every((path) => !path.startsWith(root))).toBe(true);
```

**Readiness compatibility assertions** (`tests/preflight.test.ts:126-155`, `tests/preflight.test.ts:157-220`):

```typescript
expect(result.ok).toBe(true);
expect(result.operation).toBe("dry_run_release_report");
expect(result.evidence).toContain("dry-run release report generated");
expect(result.evidence).toContain("release blockers: 0");
expect(result.evidence).toContain("metadata evidence: addonVersion present");
expect(result.warnings).toContain("Steam login is manual and out of scope");

expect(blocked.evidence).toContain("metadata blocker: addontitle placeholder");
expect(redacted.evidence).toContain("secret blocker: scripts/vscripts/secrets.lua matches password");
expect(redacted.evidence.join("\n")).not.toContain(credentialValue);
```

Add characterization cases before extracting policy and compare the complete representative `ToolResult`, not weakened substring-only substitutes. Candidate tests should additionally cover zero `mkdtemp` calls for every precreation blocker, all regular/hidden files and empty directories inside the callback, adapter-recorded writes confined to the candidate, mutation checkpoints, no retry, and candidate absence after callback success/failure.

## Pattern Assignments

### `src/release-readiness.ts` (domain policy, transform over filesystem observations)

- Extract constants and pure classification from `src/preflight.ts:27-63` and readiness sequencing from `src/preflight.ts:272-360`.
- Return structured findings with stable `code`, safe relative `path`, `field`/`category`, and no matched value, following `SourceSnapshotBlocker` at `src/source-snapshot.ts:25-30`.
- Keep filesystem reads outside the pure classifier where practical; the caller supplies text/type/size observations.
- Preserve current required-path order, metadata-key order, scan-root order, secret-pattern order, and warning order so `preflight.ts` can render without drift.

### `src/release-candidate.ts` (domain service, callback-scoped file-I/O)

- Use the import/result conventions from `src/install-simulation.ts:1-24`.
- Use canonical `relative` containment and forward-slash evidence from `src/install-simulation.ts:365-375`.
- Use ordinal comparison and normalized identities from `src/source-snapshot.ts:245-267`.
- Sequence: validate addon and every supplied root; canonicalize and prove isolation; inventory/classify/collision-check both trees; only then `mkdtemp`; canonicalize the child; create fixed layout; reclassify immediately before each `mkdir`/`copyFile`; observe after copy; rewalk sources; inspect through callback; revalidate; remove in `finally`.
- Represent adapter entry kinds explicitly (`file`, `directory`, `symbolic-link`, `reparse`, `special`, `unknown`) and fail closed for every non-file/non-directory kind.
- Do not use recursive `cp`, `Dirent` as authority, retries, repair, source writes, public MCP registration, manifests, archives, signing, encryption, login, upload, launch, or runtime claims.

### `src/preflight.ts` (compatibility renderer, request-response)

- Keep public validation and result construction at `src/preflight.ts:106-171`.
- Delegate readiness decisions to `release-readiness.ts`, then reproduce the current evidence/warning/blocker ordering exactly.
- Continue returning `createFailureResult` with `RELEASE_PREFLIGHT_BLOCKED` when any rendered blocker exists; otherwise return `createSuccessResult`.
- Do not route candidate creation through `dryRunReleaseReport`; inspection and candidate lifetime remain separate seams.

### `tests/release-readiness.test.ts` (pure policy and fixture observations)

- Follow `tests/source-snapshot.test.ts:14-24` for isolated fixture lifecycle and fixed inputs.
- Follow `tests/preflight.test.ts:157-220` for missing structure, missing/placeholder metadata, and redacted secret expectations.
- Assert exact structured finding arrays and serialized non-disclosure for sensitive values and private absolute roots.
- Include unreadable and oversized required text inputs as blockers, not silent skipped-success cases.

### `tests/release-candidate.test.ts` (lifecycle and adapter contract)

- Follow `tests/install-simulation.test.ts:85-105` for temporary-parent assertions and post-return absence.
- Follow `tests/install-simulation.test.ts:185-205` for link target/value non-disclosure.
- Follow `tests/source-snapshot.test.ts:26-60` for deterministic ordering and normalized relative identities.
- Use injectable adapter spies only for required sequencing/fault cases: zero creation before validation, reparse/unknown kinds, canonical escape, case collision, mutation before/during/after copy, destination failure, callback failure, and source-write recording.
- Inspect exact `game/dota_addons/<addon>` and `content/dota_addons/<addon>` contents inside the callback, including binary, extensionless, dotfile, generated-looking file, and nested empty-directory fixtures.

### `tests/preflight.test.ts` (public compatibility characterization)

- Preserve existing assertions and add complete representative result snapshots/equality before extraction.
- Cover success, missing required structure, missing metadata, placeholder metadata, sensitive material, oversized required text, unreadable required text, invalid addon, and missing root.
- Keep the common envelope assertions aligned with `tests/result.test.ts:5-46`: stable `ok`, `operation`, `error.code`, evidence, warnings, paths, commands, and logs.

## Shared Patterns

### Explicit error normalization

Apply to candidate and readiness boundaries. Catch filesystem errors only to map them to stable domain codes and safe fields/categories. Never forward raw exception text, link targets, source contents, credentials, or private absolute roots.

### Relative path identity

Apply to all traversal, collision, blocker, and test expectations. Keep normalized relative identity distinct from absolute source/destination paths, reject absolute/`.`/`..`/separator-ambiguous identities before `join`, and compare a locale-independent case-folded key globally across both candidate prefixes.

### Source immutability

Every production write (`mkdir`, `copyFile`, `rm`) must be proven inside the validated candidate root. Tests should record adapter write paths and compare source topology/bytes before and after success and every injected failure. No compile, generate, repair, rename, retry, or post-processing path is valid.

### Boundary evidence

Retain explicit evidence that no Steam login, Workshop mutation/upload, credentials, archive, signing, encryption, game launch, runtime validation, automatic compilation, or source repair occurred. Phase 3 establishes lifecycle behavior only; Phase 4 owns manifests and formal cleanup proof, and Phase 5 owns public MCP/remote normalization.

## Planner Warnings

- The existing graph index is stale for the newest filesystem services; no assignment above relies on graph edges. All excerpts are from current repository files.
- `install-simulation.ts` is an analog for ownership and safety helpers, not its create-before-validate orchestration or recursive copy.
- `source-snapshot.ts` is an analog for deterministic file identities, not its file-only traversal, filtering, `stat`, or `Dirent` trust.
- `preflight.ts` is both the extraction source and compatibility contract. Tests must be strengthened before moving policy.
- Do not modify the public `ToolResult` contract in this phase; structured MCP candidate details and target parity belong to Phase 5.

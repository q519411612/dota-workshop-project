import { lstat, mkdtemp, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Stats } from "node:fs";
import { validateAddonName } from "./addon.js";
import {
  evaluateReleaseReadiness,
  isReleaseTextPath,
  MAX_SECRET_SCAN_BYTES,
  type ReleaseReadinessFinding,
  type ReleaseReadinessInput
} from "./release-readiness.js";

export type ReleaseCandidateInput = {
  addonName: string;
  dotaRoot: string;
  tempParent: string;
};

export type ReleaseCandidateInputField =
  | "addonName"
  | "dotaRoot"
  | "repositoryRoot"
  | "tempParent"
  | "gameAddonRoot"
  | "contentAddonRoot";

export type ReleaseCandidateInputBlocker = {
  code: string;
  field: ReleaseCandidateInputField;
  category: "invalid" | "required" | "missing" | "not-directory" | "unreadable" | "unsafe-isolation";
};

const validatedReleaseCandidateInputBrand: unique symbol = Symbol("validatedReleaseCandidateInput");
const releaseCandidateFilesystemCapability: unique symbol = Symbol("releaseCandidateFilesystemCapability");
const releaseCandidateLeaseBrand: unique symbol = Symbol("releaseCandidateLease");
const identityBoundCandidateLifecycleBrand: unique symbol = Symbol("identityBoundCandidateLifecycle");

export type ValidatedReleaseCandidateInput = Readonly<{
  [validatedReleaseCandidateInputBrand]: true;
  [releaseCandidateFilesystemCapability]: ReleaseCandidateFilesystem;
  addonName: string;
  dotaRoot: string;
  repositoryRoot: string;
  tempParent: string;
  gameAddonRoot: string;
  contentAddonRoot: string;
}>;

export type ReleaseCandidateInputResult =
  | { ok: true; value: ValidatedReleaseCandidateInput }
  | { ok: false; blockers: ReleaseCandidateInputBlocker[] };

export type ReleaseCandidateEntryKind =
  | "file"
  | "directory"
  | "symbolic-link"
  | "reparse"
  | "special"
  | "unknown";

export type ReleaseCandidateSourceRoot = "game" | "content";

export type ReleaseCandidateSourceEntry = Readonly<{
  root: ReleaseCandidateSourceRoot;
  path: string;
  kind: "file" | "directory";
}>;

export type ReleaseCandidateInventoryBlocker = Readonly<{
  code: string;
  path: string;
  category: string;
}>;

export type ReleaseCandidateInventoryResult =
  | { ok: true; entries: ReleaseCandidateSourceEntry[] }
  | { ok: false; blockers: ReleaseCandidateInventoryBlocker[] };

export type ReleaseCandidateFilesystem = {
  reparsePointAware?: true;
  lstat(path: string): Promise<Pick<Stats, "isDirectory">>;
  realpath(path: string): Promise<string>;
  readDirectory(path: string): Promise<string[]>;
  classifySourceEntry(path: string): Promise<ReleaseCandidateEntryKind>;
  createCandidateRoot(input: ValidatedReleaseCandidateInput): Promise<string>;
  candidateLifecycle?: IdentityBoundCandidateLifecycle;
};

export type ReleaseCandidateDependencies = {
  repositoryRoot?: string;
  filesystem?: ReleaseCandidateFilesystem;
  platform?: NodeJS.Platform;
};

function createDefaultFilesystem(platform: NodeJS.Platform): ReleaseCandidateFilesystem {
  return {
    lstat,
    realpath,
    readDirectory: async (path) => await readdir(path),
    classifySourceEntry: platform === "win32"
      ? async () => "unknown"
      : classifySourceEntry,
    createCandidateRoot: async (input) => await mkdtemp(join(input.tempParent, "dota-release-candidate-"))
  };
}

export type ReleaseCandidateLifecycleBlocker = Readonly<{
  code: string;
  category: "assembly" | "creation" | "inspection" | "removal" | "unsafe-isolation" | "unexpected-entry";
  path?: string;
}>;

export type ReleaseCandidateLifecycleResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      blockers: Array<
        ReleaseCandidateInputBlocker
        | ReleaseCandidateInventoryBlocker
        | ReleaseCandidateLifecycleBlocker
        | ReleaseReadinessFinding
      >;
    };

type ReleaseCandidateLifecycleFailure = Extract<ReleaseCandidateLifecycleResult<never>, { ok: false }>;
type AcceptedSourceObservation = Extract<AcceptedSourceObservationResult, { ok: true }>;
type AcceptedSourceObservations = ReadonlyMap<string, AcceptedSourceObservation>;

export type ReleaseCandidateLease = Readonly<{
  [releaseCandidateLeaseBrand]: true;
}>;

export type CandidateLeaseCleanupFailureCode =
  | "CANDIDATE_IDENTITY_MISMATCH"
  | "CANDIDATE_REMOVAL_FAILED"
  | "CANDIDATE_ABSENCE_UNVERIFIED"
  | "CANDIDATE_LEASE_INVALID";

export type CandidateLeaseCleanupResult =
  | Readonly<{
      ok: true;
      removed: true;
      absent: true;
      identityMatched: true;
    }>
  | Readonly<{
      ok: false;
      removed: boolean;
      absent: boolean;
      identityMatched: boolean;
      code: CandidateLeaseCleanupFailureCode;
    }>;

export type AcceptedSourceReadResult =
  | Readonly<{
      ok: true;
      state: "readable";
      size: number;
      content: string;
      identityMatched: true;
      kindMatched: true;
      contained: true;
    }>
  | Readonly<{
      ok: true;
      state: "oversized";
      size: number;
      identityMatched: true;
      kindMatched: true;
      contained: true;
    }>
  | Readonly<{ ok: false; code: "SOURCE_FILE_IDENTITY_CHANGED" | "SOURCE_FILE_READ_FAILED" }>;

export type AcceptedSourceObservationResult =
  | Readonly<{
      ok: true;
      kind: "file" | "directory";
      canonicalPath: string;
      size: number;
      mtimeMs: number;
      ctimeMs: number;
      mode: number;
      bytes?: Uint8Array;
      identityMatched: true;
      contained: true;
    }>
  | Readonly<{ ok: false; code: "SOURCE_ENTRY_CHANGED" | "SOURCE_OBSERVATION_FAILED" }>;

export type CandidateMaterializationOperation = Readonly<{
  destination: string;
  kind: "file" | "directory";
  source: ReleaseCandidateSourceEntry;
}>;

export type CandidateMaterializationResult =
  | Readonly<{ ok: true; created: true; identityMatched: true; kindMatched: true; contained: true }>
  | Readonly<{
      ok: false;
      code:
        | "CANDIDATE_DESTINATION_IDENTITY_MISMATCH"
        | "CANDIDATE_DESTINATION_UNEXPECTED"
        | "CANDIDATE_MATERIALIZATION_FAILED"
        | "SOURCE_ENTRY_CHANGED";
    }>;

export type CandidateRootInspectionResult =
  | Readonly<{ ok: true; empty: true; identityMatched: true }>
  | Readonly<{
      ok: false;
      code: "CANDIDATE_ROOT_IDENTITY_MISMATCH" | "CANDIDATE_ROOT_INSPECTION_FAILED" | "CANDIDATE_ROOT_NOT_EMPTY";
      entries?: string[];
    }>;

export type CandidateExpectedEntry = Readonly<{ path: string; kind: "file" | "directory" }>;
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

export function createIdentityBoundCandidateLifecycle<TIdentity extends object>(operations: {
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<Readonly<{
    inspectionRoot: string;
    identity: TIdentity;
  }>>;
  cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
  readAcceptedSourceFile?(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry,
    maxBytes: number
  ): Promise<AcceptedSourceReadResult>;
  observeAcceptedSourceEntry?(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry
  ): Promise<AcceptedSourceObservationResult>;
  inspectCandidateRoot?(identity: TIdentity): Promise<CandidateRootInspectionResult>;
  materializeCandidateEntry?(
    identity: TIdentity,
    input: ValidatedReleaseCandidateInput,
    operation: CandidateMaterializationOperation
  ): Promise<CandidateMaterializationResult>;
  reconcileCandidateTree?(
    identity: TIdentity,
    expected: CandidateExpectedEntry[]
  ): Promise<CandidateTreeReconciliationResult>;
}): IdentityBoundCandidateLifecycle {
  const identities = new WeakMap<ReleaseCandidateLease, TIdentity>();
  const createCandidateLease = operations.createCandidateLease.bind(operations);
  const cleanupCandidateLease = operations.cleanupCandidateLease.bind(operations);
  const readAcceptedSourceFile = operations.readAcceptedSourceFile?.bind(operations);
  const observeAcceptedSourceEntry = operations.observeAcceptedSourceEntry?.bind(operations);
  const inspectCandidateRoot = operations.inspectCandidateRoot?.bind(operations);
  const materializeCandidateEntry = operations.materializeCandidateEntry?.bind(operations);
  const reconcileCandidateTree = operations.reconcileCandidateTree?.bind(operations);
  const identityBoundAssembly = readAcceptedSourceFile !== undefined
    && observeAcceptedSourceEntry !== undefined
    && inspectCandidateRoot !== undefined
    && materializeCandidateEntry !== undefined
    && reconcileCandidateTree !== undefined;
  return Object.freeze({
    [identityBoundCandidateLifecycleBrand]: true as const,
    identityBoundCleanup: true as const,
    identityBoundAssembly,
    createCandidateLease: async (input) => {
      const created = await createCandidateLease(input);
      const lease = Object.freeze({ [releaseCandidateLeaseBrand]: true as const });
      identities.set(lease, created.identity);
      return Object.freeze({ inspectionRoot: created.inspectionRoot, lease });
    },
    cleanupCandidateLease: async (lease) => {
      const identity = identities.get(lease);
      if (identity === undefined) {
        return {
          ok: false,
          removed: false,
          absent: false,
          identityMatched: false,
          code: "CANDIDATE_LEASE_INVALID"
        };
      }
      identities.delete(lease);
      return await cleanupCandidateLease(identity);
    },
    readAcceptedSourceFile: async (input, entry, maxBytes) => (
      readAcceptedSourceFile === undefined
        ? { ok: false, code: "SOURCE_FILE_READ_FAILED" }
        : await readAcceptedSourceFile(input, entry, maxBytes)
    ),
    observeAcceptedSourceEntry: async (input, entry) => (
      observeAcceptedSourceEntry === undefined
        ? { ok: false, code: "SOURCE_OBSERVATION_FAILED" }
        : await observeAcceptedSourceEntry(input, entry)
    ),
    inspectCandidateRoot: async (lease) => {
      const identity = identities.get(lease);
      if (identity === undefined || inspectCandidateRoot === undefined) {
        return { ok: false, code: "CANDIDATE_ROOT_IDENTITY_MISMATCH" };
      }
      return await inspectCandidateRoot(identity);
    },
    materializeCandidateEntry: async (lease, input, operation) => {
      const identity = identities.get(lease);
      if (identity === undefined || materializeCandidateEntry === undefined) {
        return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
      }
      return await materializeCandidateEntry(identity, input, operation);
    },
    reconcileCandidateTree: async (lease, expected) => {
      const identity = identities.get(lease);
      if (identity === undefined || reconcileCandidateTree === undefined) {
        return { ok: false, code: "CANDIDATE_TREE_RECONCILIATION_FAILED" };
      }
      return await reconcileCandidateTree(identity, expected);
    }
  });
}

type BoundCandidateLifecycle = Readonly<{
  lstat: ReleaseCandidateFilesystem["lstat"];
  realpath: ReleaseCandidateFilesystem["realpath"];
  createCandidateLease: IdentityBoundCandidateLifecycle["createCandidateLease"];
  cleanupCandidateLease: IdentityBoundCandidateLifecycle["cleanupCandidateLease"];
  readAcceptedSourceFile: IdentityBoundCandidateLifecycle["readAcceptedSourceFile"];
  observeAcceptedSourceEntry: IdentityBoundCandidateLifecycle["observeAcceptedSourceEntry"];
  inspectCandidateRoot: IdentityBoundCandidateLifecycle["inspectCandidateRoot"];
  materializeCandidateEntry: IdentityBoundCandidateLifecycle["materializeCandidateEntry"];
  reconcileCandidateTree: IdentityBoundCandidateLifecycle["reconcileCandidateTree"];
}>;

export type ReleaseCandidateContinuationResult<T> =
  | { ok: true; value: T }
  | { ok: false; blockers: ReleaseCandidateInputBlocker[] };

export async function continueReleaseCandidatePreparation<T>(
  input: ReleaseCandidateInput,
  dependencies: ReleaseCandidateDependencies,
  continuation: (validated: ValidatedReleaseCandidateInput) => Promise<T>
): Promise<ReleaseCandidateContinuationResult<T>> {
  const prepared = await prepareReleaseCandidateInput(input, dependencies);
  if (!prepared.ok) return prepared;
  return { ok: true, value: await continuation(prepared.value) };
}

export async function prepareReleaseCandidateInput(
  input: ReleaseCandidateInput,
  dependencies: ReleaseCandidateDependencies = {}
): Promise<ReleaseCandidateInputResult> {
  const addonValidation = validateAddonName(input?.addonName);
  if (!addonValidation.ok) {
    return blocked("INVALID_ADDON_NAME", "addonName", "invalid");
  }

  const platform = dependencies.platform ?? process.platform;
  if (platform === "win32" && dependencies.filesystem?.reparsePointAware !== true) {
    return blocked("WINDOWS_REPARSE_CLASSIFIER_REQUIRED", "dotaRoot", "unsafe-isolation");
  }

  const filesystem = dependencies.filesystem ?? createDefaultFilesystem(platform);
  const dotaRoot = await validateDirectory(input?.dotaRoot, "dotaRoot", "DOTA_ROOT", filesystem);
  if (!dotaRoot.ok) return dotaRoot.result;

  const repositoryRoot = await validateDirectory(
    dependencies.repositoryRoot ?? process.cwd(),
    "repositoryRoot",
    "REPOSITORY_ROOT",
    filesystem
  );
  if (!repositoryRoot.ok) return repositoryRoot.result;

  const tempParent = await validateDirectory(input?.tempParent, "tempParent", "TEMP_PARENT", filesystem);
  if (!tempParent.ok) return tempParent.result;

  const gameAddonRootPath = join(dotaRoot.path, "game", "dota_addons", input.addonName);
  const gameAddonRoot = await validateDirectory(gameAddonRootPath, "gameAddonRoot", "GAME_ADDON_ROOT", filesystem);
  if (!gameAddonRoot.ok) return gameAddonRoot.result;
  if (!isPathInside(gameAddonRoot.path, dotaRoot.path)) {
    return blocked("GAME_ADDON_ROOT_OUTSIDE_DOTA_ROOT", "gameAddonRoot", "unsafe-isolation");
  }

  const contentAddonRootPath = join(dotaRoot.path, "content", "dota_addons", input.addonName);
  const contentAddonRoot = await validateDirectory(
    contentAddonRootPath,
    "contentAddonRoot",
    "CONTENT_ADDON_ROOT",
    filesystem
  );
  if (!contentAddonRoot.ok) return contentAddonRoot.result;
  if (!isPathInside(contentAddonRoot.path, dotaRoot.path)) {
    return blocked("CONTENT_ADDON_ROOT_OUTSIDE_DOTA_ROOT", "contentAddonRoot", "unsafe-isolation");
  }

  const protectedRoots = [dotaRoot.path, repositoryRoot.path, gameAddonRoot.path, contentAddonRoot.path];
  if (protectedRoots.some((root) => isPathAtOrInside(tempParent.path, root))) {
    return blocked("TEMP_PARENT_NOT_ISOLATED", "tempParent", "unsafe-isolation");
  }

  return {
    ok: true,
    value: Object.freeze({
      [validatedReleaseCandidateInputBrand]: true as const,
      [releaseCandidateFilesystemCapability]: filesystem,
      addonName: input.addonName,
      dotaRoot: dotaRoot.path,
      repositoryRoot: repositoryRoot.path,
      tempParent: tempParent.path,
      gameAddonRoot: gameAddonRoot.path,
      contentAddonRoot: contentAddonRoot.path
    })
  };
}

export async function inventoryReleaseCandidateSources(
  input: ValidatedReleaseCandidateInput
): Promise<ReleaseCandidateInventoryResult> {
  const filesystem = input[releaseCandidateFilesystemCapability];
  const entries: ReleaseCandidateSourceEntry[] = [];
  const blockers: ReleaseCandidateInventoryBlocker[] = [];
  const identities = new Map<string, Set<string>>();
  const roots: Array<{
    root: ReleaseCandidateSourceRoot;
    sourcePath: string;
    identity: string;
  }> = [
    {
      root: "game",
      sourcePath: input.gameAddonRoot,
      identity: `game/dota_addons/${input.addonName}`
    },
    {
      root: "content",
      sourcePath: input.contentAddonRoot,
      identity: `content/dota_addons/${input.addonName}`
    }
  ];

  for (const root of roots) {
    addIdentity(identities, root.identity);
    await inventorySourceDirectory({
      ...root,
      sourceRoot: root.sourcePath,
      segments: [],
      filesystem,
      entries,
      blockers,
      identities
    });
  }

  appendCollisionBlockers(identities, blockers);

  if (blockers.length > 0) {
    blockers.sort(compareInventoryBlockers);
    return { ok: false, blockers };
  }

  entries.sort((left, right) => compareOrdinal(left.path, right.path));
  return { ok: true, entries };
}

export async function withAssembledReleaseCandidate<T>(
  input: ReleaseCandidateInput,
  inspect: (candidateRoot: string) => Promise<T>,
  dependencies: ReleaseCandidateDependencies = {}
): Promise<ReleaseCandidateLifecycleResult<T>> {
  const prepared = await prepareReleaseCandidateInput(input, dependencies);
  if (!prepared.ok) return prepared;

  const inventory = await inventoryReleaseCandidateSources(prepared.value);
  if (!inventory.ok) return inventory;

  const filesystem = prepared.value[releaseCandidateFilesystemCapability];
  const capability = filesystem.candidateLifecycle;
  if (
    capability?.identityBoundCleanup !== true
    || capability[identityBoundCandidateLifecycleBrand] !== true
  ) {
    return lifecycleBlocked("IDENTITY_BOUND_CLEANUP_REQUIRED", "creation");
  }
  if (capability.identityBoundAssembly !== true) {
    return lifecycleBlocked("IDENTITY_BOUND_ASSEMBLY_REQUIRED", "creation");
  }
  const lifecycle = bindIdentityBoundCandidateLifecycle(filesystem);
  if (lifecycle === undefined) {
    return lifecycleBlocked("IDENTITY_BOUND_CLEANUP_REQUIRED", "creation");
  }
  const observations = await captureSourceObservations(prepared.value, inventory.entries, lifecycle);
  if (!observations.ok) return observations;
  const readiness = await releaseReadinessBlockers(prepared.value, inventory.entries, lifecycle);
  if (!readiness.ok) return readiness;
  if (readiness.blockers.length > 0) return { ok: false, blockers: readiness.blockers };
  const precreationStability = await verifySourceStability(
    prepared.value,
    inventory.entries,
    observations.value,
    lifecycle
  );
  if (precreationStability !== undefined) return precreationStability;

  let created: Awaited<ReturnType<BoundCandidateLifecycle["createCandidateLease"]>>;
  try {
    created = await lifecycle.createCandidateLease(prepared.value);
  } catch {
    return lifecycleBlocked("CANDIDATE_CREATION_FAILED", "creation");
  }

  let outcome: ReleaseCandidateLifecycleResult<T>;
  let cleanupFailure: ReleaseCandidateLifecycleResult<never> | undefined;
  try {
    outcome = await inspectCandidateLease(
      created.inspectionRoot,
      created.lease,
      prepared.value,
      inventory.entries,
      observations.value,
      lifecycle,
      inspect
    );
  } finally {
    cleanupFailure = await parseCandidateCleanupResult(
      async () => await lifecycle.cleanupCandidateLease(created.lease)
    );
  }
  return cleanupFailure ?? outcome;
}

function bindIdentityBoundCandidateLifecycle(
  filesystem: ReleaseCandidateFilesystem
): BoundCandidateLifecycle | undefined {
  const capability = filesystem.candidateLifecycle;
  if (
    capability?.identityBoundCleanup !== true
    || capability[identityBoundCandidateLifecycleBrand] !== true
    || capability.identityBoundAssembly !== true
  ) {
    return undefined;
  }
  return Object.freeze({
    lstat: filesystem.lstat.bind(filesystem),
    realpath: filesystem.realpath.bind(filesystem),
    createCandidateLease: capability.createCandidateLease.bind(capability),
    cleanupCandidateLease: capability.cleanupCandidateLease.bind(capability),
    readAcceptedSourceFile: capability.readAcceptedSourceFile.bind(capability),
    observeAcceptedSourceEntry: capability.observeAcceptedSourceEntry.bind(capability),
    inspectCandidateRoot: capability.inspectCandidateRoot.bind(capability),
    materializeCandidateEntry: capability.materializeCandidateEntry.bind(capability),
    reconcileCandidateTree: capability.reconcileCandidateTree.bind(capability)
  });
}

async function inspectCandidateLease<T>(
  inspectionRoot: string,
  lease: ReleaseCandidateLease,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle,
  inspect: (candidateRoot: string) => Promise<T>
): Promise<ReleaseCandidateLifecycleResult<T>> {
  let root: string;
  try {
    root = resolve(inspectionRoot);
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
  }

  if (!isPathInside(root, input.tempParent)) {
    return lifecycleBlocked("CANDIDATE_ROOT_NOT_OWNED", "unsafe-isolation");
  }

  try {
    const stats = await lifecycle.lstat(root);
    if (!stats.isDirectory()) {
      return lifecycleBlocked("CANDIDATE_ROOT_NOT_OWNED", "unsafe-isolation");
    }
    const canonicalRoot = await lifecycle.realpath(root);
    if (!isCandidateRootIsolated(canonicalRoot, input)) {
      return lifecycleBlocked("CANDIDATE_ROOT_NOT_ISOLATED", "unsafe-isolation");
    }
    const unexpectedEntries = await parseCandidateRootInspection(
      async () => await lifecycle.inspectCandidateRoot(lease)
    );
    if (unexpectedEntries !== undefined) return unexpectedEntries;
    const preassemblyStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (preassemblyStability !== undefined) return preassemblyStability;
    const assemblyFailure = await assembleReleaseCandidate(lease, input, inventory, observations, lifecycle);
    if (assemblyFailure !== undefined) return assemblyFailure;
    const postassemblyStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (postassemblyStability !== undefined) return postassemblyStability;
    const reconciliationFailure = await reconcileReleaseCandidate(lease, input, inventory, lifecycle);
    if (reconciliationFailure !== undefined) return reconciliationFailure;
    const prereviewStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (prereviewStability !== undefined) return prereviewStability;
    let value: T | undefined;
    let inspectionFailed = false;
    try {
      value = await inspect(canonicalRoot);
    } catch {
      inspectionFailed = true;
    }
    const finalStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (finalStability !== undefined) return finalStability;
    if (inspectionFailed) return lifecycleBlocked("CANDIDATE_INSPECTION_FAILED", "inspection");
    return { ok: true, value: value as T };
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
  }
}

async function parseCandidateRootInspection(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
    }
    const ok = Reflect.get(result, "ok");
    if (
      ok === true
      && Reflect.get(result, "empty") === true
      && Reflect.get(result, "identityMatched") === true
    ) return undefined;
    const code = Reflect.get(result, "code");
    if (ok !== false || typeof code !== "string") {
      return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
    }
    if (code === "CANDIDATE_ROOT_NOT_EMPTY") {
      const entries = Reflect.get(result, "entries");
      if (!Array.isArray(entries) || entries.length === 0 || !entries.every((entry) => typeof entry === "string")) {
        return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
      }
      return {
        ok: false,
        blockers: [...entries].sort(compareOrdinal).map((entry) => ({
          code: "CANDIDATE_ROOT_NOT_EMPTY",
          category: "unexpected-entry" as const,
          path: safeCandidateEntryIdentity(entry)
        }))
      };
    }
    if (code === "CANDIDATE_ROOT_IDENTITY_MISMATCH") {
      return lifecycleBlocked(code, "unsafe-isolation");
    }
    if (code === "CANDIDATE_ROOT_INSPECTION_FAILED") {
      return lifecycleBlocked(code, "inspection");
    }
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
  }
  return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
}

function safeCandidateEntryIdentity(name: string): string {
  if (invalidSourceNameCategory(name) !== undefined) return "[invalid]";
  if (/(?:password|passwd|pwd|token|api[_-]?key|secret)/iu.test(name)) return "[redacted]";
  return name;
}

async function assembleReleaseCandidate(
  lease: ReleaseCandidateLease,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  const fixedDirectories = [
    { path: "content", root: "content" as const },
    { path: "content/dota_addons", root: "content" as const },
    { path: `content/dota_addons/${input.addonName}`, root: "content" as const },
    { path: "game", root: "game" as const },
    { path: "game/dota_addons", root: "game" as const },
    { path: `game/dota_addons/${input.addonName}`, root: "game" as const }
  ];

  for (const directory of fixedDirectories) {
    const failure = await parseCandidateMaterialization(async () => (
      await lifecycle.materializeCandidateEntry(lease, input, {
        destination: directory.path,
        kind: "directory",
        source: { root: directory.root, path: `${directory.root}/dota_addons/${input.addonName}`, kind: "directory" }
      })
    ));
    if (failure !== undefined) return failure;
  }

  for (const entry of inventory) {
    const beforeUse = await verifySourceEntryObservation(input, entry, observations, lifecycle);
    if (beforeUse !== undefined) return beforeUse;
    const failure = await parseCandidateMaterialization(async () => (
      await lifecycle.materializeCandidateEntry(lease, input, {
        destination: entry.path,
        kind: entry.kind,
        source: entry
      })
    ));
    if (failure !== undefined) return failure;
    const afterUse = await verifySourceEntryObservation(input, entry, observations, lifecycle);
    if (afterUse !== undefined) return afterUse;
  }
  return undefined;
}

async function parseCandidateMaterialization(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
    }
    if (
      Reflect.get(result, "ok") === true
      && Reflect.get(result, "created") === true
      && Reflect.get(result, "identityMatched") === true
      && Reflect.get(result, "kindMatched") === true
      && Reflect.get(result, "contained") === true
    ) return undefined;
    const code = Reflect.get(result, "code");
    if (Reflect.get(result, "ok") !== false || typeof code !== "string") {
      return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
    }
    if (code === "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" || code === "CANDIDATE_DESTINATION_UNEXPECTED") {
      return lifecycleBlocked(code, "unsafe-isolation");
    }
    if (code === "SOURCE_ENTRY_CHANGED") return sourceChangedDuringAssembly();
    if (code === "CANDIDATE_MATERIALIZATION_FAILED") return lifecycleBlocked(code, "assembly");
  } catch {
    return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
  }
  return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
}

async function reconcileReleaseCandidate(
  lease: ReleaseCandidateLease,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  const expected = expectedCandidateTree(input, inventory);
  return await parseCandidateReconciliation(
    async () => await lifecycle.reconcileCandidateTree(lease, expected)
  );
}

function expectedCandidateTree(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[]
): CandidateExpectedEntry[] {
  const fixed = [
    "content",
    "content/dota_addons",
    `content/dota_addons/${input.addonName}`,
    "game",
    "game/dota_addons",
    `game/dota_addons/${input.addonName}`
  ].map((path) => ({ path, kind: "directory" as const }));
  return [...fixed, ...inventory.map((entry) => ({ path: entry.path, kind: entry.kind }))]
    .sort((left, right) => compareOrdinal(left.path, right.path));
}

async function parseCandidateReconciliation(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
    }
    if (
      Reflect.get(result, "ok") === true
      && Reflect.get(result, "exact") === true
      && Reflect.get(result, "identityMatched") === true
    ) return undefined;
    if (Reflect.get(result, "ok") !== false || Reflect.get(result, "code") !== "CANDIDATE_TREE_MISMATCH") {
      return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
    }
    const issues = Reflect.get(result, "issues");
    if (!Array.isArray(issues) || issues.length === 0) {
      return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
    }
    const blockers: ReleaseCandidateLifecycleBlocker[] = [];
    for (const issue of issues) {
      if (issue === null || typeof issue !== "object") {
        return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
      }
      const code = Reflect.get(issue, "code");
      const path = Reflect.get(issue, "path");
      if (
        typeof path !== "string"
        || ![
          "CANDIDATE_TREE_MISSING",
          "CANDIDATE_TREE_UNEXPECTED",
          "CANDIDATE_TREE_WRONG_KIND",
          "CANDIDATE_TREE_IDENTITY_INVALID"
        ].includes(code)
      ) {
        return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
      }
      blockers.push({
        code,
        category: code === "CANDIDATE_TREE_UNEXPECTED" ? "unexpected-entry" : "assembly",
        path: safeCandidateTreeIdentity(path)
      });
    }
    blockers.sort((left, right) => compareOrdinal(left.path ?? "", right.path ?? "") || compareOrdinal(left.code, right.code));
    return { ok: false, blockers };
  } catch {
    return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
  }
}

function safeCandidateTreeIdentity(path: string): string {
  if (path.length === 0 || path.startsWith("/") || path.startsWith("\\") || path.includes("\\")) return "[invalid]";
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return "[invalid]";
  return segments.map(safeCandidateEntryIdentity).join("/");
}

async function captureSourceObservations(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<{ ok: true; value: AcceptedSourceObservations } | ReleaseCandidateLifecycleFailure> {
  const observations = new Map<string, AcceptedSourceObservation>();
  for (const entry of sourceEntriesWithRoots(input, inventory)) {
    const observed = await parseAcceptedSourceObservation(
      async () => await lifecycle.observeAcceptedSourceEntry(input, entry)
    );
    if (!observed.ok) return observed;
    observations.set(entry.path, observed.value);
  }
  return { ok: true, value: observations };
}

async function verifySourceStability(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleFailure | undefined> {
  const rewalk = await inventoryReleaseCandidateSources(input);
  if (!rewalk.ok) return rewalk;
  if (!sameSourceInventory(inventory, rewalk.entries)) return sourceChangedDuringAssembly();
  for (const entry of sourceEntriesWithRoots(input, inventory)) {
    const failure = await verifySourceEntryObservation(input, entry, observations, lifecycle);
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function sourceEntriesWithRoots(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[]
): ReleaseCandidateSourceEntry[] {
  return [
    { root: "content", path: `content/dota_addons/${input.addonName}`, kind: "directory" },
    { root: "game", path: `game/dota_addons/${input.addonName}`, kind: "directory" },
    ...inventory
  ];
}

async function verifySourceEntryObservation(
  input: ValidatedReleaseCandidateInput,
  entry: ReleaseCandidateSourceEntry,
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleFailure | undefined> {
  const accepted = observations.get(entry.path);
  if (accepted === undefined) return sourceChangedDuringAssembly();
  const current = await parseAcceptedSourceObservation(
    async () => await lifecycle.observeAcceptedSourceEntry(input, entry)
  );
  if (!current.ok || !sameSourceObservation(accepted, current.value)) {
    return sourceChangedDuringAssembly();
  }
  return undefined;
}

async function parseAcceptedSourceObservation(
  acquire: () => Promise<unknown>
): Promise<{ ok: true; value: AcceptedSourceObservation } | ReleaseCandidateLifecycleFailure> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object" || Reflect.get(result, "ok") !== true) {
      return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
    }
    const kind = Reflect.get(result, "kind");
    const canonicalPath = Reflect.get(result, "canonicalPath");
    const size = Reflect.get(result, "size");
    const mtimeMs = Reflect.get(result, "mtimeMs");
    const ctimeMs = Reflect.get(result, "ctimeMs");
    const mode = Reflect.get(result, "mode");
    if (
      (kind !== "file" && kind !== "directory")
      || typeof canonicalPath !== "string"
      || canonicalPath.length === 0
      || !Number.isSafeInteger(size)
      || size < 0
      || typeof mtimeMs !== "number"
      || !Number.isFinite(mtimeMs)
      || typeof ctimeMs !== "number"
      || !Number.isFinite(ctimeMs)
      || !Number.isSafeInteger(mode)
      || mode < 0
      || Reflect.get(result, "identityMatched") !== true
      || Reflect.get(result, "contained") !== true
    ) return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
    const bytes = Reflect.get(result, "bytes");
    if (kind === "file" && (!(bytes instanceof Uint8Array) || bytes.byteLength !== size)) {
      return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
    }
    if (kind === "directory" && bytes !== undefined) {
      return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
    }
    return {
      ok: true,
      value: {
        ok: true,
        kind,
        canonicalPath,
        size,
        mtimeMs,
        ctimeMs,
        mode,
        ...(kind === "file" ? { bytes: Uint8Array.from(bytes as Uint8Array) } : {}),
        identityMatched: true,
        contained: true
      }
    };
  } catch {
    return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
  }
}

function sameSourceInventory(
  accepted: ReleaseCandidateSourceEntry[],
  current: ReleaseCandidateSourceEntry[]
): boolean {
  return accepted.length === current.length && accepted.every((entry, index) => {
    const candidate = current[index];
    return candidate !== undefined
      && entry.root === candidate.root
      && entry.path === candidate.path
      && entry.kind === candidate.kind;
  });
}

function sameSourceObservation(
  accepted: AcceptedSourceObservation,
  current: AcceptedSourceObservation
): boolean {
  if (
    accepted.kind !== current.kind
    || accepted.canonicalPath !== current.canonicalPath
    || accepted.size !== current.size
    || accepted.mtimeMs !== current.mtimeMs
    || accepted.ctimeMs !== current.ctimeMs
    || accepted.mode !== current.mode
  ) return false;
  if (accepted.kind === "directory") return current.bytes === undefined;
  if (accepted.bytes === undefined || current.bytes === undefined || accepted.bytes.length !== current.bytes.length) return false;
  return accepted.bytes.every((byte, index) => byte === current.bytes?.[index]);
}

function sourceChangedDuringAssembly(): ReleaseCandidateLifecycleFailure {
  return lifecycleBlocked("SOURCE_CHANGED_DURING_ASSEMBLY", "assembly");
}

async function releaseReadinessBlockers(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<
  | { ok: true; blockers: ReleaseReadinessFinding[] }
  | ReleaseCandidateLifecycleFailure
> {
  const collected = await collectReleaseReadinessInput(input, inventory, lifecycle);
  if (!collected.ok) return collected;
  const blockers = evaluateReleaseReadiness(collected.value)
    .filter((finding) => finding.disposition === "blocker");
  const unique = new Map<string, ReleaseReadinessFinding>();
  for (const blocker of blockers) unique.set(JSON.stringify(blocker), blocker);
  return { ok: true, blockers: [...unique.values()] };
}

async function collectReleaseReadinessInput(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<{ ok: true; value: ReleaseReadinessInput } | ReleaseCandidateLifecycleFailure> {
  const identities = new Map(inventory.map((entry) => [entry.path, entry]));
  const gamePrefix = `game/dota_addons/${input.addonName}`;
  const contentPrefix = `content/dota_addons/${input.addonName}`;
  const required = (
    label: ReleaseReadinessInput["requiredPaths"][number]["label"],
    path: string,
    expectedKind: "file" | "directory"
  ): ReleaseReadinessInput["requiredPaths"][number] => {
    const entry = identities.get(path);
    return { label, present: entry !== undefined, kind: entry?.kind, expectedKind };
  };
  const requiredPaths: ReleaseReadinessInput["requiredPaths"] = [
    { label: "game addon root", present: true, kind: "directory", expectedKind: "directory" },
    { label: "content addon root", present: true, kind: "directory", expectedKind: "directory" },
    required("addon metadata", `${gamePrefix}/addoninfo.txt`, "file"),
    required("lua entry", `${gamePrefix}/scripts/vscripts/addon_game_mode.lua`, "file"),
    required("localization file", `${gamePrefix}/resource/addon_${input.addonName}_english.txt`, "file"),
    required("content maps directory", `${contentPrefix}/maps`, "directory"),
    required("hero list", `${gamePrefix}/scripts/npc/herolist.txt`, "file"),
    required("hero data", `${gamePrefix}/scripts/npc/npc_heroes_custom.txt`, "file"),
    required("unit support file", `${gamePrefix}/scripts/npc/npc_units_custom.txt`, "file"),
    required("ability support file", `${gamePrefix}/scripts/npc/npc_abilities_custom.txt`, "file")
  ];

  const observations = new Map<string, Extract<AcceptedSourceReadResult, { ok: true }>>();
  for (const entry of inventory.filter((candidate) => candidate.kind === "file" && isReleaseTextPath(candidate.path))) {
    const observed = await parseAcceptedSourceRead(
      async () => await lifecycle.readAcceptedSourceFile(input, entry, MAX_SECRET_SCAN_BYTES)
    );
    if (!observed.ok) return observed;
    observations.set(entry.path, observed.value);
  }

  let metadata: ReleaseReadinessInput["metadata"] = { state: "missing" };
  const metadataObservation = observations.get(`${gamePrefix}/addoninfo.txt`);
  if (metadataObservation?.state === "readable") {
    metadata = { state: "readable", content: metadataObservation.content };
  } else if (metadataObservation?.state === "oversized") {
    metadata = { state: "oversized", path: "addoninfo.txt" };
  }

  const requiredText = new Set([
    "addoninfo.txt",
    "scripts/vscripts/addon_game_mode.lua",
    `resource/addon_${input.addonName}_english.txt`,
    "scripts/npc/herolist.txt",
    "scripts/npc/npc_heroes_custom.txt",
    "scripts/npc/npc_units_custom.txt",
    "scripts/npc/npc_abilities_custom.txt"
  ]);
  const scanRoots: ReleaseReadinessInput["scanRoots"] = [];
  for (const root of ["game", "content"] as const) {
    const prefix = root === "game" ? gamePrefix : contentPrefix;
    const files: ReleaseReadinessInput["scanRoots"][number]["files"] = [];
    for (const entry of inventory.filter((candidate) => candidate.root === root && candidate.kind === "file")) {
      const relativePath = entry.path.slice(prefix.length + 1);
      if (!isReleaseTextPath(relativePath)) {
        files.push({ relativePath, state: "non-text", requiredText: requiredText.has(relativePath) });
        continue;
      }
      const observed = observations.get(entry.path);
      if (observed?.state === "oversized") {
        files.push({ relativePath, state: "oversized", requiredText: requiredText.has(relativePath) });
      } else if (observed?.state === "readable") {
        files.push({ relativePath, state: "text", content: observed.content, requiredText: requiredText.has(relativePath) });
      } else files.push({ relativePath, state: "unreadable", requiredText: requiredText.has(relativePath) });
    }
    scanRoots.push({ root, files });
  }
  return { ok: true, value: { requiredPaths, metadata, scanRoots } };
}

async function parseAcceptedSourceRead(
  acquire: () => Promise<unknown>
): Promise<
  | { ok: true; value: Extract<AcceptedSourceReadResult, { ok: true }> }
  | ReleaseCandidateLifecycleFailure
> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    const ok = Reflect.get(result, "ok");
    if (ok === false) {
      const code = Reflect.get(result, "code");
      if (code === "SOURCE_FILE_IDENTITY_CHANGED" || code === "SOURCE_FILE_READ_FAILED") {
        return lifecycleBlocked(code, "assembly");
      }
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    const state = Reflect.get(result, "state");
    const size = Reflect.get(result, "size");
    if (ok !== true || !Number.isSafeInteger(size) || size < 0) {
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    const identityMatched = Reflect.get(result, "identityMatched");
    const kindMatched = Reflect.get(result, "kindMatched");
    const contained = Reflect.get(result, "contained");
    if (identityMatched !== true || kindMatched !== true || contained !== true) {
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    if (state === "oversized" && size > MAX_SECRET_SCAN_BYTES) {
      return { ok: true, value: { ok: true, state, size, identityMatched, kindMatched, contained } };
    }
    const content = Reflect.get(result, "content");
    if (
      state === "readable"
      && size <= MAX_SECRET_SCAN_BYTES
      && typeof content === "string"
      && Buffer.byteLength(content, "utf8") === size
    ) {
      return { ok: true, value: { ok: true, state, size, content, identityMatched, kindMatched, contained } };
    }
  } catch {
    return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
  }
  return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
}

async function parseCandidateCleanupResult(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await acquire();
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

    const code = Reflect.get(result, "code");
    if (
      ok === false
      && typeof removed === "boolean"
      && typeof absent === "boolean"
      && typeof identityMatched === "boolean"
      && isCandidateLeaseCleanupFailureCode(code)
    ) {
      return lifecycleBlocked(code, "removal");
    }
  } catch {
    return lifecycleBlocked("CANDIDATE_CLEANUP_RESULT_INVALID", "removal");
  }
  return lifecycleBlocked("CANDIDATE_CLEANUP_RESULT_INVALID", "removal");
}

function isCandidateLeaseCleanupFailureCode(
  value: unknown
): value is CandidateLeaseCleanupFailureCode {
  return value === "CANDIDATE_IDENTITY_MISMATCH"
    || value === "CANDIDATE_REMOVAL_FAILED"
    || value === "CANDIDATE_ABSENCE_UNVERIFIED"
    || value === "CANDIDATE_LEASE_INVALID";
}

function isCandidateRootIsolated(
  candidateRoot: string,
  input: ValidatedReleaseCandidateInput
): boolean {
  if (!isPathInside(candidateRoot, input.tempParent)) return false;
  const protectedRoots = [input.dotaRoot, input.gameAddonRoot, input.contentAddonRoot, input.repositoryRoot];
  return protectedRoots.every((root) => (
    !isPathAtOrInside(candidateRoot, root) && !isPathAtOrInside(root, candidateRoot)
  ));
}

function lifecycleBlocked(
  code: string,
  category: ReleaseCandidateLifecycleBlocker["category"]
): ReleaseCandidateLifecycleFailure {
  return { ok: false, blockers: [{ code, category }] };
}

type InventoryDirectoryInput = {
  root: ReleaseCandidateSourceRoot;
  sourceRoot: string;
  sourcePath: string;
  identity: string;
  segments: string[];
  filesystem: ReleaseCandidateFilesystem;
  entries: ReleaseCandidateSourceEntry[];
  blockers: ReleaseCandidateInventoryBlocker[];
  identities: Map<string, Set<string>>;
};

async function inventorySourceDirectory(input: InventoryDirectoryInput): Promise<void> {
  let names: string[];
  try {
    names = await input.filesystem.readDirectory(input.sourcePath);
  } catch {
    input.blockers.push({
      code: "SOURCE_ENTRY_UNREADABLE",
      path: input.identity,
      category: "unreadable"
    });
    return;
  }

  for (const name of [...names].sort(compareOrdinal)) {
    const identity = safeChildIdentity(input.identity, name);
    const invalidCategory = invalidSourceNameCategory(name);
    if (invalidCategory !== undefined) {
      input.blockers.push({
        code: "SOURCE_IDENTITY_INVALID",
        path: identity,
        category: invalidCategory
      });
      continue;
    }

    addIdentity(input.identities, identity);
    const sourcePath = join(input.sourceRoot, ...input.segments, name);
    let kind: ReleaseCandidateEntryKind;
    try {
      kind = normalizeEntryKind(await input.filesystem.classifySourceEntry(sourcePath));
    } catch {
      input.blockers.push({
        code: "SOURCE_ENTRY_UNREADABLE",
        path: identity,
        category: "unreadable"
      });
      continue;
    }

    if (kind !== "file" && kind !== "directory") {
      input.blockers.push({ code: "SOURCE_ENTRY_UNSAFE", path: identity, category: kind });
      continue;
    }

    let canonicalPath: string;
    try {
      canonicalPath = await input.filesystem.realpath(sourcePath);
    } catch {
      input.blockers.push({
        code: "SOURCE_ENTRY_UNREADABLE",
        path: identity,
        category: "unreadable"
      });
      continue;
    }
    if (!isPathAtOrInside(canonicalPath, input.sourceRoot)) {
      input.blockers.push({
        code: "SOURCE_ENTRY_OUTSIDE_ROOT",
        path: identity,
        category: "escape"
      });
      continue;
    }

    input.entries.push({ root: input.root, path: identity, kind });

    if (kind === "directory") {
      await inventorySourceDirectory({
        ...input,
        sourcePath,
        identity,
        segments: [...input.segments, name]
      });
    }
  }
}

async function classifySourceEntry(path: string): Promise<ReleaseCandidateEntryKind> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "special";
}

function normalizeEntryKind(kind: unknown): ReleaseCandidateEntryKind {
  if (
    kind === "file"
    || kind === "directory"
    || kind === "symbolic-link"
    || kind === "reparse"
    || kind === "special"
    || kind === "unknown"
  ) {
    return kind;
  }
  return "unknown";
}

function invalidSourceNameCategory(name: string): "absolute" | "traversal" | "separator" | undefined {
  if (isAbsolute(name) || /^[A-Za-z]:[\\/]/u.test(name) || /^[/\\]{2}/u.test(name)) return "absolute";
  if (name === "" || name === "." || name === "..") return "traversal";
  if (name.includes("/") || name.includes("\\")) return "separator";
  return undefined;
}

function safeChildIdentity(parent: string, name: string): string {
  const normalized = name.replaceAll("\\", "/").replace(/^\/+/, "");
  return `${parent}/${normalized}`;
}

function foldIdentity(identity: string): string {
  return identity.toLowerCase();
}

function addIdentity(identities: Map<string, Set<string>>, identity: string): void {
  const folded = foldIdentity(identity);
  const group = identities.get(folded) ?? new Set<string>();
  group.add(identity);
  identities.set(folded, group);
}

function appendCollisionBlockers(
  identities: Map<string, Set<string>>,
  blockers: ReleaseCandidateInventoryBlocker[]
): void {
  for (const group of identities.values()) {
    if (group.size < 2) continue;
    for (const path of group) {
      blockers.push({
        code: "SOURCE_IDENTITY_COLLISION",
        path,
        category: "case-fold"
      });
    }
  }
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareInventoryBlockers(
  left: ReleaseCandidateInventoryBlocker,
  right: ReleaseCandidateInventoryBlocker
): number {
  return compareOrdinal(left.path, right.path)
    || compareOrdinal(left.code, right.code)
    || compareOrdinal(left.category, right.category);
}

type ValidDirectory =
  | { ok: true; path: string }
  | { ok: false; result: ReleaseCandidateInputResult };

async function validateDirectory(
  value: string,
  field: Exclude<ReleaseCandidateInputField, "addonName">,
  codePrefix: string,
  filesystem: ReleaseCandidateFilesystem
): Promise<ValidDirectory> {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, result: blocked(`${codePrefix}_REQUIRED`, field, "required") };
  }

  const path = resolve(value);
  let stats: Pick<Stats, "isDirectory">;
  try {
    stats = await filesystem.lstat(path);
  } catch (error) {
    const category = errorCode(error) === "ENOENT" ? "missing" : "unreadable";
    const suffix = category === "missing" ? "MISSING" : "UNREADABLE";
    return { ok: false, result: blocked(`${codePrefix}_${suffix}`, field, category) };
  }

  if (!stats.isDirectory()) {
    return { ok: false, result: blocked(`${codePrefix}_NOT_DIRECTORY`, field, "not-directory") };
  }

  try {
    return { ok: true, path: await filesystem.realpath(path) };
  } catch {
    return { ok: false, result: blocked(`${codePrefix}_UNREADABLE`, field, "unreadable") };
  }
}

function blocked(
  code: string,
  field: ReleaseCandidateInputField,
  category: ReleaseCandidateInputBlocker["category"]
): ReleaseCandidateInputResult {
  return { ok: false, blockers: [{ code, field, category }] };
}

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isPathAtOrInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  return isPathInside(child, parent);
}

function isPathInside(child: string, parent: string): boolean {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

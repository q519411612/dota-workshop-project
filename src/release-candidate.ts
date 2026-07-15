import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { constants as filesystemConstants, type Stats } from "node:fs";
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
  makeDirectory?(path: string): Promise<void>;
  copySourceFile?(source: string, destination: string): Promise<void>;
  readSourceFile?(path: string): Promise<string>;
  sourceFileSize?(path: string): Promise<number>;
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
    createCandidateRoot: async (input) => await mkdtemp(join(input.tempParent, "dota-release-candidate-")),
    makeDirectory: async (path) => await mkdir(path),
    copySourceFile: async (source, destination) => (
      await copyFile(source, destination, filesystemConstants.COPYFILE_EXCL)
    ),
    readSourceFile: async (path) => await readFile(path, "utf8"),
    sourceFileSize: async (path) => (await stat(path)).size
  };
}

export type ReleaseCandidateLifecycleBlocker = Readonly<{
  code: string;
  category: "assembly" | "creation" | "inspection" | "removal" | "unsafe-isolation";
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

export type IdentityBoundCandidateLifecycle = Readonly<{
  [identityBoundCandidateLifecycleBrand]: true;
  identityBoundCleanup: true;
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<Readonly<{
    inspectionRoot: string;
    lease: ReleaseCandidateLease;
  }>>;
  cleanupCandidateLease(lease: ReleaseCandidateLease): Promise<CandidateLeaseCleanupResult>;
}>;

export function createIdentityBoundCandidateLifecycle<TIdentity extends object>(operations: {
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<Readonly<{
    inspectionRoot: string;
    identity: TIdentity;
  }>>;
  cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
}): IdentityBoundCandidateLifecycle {
  const identities = new WeakMap<ReleaseCandidateLease, TIdentity>();
  const createCandidateLease = operations.createCandidateLease.bind(operations);
  const cleanupCandidateLease = operations.cleanupCandidateLease.bind(operations);
  return Object.freeze({
    [identityBoundCandidateLifecycleBrand]: true as const,
    identityBoundCleanup: true as const,
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
    }
  });
}

type BoundCandidateLifecycle = Readonly<{
  lstat: ReleaseCandidateFilesystem["lstat"];
  realpath: ReleaseCandidateFilesystem["realpath"];
  classifySourceEntry: ReleaseCandidateFilesystem["classifySourceEntry"];
  createCandidateLease: IdentityBoundCandidateLifecycle["createCandidateLease"];
  cleanupCandidateLease: IdentityBoundCandidateLifecycle["cleanupCandidateLease"];
  makeDirectory: (path: string) => Promise<void>;
  copySourceFile: (source: string, destination: string) => Promise<void>;
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
  if (filesystem.readSourceFile === undefined || filesystem.sourceFileSize === undefined) {
    return lifecycleBlocked("RELEASE_READINESS_CAPABILITY_REQUIRED", "creation");
  }
  const readinessBlockers = await releaseReadinessBlockers(
    prepared.value,
    inventory.entries,
    filesystem.readSourceFile.bind(filesystem),
    filesystem.sourceFileSize.bind(filesystem)
  );
  if (readinessBlockers.length > 0) return { ok: false, blockers: readinessBlockers };

  const capability = filesystem.candidateLifecycle;
  if (
    capability?.identityBoundCleanup !== true
    || capability[identityBoundCandidateLifecycleBrand] !== true
  ) {
    return lifecycleBlocked("IDENTITY_BOUND_CLEANUP_REQUIRED", "creation");
  }
  if (filesystem.makeDirectory === undefined || filesystem.copySourceFile === undefined) {
    return lifecycleBlocked("CANDIDATE_ASSEMBLY_CAPABILITY_REQUIRED", "creation");
  }
  const lifecycle = bindIdentityBoundCandidateLifecycle(filesystem);
  if (lifecycle === undefined) {
    return lifecycleBlocked("IDENTITY_BOUND_CLEANUP_REQUIRED", "creation");
  }

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
      prepared.value,
      inventory.entries,
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
    || filesystem.makeDirectory === undefined
    || filesystem.copySourceFile === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    lstat: filesystem.lstat.bind(filesystem),
    realpath: filesystem.realpath.bind(filesystem),
    classifySourceEntry: filesystem.classifySourceEntry.bind(filesystem),
    createCandidateLease: capability.createCandidateLease.bind(capability),
    cleanupCandidateLease: capability.cleanupCandidateLease.bind(capability),
    makeDirectory: filesystem.makeDirectory.bind(filesystem),
    copySourceFile: filesystem.copySourceFile.bind(filesystem)
  });
}

async function inspectCandidateLease<T>(
  inspectionRoot: string,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
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
    const assemblyFailure = await assembleReleaseCandidate(canonicalRoot, input, inventory, lifecycle);
    if (assemblyFailure !== undefined) return assemblyFailure;
    try {
      return { ok: true, value: await inspect(canonicalRoot) };
    } catch {
      return lifecycleBlocked("CANDIDATE_INSPECTION_FAILED", "inspection");
    }
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
  }
}

async function assembleReleaseCandidate(
  candidateRoot: string,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  filesystem: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  const fixedDirectories = [
    { path: "content", sourceRoot: input.contentAddonRoot },
    { path: "content/dota_addons", sourceRoot: input.contentAddonRoot },
    { path: `content/dota_addons/${input.addonName}`, sourceRoot: input.contentAddonRoot },
    { path: "game", sourceRoot: input.gameAddonRoot },
    { path: "game/dota_addons", sourceRoot: input.gameAddonRoot },
    { path: `game/dota_addons/${input.addonName}`, sourceRoot: input.gameAddonRoot }
  ];

  for (const directory of fixedDirectories) {
    const sourceFailure = await revalidateSourceEntry(
      directory.sourceRoot,
      directory.sourceRoot,
      "directory",
      filesystem
    );
    if (sourceFailure !== undefined) return sourceFailure;
    const destination = join(candidateRoot, ...directory.path.split("/"));
    const destinationFailure = await validateDestinationParent(destination, candidateRoot, filesystem);
    if (destinationFailure !== undefined) return destinationFailure;
    try {
      await filesystem.makeDirectory(destination);
    } catch {
      return lifecycleBlocked("CANDIDATE_ASSEMBLY_FAILED", "assembly");
    }
  }

  for (const entry of inventory) {
    const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
    const prefix = `${entry.root}/dota_addons/${input.addonName}`;
    const relativeIdentity = entry.path.slice(prefix.length + 1);
    const source = join(sourceRoot, ...relativeIdentity.split("/"));
    const sourceFailure = await revalidateSourceEntry(source, sourceRoot, entry.kind, filesystem);
    if (sourceFailure !== undefined) return sourceFailure;

    const destination = join(candidateRoot, ...entry.path.split("/"));
    const destinationFailure = await validateDestinationParent(destination, candidateRoot, filesystem);
    if (destinationFailure !== undefined) return destinationFailure;
    try {
      if (entry.kind === "directory") {
        await filesystem.makeDirectory(destination);
      } else {
        await filesystem.copySourceFile(source, destination);
      }
    } catch {
      return lifecycleBlocked("CANDIDATE_ASSEMBLY_FAILED", "assembly");
    }
  }
  return undefined;
}

async function revalidateSourceEntry(
  source: string,
  sourceRoot: string,
  expectedKind: "file" | "directory",
  filesystem: Pick<ReleaseCandidateFilesystem, "classifySourceEntry" | "realpath">
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const kind = normalizeEntryKind(await filesystem.classifySourceEntry(source));
    if (kind !== expectedKind) {
      return lifecycleBlocked("SOURCE_ENTRY_CHANGED", "assembly");
    }
    const canonicalSource = await filesystem.realpath(source);
    if (!isPathAtOrInside(canonicalSource, sourceRoot)) {
      return lifecycleBlocked("SOURCE_ENTRY_CHANGED", "assembly");
    }
    return undefined;
  } catch {
    return lifecycleBlocked("SOURCE_ENTRY_CHANGED", "assembly");
  }
}

async function validateDestinationParent(
  destination: string,
  candidateRoot: string,
  filesystem: Pick<ReleaseCandidateFilesystem, "lstat" | "realpath">
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  if (!isPathInside(destination, candidateRoot)) {
    return lifecycleBlocked("CANDIDATE_DESTINATION_UNSAFE", "unsafe-isolation");
  }
  try {
    try {
      await filesystem.lstat(destination);
      return lifecycleBlocked("CANDIDATE_DESTINATION_UNEXPECTED", "unsafe-isolation");
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        return lifecycleBlocked("CANDIDATE_DESTINATION_UNSAFE", "unsafe-isolation");
      }
    }
    const canonicalParent = await filesystem.realpath(resolve(destination, ".."));
    if (!isPathAtOrInside(canonicalParent, candidateRoot)) {
      return lifecycleBlocked("CANDIDATE_DESTINATION_UNSAFE", "unsafe-isolation");
    }
    return undefined;
  } catch {
    return lifecycleBlocked("CANDIDATE_DESTINATION_UNSAFE", "unsafe-isolation");
  }
}

async function releaseReadinessBlockers(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  readSourceFile: (path: string) => Promise<string>,
  sourceFileSize: (path: string) => Promise<number>
): Promise<ReleaseReadinessFinding[]> {
  const observations = await collectReleaseReadinessInput(input, inventory, readSourceFile, sourceFileSize);
  return evaluateReleaseReadiness(observations).filter((finding) => finding.disposition === "blocker");
}

async function collectReleaseReadinessInput(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  readSourceFile: (path: string) => Promise<string>,
  sourceFileSize: (path: string) => Promise<number>
): Promise<ReleaseReadinessInput> {
  const identities = new Set(inventory.map((entry) => entry.path));
  const gamePrefix = `game/dota_addons/${input.addonName}`;
  const contentPrefix = `content/dota_addons/${input.addonName}`;
  const requiredPaths: ReleaseReadinessInput["requiredPaths"] = [
    { label: "game addon root", present: true },
    { label: "content addon root", present: true },
    { label: "addon metadata", present: identities.has(`${gamePrefix}/addoninfo.txt`) },
    { label: "lua entry", present: identities.has(`${gamePrefix}/scripts/vscripts/addon_game_mode.lua`) },
    { label: "localization file", present: identities.has(`${gamePrefix}/resource/addon_${input.addonName}_english.txt`) },
    { label: "content maps directory", present: identities.has(`${contentPrefix}/maps`) },
    { label: "hero list", present: identities.has(`${gamePrefix}/scripts/npc/herolist.txt`) },
    { label: "hero data", present: identities.has(`${gamePrefix}/scripts/npc/npc_heroes_custom.txt`) },
    { label: "unit support file", present: identities.has(`${gamePrefix}/scripts/npc/npc_units_custom.txt`) },
    { label: "ability support file", present: identities.has(`${gamePrefix}/scripts/npc/npc_abilities_custom.txt`) }
  ];

  const metadataPath = join(input.gameAddonRoot, "addoninfo.txt");
  let metadata: ReleaseReadinessInput["metadata"] = { state: "missing" };
  if (identities.has(`${gamePrefix}/addoninfo.txt`)) {
    try {
      metadata = { state: "readable", content: await readSourceFile(metadataPath) };
    } catch {
      metadata = { state: "unreadable", path: "addoninfo.txt" };
    }
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
    const sourceRoot = root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
    const prefix = root === "game" ? gamePrefix : contentPrefix;
    const files: ReleaseReadinessInput["scanRoots"][number]["files"] = [];
    for (const entry of inventory.filter((candidate) => candidate.root === root && candidate.kind === "file")) {
      const relativePath = entry.path.slice(prefix.length + 1);
      const source = join(sourceRoot, ...relativePath.split("/"));
      if (!isReleaseTextPath(relativePath)) {
        files.push({ relativePath, state: "non-text", requiredText: requiredText.has(relativePath) });
        continue;
      }
      try {
        const size = await sourceFileSize(source);
        if (size > MAX_SECRET_SCAN_BYTES) {
          files.push({ relativePath, state: "oversized", requiredText: requiredText.has(relativePath) });
        } else {
          files.push({
            relativePath,
            state: "text",
            content: await readSourceFile(source),
            requiredText: requiredText.has(relativePath)
          });
        }
      } catch {
        files.push({ relativePath, state: "unreadable", requiredText: requiredText.has(relativePath) });
      }
    }
    scanRoots.push({ root, files });
  }
  return { requiredPaths, metadata, scanRoots };
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
): ReleaseCandidateLifecycleResult<never> {
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

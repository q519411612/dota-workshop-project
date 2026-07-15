import { lstat, mkdtemp, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Stats } from "node:fs";
import { validateAddonName } from "./addon.js";

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
  category: "creation" | "inspection" | "removal" | "unsafe-isolation";
}>;

export type ReleaseCandidateLifecycleResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      blockers: Array<
        ReleaseCandidateInputBlocker
        | ReleaseCandidateInventoryBlocker
        | ReleaseCandidateLifecycleBlocker
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
  createCandidateLease: IdentityBoundCandidateLifecycle["createCandidateLease"];
  cleanupCandidateLease: IdentityBoundCandidateLifecycle["cleanupCandidateLease"];
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
    outcome = await inspectCandidateLease(created.inspectionRoot, prepared.value, lifecycle, inspect);
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
  ) {
    return undefined;
  }
  return Object.freeze({
    lstat: filesystem.lstat.bind(filesystem),
    realpath: filesystem.realpath.bind(filesystem),
    createCandidateLease: capability.createCandidateLease.bind(capability),
    cleanupCandidateLease: capability.cleanupCandidateLease.bind(capability)
  });
}

async function inspectCandidateLease<T>(
  inspectionRoot: string,
  input: ValidatedReleaseCandidateInput,
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
    try {
      return { ok: true, value: await inspect(canonicalRoot) };
    } catch {
      return lifecycleBlocked("CANDIDATE_INSPECTION_FAILED", "inspection");
    }
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
  }
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

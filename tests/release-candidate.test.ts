import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  utimes,
  writeFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { constants as filesystemConstants } from "node:fs";
import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  continueReleaseCandidatePreparation,
  createIdentityBoundCandidateLifecycle,
  inventoryReleaseCandidateSources,
  prepareReleaseCandidateInput,
  withAssembledReleaseCandidate,
  type CandidateLeaseCleanupResult,
  type CandidateExpectedEntry,
  type CandidateMaterializationOperation,
  type CandidateMaterializationResult,
  type CandidateRootInspectionResult,
  type CandidateTreeReconciliationResult,
  type AcceptedSourceReadResult,
  type AcceptedSourceObservationResult,
  type IdentityBoundCandidateLifecycle,
  type ReleaseCandidateEntryKind,
  type ReleaseCandidateFilesystem,
  type ReleaseCandidateInspectionValue,
  type ReleaseCandidateLifecycleResult,
  type RegisteredCandidateCreation,
  type ValidatedReleaseCandidateInput
} from "../src/release-candidate.js";
import { MAX_SECRET_SCAN_BYTES, isReleaseTextPath } from "../src/release-readiness.js";

type Fixture = {
  root: string;
  dotaRoot: string;
  repositoryRoot: string;
  tempParent: string;
  gameAddonRoot: string;
  contentAddonRoot: string;
};

function withoutCleanup<T extends { cleanup?: unknown; operation?: unknown; artifactValidation?: unknown }>(
  result: T
): Omit<T, "cleanup" | "operation" | "artifactValidation"> {
  const {
    cleanup: _cleanup,
    operation: _operation,
    artifactValidation: _artifactValidation,
    ...rest
  } = result;
  return rest;
}

function withoutResultDomains<T extends { operation?: unknown; artifactValidation?: unknown }>(
  result: T
): Omit<T, "operation" | "artifactValidation"> {
  const { operation: _operation, artifactValidation: _artifactValidation, ...rest } = result;
  return rest;
}

const fixtureRoots: string[] = [];

const compactAssignment = (name: string, value: string): string => [name, "=", value].join("");
const credentialPasswordFixture = (value: string): string => ["credential_", compactAssignment("password", value)].join("");
const githubPatFixture = (): string => [["g", "h", "p", "_"].join(""), "A".repeat(24)].join("");

type SourceTreeSnapshotEntry = Readonly<{
  path: string;
  kind: "directory" | "file" | "symbolic-link" | "special";
  bytes?: string;
}>;

type FixtureIntegrityObservation = Readonly<{
  ok: true;
  schemaVersion: "1.0";
  root: "game" | "content";
  path: string;
  bytes: number;
  sha256: string;
  identityMatched: true;
  kindMatched: true;
  contained: true;
}>;

async function streamFixtureIntegrity(
  absolutePath: string,
  root: "game" | "content",
  path: string,
  chunkSizes?: number[]
): Promise<FixtureIntegrityObservation> {
  const releaseCandidate = await import("../src/release-candidate.js") as unknown as {
    observeIdentityBoundIntegrityStream?: (input: unknown) => Promise<unknown>;
  };
  const observe = releaseCandidate.observeIdentityBoundIntegrityStream;
  if (observe === undefined) throw new Error("production integrity stream helper missing");
  const result = await observe({
    root,
    path,
    identityMatched: true,
    kindMatched: true,
    contained: true,
    openByteStream: async () => {
      const handle = await open(absolutePath, filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
      return (async function* (): AsyncGenerator<Uint8Array> {
        let chunkIndex = 0;
        try {
          for (;;) {
            const requested = chunkSizes?.[chunkIndex] ?? 64;
            const buffer = Buffer.alloc(requested);
            const read = await handle.read(buffer, 0, requested, null);
            if (read.bytesRead === 0) return;
            chunkIndex += 1;
            yield buffer.subarray(0, read.bytesRead);
          }
        } finally {
          await handle.close();
        }
      })();
    }
  });
  if (result === null || typeof result !== "object" || Reflect.get(result, "ok") !== true) {
    throw new Error("production integrity stream helper rejected fixture stream");
  }
  return result as FixtureIntegrityObservation;
}

async function snapshotSourceTrees(fixture: Fixture): Promise<SourceTreeSnapshotEntry[]> {
  const snapshot: SourceTreeSnapshotEntry[] = [];
  const walk = async (root: string, label: "game" | "content", directory: string): Promise<void> => {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name);
      const info = await lstat(path);
      const identity = `${label}/${relative(root, path).replaceAll("\\", "/")}`;
      if (info.isSymbolicLink()) snapshot.push({ path: identity, kind: "symbolic-link" });
      else if (info.isDirectory()) {
        snapshot.push({ path: identity, kind: "directory" });
        await walk(root, label, path);
      } else if (info.isFile()) {
        snapshot.push({ path: identity, kind: "file", bytes: (await readFile(path)).toString("base64") });
      } else snapshot.push({ path: identity, kind: "special" });
    }
  };
  await walk(fixture.gameAddonRoot, "game", fixture.gameAddonRoot);
  await walk(fixture.contentAddonRoot, "content", fixture.contentAddonRoot);
  return snapshot;
}

async function classifyFixtureEntry(path: string): Promise<ReleaseCandidateEntryKind> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "special";
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dota-candidate-input-"));
  fixtureRoots.push(root);

  const dotaRoot = join(root, "dota");
  const repositoryRoot = join(root, "repository");
  const tempParent = join(root, "candidate-parent");
  const gameAddonRoot = join(dotaRoot, "game", "dota_addons", "fixture_addon");
  const contentAddonRoot = join(dotaRoot, "content", "dota_addons", "fixture_addon");
  await Promise.all([
    mkdir(gameAddonRoot, { recursive: true }),
    mkdir(contentAddonRoot, { recursive: true }),
    mkdir(repositoryRoot, { recursive: true }),
    mkdir(tempParent, { recursive: true })
  ]);

  return { root, dotaRoot, repositoryRoot, tempParent, gameAddonRoot, contentAddonRoot };
}

async function populateReadyFixture(fixture: Fixture): Promise<void> {
  const files: Array<[string, string]> = [
    [join(fixture.gameAddonRoot, "addoninfo.txt"), `
"AddonInfo"
{
  "addonSteamAppID" "570"
  "addontitle" "Fixture"
  "addonAuthor" "Author"
  "addonDescription" "Ready"
  "addonVersion" "1"
  "DefaultMap" "fixture_map"
  "maps" "fixture_map"
}
`],
    [join(fixture.gameAddonRoot, "scripts/vscripts/addon_game_mode.lua"), "function Activate() end\n"],
    [join(fixture.gameAddonRoot, "resource/addon_fixture_addon_english.txt"), "localization\n"],
    [join(fixture.gameAddonRoot, "scripts/npc/herolist.txt"), "heroes\n"],
    [join(fixture.gameAddonRoot, "scripts/npc/npc_heroes_custom.txt"), "heroes\n"],
    [join(fixture.gameAddonRoot, "scripts/npc/npc_units_custom.txt"), "units\n"],
    [join(fixture.gameAddonRoot, "scripts/npc/npc_abilities_custom.txt"), "abilities\n"]
  ];
  for (const [path, content] of files) {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, content);
  }
  await mkdir(join(fixture.contentAddonRoot, "maps"), { recursive: true });
}

const assemblyOperations = {
  makeDirectory: async (path: string) => await mkdir(path),
  copySourceFile: async (source: string, destination: string) => await copyFile(source, destination),
  readSourceFile: async (path: string) => await readFile(path, "utf8"),
  sourceFileSize: async (path: string) => (await lstat(path)).size
};

function createNoFollowSourceReader() {
  return async (
    input: ValidatedReleaseCandidateInput,
    entry: { root: "game" | "content"; path: string; kind: "file" | "directory" },
    maxBytes: number
  ) => {
    const relativePath = entry.path.split(`/dota_addons/${input.addonName}/`)[1];
    const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
    try {
      const handle = await open(
        join(sourceRoot, ...relativePath.split("/")),
        filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW
      );
      try {
        const info = await handle.stat();
        if (!info.isFile()) return { ok: false as const, code: "SOURCE_FILE_IDENTITY_CHANGED" as const };
        const base = { ok: true as const, schemaVersion: "1.0" as const, size: info.size, identityMatched: true as const, kindMatched: true as const, contained: true as const };
        if (!isReleaseTextPath(relativePath)) return { ...base, state: "binary" as const };
        if (info.size > maxBytes) return { ...base, state: "oversized" as const };
        return { ...base, state: "readable" as const, bytes: await handle.readFile() };
      } finally {
        await handle.close();
      }
    } catch {
      return { ok: false as const, code: "SOURCE_FILE_IDENTITY_CHANGED" as const };
    }
  };
}

function createAcceptedSourceObserver() {
  return async (
    input: ValidatedReleaseCandidateInput,
    entry: { root: "game" | "content"; path: string; kind: "file" | "directory" }
  ) => {
    const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
    const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
    const sourcePath = join(sourceRoot, ...entry.path.slice(prefix.length).split("/"));
    try {
      const info = await lstat(sourcePath);
      const kind = info.isFile() ? "file" as const : info.isDirectory() ? "directory" as const : undefined;
      if (kind === undefined || kind !== entry.kind) return { ok: false as const, code: "SOURCE_ENTRY_CHANGED" as const };
      const canonicalPath = await realpath(sourcePath);
      if (canonicalPath !== sourceRoot && !canonicalPath.startsWith(`${sourceRoot}/`)) {
        return { ok: false as const, code: "SOURCE_ENTRY_CHANGED" as const };
      }
      return {
        ok: true as const,
        kind,
        canonicalPath,
        size: info.size,
        mtimeMs: info.mtimeMs,
        ctimeMs: info.ctimeMs,
        mode: info.mode,
        identityMatched: true as const,
        contained: true as const
      };
    } catch {
      return { ok: false as const, code: "SOURCE_ENTRY_CHANGED" as const };
    }
  };
}

function createFixtureIdentityBoundCandidateLifecycle<TIdentity extends object>(operations: {
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<{
    inspectionRoot: string;
    identity: TIdentity;
  }>;
  acquireCandidateLease?(
    input: ValidatedReleaseCandidateInput,
    createRegisteredCandidate: () => Promise<RegisteredCandidateCreation>
  ): Promise<unknown>;
  createCandidateState?(
    input: ValidatedReleaseCandidateInput,
    registerCreatedCandidate: (inspectionRoot: string, identity: TIdentity) => RegisteredCandidateCreation
  ): Promise<unknown>;
  cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
  readAcceptedSourceFile?(input: ValidatedReleaseCandidateInput, entry: Parameters<ReturnType<typeof createNoFollowSourceReader>>[1], maxBytes: number): Promise<AcceptedSourceReadResult>;
  inspectCandidateRoot?(identity: TIdentity): Promise<CandidateRootInspectionResult>;
  materializeCandidateEntry?(identity: TIdentity, input: ValidatedReleaseCandidateInput, operation: CandidateMaterializationOperation): Promise<CandidateMaterializationResult>;
  reconcileCandidateTree?(identity: TIdentity, expected: CandidateExpectedEntry[]): Promise<CandidateTreeReconciliationResult>;
  observeAcceptedSource?(
    input: ValidatedReleaseCandidateInput,
    entry: Parameters<ReturnType<typeof createNoFollowSourceReader>>[1]
  ): Promise<unknown>;
  observeAcceptedSourceEntry?(
    input: ValidatedReleaseCandidateInput,
    entry: Parameters<ReturnType<typeof createNoFollowSourceReader>>[1]
  ): Promise<AcceptedSourceObservationResult>;
  observeCandidate?(identity: TIdentity, expected: CandidateExpectedEntry[]): Promise<unknown>;
}) {
  const identityRoot = (identity: TIdentity): string => {
    const record = identity as Record<string, unknown>;
    const root = typeof record.root === "string" ? record.root : record.candidateRoot;
    if (typeof root !== "string") throw new Error("fixture identity does not expose its candidate root");
    return root;
  };
  const defaultInspect = async (identity: TIdentity): Promise<CandidateRootInspectionResult> => {
    const entries = await readdir(identityRoot(identity));
    return entries.length === 0
      ? { ok: true, empty: true, identityMatched: true }
      : { ok: false, code: "CANDIDATE_ROOT_NOT_EMPTY", entries };
  };
  const defaultMaterialize = async (
    identity: TIdentity,
    input: ValidatedReleaseCandidateInput,
    operation: CandidateMaterializationOperation
  ): Promise<CandidateMaterializationResult> => {
    const root = identityRoot(identity);
    const identityRecord = identity as Record<string, unknown>;
    if (typeof identityRecord.beforeMaterialize === "function") {
      await (identityRecord.beforeMaterialize as (operation: CandidateMaterializationOperation) => Promise<void>)(operation);
    }
    if (Array.isArray(identityRecord.materializedDestinations)) {
      identityRecord.materializedDestinations.push(join(root, ...operation.destination.split("/")));
    }
    if (
      identityRecord.failCopy === true
      && operation.kind === "file"
      && operation.source.path.endsWith("/texture.bin")
    ) return { ok: false, code: "CANDIDATE_MATERIALIZATION_FAILED" };
    if (
      identityRecord.aliasDestinationParent === true
      && operation.destination === `game/dota_addons/${input.addonName}`
    ) return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
    const destination = join(root, ...operation.destination.split("/"));
    try {
      const canonicalParent = await realpath(join(destination, ".."));
      if (canonicalParent !== root && !canonicalParent.startsWith(`${root}/`)) {
        return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
      }
      if (operation.kind === "directory") {
        await mkdir(destination);
      } else {
        if (Array.isArray(identityRecord.copiedDestinations)) {
          identityRecord.copiedDestinations.push(destination);
        }
        const prefix = `${operation.source.root}/dota_addons/${input.addonName}/`;
        const sourceRoot = operation.source.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const source = join(sourceRoot, ...operation.source.path.slice(prefix.length).split("/"));
        const sourceHandle = await open(source, filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
        try {
          const sourceInfo = await sourceHandle.stat();
          if (!sourceInfo.isFile()) return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
          const destinationHandle = await open(
            destination,
            filesystemConstants.O_WRONLY | filesystemConstants.O_CREAT | filesystemConstants.O_EXCL
          );
          try {
            await destinationHandle.writeFile(await sourceHandle.readFile());
          } finally {
            await destinationHandle.close();
          }
        } finally {
          await sourceHandle.close();
        }
      }
      const created = await lstat(destination);
      if (created.isSymbolicLink() || (operation.kind === "file" ? !created.isFile() : !created.isDirectory())) {
        return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
      }
      if (typeof identityRecord.afterMaterialize === "function") {
        await (identityRecord.afterMaterialize as (operation: CandidateMaterializationOperation) => Promise<void>)(operation);
      }
      return { ok: true, created: true, identityMatched: true, kindMatched: true, contained: true };
    } catch {
      if (operation.kind === "file") {
        const prefix = `${operation.source.root}/dota_addons/${input.addonName}/`;
        const sourceRoot = operation.source.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const sourcePath = join(sourceRoot, ...operation.source.path.slice(prefix.length).split("/"));
        try {
          const sourceInfo = await lstat(sourcePath);
          if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
        } catch {
          return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
        }
      }
      return { ok: false, code: "CANDIDATE_MATERIALIZATION_FAILED" };
    }
  };
  const defaultReconcile = async (
    identity: TIdentity,
    expected: CandidateExpectedEntry[]
  ): Promise<CandidateTreeReconciliationResult> => {
    const identityRecord = identity as Record<string, unknown>;
    if (typeof identityRecord.beforeReconcile === "function") {
      await (identityRecord.beforeReconcile as () => Promise<void>)();
    }
    const root = identityRoot(identity);
    const actual: CandidateExpectedEntry[] = [];
    const walk = async (directory: string): Promise<void> => {
      for (const name of (await readdir(directory)).sort()) {
        const path = join(directory, name);
        const info = await lstat(path);
        const identityPath = relative(root, path).replaceAll("\\", "/");
        if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) {
          actual.push({ path: identityPath, kind: "file" });
          continue;
        }
        actual.push({ path: identityPath, kind: info.isDirectory() ? "directory" : "file" });
        if (info.isDirectory()) await walk(path);
      }
    };
    await walk(root);
    const expectedMap = new Map(expected.map((entry) => [entry.path, entry.kind]));
    const actualMap = new Map(actual.map((entry) => [entry.path, entry.kind]));
    const issues: Extract<CandidateTreeReconciliationResult, { ok: false }>["issues"] = [];
    for (const entry of expected) {
      const kind = actualMap.get(entry.path);
      if (kind === undefined) issues.push({ code: "CANDIDATE_TREE_MISSING", path: entry.path });
      else if (kind !== entry.kind) issues.push({ code: "CANDIDATE_TREE_WRONG_KIND", path: entry.path, kind });
    }
    for (const entry of actual) {
      if (!expectedMap.has(entry.path)) issues.push({ code: "CANDIDATE_TREE_UNEXPECTED", path: entry.path, kind: entry.kind });
    }
    return issues.length === 0
      ? { ok: true, exact: true, identityMatched: true }
      : { ok: false, code: "CANDIDATE_TREE_MISMATCH", issues };
  };
  const defaultObserveAcceptedSource = async (
    input: ValidatedReleaseCandidateInput,
    entry: Parameters<ReturnType<typeof createNoFollowSourceReader>>[1]
  ): Promise<unknown> => {
    const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
    const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
    return await streamFixtureIntegrity(
      join(sourceRoot, ...entry.path.slice(prefix.length).split("/")),
      entry.root,
      entry.path
    );
  };
  const defaultObserveCandidate = async (
    identity: TIdentity,
    expected: CandidateExpectedEntry[]
  ): Promise<unknown> => ({
    ok: true,
    schemaVersion: "1.0",
    observations: await Promise.all(expected
      .filter((entry) => entry.kind === "file")
      .map(async (entry) => {
        const [root] = entry.path.split("/");
        return await streamFixtureIntegrity(
          join(identityRoot(identity), ...entry.path.split("/")),
          root as "game" | "content",
          entry.path
        );
      }))
  });
  const { createCandidateLease, createCandidateState, acquireCandidateLease, ...overrides } = operations;
  return createIdentityBoundCandidateLifecycle({
    readAcceptedSourceFile: createNoFollowSourceReader(),
    observeAcceptedSourceEntry: createAcceptedSourceObserver(),
    inspectCandidateRoot: defaultInspect,
    materializeCandidateEntry: defaultMaterialize,
    reconcileCandidateTree: defaultReconcile,
    observeAcceptedSource: defaultObserveAcceptedSource,
    observeCandidate: defaultObserveCandidate,
    ...overrides,
    createCandidateState: createCandidateState ?? (async (input, registerCreatedCandidate) => {
      const created = await createCandidateLease(input);
      return registerCreatedCandidate(created.inspectionRoot, created.identity);
    }),
    acquireCandidateLease: acquireCandidateLease ?? (async (_input, createRegisteredCandidate) => (
      await createRegisteredCandidate()
    ))
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("release candidate input validation", () => {
  test("constrains inspection callbacks to safe evidence types", () => {
    const input = { addonName: "fixture_addon", dotaRoot: "/dota", tempParent: "/temp" };
    const accepted = withAssembledReleaseCandidate(
      input,
      async () => ({ status: "ready", nested: [1, true, null] })
    );
    expectTypeOf(accepted).toMatchTypeOf<Promise<
      ReleaseCandidateLifecycleResult<ReleaseCandidateInspectionValue>
    >>();

    if (false) {
      // @ts-expect-error void 不是可序列化的检查证据
      void withAssembledReleaseCandidate(input, async () => undefined);
      // @ts-expect-error 函数能力不能作为检查证据返回
      void withAssembledReleaseCandidate(input, async () => (() => "live"));
      // @ts-expect-error 实例句柄不能作为检查证据返回
      void withAssembledReleaseCandidate(input, async () => new Date());
      // @ts-expect-error bigint 不属于受支持的证据标量
      void withAssembledReleaseCandidate(input, async () => 1n);
      // @ts-expect-error symbol 不属于受支持的证据标量
      void withAssembledReleaseCandidate(input, async () => Symbol("live"));
    }
  });

  test("assembles the complete fixed two-root layout", async () => {
    const fixture = await createFixture();
    const addonInfo = `
"AddonInfo"
{
  "addonSteamAppID" "570"
  "addontitle" "Fixture Addon"
  "addonAuthor" "Fixture Author"
  "addonDescription" "Complete release candidate fixture"
  "addonVersion" "1.0.0"
  "DefaultMap" "fixture_map"
  "maps" "fixture_map"
}
`;
    const binaryBytes = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x42]);
    const requiredFiles: Array<[string, string | Buffer]> = [
      [join(fixture.gameAddonRoot, "addoninfo.txt"), addonInfo],
      [join(fixture.gameAddonRoot, "scripts", "vscripts", "addon_game_mode.lua"), "function Activate() end\n"],
      [join(fixture.gameAddonRoot, "resource", "addon_fixture_addon_english.txt"), "fixture localization\n"],
      [join(fixture.gameAddonRoot, "scripts", "npc", "herolist.txt"), "heroes\n"],
      [join(fixture.gameAddonRoot, "scripts", "npc", "npc_heroes_custom.txt"), "heroes custom\n"],
      [join(fixture.gameAddonRoot, "scripts", "npc", "npc_units_custom.txt"), "units custom\n"],
      [join(fixture.gameAddonRoot, "scripts", "npc", "npc_abilities_custom.txt"), "abilities custom\n"],
      [join(fixture.gameAddonRoot, ".hidden-config"), "hidden\n"],
      [join(fixture.gameAddonRoot, "scripts", "vscripts", "generated_runtime.lua"), "generated-looking\n"],
      [join(fixture.contentAddonRoot, "materials", "texture.bin"), binaryBytes],
      [join(fixture.contentAddonRoot, "panorama", "extensionless"), "extensionless\n"],
      [join(fixture.contentAddonRoot, ".gitignore"), "ignored-looking but included\n"],
      [join(fixture.contentAddonRoot, "maps", "fixture_map.vmap"), "map source\n"]
    ];
    for (const [path, content] of requiredFiles) {
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, content);
    }
    const oldFile = join(fixture.contentAddonRoot, "old-timestamp.txt");
    await writeFile(oldFile, "old but included\n");
    await utimes(oldFile, new Date("2001-01-01T00:00:00Z"), new Date("2001-01-01T00:00:00Z"));
    await Promise.all([
      mkdir(join(fixture.gameAddonRoot, "empty", "nested"), { recursive: true }),
      mkdir(join(fixture.contentAddonRoot, ".empty", "nested"), { recursive: true })
    ]);

    let candidateRoot: string | undefined;
    const copiedDestinations: string[] = [];
    const createFilesystem = (options: {
      failCopy?: boolean;
      aliasDestinationParent?: boolean;
    } = {}): ReleaseCandidateFilesystem => ({
      lstat,
      realpath: async (path) => {
        if (
          options.aliasDestinationParent === true
          && candidateRoot !== undefined
          && path === join(candidateRoot, "game", "dota_addons", "fixture_addon")
        ) {
          return await realpath(fixture.repositoryRoot);
        }
        return await realpath(path);
      },
      readDirectory: async (path) => (await readdir(path)).reverse(),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return {
            inspectionRoot: candidateRoot,
            identity: {
              root: candidateRoot,
              failCopy: options.failCopy === true,
              aliasDestinationParent: options.aliasDestinationParent === true,
              copiedDestinations
            }
          };
        },
        cleanupCandidateLease: async (identity) => {
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        }
      })
    });

    const inspect = vi.fn(async (root: string) => {
      expect(await readdir(root)).toEqual(["content", "game"]);
      const gameRoot = join(root, "game", "dota_addons", "fixture_addon");
      const contentRoot = join(root, "content", "dota_addons", "fixture_addon");
      expect((await lstat(gameRoot)).isDirectory()).toBe(true);
      expect((await lstat(contentRoot)).isDirectory()).toBe(true);
      expect(await readFile(join(contentRoot, "materials", "texture.bin"))).toEqual(binaryBytes);
      for (const [source, content] of requiredFiles) {
        const sourceRoot = source.startsWith(fixture.gameAddonRoot)
          ? fixture.gameAddonRoot
          : fixture.contentAddonRoot;
        const destinationRoot = sourceRoot === fixture.gameAddonRoot ? gameRoot : contentRoot;
        const relativePath = source.slice(sourceRoot.length + 1);
        expect(await readFile(join(destinationRoot, relativePath))).toEqual(Buffer.from(content));
      }
      expect(await readFile(join(contentRoot, "old-timestamp.txt"), "utf8")).toBe("old but included\n");
      expect((await lstat(join(gameRoot, "empty", "nested"))).isDirectory()).toBe(true);
      expect((await lstat(join(contentRoot, ".empty", "nested"))).isDirectory()).toBe(true);
      return "complete";
    });

    const success = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      inspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem: createFilesystem() }
    );
    expect(success).toMatchObject({ ok: true, value: "complete" });
    expect(inspect).toHaveBeenCalledTimes(1);
    if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
    expect(copiedDestinations.every((path) => path.startsWith(`${candidateRoot}/`))).toBe(true);
    await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });

    candidateRoot = undefined;
    copiedDestinations.length = 0;
    const failedInspect = vi.fn(async () => "unexpected");
    const copyFailure = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      failedInspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem: createFilesystem({ failCopy: true }) }
    );
    expect(withoutCleanup(copyFailure)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_MATERIALIZATION_FAILED", category: "assembly" }]
    });
    expect(failedInspect).not.toHaveBeenCalled();
    expect(JSON.stringify(copyFailure)).not.toContain(fixture.root);
    expect(JSON.stringify(copyFailure)).not.toContain("private-value");
    if (candidateRoot === undefined) throw new Error("failed candidate root was not recorded");
    await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });

    candidateRoot = undefined;
    copiedDestinations.length = 0;
    const aliasInspect = vi.fn(async () => "unexpected");
    const destinationAlias = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      aliasInspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem: createFilesystem({ aliasDestinationParent: true }) }
    );
    expect(withoutCleanup(destinationAlias)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH", category: "unsafe-isolation" }]
    });
    expect(aliasInspect).not.toHaveBeenCalled();
    if (candidateRoot === undefined) throw new Error("aliased candidate root was not recorded");
    expect(copiedDestinations.every((path) => path.startsWith(`${candidateRoot}/`))).toBe(true);
    expect(await readdir(fixture.repositoryRoot)).toEqual([]);
    await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });

    await rm(join(fixture.gameAddonRoot, "scripts", "vscripts", "addon_game_mode.lua"));
    candidateRoot = undefined;
    const blockedInspect = vi.fn(async () => "unexpected");
    const readinessBlocked = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      blockedInspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem: createFilesystem() }
    );
    expect(readinessBlocked).toMatchObject({
      ok: false,
      blockers: [{ code: "REQUIRED_PATH_MISSING", disposition: "blocker", field: "lua entry" }]
    });
    expect(blockedInspect).not.toHaveBeenCalled();
    expect(candidateRoot).toBeUndefined();

    await writeFile(join(fixture.gameAddonRoot, "scripts", "vscripts", "addon_game_mode.lua"), "function Activate() end\n");
    const metadataPath = join(fixture.gameAddonRoot, "addoninfo.txt");
    const completeMetadata = await readFile(metadataPath, "utf8");
    await writeFile(metadataPath, completeMetadata.replace("Fixture Addon", "placeholder"));
    const placeholderBlocked = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      blockedInspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem: createFilesystem() }
    );
    expect(placeholderBlocked).toMatchObject({
      ok: false,
      blockers: [{ code: "METADATA_PLACEHOLDER", disposition: "blocker", field: "addontitle" }]
    });
    expect(candidateRoot).toBeUndefined();

    await writeFile(metadataPath, completeMetadata);
    await writeFile(join(fixture.gameAddonRoot, "private.txt"), `${compactAssignment("password", "synthetic-private-value")}\n`);
    const sensitiveBlocked = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      blockedInspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem: createFilesystem() }
    );
    expect(sensitiveBlocked).toMatchObject({
      ok: false,
      blockers: [{ code: "SENSITIVE_MATERIAL", disposition: "blocker", path: "private.txt" }]
    });
    expect(JSON.stringify(sensitiveBlocked)).not.toContain("synthetic-private-value");
    expect(candidateRoot).toBeUndefined();
  });

  test("rejects every unexpected leased-root entry before assembly", async () => {
    for (const kind of ["file", "directory", "symbolic-link"] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      let candidateRoot: string | undefined;
      const cleanupCandidateLease = vi.fn(async (identity: { root: string; rogues: string[] }) => {
        for (const rogue of identity.rogues) expect(await lstat(rogue)).toBeDefined();
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const filesystem: ReleaseCandidateFilesystem = {
        ...assemblyOperations,
        lstat,
        realpath,
        readDirectory: async (path) => (await readdir(path)).reverse(),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => {
          throw new Error("raw candidate creation must not be used");
        }),
        candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
          createCandidateLease: async (validated) => {
            candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
            const rogue = join(candidateRoot, `rogue-${kind}`);
            if (kind === "file") await writeFile(rogue, "rogue\n");
            const rogues = [rogue];
            if (kind === "directory") {
              await mkdir(rogue);
              const earlierRogue = join(candidateRoot, "alpha-directory");
              await mkdir(earlierRogue);
              rogues.push(earlierRogue);
            }
            if (kind === "symbolic-link") await symlink(fixture.repositoryRoot, rogue);
            return { inspectionRoot: candidateRoot, identity: { root: candidateRoot, rogues } };
          },
          cleanupCandidateLease
        })
      };
      const inspect = vi.fn(async () => "unexpected");

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        inspect,
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      const expectedPaths = kind === "directory"
        ? ["alpha-directory", "rogue-directory"]
        : [`rogue-${kind}`];
      expect(withoutCleanup(result), kind).toEqual({
        ok: false,
        blockers: expectedPaths.map((path) => ({
          code: "CANDIDATE_ROOT_NOT_EMPTY",
          category: "unexpected-entry",
          path
        }))
      });
      expect(inspect, kind).not.toHaveBeenCalled();
      expect(cleanupCandidateLease, kind).toHaveBeenCalledTimes(1);
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  test("reads readiness files through one no-follow identity boundary", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const addonInfoPath = join(fixture.gameAddonRoot, "addoninfo.txt");
    const externalPath = join(fixture.repositoryRoot, "external-private.txt");
    await writeFile(externalPath, `${compactAssignment("password", "synthetic-private-value")}\n`);
    let swapped = false;
    let externalRead = false;
    const legacyRead = vi.fn(async (path: string) => {
      const content = await readFile(path, "utf8");
      if (path === addonInfoPath && !swapped) {
        await rm(path);
        await symlink(externalPath, path);
        swapped = true;
        return content;
      }
      if (path === addonInfoPath) externalRead = true;
      return content;
    });
    const createCandidateLease = vi.fn(async () => {
      throw new Error("source identity failure must precede candidate creation");
    });
    const operations = {
      createCandidateLease,
      cleanupCandidateLease: vi.fn(async () => ({
        ok: true as const,
        removed: true as const,
        absent: true as const,
        identityMatched: true as const
      })),
      readAcceptedSourceFile: vi.fn(async (
        input: ValidatedReleaseCandidateInput,
        entry: { root: "game" | "content"; path: string; kind: "file" | "directory" },
        maxBytes: number
      ) => {
        const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
        const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const source = join(sourceRoot, ...entry.path.slice(prefix.length).split("/"));
        if (entry.path.endsWith("/addoninfo.txt") && !swapped) {
          await rm(source);
          await symlink(externalPath, source);
          swapped = true;
        }
        try {
          const handle = await open(source, filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
          try {
            const info = await handle.stat();
            if (!info.isFile()) return { ok: false as const, code: "SOURCE_FILE_IDENTITY_CHANGED" as const };
            const base = { ok: true as const, schemaVersion: "1.0" as const, size: info.size, identityMatched: true as const, kindMatched: true as const, contained: true as const };
            if (!isReleaseTextPath(entry.path)) return { ...base, state: "binary" as const };
            if (info.size > maxBytes) {
              return { ...base, state: "oversized" as const };
            }
            return { ...base, state: "readable" as const, bytes: await handle.readFile() };
          } finally {
            await handle.close();
          }
        } catch {
          return { ok: false as const, code: "SOURCE_FILE_IDENTITY_CHANGED" as const };
        }
      }),
      inspectCandidateRoot: vi.fn(async () => ({ ok: true as const, empty: true as const, identityMatched: true as const })),
      materializeCandidateEntry: vi.fn(async () => ({ ok: true as const, created: true as const, identityMatched: true as const, kindMatched: true as const, contained: true as const })),
      reconcileCandidateTree: vi.fn(async () => ({ ok: true as const, exact: true as const, identityMatched: true as const }))
    };
    const filesystem: ReleaseCandidateFilesystem & { readSourceFile(path: string): Promise<string> } = {
      ...assemblyOperations,
      readSourceFile: legacyRead,
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle(operations)
    };

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => "unexpected",
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{ code: "SOURCE_FILE_IDENTITY_CHANGED", category: "assembly" }]
    });
    expect(operations.readAcceptedSourceFile).toHaveBeenCalled();
    expect(legacyRead).not.toHaveBeenCalled();
    expect(externalRead).toBe(false);
    expect(createCandidateLease).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(fixture.root);
    expect(JSON.stringify(result)).not.toContain("synthetic-private-value");
  });

  test("size-gates metadata before reading and rejects wrong required kinds", async () => {
    const oversizedFixture = await createFixture();
    await populateReadyFixture(oversizedFixture);
    const rawRead = vi.fn(async () => {
      throw new Error("raw source reads are forbidden");
    });
    const operations = {
      createCandidateLease: vi.fn(async () => {
        throw new Error("readiness blockers must precede creation");
      }),
      cleanupCandidateLease: vi.fn(async () => ({
        ok: true as const,
        removed: true as const,
        absent: true as const,
        identityMatched: true as const
      })),
      readAcceptedSourceFile: vi.fn(async (
        input: ValidatedReleaseCandidateInput,
        entry: { root: "game" | "content"; path: string; kind: "file" | "directory" },
        maxBytes: number
      ) => {
        const relativePath = entry.path.split(`/dota_addons/${input.addonName}/`)[1];
        if (relativePath === "addoninfo.txt") {
          return { ok: true as const, schemaVersion: "1.0" as const, state: "oversized" as const, size: maxBytes + 1, identityMatched: true as const, kindMatched: true as const, contained: true as const };
        }
        const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const handle = await open(join(sourceRoot, ...relativePath.split("/")), filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
        try {
          const info = await handle.stat();
          if (!isReleaseTextPath(relativePath)) {
            return { ok: true as const, schemaVersion: "1.0" as const, state: "binary" as const, size: info.size, identityMatched: true as const, kindMatched: true as const, contained: true as const };
          }
          return { ok: true as const, schemaVersion: "1.0" as const, state: "readable" as const, size: info.size, bytes: await handle.readFile(), identityMatched: true as const, kindMatched: true as const, contained: true as const };
        } finally {
          await handle.close();
        }
      }),
      inspectCandidateRoot: vi.fn(async () => ({ ok: true as const, empty: true as const, identityMatched: true as const })),
      materializeCandidateEntry: vi.fn(async () => ({ ok: true as const, created: true as const, identityMatched: true as const, kindMatched: true as const, contained: true as const })),
      reconcileCandidateTree: vi.fn(async () => ({ ok: true as const, exact: true as const, identityMatched: true as const }))
    };
    const oversizedFilesystem: ReleaseCandidateFilesystem & { readSourceFile(path: string): Promise<string> } = {
      ...assemblyOperations,
      readSourceFile: rawRead,
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle(operations)
    };

    const oversized = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: oversizedFixture.dotaRoot, tempParent: oversizedFixture.tempParent },
      async () => "unexpected",
      { repositoryRoot: oversizedFixture.repositoryRoot, filesystem: oversizedFilesystem }
    );
    expect(oversized).toMatchObject({
      ok: false,
      scanCoverage: {
        schemaVersion: "1.0",
        totalFileCount: 7,
        oversized: { count: 1, paths: ["game/addoninfo.txt"] }
      },
      blockers: [{
        code: "REQUIRED_TEXT_OVERSIZED",
        category: "oversized-required-text",
        disposition: "blocker",
        path: "addoninfo.txt"
      }]
    });
    expect(rawRead).not.toHaveBeenCalled();
    expect(operations.createCandidateLease).not.toHaveBeenCalled();

    for (const wrongKind of ["lua-directory", "maps-file"] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      if (wrongKind === "lua-directory") {
        const path = join(fixture.gameAddonRoot, "scripts/vscripts/addon_game_mode.lua");
        await rm(path);
        await mkdir(path);
      } else {
        const path = join(fixture.contentAddonRoot, "maps");
        await rm(path, { recursive: true });
        await writeFile(path, "not a directory\n");
      }
      const inspect = vi.fn(async () => "unexpected");
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        inspect,
        { repositoryRoot: fixture.repositoryRoot, filesystem: oversizedFilesystem }
      );
      expect(result.ok, wrongKind).toBe(false);
      if (result.ok) throw new Error(`${wrongKind} unexpectedly passed`);
      expect(result.blockers, wrongKind).toContainEqual({
          code: "REQUIRED_PATH_WRONG_KIND",
          category: "required-structure",
          disposition: "blocker",
          field: wrongKind === "lua-directory" ? "lua entry" : "content maps directory"
      });
      expect(inspect).not.toHaveBeenCalled();
    }
  });

  test("materializes only through the lease-bound destination capability", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const outsideSentinel = join(fixture.repositoryRoot, "outside-write.txt");
    let candidateRoot: string | undefined;
    const legacyMakeDirectory = vi.fn(async (path: string) => {
      await writeFile(outsideSentinel, `escaped from ${path}\n`);
      await mkdir(path);
    });
    const materializeCandidateEntry = vi.fn(async () => ({
      ok: false as const,
      code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" as const
    }));
    const operations = {
      createCandidateLease: async (validated: ValidatedReleaseCandidateInput) => {
        candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
      },
      cleanupCandidateLease: async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      },
      readAcceptedSourceFile: createNoFollowSourceReader(),
      observeAcceptedSourceEntry: createAcceptedSourceObserver(),
      inspectCandidateRoot: vi.fn(async () => ({ ok: true as const, empty: true as const, identityMatched: true as const })),
      materializeCandidateEntry,
      reconcileCandidateTree: vi.fn(async () => ({ ok: true as const, exact: true as const, identityMatched: true as const }))
    };
    const filesystem: ReleaseCandidateFilesystem & { makeDirectory(path: string): Promise<void> } = {
      ...assemblyOperations,
      makeDirectory: legacyMakeDirectory,
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle(operations)
    };
    const inspect = vi.fn(async () => "unexpected");

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      inspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH", category: "unsafe-isolation" }]
    });
    expect(materializeCandidateEntry).toHaveBeenCalledTimes(1);
    expect(legacyMakeDirectory).not.toHaveBeenCalled();
    await expect(lstat(outsideSentinel)).rejects.toMatchObject({ code: "ENOENT" });
    expect(inspect).not.toHaveBeenCalled();
    if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
    await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("reconciles the exact candidate tree after mid-assembly injection", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    let candidateRoot: string | undefined;
    let injected = false;
    const legacyMakeDirectory = vi.fn(async (path: string) => {
      await mkdir(path);
      if (!injected && candidateRoot !== undefined) {
        injected = true;
        await writeFile(join(candidateRoot, "rogue-mid-assembly"), "rogue\n");
      }
    });
    const materializeCandidateEntry = vi.fn(async (
      identity: { root: string },
      input: ValidatedReleaseCandidateInput,
      operation: {
        destination: string;
        kind: "file" | "directory";
        source: { root: "game" | "content"; path: string; kind: "file" | "directory" };
      }
    ) => {
      const destination = join(identity.root, ...operation.destination.split("/"));
      if (operation.kind === "directory") await mkdir(destination);
      else {
        const prefix = `${operation.source.root}/dota_addons/${input.addonName}/`;
        const sourceRoot = operation.source.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        await copyFile(
          join(sourceRoot, ...operation.source.path.slice(prefix.length).split("/")),
          destination
        );
      }
      if (!injected) {
        injected = true;
        await writeFile(join(identity.root, "rogue-mid-assembly"), "rogue\n");
      }
      return { ok: true as const, created: true as const, identityMatched: true as const, kindMatched: true as const, contained: true as const };
    });
    const reconcileCandidateTree = vi.fn(async () => ({
      ok: false as const,
      code: "CANDIDATE_TREE_MISMATCH" as const,
      issues: [{ code: "CANDIDATE_TREE_UNEXPECTED" as const, path: "rogue-mid-assembly", kind: "file" as const }]
    }));
    const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
      expect(await readFile(join(identity.root, "rogue-mid-assembly"), "utf8")).toBe("rogue\n");
      await rm(identity.root, { recursive: true, force: false });
      return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
    });
    const operations = {
      createCandidateLease: async (validated: ValidatedReleaseCandidateInput) => {
        candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
      },
      cleanupCandidateLease,
      readAcceptedSourceFile: createNoFollowSourceReader(),
      observeAcceptedSourceEntry: createAcceptedSourceObserver(),
      inspectCandidateRoot: vi.fn(async () => ({ ok: true as const, empty: true as const, identityMatched: true as const })),
      materializeCandidateEntry,
      reconcileCandidateTree
    };
    const filesystem: ReleaseCandidateFilesystem & { makeDirectory(path: string): Promise<void> } = {
      ...assemblyOperations,
      makeDirectory: legacyMakeDirectory,
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle(operations)
    };
    const inspect = vi.fn(async () => "unexpected");

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      inspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_TREE_UNEXPECTED", category: "unexpected-entry", path: "rogue-mid-assembly" }]
    });
    expect(materializeCandidateEntry).toHaveBeenCalled();
    expect(reconcileCandidateTree).toHaveBeenCalledTimes(1);
    expect(inspect).not.toHaveBeenCalled();
    expect(cleanupCandidateLease).toHaveBeenCalledTimes(1);
  });

  test("sanitizes malformed identity-bound assembly results", async () => {
    for (const stage of ["source", "materialization", "reconciliation"] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const privateFailure = `${fixture.root}/${credentialPasswordFixture("synthetic-private-value")}`;
      const throwingResult = new Proxy({}, {
        get: () => {
          throw new Error(privateFailure);
        }
      });
      const cleanup = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const operations = {
        createCandidateLease: async (validated: ValidatedReleaseCandidateInput) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: root, identity: { root } };
        },
        cleanupCandidateLease: cleanup,
        ...(stage === "source" ? {
          readAcceptedSourceFile: vi.fn(async () => throwingResult as AcceptedSourceReadResult)
        } : {}),
        ...(stage === "materialization" ? {
          materializeCandidateEntry: vi.fn(async () => throwingResult as CandidateMaterializationResult)
        } : {}),
        ...(stage === "reconciliation" ? {
          reconcileCandidateTree: vi.fn(async () => throwingResult as CandidateTreeReconciliationResult)
        } : {})
      };
      const filesystem: ReleaseCandidateFilesystem = {
        ...assemblyOperations,
        lstat,
        realpath,
        readDirectory: async (path) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => {
          throw new Error("raw candidate creation must not be used");
        }),
        candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle(operations)
      };

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => "unexpected",
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(withoutCleanup(result), stage).toEqual({
        ok: false,
        blockers: [{
          code: stage === "source"
            ? "SOURCE_READ_RESULT_INVALID"
            : stage === "materialization"
              ? "CANDIDATE_MATERIALIZATION_RESULT_INVALID"
              : "CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID",
          category: "assembly"
        }]
      });
      expect(JSON.stringify(result), stage).not.toContain(fixture.root);
      expect(JSON.stringify(result), stage).not.toContain("synthetic-private-value");
      expect(cleanup, stage).toHaveBeenCalledTimes(stage === "source" ? 0 : 1);
    }
  });

  test("rejects readable source results whose UTF-8 bytes do not match the claimed size", async () => {
    const cases = [
      { name: "truncated content", size: 8, content: "short" },
      {
        name: "multibyte content with a secret beyond the claimed prefix",
        size: 2,
        content: `ok🙂${compactAssignment("password", "synthetic-private-value")}`
      }
    ];
    for (const scenario of cases) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const createCandidateLease = vi.fn(async () => {
        throw new Error("invalid readable result must precede candidate creation");
      });
      const operations = {
        createCandidateState: async () => await createCandidateLease(),
        acquireCandidateLease: async (_input: ValidatedReleaseCandidateInput, createRegisteredCandidate: () => Promise<RegisteredCandidateCreation>) => (
          await createRegisteredCandidate()
        ),
        cleanupCandidateLease: vi.fn(async () => ({
          ok: true as const,
          removed: true as const,
          absent: true as const,
          identityMatched: true as const
        })),
        readAcceptedSourceFile: vi.fn(async () => ({
          ok: true as const,
          schemaVersion: "1.0" as const,
          state: "readable" as const,
          size: scenario.size,
          bytes: Buffer.from(scenario.content),
          identityMatched: true as const,
          kindMatched: true as const,
          contained: true as const
        })),
        observeAcceptedSourceEntry: createAcceptedSourceObserver(),
        inspectCandidateRoot: vi.fn(async () => ({ ok: true as const, empty: true as const, identityMatched: true as const })),
        materializeCandidateEntry: vi.fn(async () => ({ ok: true as const, created: true as const, identityMatched: true as const, kindMatched: true as const, contained: true as const })),
        reconcileCandidateTree: vi.fn(async () => ({ ok: true as const, exact: true as const, identityMatched: true as const }))
      };
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath,
        readDirectory: async (path) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => {
          throw new Error("raw candidate creation must not be used");
        }),
        candidateLifecycle: createIdentityBoundCandidateLifecycle(operations)
      };

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => "unexpected",
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      expect(withoutCleanup(result), scenario.name).toEqual({
        ok: false,
        blockers: [{ code: "SOURCE_READ_RESULT_INVALID", category: "assembly" }]
      });
      expect(JSON.stringify(result), scenario.name).not.toContain("synthetic-private-value");
      expect(createCandidateLease, scenario.name).not.toHaveBeenCalled();
    }
  });

  test("fails before creation when identity-bound assembly operations are incomplete", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const createCandidateLease = vi.fn(async () => {
      throw new Error("incomplete capability must not create");
    });
    const filesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createIdentityBoundCandidateLifecycle({
        createCandidateState: async () => await createCandidateLease(),
        acquireCandidateLease: async (_input, createRegisteredCandidate) => await createRegisteredCandidate(),
        cleanupCandidateLease: vi.fn(async () => ({
          ok: true as const,
          removed: true as const,
          absent: true as const,
          identityMatched: true as const
        }))
      })
    };

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => "unexpected",
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{ code: "IDENTITY_BOUND_ASSEMBLY_REQUIRED", category: "creation" }]
    });
    expect(createCandidateLease).not.toHaveBeenCalled();
  });

  test("keeps the candidate canonically isolated and callback scoped", async () => {
    const createLifecycleFilesystem = (fixture: Fixture, options: {
      aliasCreatedRootTo?: string;
      failRemoval?: boolean;
    } = {}) => {
      let candidateRoot: string | undefined;
      const writes: Array<{ operation: "create" | "remove"; path: string }> = [];
      const createCandidateLease = vi.fn(async (validated: ValidatedReleaseCandidateInput) => {
        candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        writes.push({ operation: "create", path: candidateRoot });
        return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
      });
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        writes.push({ operation: "remove", path: identity.root });
        if (options.failRemoval === true) {
          return {
            ok: false as const,
            removed: false,
            absent: false,
            identityMatched: true,
            code: "CANDIDATE_REMOVAL_FAILED" as const
          };
        }
        await rm(identity.root, { recursive: true, force: false });
        return {
          ok: true as const,
          removed: true as const,
          absent: true as const,
          identityMatched: true as const
        };
      });
      const filesystem = {
        ...assemblyOperations,
        lstat,
        realpath: vi.fn(async (path: string) => (
          candidateRoot !== undefined
          && path === candidateRoot
          && options.aliasCreatedRootTo !== undefined
            ? await realpath(options.aliasCreatedRootTo)
            : await realpath(path)
        )),
        readDirectory: async (path: string) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => {
          throw new Error("raw candidate creation must not be used");
        }),
        candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
          createCandidateLease,
          cleanupCandidateLease
        })
      };
      return {
        filesystem,
        createCandidateLease,
        cleanupCandidateLease,
        writes,
        candidateRoot: () => candidateRoot
      };
    };

    const successfulFixture = await createFixture();
    await populateReadyFixture(successfulFixture);
    const successfulLifecycle = createLifecycleFilesystem(successfulFixture);
    const inspectSuccess = vi.fn(async (candidateRoot: string) => {
      expect((await lstat(candidateRoot)).isDirectory()).toBe(true);
      expect(candidateRoot.startsWith(`${await realpath(successfulFixture.tempParent)}/`)).toBe(true);
      return "inspected";
    });

    const successfulResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: successfulFixture.dotaRoot,
        tempParent: successfulFixture.tempParent
      },
      inspectSuccess,
      {
        repositoryRoot: successfulFixture.repositoryRoot,
        filesystem: successfulLifecycle.filesystem
      }
    );

    expect(successfulResult).toMatchObject({ ok: true, value: "inspected" });
    expect(successfulLifecycle.createCandidateLease).toHaveBeenCalledTimes(1);
    expect(successfulLifecycle.cleanupCandidateLease).toHaveBeenCalledTimes(1);
    expect(inspectSuccess).toHaveBeenCalledTimes(1);
    expect(successfulLifecycle.writes.map(({ operation }) => operation)).toEqual(["create", "remove"]);
    const successfulRoot = successfulLifecycle.candidateRoot();
    if (successfulRoot === undefined) throw new Error("candidate root was not recorded");
    await expect(lstat(successfulRoot)).rejects.toMatchObject({ code: "ENOENT" });

    const unsafeInspectionValues = [
      { name: "candidate root directly", value: (root: string) => root },
      { name: "candidate root nested", value: (root: string) => ({ nested: [{ root }] }) },
      { name: "absolute source path", value: () => successfulFixture.gameAddonRoot },
      { name: "function capability", value: () => ({ invoke: () => "live" }) },
      { name: "live map handle", value: () => new Map([["state", "live"]]) },
      {
        name: "throwing value getter",
        value: () => Object.defineProperty({}, "state", {
          enumerable: true,
          get: () => { throw new Error(`private value getter ${successfulFixture.root}`); }
        })
      },
      {
        name: "throwing value proxy",
        value: () => new Proxy({}, {
          ownKeys: () => { throw new Error(`private value proxy ${successfulFixture.root}`); }
        })
      }
    ];

    for (const scenario of unsafeInspectionValues) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const lifecycle = createLifecycleFilesystem(fixture);
      const result = await withAssembledReleaseCandidate(
        {
          addonName: "fixture_addon",
          dotaRoot: fixture.dotaRoot,
          tempParent: fixture.tempParent
        },
        async (root) => scenario.value(root),
        { repositoryRoot: fixture.repositoryRoot, filesystem: lifecycle.filesystem }
      );

      expect(result, scenario.name).toMatchObject({
        ok: false,
        operation: { status: "failed", code: "CANDIDATE_INSPECTION_FAILED" },
        artifactValidation: { status: "passed" },
        cleanup: { status: "verified", attempts: 1 },
        blockers: [{ code: "CANDIDATE_INSPECTION_VALUE_UNSAFE", category: "inspection" }]
      });
      expect(result, scenario.name).not.toHaveProperty("value");
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(lifecycle.cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      const root = lifecycle.candidateRoot();
      if (root === undefined) throw new Error("unsafe-value candidate root was not recorded");
      await expect(lstat(root), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }

    const callbackFixture = await createFixture();
    await populateReadyFixture(callbackFixture);
    const callbackLifecycle = createLifecycleFilesystem(callbackFixture);
    const privateFailure = join(callbackFixture.root, credentialPasswordFixture("private-value"));
    const callbackResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: callbackFixture.dotaRoot,
        tempParent: callbackFixture.tempParent
      },
      async () => {
        throw new Error(`inspection failed at ${privateFailure}`);
      },
      { repositoryRoot: callbackFixture.repositoryRoot, filesystem: callbackLifecycle.filesystem }
    );

    expect(withoutCleanup(callbackResult)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_INSPECTION_FAILED", category: "inspection" }]
    });
    expect(JSON.stringify(callbackResult)).not.toContain(callbackFixture.root);
    expect(JSON.stringify(callbackResult)).not.toContain("private-value");
    expect(callbackLifecycle.createCandidateLease).toHaveBeenCalledTimes(1);
    expect(callbackLifecycle.cleanupCandidateLease).toHaveBeenCalledTimes(1);
    const callbackRoot = callbackLifecycle.candidateRoot();
    if (callbackRoot === undefined) throw new Error("callback candidate root was not recorded");
    await expect(lstat(callbackRoot)).rejects.toMatchObject({ code: "ENOENT" });

    const aliasFixture = await createFixture();
    await populateReadyFixture(aliasFixture);
    const aliasLifecycle = createLifecycleFilesystem(aliasFixture, {
      aliasCreatedRootTo: aliasFixture.gameAddonRoot
    });
    const inspectAlias = vi.fn(async () => "unexpected");
    const aliasResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: aliasFixture.dotaRoot,
        tempParent: aliasFixture.tempParent
      },
      inspectAlias,
      { repositoryRoot: aliasFixture.repositoryRoot, filesystem: aliasLifecycle.filesystem }
    );

    expect(withoutCleanup(aliasResult)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_ROOT_NOT_ISOLATED", category: "unsafe-isolation" }]
    });
    expect(aliasLifecycle.createCandidateLease).toHaveBeenCalledTimes(1);
    expect(aliasLifecycle.cleanupCandidateLease).toHaveBeenCalledTimes(1);
    expect(inspectAlias).not.toHaveBeenCalled();
    const aliasRoot = aliasLifecycle.candidateRoot();
    if (aliasRoot === undefined) throw new Error("aliased candidate root was not recorded");
    await expect(lstat(aliasRoot)).rejects.toMatchObject({ code: "ENOENT" });

    const removalFixture = await createFixture();
    await populateReadyFixture(removalFixture);
    const removalLifecycle = createLifecycleFilesystem(removalFixture, { failRemoval: true });
    const removalResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: removalFixture.dotaRoot,
        tempParent: removalFixture.tempParent
      },
      async () => "inspected",
      { repositoryRoot: removalFixture.repositoryRoot, filesystem: removalLifecycle.filesystem }
    );

    expect(withoutCleanup(removalResult)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_REMOVAL_FAILED", category: "removal" }]
    });
    expect(JSON.stringify(removalResult)).not.toContain(removalFixture.root);
    expect(JSON.stringify(removalResult)).not.toContain("private-value");
    const residualRoot = removalLifecycle.candidateRoot();
    if (residualRoot === undefined) throw new Error("residual candidate root was not recorded");
    expect((await lstat(residualRoot)).isDirectory()).toBe(true);
  });

  test("refuses unowned roots and revalidates cleanup leases", async () => {
    const unownedCases: Array<{
      name: string;
      target: (fixture: Fixture) => Promise<string>;
    }> = [
      { name: "repository root", target: async (fixture) => fixture.repositoryRoot },
      { name: "game source root", target: async (fixture) => fixture.gameAddonRoot },
      { name: "content source root", target: async (fixture) => fixture.contentAddonRoot },
      { name: "temporary parent itself", target: async (fixture) => fixture.tempParent },
      {
        name: "outside temporary parent",
        target: async (fixture) => {
          const path = join(fixture.root, "unowned-outside");
          await mkdir(path);
          return path;
        }
      }
    ];

    for (const scenario of unownedCases) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const target = await scenario.target(fixture);
      const sentinel = join(target, "ownership-sentinel.txt");
      await writeFile(sentinel, "survives\n");
      const rawRemoval = vi.fn(async () => undefined);
      const cleanupCandidateLease = vi.fn(async () => ({
        ok: false as const,
        removed: false,
        absent: false,
        identityMatched: false,
        code: "CANDIDATE_IDENTITY_MISMATCH" as const
      }));
      const filesystem = {
        ...assemblyOperations,
        lstat,
        realpath,
        readDirectory: async (path: string) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => target),
        candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
          createCandidateLease: vi.fn(async () => ({
            inspectionRoot: target,
            identity: { target, rawRemoval }
          })),
          cleanupCandidateLease
        })
      };

      const result = await withAssembledReleaseCandidate(
        {
          addonName: "fixture_addon",
          dotaRoot: fixture.dotaRoot,
          tempParent: fixture.tempParent
        },
        async () => "unexpected",
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      expect(rawRemoval, scenario.name).not.toHaveBeenCalled();
      expect(withoutCleanup(result), scenario.name).toEqual({
        ok: false,
        blockers: [
          { code: "CANDIDATE_ROOT_NOT_OWNED", category: "unsafe-isolation" },
          { code: "CANDIDATE_IDENTITY_MISMATCH", category: "removal" }
        ]
      });
      expect(await lstat(sentinel), scenario.name).toBeDefined();
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
    }

    const swappedFixture = await createFixture();
    await populateReadyFixture(swappedFixture);
    await writeFile(join(swappedFixture.repositoryRoot, "repository-sentinel.txt"), "survives\n");
    let swappedRoot: string | undefined;
    const swappedRemoval = vi.fn(async (path: string) => await rm(path, { recursive: true, force: false }));
    const swappedCleanup = vi.fn(async (identity: { root: string; canonicalRoot: string }) => {
      const currentCanonicalRoot = await realpath(identity.root);
      if (currentCanonicalRoot !== identity.canonicalRoot) {
        return {
          ok: false as const,
          removed: false,
          absent: false,
          identityMatched: false,
          code: "CANDIDATE_IDENTITY_MISMATCH" as const
        };
      }
      await swappedRemoval(identity.root);
      return {
        ok: true as const,
        removed: true as const,
        absent: true as const,
        identityMatched: true as const
      };
    });
    const swappedFilesystem = {
      ...assemblyOperations,
      lstat,
      realpath,
      readDirectory: async (path: string) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: vi.fn(async (validated: ValidatedReleaseCandidateInput) => {
          swappedRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return {
            inspectionRoot: swappedRoot,
            identity: { root: swappedRoot, canonicalRoot: await realpath(swappedRoot) }
          };
        }),
        cleanupCandidateLease: swappedCleanup
      })
    };

    const swappedResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: swappedFixture.dotaRoot,
        tempParent: swappedFixture.tempParent
      },
      async (candidateRoot) => {
        await rm(candidateRoot, { recursive: true, force: false });
        await symlink(swappedFixture.repositoryRoot, candidateRoot);
        return "must not escape";
      },
      { repositoryRoot: swappedFixture.repositoryRoot, filesystem: swappedFilesystem }
    );

    expect(swappedResult).toMatchObject({
      ok: false,
      operation: { status: "completed" },
      artifactValidation: { status: "blocked" },
      cleanup: { status: "failed", code: "CANDIDATE_IDENTITY_MISMATCH" },
      blockers: expect.arrayContaining([
        { code: "CANDIDATE_IDENTITY_MISMATCH", category: "removal" }
      ])
    });
    expect(swappedResult).not.toHaveProperty("value");
    expect(swappedCleanup).toHaveBeenCalledTimes(1);
    expect(swappedRemoval).not.toHaveBeenCalled();
    expect(await lstat(join(swappedFixture.repositoryRoot, "repository-sentinel.txt"))).toBeDefined();
    if (swappedRoot === undefined) throw new Error("swapped candidate root was not recorded");
    expect((await lstat(swappedRoot)).isSymbolicLink()).toBe(true);

    const mutableFixture = await createFixture();
    await populateReadyFixture(mutableFixture);
    let mutableRoot: string | undefined;
    const capturedCleanup = vi.fn(async (identity: { root: string }) => {
      await rm(identity.root, { recursive: true, force: false });
      return {
        ok: true as const,
        removed: true as const,
        absent: true as const,
        identityMatched: true as const
      };
    });
    const mutableOperations: {
      createCandidateLease(validated: ValidatedReleaseCandidateInput): Promise<{
        inspectionRoot: string;
        identity: { root: string };
      }>;
      cleanupCandidateLease(identity: { root: string }): Promise<CandidateLeaseCleanupResult>;
    } = {
      createCandidateLease: vi.fn(async (validated: ValidatedReleaseCandidateInput) => {
        mutableRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: mutableRoot, identity: { root: mutableRoot } };
      }),
      cleanupCandidateLease: capturedCleanup
    };
    const originalLifecycle = createFixtureIdentityBoundCandidateLifecycle(mutableOperations);
    const mutableFilesystem = {
      ...assemblyOperations,
      lstat,
      realpath,
      readDirectory: async (path: string) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: originalLifecycle
    };

    const mutableResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: mutableFixture.dotaRoot,
        tempParent: mutableFixture.tempParent
      },
      async () => {
        mutableOperations.cleanupCandidateLease = vi.fn(async () => ({
          ok: false as const,
          removed: false,
          absent: false,
          identityMatched: false,
          code: "CANDIDATE_IDENTITY_MISMATCH" as const
        }));
        mutableFilesystem.candidateLifecycle = createFixtureIdentityBoundCandidateLifecycle({
          createCandidateLease: vi.fn(async () => {
            throw new Error("replacement create must not run");
          }),
          cleanupCandidateLease: vi.fn(async () => ({
            ok: false as const,
            removed: false,
            absent: false,
            identityMatched: false,
            code: "CANDIDATE_IDENTITY_MISMATCH" as const
          }))
        });
        return "inspected";
      },
      { repositoryRoot: mutableFixture.repositoryRoot, filesystem: mutableFilesystem }
    );

    expect(mutableResult).toMatchObject({ ok: true, value: "inspected" });
    expect(capturedCleanup).toHaveBeenCalledTimes(1);
    if (mutableRoot === undefined) throw new Error("mutable candidate root was not recorded");
    await expect(lstat(mutableRoot)).rejects.toMatchObject({ code: "ENOENT" });

    const unmarkedFixture = await createFixture();
    await populateReadyFixture(unmarkedFixture);
    const unmarkedCreate = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
      await mkdtemp(join(validated.tempParent, "dota-release-candidate-"))
    ));
    const unmarkedFilesystem: ReleaseCandidateFilesystem = {
      ...assemblyOperations,
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: unmarkedCreate
    };
    const unmarkedResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: unmarkedFixture.dotaRoot,
        tempParent: unmarkedFixture.tempParent
      },
      async () => "unexpected",
      { repositoryRoot: unmarkedFixture.repositoryRoot, filesystem: unmarkedFilesystem }
    );
    expect(withoutCleanup(unmarkedResult)).toEqual({
      ok: false,
      blockers: [{ code: "IDENTITY_BOUND_CLEANUP_REQUIRED", category: "creation" }]
    });
    expect(unmarkedCreate).not.toHaveBeenCalled();

    const forgedCreate = vi.fn(async () => {
      throw new Error("forged lifecycle must not create");
    });
    const forgedCleanup = vi.fn(async () => ({
      ok: true as const,
      removed: true as const,
      absent: true as const,
      identityMatched: true as const
    }));
    const forgedFilesystem: ReleaseCandidateFilesystem = {
      ...unmarkedFilesystem,
      candidateLifecycle: {
        identityBoundCleanup: true,
        createCandidateLease: forgedCreate,
        cleanupCandidateLease: forgedCleanup
      } as unknown as IdentityBoundCandidateLifecycle
    };
    const forgedResult = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: unmarkedFixture.dotaRoot,
        tempParent: unmarkedFixture.tempParent
      },
      async () => "unexpected",
      { repositoryRoot: unmarkedFixture.repositoryRoot, filesystem: forgedFilesystem }
    );
    expect(withoutCleanup(forgedResult)).toEqual({
      ok: false,
      blockers: [{ code: "IDENTITY_BOUND_CLEANUP_REQUIRED", category: "creation" }]
    });
    expect(forgedCreate).not.toHaveBeenCalled();
    expect(forgedCleanup).not.toHaveBeenCalled();
  });

  test("rejects malformed identity-bound cleanup results", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    let candidateRoot: string | undefined;
    const privateCode = `PRIVATE_${fixture.root}_${credentialPasswordFixture("private-value")}`;
    const filesystem: ReleaseCandidateFilesystem = {
      ...assemblyOperations,
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: vi.fn(async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        }),
        cleanupCandidateLease: vi.fn(async () => ({
          ok: false,
          removed: false,
          absent: false,
          identityMatched: false,
          code: privateCode
        } as unknown as CandidateLeaseCleanupResult))
      })
    };

    const result = await withAssembledReleaseCandidate(
      {
        addonName: "fixture_addon",
        dotaRoot: fixture.dotaRoot,
        tempParent: fixture.tempParent
      },
      async () => "must not survive malformed cleanup",
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_CLEANUP_RESULT_INVALID", category: "removal" }]
    });
    expect(JSON.stringify(result)).not.toContain(fixture.root);
    expect(JSON.stringify(result)).not.toContain("private-value");
    if (candidateRoot === undefined) throw new Error("malformed cleanup candidate was not recorded");
    expect((await lstat(candidateRoot)).isDirectory()).toBe(true);
  });

  test("sanitizes exceptional identity-bound cleanup results", async () => {
    const scenarios: Array<{
      name: string;
      createResult: (privateFailure: string) => CandidateLeaseCleanupResult;
    }> = [
      {
        name: "throwing ok getter",
        createResult: (privateFailure) => Object.defineProperty({}, "ok", {
          get: () => {
            throw new Error(`getter exposed ${privateFailure}`);
          }
        }) as CandidateLeaseCleanupResult
      },
      {
        name: "throwing required-field proxy",
        createResult: (privateFailure) => new Proxy(
          { ok: false, removed: false, absent: false, identityMatched: false },
          {
            get: (target, property, receiver) => {
              if (property === "removed") {
                throw new Error(`proxy exposed ${privateFailure}`);
              }
              return Reflect.get(target, property, receiver);
            }
          }
        ) as unknown as CandidateLeaseCleanupResult
      }
    ];

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const privateFailure = `${fixture.root}/${credentialPasswordFixture("synthetic-private-value")}`;
      const filesystem: ReleaseCandidateFilesystem = {
        ...assemblyOperations,
        lstat,
        realpath,
        readDirectory: async (path) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => {
          throw new Error("raw candidate creation must not be used");
        }),
        candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
          createCandidateLease: vi.fn(async (validated) => {
            const candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
            return { inspectionRoot: candidateRoot, identity: { candidateRoot } };
          }),
          cleanupCandidateLease: vi.fn(async () => scenario.createResult(privateFailure))
        })
      };

      const result = await withAssembledReleaseCandidate(
        {
          addonName: "fixture_addon",
          dotaRoot: fixture.dotaRoot,
          tempParent: fixture.tempParent
        },
        async () => "must not survive exceptional cleanup",
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      expect(withoutCleanup(result), scenario.name).toEqual({
        ok: false,
        blockers: [{ code: "CANDIDATE_CLEANUP_RESULT_INVALID", category: "removal" }]
      });
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("synthetic-private-value");
    }
  });

  test("blocks invalid inputs before candidate creation", async () => {
    const cases: Array<{
      name: string;
      arrange: (fixture: Fixture) => Promise<{
        input?: Partial<{ addonName: string; dotaRoot: string; tempParent: string }>;
        repositoryRoot?: string;
        expected: { code: string; field: string; category: string };
        failField?: string;
      }>;
    }> = [
      {
        name: "invalid addon name",
        arrange: async () => ({
          input: { addonName: "../private-addon" },
          expected: { code: "INVALID_ADDON_NAME", field: "addonName", category: "invalid" }
        })
      },
      {
        name: "missing Dota root input",
        arrange: async () => ({
          input: { dotaRoot: "" },
          expected: { code: "DOTA_ROOT_REQUIRED", field: "dotaRoot", category: "required" }
        })
      },
      {
        name: "nonexistent Dota root",
        arrange: async (fixture) => ({
          input: { dotaRoot: join(fixture.root, "missing-dota") },
          expected: { code: "DOTA_ROOT_MISSING", field: "dotaRoot", category: "missing" }
        })
      },
      {
        name: "non-directory Dota root",
        arrange: async (fixture) => {
          const path = join(fixture.root, "dota-file");
          await writeFile(path, "not a directory\n");
          return {
            input: { dotaRoot: path },
            expected: { code: "DOTA_ROOT_NOT_DIRECTORY", field: "dotaRoot", category: "not-directory" }
          };
        }
      },
      {
        name: "missing repository root input",
        arrange: async () => ({
          repositoryRoot: "",
          expected: { code: "REPOSITORY_ROOT_REQUIRED", field: "repositoryRoot", category: "required" }
        })
      },
      {
        name: "nonexistent repository root",
        arrange: async (fixture) => ({
          repositoryRoot: join(fixture.root, "missing-repository"),
          expected: { code: "REPOSITORY_ROOT_MISSING", field: "repositoryRoot", category: "missing" }
        })
      },
      {
        name: "non-directory repository root",
        arrange: async (fixture) => {
          const path = join(fixture.root, "repository-file");
          await writeFile(path, "not a directory\n");
          return {
            repositoryRoot: path,
            expected: { code: "REPOSITORY_ROOT_NOT_DIRECTORY", field: "repositoryRoot", category: "not-directory" }
          };
        }
      },
      {
        name: "missing temporary parent input",
        arrange: async () => ({
          input: { tempParent: "" },
          expected: { code: "TEMP_PARENT_REQUIRED", field: "tempParent", category: "required" }
        })
      },
      {
        name: "nonexistent temporary parent",
        arrange: async (fixture) => ({
          input: { tempParent: join(fixture.root, "missing-parent") },
          expected: { code: "TEMP_PARENT_MISSING", field: "tempParent", category: "missing" }
        })
      },
      {
        name: "non-directory temporary parent",
        arrange: async (fixture) => {
          const path = join(fixture.root, "parent-file");
          await writeFile(path, "not a directory\n");
          return {
            input: { tempParent: path },
            expected: { code: "TEMP_PARENT_NOT_DIRECTORY", field: "tempParent", category: "not-directory" }
          };
        }
      },
      {
        name: "temporary parent inside Dota root",
        arrange: async (fixture) => {
          const path = join(fixture.dotaRoot, "candidate-parent");
          await mkdir(path, { recursive: true });
          return {
            input: { tempParent: path },
            expected: { code: "TEMP_PARENT_NOT_ISOLATED", field: "tempParent", category: "unsafe-isolation" }
          };
        }
      },
      {
        name: "temporary parent inside game addon root",
        arrange: async (fixture) => ({
          input: { tempParent: fixture.gameAddonRoot },
          expected: { code: "TEMP_PARENT_NOT_ISOLATED", field: "tempParent", category: "unsafe-isolation" }
        })
      },
      {
        name: "temporary parent inside content addon root",
        arrange: async (fixture) => ({
          input: { tempParent: fixture.contentAddonRoot },
          expected: { code: "TEMP_PARENT_NOT_ISOLATED", field: "tempParent", category: "unsafe-isolation" }
        })
      },
      {
        name: "temporary parent inside repository root",
        arrange: async (fixture) => ({
          input: { tempParent: fixture.repositoryRoot },
          expected: { code: "TEMP_PARENT_NOT_ISOLATED", field: "tempParent", category: "unsafe-isolation" }
        })
      },
      {
        name: "missing game addon root",
        arrange: async (fixture) => {
          await rm(fixture.gameAddonRoot, { recursive: true, force: true });
          return {
            expected: { code: "GAME_ADDON_ROOT_MISSING", field: "gameAddonRoot", category: "missing" }
          };
        }
      },
      {
        name: "non-directory game addon root",
        arrange: async (fixture) => {
          await rm(fixture.gameAddonRoot, { recursive: true, force: true });
          await writeFile(fixture.gameAddonRoot, "not a directory\n");
          return {
            expected: { code: "GAME_ADDON_ROOT_NOT_DIRECTORY", field: "gameAddonRoot", category: "not-directory" }
          };
        }
      },
      {
        name: "missing content addon root",
        arrange: async (fixture) => {
          await rm(fixture.contentAddonRoot, { recursive: true, force: true });
          return {
            expected: { code: "CONTENT_ADDON_ROOT_MISSING", field: "contentAddonRoot", category: "missing" }
          };
        }
      },
      {
        name: "non-directory content addon root",
        arrange: async (fixture) => {
          await rm(fixture.contentAddonRoot, { recursive: true, force: true });
          await writeFile(fixture.contentAddonRoot, "not a directory\n");
          return {
            expected: { code: "CONTENT_ADDON_ROOT_NOT_DIRECTORY", field: "contentAddonRoot", category: "not-directory" }
          };
        }
      },
      {
        name: "filesystem inspection failure",
        arrange: async () => ({
          expected: { code: "DOTA_ROOT_UNREADABLE", field: "dotaRoot", category: "unreadable" },
          failField: "dotaRoot"
        })
      }
    ];

    for (const scenario of cases) {
      const fixture = await createFixture();
      const arranged = await scenario.arrange(fixture);
      const createCandidateRoot = vi.fn(async () => join(fixture.tempParent, "candidate"));
      const privateFailure = join(fixture.root, credentialPasswordFixture("private-value"));
      const filesystem = {
        lstat: vi.fn(async (path: string) => {
          if (arranged.failField === "dotaRoot" && path === fixture.dotaRoot) {
            throw new Error(`EACCES: ${privateFailure}`);
          }
          return await lstat(path);
        }),
        realpath,
        readDirectory: async (path: string) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot
      };

      const result = await prepareReleaseCandidateInput(
        {
          addonName: arranged.input?.addonName ?? "fixture_addon",
          dotaRoot: arranged.input?.dotaRoot ?? fixture.dotaRoot,
          tempParent: arranged.input?.tempParent ?? fixture.tempParent
        },
        {
          repositoryRoot: arranged.repositoryRoot ?? fixture.repositoryRoot,
          filesystem
        }
      );

      expect(result, scenario.name).toEqual({ ok: false, blockers: [arranged.expected] });
      expect(createCandidateRoot, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("private-value");
    }
  });

  test("blocks canonical root escapes before candidate creation", async () => {
    const cases: Array<{
      name: string;
      canonicalAlias: (fixture: Fixture) => { source: string; target: string };
      expected: { code: string; field: string; category: string };
    }> = [
      {
        name: "game addon root escapes the canonical Dota root",
        canonicalAlias: (fixture) => ({ source: fixture.gameAddonRoot, target: fixture.repositoryRoot }),
        expected: {
          code: "GAME_ADDON_ROOT_OUTSIDE_DOTA_ROOT",
          field: "gameAddonRoot",
          category: "unsafe-isolation"
        }
      },
      {
        name: "content addon root escapes the canonical Dota root",
        canonicalAlias: (fixture) => ({ source: fixture.contentAddonRoot, target: fixture.repositoryRoot }),
        expected: {
          code: "CONTENT_ADDON_ROOT_OUTSIDE_DOTA_ROOT",
          field: "contentAddonRoot",
          category: "unsafe-isolation"
        }
      },
      {
        name: "temporary parent aliases the canonical game addon root",
        canonicalAlias: (fixture) => ({ source: fixture.tempParent, target: fixture.gameAddonRoot }),
        expected: { code: "TEMP_PARENT_NOT_ISOLATED", field: "tempParent", category: "unsafe-isolation" }
      }
    ];

    for (const scenario of cases) {
      const fixture = await createFixture();
      const alias = scenario.canonicalAlias(fixture);
      const aliasSource = await realpath(alias.source);
      const aliasTarget = await realpath(alias.target);
      const createCandidateRoot = vi.fn(async () => join(fixture.tempParent, "candidate"));
      const filesystem = {
        lstat,
        realpath: vi.fn(async (path: string) => (
          path === alias.source || path === aliasSource ? aliasTarget : await realpath(path)
        )),
        readDirectory: async (path: string) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot
      };

      const result = await prepareReleaseCandidateInput(
        {
          addonName: "fixture_addon",
          dotaRoot: fixture.dotaRoot,
          tempParent: fixture.tempParent
        },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      expect(result, scenario.name).toEqual({ ok: false, blockers: [scenario.expected] });
      expect(createCandidateRoot, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
    }
  });

  test("normalizes hostile filesystem results at preparation boundaries", async () => {
    const scenarios: Array<Readonly<{
      name: string;
      lstatResult?: unknown;
      realpathResult?: unknown;
    }>> = [
      {
        name: "throwing directory predicate getter",
        lstatResult: Object.defineProperty({}, "isDirectory", {
          get: () => { throw new Error(credentialPasswordFixture("predicate-getter")); }
        })
      },
      { name: "non-callable directory predicate", lstatResult: { isDirectory: true } },
      { name: "non-boolean directory predicate", lstatResult: { isDirectory: () => "yes" } },
      { name: "empty canonical path", realpathResult: "" },
      { name: "relative canonical path", realpathResult: credentialPasswordFixture("relative-realpath") }
    ];

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      const privateValue = credentialPasswordFixture("private-adapter-value");
      const filesystem: ReleaseCandidateFilesystem = {
        lstat: vi.fn(async (path) => (
          path === fixture.dotaRoot && scenario.lstatResult !== undefined
            ? scenario.lstatResult as Awaited<ReturnType<ReleaseCandidateFilesystem["lstat"]>>
            : await lstat(path)
        )),
        realpath: vi.fn(async (path) => (
          path === fixture.dotaRoot && scenario.realpathResult !== undefined
            ? scenario.realpathResult as string
            : await realpath(path)
        )),
        readDirectory: async (path) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => { throw new Error(privateValue); })
      };

      const result = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      expect(result, scenario.name).toEqual({
        ok: false,
        blockers: [{ code: "DOTA_ROOT_UNREADABLE", field: "dotaRoot", category: "unreadable" }]
      });
      expect(JSON.stringify(result), scenario.name).not.toContain(privateValue);
      expect(JSON.stringify(result), scenario.name).not.toContain("relative-realpath");
    }
  });

  test("normalizes hostile filesystem results at inventory and lifecycle boundaries", async () => {
    const inventoryScenarios: Array<Readonly<{ name: string; names?: unknown; canonical?: unknown }>> = [
      { name: "malformed directory array", names: ["safe.txt", 7] },
      {
        name: "throwing directory index getter",
        names: Object.defineProperty(["safe.txt"], "0", {
          get: () => { throw new Error(credentialPasswordFixture("index-getter")); }
        })
      },
      {
        name: "throwing directory iterator",
        names: Object.defineProperty(["safe.txt"], Symbol.iterator, {
          get: () => { throw new Error(credentialPasswordFixture("iterator-getter")); }
        })
      },
      { name: "empty entry canonical path", names: ["safe.txt"], canonical: "" },
      { name: "relative entry canonical path", names: ["safe.txt"], canonical: "relative/private" }
    ];

    for (const scenario of inventoryScenarios) {
      const fixture = await createFixture();
      const createCandidateRoot = vi.fn(async () => join(fixture.tempParent, "candidate"));
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath: vi.fn(async (path) => (
          path.endsWith("/game/dota_addons/fixture_addon/safe.txt") && scenario.canonical !== undefined
            ? scenario.canonical as string
            : await realpath(path)
        )),
        readDirectory: vi.fn(async (path) => (
          path.endsWith("/game/dota_addons/fixture_addon") && scenario.names !== undefined
            ? scenario.names as string[]
            : []
        )),
        classifySourceEntry: async () => "file",
        createCandidateRoot
      };
      const prepared = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(prepared.ok, scenario.name).toBe(true);
      if (!prepared.ok) throw new Error("hostile inventory fixture input was rejected");

      const result = await inventoryReleaseCandidateSources(prepared.value);

      expect(result, scenario.name).toEqual({
        ok: false,
        blockers: [{
          code: "SOURCE_ENTRY_UNREADABLE",
          path: scenario.canonical === undefined
            ? "game/dota_addons/fixture_addon"
            : "game/dota_addons/fixture_addon/safe.txt",
          category: "unreadable"
        }]
      });
      expect(createCandidateRoot, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain("private");
    }

    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
      createCandidateLease: async (validated) => {
        const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: root, identity: { root } };
      },
      cleanupCandidateLease: async (identity) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true, removed: true, absent: true, identityMatched: true };
      }
    });
    const filesystem: ReleaseCandidateFilesystem = {
      lstat: vi.fn(async (path) => {
        if (path.includes("dota-release-candidate-")) {
          return Object.defineProperty({}, "isDirectory", {
            get: () => { throw new Error(credentialPasswordFixture("lifecycle-getter")); }
          }) as Awaited<ReturnType<ReleaseCandidateFilesystem["lstat"]>>;
        }
        return await lstat(path);
      }),
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
      candidateLifecycle: lifecycle
    };
    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => "must not inspect",
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );
    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_ROOT_UNREADABLE", category: "unsafe-isolation" }]
    });
    expect(JSON.stringify(result)).not.toContain("lifecycle-getter");
  });

  test("requires a validated handle before candidate continuation", async () => {
    type RawValidatedInput = Readonly<{
      addonName: string;
      dotaRoot: string;
      repositoryRoot: string;
      tempParent: string;
      gameAddonRoot: string;
      contentAddonRoot: string;
    }>;

    const fixture = await createFixture();
    const rawValidatedInput: RawValidatedInput = {
      addonName: "fixture_addon",
      dotaRoot: fixture.dotaRoot,
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      gameAddonRoot: fixture.gameAddonRoot,
      contentAddonRoot: fixture.contentAddonRoot
    };
    expectTypeOf(rawValidatedInput).not.toMatchTypeOf<ValidatedReleaseCandidateInput>();
    expectTypeOf(fixture.tempParent).not.toMatchTypeOf<
      Parameters<ReleaseCandidateFilesystem["createCandidateRoot"]>[0]
    >();

    const createCandidateRoot = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
      join(validated.tempParent, "candidate")
    ));
    const filesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot
    };
    const continuation = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
      await filesystem.createCandidateRoot(validated)
    ));

    const rejected = await continueReleaseCandidatePreparation(
      { addonName: "../private-addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem },
      continuation
    );

    expect(rejected).toEqual({
      ok: false,
      blockers: [{ code: "INVALID_ADDON_NAME", field: "addonName", category: "invalid" }]
    });
    expect(continuation).not.toHaveBeenCalled();
    expect(createCandidateRoot).not.toHaveBeenCalled();

    const accepted = await continueReleaseCandidatePreparation(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem },
      continuation
    );

    expect(accepted).toEqual({ ok: true, value: join(await realpath(fixture.tempParent), "candidate") });
    expect(continuation).toHaveBeenCalledTimes(1);
    expect(createCandidateRoot).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(continuation.mock.calls[0][0])).toBe(true);
  });

  test("rejects unsafe source identities before creation", async () => {
    const fixture = await createFixture();
    const privateRoot = join(fixture.root, "private", credentialPasswordFixture("private-value"));
    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(privateRoot, "target.txt"), "private target contents\n");
    await symlink(join(privateRoot, "target.txt"), join(fixture.gameAddonRoot, "linked.txt"));

    const createCandidateRoot = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
      join(validated.tempParent, "candidate")
    ));
    const filesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot
    };

    const realpathSpy = vi.fn(async (path: string) => await realpath(path));
    const prepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem: { ...filesystem, realpath: realpathSpy } }
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("fixture input was rejected");

    const realSymlinkResult = await inventoryReleaseCandidateSources(prepared.value);
    expect(realSymlinkResult).toEqual({
      ok: false,
      blockers: [{
        code: "SOURCE_ENTRY_UNSAFE",
        path: "game/dota_addons/fixture_addon/linked.txt",
        category: "symbolic-link"
      }]
    });
    expect(realpathSpy).not.toHaveBeenCalledWith(join(fixture.gameAddonRoot, "linked.txt"));
    expect(JSON.stringify(realSymlinkResult)).not.toContain(fixture.root);
    expect(JSON.stringify(realSymlinkResult)).not.toContain("private-value");

    type InventoryScenario = {
      name: string;
      gameNames?: string[];
      contentNames?: string[];
      directoryNames?: Record<string, string[]>;
      kinds?: Record<string, ReleaseCandidateEntryKind>;
      canonicalEscapes?: string[];
      expected: { code: string; path: string; category: string }[];
      unclassified?: string[];
    };
    const scenarios: InventoryScenario[] = [
      {
        name: "Windows reparse point",
        gameNames: ["junction"],
        kinds: { "game/junction": "reparse" },
        expected: [{
          code: "SOURCE_ENTRY_UNSAFE",
          path: "game/dota_addons/fixture_addon/junction",
          category: "reparse"
        }]
      },
      {
        name: "special entry",
        gameNames: ["pipe"],
        kinds: { "game/pipe": "special" },
        expected: [{
          code: "SOURCE_ENTRY_UNSAFE",
          path: "game/dota_addons/fixture_addon/pipe",
          category: "special"
        }]
      },
      {
        name: "unknown entry",
        contentNames: ["device"],
        kinds: { "content/device": "unknown" },
        expected: [{
          code: "SOURCE_ENTRY_UNSAFE",
          path: "content/dota_addons/fixture_addon/device",
          category: "unknown"
        }]
      },
      {
        name: "absolute identity",
        gameNames: ["/absolute.lua"],
        expected: [{
          code: "SOURCE_IDENTITY_INVALID",
          path: "game/dota_addons/fixture_addon/absolute.lua",
          category: "absolute"
        }],
        unclassified: ["/absolute.lua"]
      },
      {
        name: "Windows absolute identity",
        contentNames: ["C:\\private.lua"],
        expected: [{
          code: "SOURCE_IDENTITY_INVALID",
          path: "content/dota_addons/fixture_addon/C:/private.lua",
          category: "absolute"
        }],
        unclassified: ["C:\\private.lua"]
      },
      {
        name: "parent traversal",
        gameNames: [".."],
        expected: [{
          code: "SOURCE_IDENTITY_INVALID",
          path: "game/dota_addons/fixture_addon/..",
          category: "traversal"
        }],
        unclassified: [".."]
      },
      {
        name: "dot segment",
        contentNames: ["."],
        expected: [{
          code: "SOURCE_IDENTITY_INVALID",
          path: "content/dota_addons/fixture_addon/.",
          category: "traversal"
        }],
        unclassified: ["."]
      },
      {
        name: "separator ambiguity",
        gameNames: ["scripts\\addon.lua"],
        expected: [{
          code: "SOURCE_IDENTITY_INVALID",
          path: "game/dota_addons/fixture_addon/scripts/addon.lua",
          category: "separator"
        }],
        unclassified: ["scripts\\addon.lua"]
      },
      {
        name: "canonical escape",
        contentNames: ["escaped.txt"],
        kinds: { "content/escaped.txt": "file" },
        canonicalEscapes: ["content/escaped.txt"],
        expected: [{
          code: "SOURCE_ENTRY_OUTSIDE_ROOT",
          path: "content/dota_addons/fixture_addon/escaped.txt",
          category: "escape"
        }]
      },
      {
        name: "case-only collision with nested unsafe entry",
        gameNames: ["Scripts", "scripts"],
        directoryNames: { "game/scripts": ["linked"] },
        kinds: {
          "game/Scripts": "directory",
          "game/scripts": "directory",
          "game/scripts/linked": "reparse"
        },
        expected: [
          {
            code: "SOURCE_IDENTITY_COLLISION",
            path: "game/dota_addons/fixture_addon/Scripts",
            category: "case-fold"
          },
          {
            code: "SOURCE_IDENTITY_COLLISION",
            path: "game/dota_addons/fixture_addon/scripts",
            category: "case-fold"
          },
          {
            code: "SOURCE_ENTRY_UNSAFE",
            path: "game/dota_addons/fixture_addon/scripts/linked",
            category: "reparse"
          }
        ]
      }
    ];

    for (const scenario of scenarios) {
      const classifiedPaths: string[] = [];
      const canonicalizedPaths: string[] = [];
      const enumeratedPaths: string[] = [];
      const gameRoot = fixture.gameAddonRoot;
      const contentRoot = fixture.contentAddonRoot;
      const keyForPath = (path: string): string => {
        if (path.startsWith(`${gameRoot}/`)) return `game/${path.slice(gameRoot.length + 1)}`;
        if (path.startsWith(`${contentRoot}/`)) return `content/${path.slice(contentRoot.length + 1)}`;
        return path;
      };
      const scenarioFilesystem: ReleaseCandidateFilesystem = {
        ...filesystem,
        readDirectory: vi.fn(async (path) => {
          enumeratedPaths.push(path);
          if (path === gameRoot) return scenario.gameNames ?? [];
          if (path === contentRoot) return scenario.contentNames ?? [];
          return scenario.directoryNames?.[keyForPath(path)] ?? [];
        }),
        classifySourceEntry: vi.fn(async (path) => {
          classifiedPaths.push(path);
          return scenario.kinds?.[keyForPath(path)] ?? "file";
        }),
        realpath: vi.fn(async (path) => {
          canonicalizedPaths.push(path);
          return scenario.canonicalEscapes?.includes(keyForPath(path))
            ? join(privateRoot, "target.txt")
            : path;
        })
      };

      const scenarioPrepared = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem: scenarioFilesystem }
      );
      expect(scenarioPrepared.ok, scenario.name).toBe(true);
      if (!scenarioPrepared.ok) throw new Error(`${scenario.name} fixture input was rejected`);
      const result = await inventoryReleaseCandidateSources(scenarioPrepared.value);

      expect(result, scenario.name).toEqual({ ok: false, blockers: scenario.expected });
      expect(createCandidateRoot, scenario.name).not.toHaveBeenCalled();
      if ((scenario.unclassified ?? []).length > 0) {
        expect(classifiedPaths, scenario.name).toEqual([]);
      }
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("private-value");
      if (scenario.name === "canonical escape") {
        expect(canonicalizedPaths).toContain(join(contentRoot, "escaped.txt"));
      }
      if (["Windows reparse point", "special entry", "unknown entry"].includes(scenario.name)) {
        const sourceRoot = scenario.gameNames === undefined ? contentRoot : gameRoot;
        const unsafeName = (scenario.gameNames ?? scenario.contentNames)?.[0];
        if (unsafeName === undefined) throw new Error("unsafe scenario did not provide an entry name");
        const unsafePath = join(sourceRoot, unsafeName);
        expect(classifiedPaths.filter((path) => path === unsafePath), scenario.name).toHaveLength(1);
        expect(canonicalizedPaths, scenario.name).not.toContain(unsafePath);
        expect(enumeratedPaths.filter((path) => path === unsafePath), scenario.name).toHaveLength(0);
      }
    }

    await rm(join(fixture.gameAddonRoot, "linked.txt"));
    await Promise.all([
      mkdir(join(fixture.gameAddonRoot, "zeta")),
      writeFile(join(fixture.gameAddonRoot, "Alpha.txt"), "alpha\n"),
      writeFile(join(fixture.contentAddonRoot, "beta.txt"), "beta\n")
    ]);
    const acceptedFilesystem: ReleaseCandidateFilesystem = {
      ...filesystem,
      readDirectory: async (path) => (await readdir(path)).reverse()
    };
    const acceptedPrepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem: acceptedFilesystem }
    );
    expect(acceptedPrepared.ok).toBe(true);
    if (!acceptedPrepared.ok) throw new Error("accepted fixture input was rejected");
    const accepted = await inventoryReleaseCandidateSources(acceptedPrepared.value);
    expect(accepted).toEqual({
      ok: true,
      entries: [
        { root: "content", path: "content/dota_addons/fixture_addon/beta.txt", kind: "file" },
        { root: "game", path: "game/dota_addons/fixture_addon/Alpha.txt", kind: "file" },
        { root: "game", path: "game/dota_addons/fixture_addon/zeta", kind: "directory" }
      ]
    });
    expect(createCandidateRoot).not.toHaveBeenCalled();
  });

  test("preserves root provenance in deterministic global inventory order", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(join(fixture.gameAddonRoot, "Shared.TXT"), "game\n"),
      writeFile(join(fixture.gameAddonRoot, "zeta.txt"), "game zeta\n"),
      writeFile(join(fixture.contentAddonRoot, "shared.txt"), "content\n"),
      writeFile(join(fixture.contentAddonRoot, "Alpha.txt"), "content alpha\n")
    ]);
    const createCandidateRoot = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
      join(validated.tempParent, "candidate")
    ));
    const baseFilesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot
    };
    const prepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem: baseFilesystem }
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("fixture input was rejected");

    const forward = await inventoryReleaseCandidateSources(prepared.value);
    const reversedFilesystem: ReleaseCandidateFilesystem = {
      ...baseFilesystem,
      readDirectory: async (path) => (await readdir(path)).reverse()
    };
    const reversedPrepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem: reversedFilesystem }
    );
    expect(reversedPrepared.ok).toBe(true);
    if (!reversedPrepared.ok) throw new Error("reversed fixture input was rejected");
    const reversed = await inventoryReleaseCandidateSources(reversedPrepared.value);
    const expected = {
      ok: true,
      entries: [
        { root: "content", path: "content/dota_addons/fixture_addon/Alpha.txt", kind: "file" },
        { root: "content", path: "content/dota_addons/fixture_addon/shared.txt", kind: "file" },
        { root: "game", path: "game/dota_addons/fixture_addon/Shared.TXT", kind: "file" },
        { root: "game", path: "game/dota_addons/fixture_addon/zeta.txt", kind: "file" }
      ]
    };

    expect(forward).toEqual(expected);
    expect(reversed).toEqual(expected);
    expect(createCandidateRoot).not.toHaveBeenCalled();
  });

  test("binds inventory to the validated filesystem capability", async () => {
    const fixture = await createFixture();
    const virtualPath = join(fixture.gameAddonRoot, "virtual.txt");
    const readDirectory = vi.fn(async (path: string) => (
      path === fixture.gameAddonRoot ? ["virtual.txt"] : []
    ));
    const classifySourceEntry = vi.fn(async (path: string): Promise<ReleaseCandidateEntryKind> => (
      path === virtualPath ? "file" : classifyFixtureEntry(path)
    ));
    const adapterRealpath = vi.fn(async (path: string) => path);
    const filesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath: adapterRealpath,
      readDirectory,
      classifySourceEntry,
      createCandidateRoot: vi.fn(async (validated) => join(validated.tempParent, "candidate"))
    };
    const prepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("virtual fixture input was rejected");

    const result = await inventoryReleaseCandidateSources(prepared.value);

    expect(result).toEqual({
      ok: true,
      entries: [{
        root: "game",
        path: "game/dota_addons/fixture_addon/virtual.txt",
        kind: "file"
      }]
    });
    expect(readDirectory).toHaveBeenCalledWith(fixture.gameAddonRoot);
    expect(classifySourceEntry).toHaveBeenCalledExactlyOnceWith(virtualPath);
    expect(adapterRealpath).toHaveBeenCalledWith(virtualPath);
  });

  test("fails closed on Windows without a reparse-capable classifier", async () => {
    const fixture = await createFixture();
    await writeFile(join(fixture.gameAddonRoot, "regular.txt"), "regular\n");
    await symlink(join(fixture.gameAddonRoot, "regular.txt"), join(fixture.contentAddonRoot, "linked.txt"));

    const prepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, platform: "win32" }
    );
    expect(prepared).toEqual({
      ok: false,
      blockers: [{
        code: "WINDOWS_REPARSE_CLASSIFIER_REQUIRED",
        field: "dotaRoot",
        category: "unsafe-isolation"
      }]
    });

    const classifySourceEntry = vi.fn(async (path: string): Promise<ReleaseCandidateEntryKind> => (
      path.endsWith("linked.txt") ? "reparse" : "file"
    ));
    const capableFilesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath,
      readDirectory: async (path) => await readdir(path),
      classifySourceEntry,
      createCandidateRoot: vi.fn(async (validated) => join(validated.tempParent, "candidate"))
    };
    const unmarkedPrepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem: capableFilesystem, platform: "win32" }
    );
    expect(unmarkedPrepared).toEqual({
      ok: false,
      blockers: [{
        code: "WINDOWS_REPARSE_CLASSIFIER_REQUIRED",
        field: "dotaRoot",
        category: "unsafe-isolation"
      }]
    });
    const markedCapableFilesystem: ReleaseCandidateFilesystem = {
      ...capableFilesystem,
      reparsePointAware: true
    };
    const capablePrepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      { repositoryRoot: fixture.repositoryRoot, filesystem: markedCapableFilesystem, platform: "win32" }
    );
    expect(capablePrepared.ok).toBe(true);
    if (!capablePrepared.ok) throw new Error("capable Windows fixture input was rejected");

    const capableResult = await inventoryReleaseCandidateSources(capablePrepared.value);

    expect(capableResult).toEqual({
      ok: false,
      blockers: [{
        code: "SOURCE_ENTRY_UNSAFE",
        path: "content/dota_addons/fixture_addon/linked.txt",
        category: "reparse"
      }]
    });
    expect(classifySourceEntry).toHaveBeenCalledTimes(2);
  });

  test("reports every member of deterministic case-fold collision groups", async () => {
    const fixture = await createFixture();
    const expected = {
      ok: false,
      blockers: [
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "content/dota_addons/fixture_addon/BETA.TXT",
          category: "case-fold"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "content/dota_addons/fixture_addon/Beta.txt",
          category: "case-fold"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "content/dota_addons/fixture_addon/beta.txt",
          category: "case-fold"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/Alpha.txt",
          category: "case-fold"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/alpha.txt",
          category: "case-fold"
        }
      ]
    };

    for (const reverse of [false, true]) {
      const gameNames = ["Alpha.txt", "alpha.txt"];
      const contentNames = ["Beta.txt", "BETA.TXT", "beta.txt"];
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath: async (path) => path,
        readDirectory: async (path) => {
          const names = path === fixture.gameAddonRoot
            ? [...gameNames]
            : path === fixture.contentAddonRoot
              ? [...contentNames]
              : [];
          return reverse ? names.reverse() : names;
        },
        classifySourceEntry: async () => "file",
        createCandidateRoot: vi.fn(async (validated) => join(validated.tempParent, "candidate"))
      };
      const prepared = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw new Error("collision fixture input was rejected");

      expect(await inventoryReleaseCandidateSources(prepared.value)).toEqual(expected);
    }
  });

  test("blocks exact duplicate directory identities before candidate creation", async () => {
    const expected = {
      ok: false,
      blockers: [
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/Alpha.txt",
          category: "case-fold"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/Alpha.txt",
          category: "exact-duplicate"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/alpha.txt",
          category: "case-fold"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/nested/repeated.txt",
          category: "exact-duplicate"
        },
        {
          code: "SOURCE_IDENTITY_COLLISION",
          path: "game/dota_addons/fixture_addon/repeated.txt",
          category: "exact-duplicate"
        }
      ]
    };

    for (const reverse of [false, true]) {
      const fixture = await createFixture();
      const createCandidateRoot = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
        join(validated.tempParent, "candidate")
      ));
      const classifySourceEntry = vi.fn(async (path: string): Promise<ReleaseCandidateEntryKind> => (
        path.endsWith("/nested") ? "directory" : "file"
      ));
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath: async (path) => path.includes("/dota_addons/fixture_addon/")
          ? path
          : await realpath(path),
        readDirectory: async (path) => {
          const names = path.endsWith("/game/dota_addons/fixture_addon")
            ? ["repeated.txt", "Alpha.txt", "nested", "Alpha.txt", "alpha.txt", "repeated.txt"]
            : path.endsWith("/game/dota_addons/fixture_addon/nested")
              ? ["repeated.txt", "repeated.txt"]
              : [];
          return reverse ? names.reverse() : names;
        },
        classifySourceEntry,
        createCandidateRoot
      };
      const prepared = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw new Error("duplicate fixture input was rejected");

      expect(await inventoryReleaseCandidateSources(prepared.value)).toEqual(expected);
      const lifecycleResult = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => "must not inspect",
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(withoutCleanup(lifecycleResult)).toEqual(expected);
      expect(createCandidateRoot).not.toHaveBeenCalled();
      expect(classifySourceEntry).toHaveBeenCalledTimes(4);
    }
  });

  test("redacts credential-shaped identities from every serialized inventory outcome", async () => {
    const secretValue = "inventory-private-value";
    const credentialName = credentialPasswordFixture(secretValue);
    const upperCredentialName = credentialName.toUpperCase();
    const redactedPath = "game/dota_addons/fixture_addon/[redacted]";
    const scenarios: Array<Readonly<{
      name: string;
      names: string[];
      classify?: "file" | "reparse" | "throw";
      escape?: boolean;
      expected: unknown;
    }>> = [
      {
        name: "accepted inventory entry",
        names: [credentialName],
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_IDENTITY_SENSITIVE", path: redactedPath, category: "sensitive" }]
        }
      },
      {
        name: "unsafe entry kind",
        names: [credentialName],
        classify: "reparse",
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_ENTRY_UNSAFE", path: redactedPath, category: "reparse" }]
        }
      },
      {
        name: "canonical escape",
        names: [credentialName],
        escape: true,
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_ENTRY_OUTSIDE_ROOT", path: redactedPath, category: "escape" }]
        }
      },
      {
        name: "unreadable entry",
        names: [credentialName],
        classify: "throw",
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_ENTRY_UNREADABLE", path: redactedPath, category: "unreadable" }]
        }
      },
      {
        name: "invalid identity",
        names: [`${credentialName}\\nested.lua`],
        expected: {
          ok: false,
          blockers: [{
            code: "SOURCE_IDENTITY_INVALID",
            path: `${redactedPath}/nested.lua`,
            category: "separator"
          }]
        }
      },
      {
        name: "exact duplicate",
        names: [credentialName, credentialName],
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_IDENTITY_COLLISION", path: redactedPath, category: "exact-duplicate" }]
        }
      },
      {
        name: "case-fold collision",
        names: [credentialName, upperCredentialName],
        expected: {
          ok: false,
          blockers: [
            { code: "SOURCE_IDENTITY_COLLISION", path: redactedPath, category: "case-fold" },
            { code: "SOURCE_IDENTITY_COLLISION", path: redactedPath, category: "case-fold" }
          ]
        }
      }
    ];

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      const privateEscape = join(fixture.repositoryRoot, credentialName);
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath: async (path) => {
          if (scenario.escape && path.endsWith(`/${credentialName}`)) return privateEscape;
          if (path.toLowerCase().includes(`/dota_addons/fixture_addon/${credentialName}`)) return path;
          return await realpath(path);
        },
        readDirectory: async (path) => (
          path.endsWith("/game/dota_addons/fixture_addon") ? [...scenario.names] : []
        ),
        classifySourceEntry: async () => {
          if (scenario.classify === "throw") throw new Error(credentialName);
          return scenario.classify ?? "file";
        },
        createCandidateRoot: vi.fn(async () => { throw new Error("candidate creation is forbidden"); })
      };
      const prepared = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(prepared.ok, scenario.name).toBe(true);
      if (!prepared.ok) throw new Error("redaction fixture input was rejected");

      const result = await inventoryReleaseCandidateSources(prepared.value);
      const serialized = JSON.stringify(result);

      expect(result, scenario.name).toEqual(scenario.expected);
      expect(serialized, scenario.name).not.toContain(credentialName);
      expect(serialized, scenario.name).not.toContain(upperCredentialName);
      expect(serialized, scenario.name).not.toContain(secretValue);
      expect(serialized, scenario.name).not.toContain(fixture.root);
    }
  });

  test("shares token-shaped evidence redaction with readiness findings", async () => {
    const tokenName = githubPatFixture();
    const passwordName = credentialPasswordFixture("shared-classifier-value");
    const redactedPath = "game/dota_addons/fixture_addon/[redacted]";
    const scenarios: Array<Readonly<{
      name: string;
      names: string[];
      kind: "file" | "reparse";
      expected: unknown;
    }>> = [
      {
        name: "token-shaped unsafe entry",
        names: [tokenName],
        kind: "reparse",
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_ENTRY_UNSAFE", path: redactedPath, category: "reparse" }]
        }
      },
      {
        name: "token-shaped exact collision",
        names: [tokenName, tokenName],
        kind: "file",
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_IDENTITY_COLLISION", path: redactedPath, category: "exact-duplicate" }]
        }
      },
      {
        name: "password category parity",
        names: [passwordName],
        kind: "reparse",
        expected: {
          ok: false,
          blockers: [{ code: "SOURCE_ENTRY_UNSAFE", path: redactedPath, category: "reparse" }]
        }
      }
    ];

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath: async (path) => path.includes("/dota_addons/fixture_addon/")
          ? path
          : await realpath(path),
        readDirectory: async (path) => (
          path.endsWith("/game/dota_addons/fixture_addon") ? [...scenario.names] : []
        ),
        classifySourceEntry: async () => scenario.kind,
        createCandidateRoot: vi.fn(async () => { throw new Error("candidate creation is forbidden"); })
      };
      const prepared = await prepareReleaseCandidateInput(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );
      expect(prepared.ok, scenario.name).toBe(true);
      if (!prepared.ok) throw new Error("shared sanitizer fixture input was rejected");

      const result = await inventoryReleaseCandidateSources(prepared.value);
      const serialized = JSON.stringify(result);

      expect(result, scenario.name).toEqual(scenario.expected);
      expect(serialized, scenario.name).not.toContain(tokenName);
      expect(serialized, scenario.name).not.toContain(passwordName);
    }
  });

  test("rejects credential-shaped source identities before manifest evidence", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const tokenName = `${githubPatFixture()}.bin`;
    const sensitivePath = join(fixture.contentAddonRoot, "materials", tokenName);
    await mkdir(join(sensitivePath, ".."), { recursive: true });
    await writeFile(sensitivePath, Buffer.from([0x00, 0xff, 0x10]));
    const sourceBefore = await snapshotSourceTrees(fixture);
    const createCandidateLease = vi.fn(async (validated: ValidatedReleaseCandidateInput) => {
      const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
      return { inspectionRoot: root, identity: { root } };
    });
    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => "unexpected",
      {
        repositoryRoot: fixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
            createCandidateLease,
            cleanupCandidateLease: async (identity) => {
              await rm(identity.root, { recursive: true, force: false });
              return {
                ok: true,
                removed: true,
                absent: true,
                identityMatched: true
              };
            }
          })
        }
      }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      blockers: [{
        code: "SOURCE_IDENTITY_SENSITIVE",
        path: "content/dota_addons/fixture_addon/materials/[redacted]",
        category: "sensitive"
      }]
    });
    expect(createCandidateLease).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(tokenName);
    expect(JSON.stringify(result)).not.toContain("manifest");
    expect(await snapshotSourceTrees(fixture)).toEqual(sourceBefore);
  });

  test("fails on source mutation without writing source trees", async () => {
    type MutationCheckpoint = "lease" | "before-copy" | "after-copy" | "reconcile" | "callback";
    const mutationScenarios: Array<Readonly<{
      name: string;
      checkpoint: MutationCheckpoint;
      mutate(path: string, fixture: Fixture): Promise<void>;
      callbackInvoked: boolean;
    }>> = [
      { name: "add before revalidation", checkpoint: "lease", mutate: async (_path, fixture) => await writeFile(join(fixture.contentAddonRoot, "maps", "added.bin"), "added"), callbackInvoked: false },
      { name: "remove immediately before copy", checkpoint: "before-copy", mutate: async (path) => await rm(path), callbackInvoked: false },
      { name: "rename immediately before copy", checkpoint: "before-copy", mutate: async (path) => await rename(path, join(path, "..", "renamed.bin")), callbackInvoked: false },
      { name: "retype immediately before copy", checkpoint: "before-copy", mutate: async (path) => { await rm(path); await mkdir(path); }, callbackInvoked: false },
      { name: "replace with link after copy", checkpoint: "after-copy", mutate: async (path, fixture) => { await rm(path); await symlink(join(fixture.gameAddonRoot, "addoninfo.txt"), path); }, callbackInvoked: false },
      { name: "truncate before reconciliation", checkpoint: "reconcile", mutate: async (path) => await writeFile(path, Buffer.from([0x01])), callbackInvoked: false },
      { name: "change same-length bytes during callback", checkpoint: "callback", mutate: async (path) => await writeFile(path, Buffer.from([0x90, 0x80, 0x70, 0x60])), callbackInvoked: true }
    ];

    for (const scenario of mutationScenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const mutablePath = join(fixture.contentAddonRoot, "maps", "mutable.bin");
      await writeFile(mutablePath, Buffer.from([0x10, 0x20, 0x30, 0x40]));
      let mutated = false;
      let mutationAttempts = 0;
      const mutateOnce = async (): Promise<void> => {
        mutationAttempts += 1;
        if (mutated) return;
        mutated = true;
        await scenario.mutate(mutablePath, fixture);
      };
      let candidateRoot: string | undefined;
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          if (scenario.checkpoint === "lease") await mutateOnce();
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return {
            inspectionRoot: candidateRoot,
            identity: {
              root: candidateRoot,
              beforeMaterialize: async (operation: CandidateMaterializationOperation) => {
                if (scenario.checkpoint === "before-copy" && operation.source.path.endsWith("/mutable.bin")) await mutateOnce();
              },
              afterMaterialize: async (operation: CandidateMaterializationOperation) => {
                if (scenario.checkpoint === "after-copy" && operation.source.path.endsWith("/mutable.bin")) await mutateOnce();
              },
              beforeReconcile: async () => {
                if (scenario.checkpoint === "reconcile") await mutateOnce();
              }
            }
          };
        },
        cleanupCandidateLease
      });
      const inspect = vi.fn(async () => {
        if (scenario.checkpoint === "callback") await mutateOnce();
        return "must not escape source mutation";
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        inspect,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(withoutCleanup(result), scenario.name).toEqual({
        ok: false,
        blockers: [{
          code: scenario.checkpoint === "callback" ? "RELEASE_CANDIDATE_INTEGRITY_MISMATCH" : "SOURCE_CHANGED_DURING_ASSEMBLY",
          category: scenario.checkpoint === "callback" ? "integrity" : "assembly"
        }]
      });
      expect(mutated, scenario.name).toBe(true);
      expect(mutationAttempts, scenario.name).toBe(1);
      expect(inspect, scenario.name).toHaveBeenCalledTimes(scenario.callbackInvoked ? 1 : 0);
      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      if (candidateRoot !== undefined) await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });
    }

    for (const outcome of ["success", "copy-failure", "callback-failure", "removal-failure"] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      await mkdir(join(fixture.contentAddonRoot, "materials"), { recursive: true });
      await writeFile(join(fixture.contentAddonRoot, "materials", "texture.bin"), Buffer.from([0x00, 0xff]));
      const before = await snapshotSourceTrees(fixture);
      const materializedDestinations: string[] = [];
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        materializedDestinations.push(identity.root);
        await rm(identity.root, { recursive: true, force: false });
        return outcome === "removal-failure"
          ? { ok: false as const, removed: true, absent: true, identityMatched: true, code: "CANDIDATE_REMOVAL_FAILED" as const }
          : { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: root, identity: { root, failCopy: outcome === "copy-failure", materializedDestinations } };
        },
        cleanupCandidateLease
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => {
          if (outcome === "callback-failure") throw new Error("private callback failure");
          return "inspected";
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(await snapshotSourceTrees(fixture), outcome).toEqual(before);
      expect(materializedDestinations.every((path) => !path.startsWith(`${fixture.gameAddonRoot}/`) && !path.startsWith(`${fixture.contentAddonRoot}/`)), outcome).toBe(true);
      expect(cleanupCandidateLease, outcome).toHaveBeenCalledTimes(1);
      if (outcome === "success") expect(result).toMatchObject({ ok: true, value: "inspected" });
      else expect(result.ok, outcome).toBe(false);
    }
  });

  test("streams identity-bound integrity through the production primitive", async () => {
    const releaseCandidate = await import("../src/release-candidate.js") as unknown as {
      observeIdentityBoundIntegrityStream?: (input: unknown) => Promise<unknown>;
    };
    expect(releaseCandidate.observeIdentityBoundIntegrityStream).toBeTypeOf("function");
    const observe = releaseCandidate.observeIdentityBoundIntegrityStream;
    if (observe === undefined) throw new Error("production integrity stream helper missing");

    const chunks = [
      Uint8Array.from([0x00]),
      Uint8Array.from([0xff, 0x10, 0x80]),
      Uint8Array.from([0x42, 0x00])
    ];
    let yielded = 0;
    const binary = await observe({
      root: "content",
      path: "content/dota_addons/fixture_addon/materials/stream.bin",
      identityMatched: true,
      kindMatched: true,
      contained: true,
      openByteStream: async () => (async function* (): AsyncGenerator<Uint8Array> {
        for (const chunk of chunks) {
          yielded += 1;
          yield chunk;
        }
      })()
    });
    expect(binary).toEqual({
      ok: true,
      schemaVersion: "1.0",
      root: "content",
      path: "content/dota_addons/fixture_addon/materials/stream.bin",
      bytes: 6,
      sha256: createHash("sha256").update(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))).digest("hex"),
      identityMatched: true,
      kindMatched: true,
      contained: true
    });
    expect(yielded).toBe(3);
    expect(JSON.stringify(binary)).not.toContain("absolutePath");
    expect(JSON.stringify(binary)).not.toContain("chunks");

    const empty = await observe({
      root: "game",
      path: "game/dota_addons/fixture_addon/empty.bin",
      identityMatched: true,
      kindMatched: true,
      contained: true,
      openByteStream: async () => (async function* (): AsyncGenerator<Uint8Array> {})()
    });
    expect(empty).toMatchObject({
      ok: true,
      bytes: 0,
      sha256: createHash("sha256").digest("hex")
    });

    const bufferIterator = vi.fn(() => (async function* (): AsyncGenerator<Uint8Array> {
      yield Uint8Array.from([0x01, 0x02]);
    })());
    const augmentedBuffer = Buffer.from([0x01, 0x02]);
    Object.defineProperty(augmentedBuffer, Symbol.asyncIterator, { value: bufferIterator });
    const byteArrayIterator = vi.fn(() => (async function* (): AsyncGenerator<Uint8Array> {
      yield Uint8Array.from([0x03, 0x04]);
    })());
    const augmentedByteArray = Uint8Array.from([0x03, 0x04]);
    Object.defineProperty(augmentedByteArray, Symbol.asyncIterator, { value: byteArrayIterator });
    const invalidInputs: Array<Readonly<{ name: string; input: unknown; iterator?: ReturnType<typeof vi.fn> }>> = [
      {
        name: "absolute identity",
        input: {
          root: "game", path: "/private/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => (async function* (): AsyncGenerator<Uint8Array> {})()
        }
      },
      {
        name: "whole-file buffer",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => Buffer.from([0x01, 0x02])
        }
      },
      {
        name: "augmented whole-file buffer",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => augmentedBuffer
        },
        iterator: bufferIterator
      },
      {
        name: "augmented whole-file byte array",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => augmentedByteArray
        },
        iterator: byteArrayIterator
      },
      {
        name: "invalid chunk",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => (async function* (): AsyncGenerator<unknown> { yield "not bytes"; })()
        }
      },
      {
        name: "oversized chunk",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => (async function* (): AsyncGenerator<Uint8Array> { yield new Uint8Array(64 * 1024 + 1); })()
        }
      },
      {
        name: "iterator throws",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => ({ [Symbol.asyncIterator]: () => ({ next: async () => { throw new Error("private iterator"); } }) })
        }
      },
      {
        name: "iterator getter throws",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: async () => Object.defineProperty({}, Symbol.asyncIterator, { get: () => { throw new Error("private getter"); } })
        }
      },
      {
        name: "thenable throws",
        input: {
          root: "game", path: "game/dota_addons/fixture_addon/addon.bin", identityMatched: true, kindMatched: true, contained: true,
          openByteStream: () => ({ then: () => { throw new Error("private thenable"); } })
        }
      }
    ];
    for (const scenario of invalidInputs) {
      const result = await observe(scenario.input);
      expect(result, scenario.name).toEqual({ ok: false, code: "INTEGRITY_STREAM_RESULT_INVALID" });
      if (scenario.iterator !== undefined) expect(scenario.iterator, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain("private");
    }
  });

  test("keeps large-file stability metadata-only while streaming integrity bytes", async () => {
    const fixture = await createFixture();
    const largePath = join(fixture.contentAddonRoot, "materials", "large-stability.bin");
    const largeBytes = Buffer.alloc(1024 * 1024 + 17, 0x5a);
    await mkdir(join(largePath, ".."), { recursive: true });
    await writeFile(largePath, largeBytes);
    const entry = {
      root: "content" as const,
      path: "content/dota_addons/fixture_addon/materials/large-stability.bin",
      kind: "file" as const
    };
    const prepared = await prepareReleaseCandidateInput(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      {
        repositoryRoot: fixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("candidate creation is forbidden"); })
        }
      }
    );
    if (!prepared.ok) throw new Error("large stability fixture input was rejected");

    const stability = await createAcceptedSourceObserver()(prepared.value, entry);
    expect(stability).toMatchObject({
      ok: true,
      kind: "file",
      size: largeBytes.byteLength,
      identityMatched: true,
      contained: true
    });
    expect(Reflect.has(stability, "bytes")).toBe(false);

    const integrity = await streamFixtureIntegrity(
      largePath,
      "content",
      entry.path,
      [1, 63, 64, 65, 4096, 64 * 1024]
    );
    expect(integrity).toMatchObject({
      ok: true,
      bytes: largeBytes.byteLength,
      sha256: createHash("sha256").update(largeBytes).digest("hex")
    });
    expect(Reflect.has(integrity, "content")).toBe(false);
  });

  test("reobserves triple integrity after inspection before cleanup", async () => {
    for (const scenario of [
      { name: "success", mutation: "none", callbackThrows: false, expectedCode: undefined },
      { name: "callback throws", mutation: "none", callbackThrows: true, expectedCode: "CANDIDATE_INSPECTION_FAILED" },
      { name: "candidate mutation", mutation: "candidate", callbackThrows: false, expectedCode: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH" },
      { name: "source mutation", mutation: "source", callbackThrows: false, expectedCode: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH" },
      { name: "mutation before throw", mutation: "candidate", callbackThrows: true, expectedCode: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH" }
    ] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const binaryPath = join(fixture.contentAddonRoot, "materials", "integrity.bin");
      await mkdir(join(binaryPath, ".."), { recursive: true });
      await writeFile(binaryPath, Buffer.from([0x00, 0xff, 0x10, 0x80, 0x42]));
      const emptyPath = join(fixture.contentAddonRoot, "materials", "empty.bin");
      await writeFile(emptyPath, Buffer.alloc(0));
      const largePath = join(fixture.contentAddonRoot, "materials", "large.bin");
      await writeFile(largePath, Buffer.alloc(256 * 1024 + 17, 0xa5));

      const events: string[] = [];
      let sourceCalls = 0;
      let candidateCalls = 0;
      let candidateRoot: string | undefined;
      let callbackSettled = false;
      let finalStabilityRecorded = false;
      const observeSourceEntry = createAcceptedSourceObserver();
      const observeSource = async (
        input: ValidatedReleaseCandidateInput,
        entry: Parameters<ReturnType<typeof createNoFollowSourceReader>>[1]
      ): Promise<unknown> => {
        sourceCalls += 1;
        if (callbackSettled && sourceCalls === 11) events.push("source-after-integrity");
        const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
        const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        return await streamFixtureIntegrity(
          join(sourceRoot, ...entry.path.slice(prefix.length).split("/")),
          entry.root,
          entry.path,
          [1, 63, 64, 65, 4096]
        );
      };
      const observeCandidate = async (
        identity: { root: string },
        expected: CandidateExpectedEntry[]
      ): Promise<unknown> => {
        candidateCalls += 1;
        events.push(candidateCalls === 1 ? "candidate-before-callback" : "candidate-after-callback");
        return {
          ok: true,
          schemaVersion: "1.0",
          observations: await Promise.all(expected.filter((entry) => entry.kind === "file").map(async (entry) => {
            const [root] = entry.path.split("/");
            return await streamFixtureIntegrity(
              join(identity.root, ...entry.path.split("/")),
              root as "game" | "content",
              entry.path,
              [65, 1, 4096, 63, 64]
            );
          }))
        };
      };
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        events.push("cleanup");
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease,
        observeAcceptedSourceEntry: async (input, entry) => {
          if (callbackSettled && !finalStabilityRecorded) {
            finalStabilityRecorded = true;
            events.push("source-stability-after-callback");
          }
          return await observeSourceEntry(input, entry);
        },
        observeAcceptedSource: observeSource,
        observeCandidate
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async (root) => {
          events.push("callback");
          if (scenario.mutation === "candidate") {
            await writeFile(join(root, "content/dota_addons/fixture_addon/materials/integrity.bin"), Buffer.from([0x00, 0xff, 0x10, 0x80, 0x43]));
          }
          if (scenario.mutation === "source") {
            await writeFile(binaryPath, Buffer.from([0x00, 0xff, 0x10, 0x80, 0x43]));
          }
          callbackSettled = true;
          if (scenario.callbackThrows) throw new Error(`private callback failure ${fixture.root}`);
          return "validated";
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(candidateCalls, scenario.name).toBe(2);
      expect(sourceCalls, scenario.name).toBe(20);
      expect(events, scenario.name).toEqual([
        "candidate-before-callback",
        "callback",
        "source-stability-after-callback",
        "candidate-after-callback",
        "source-after-integrity",
        "cleanup"
      ]);
      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      if (scenario.expectedCode === undefined) {
        expect(result, scenario.name).toMatchObject({ ok: true, value: "validated" });
      } else {
        expect(withoutCleanup(result), scenario.name).toEqual({
          ok: false,
          blockers: [{ code: scenario.expectedCode, category: scenario.expectedCode === "CANDIDATE_INSPECTION_FAILED" ? "inspection" : "integrity" }]
        });
        expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      }
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  test("builds deterministic canonical release candidate manifests", async () => {
    const manifestEntries = [
      { schemaVersion: "1.0", root: "content", path: "content/dota_addons/fixture_addon/materials/alpha|beta.bin", bytes: 3, sha256: "0".repeat(64) },
      { schemaVersion: "1.0", root: "content", path: "content/dota_addons/fixture_addon/materials/quote\"\n.bin", bytes: 5, sha256: "1".repeat(64) },
      { schemaVersion: "1.0", root: "content", path: "content/dota_addons/fixture_addon/materials/控制-é.bin", bytes: 7, sha256: "2".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/addoninfo.txt", bytes: 11, sha256: "3".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/resource/addon_fixture_addon_english.txt", bytes: 13, sha256: "4".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/scripts/npc/herolist.txt", bytes: 17, sha256: "5".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/scripts/npc/npc_abilities_custom.txt", bytes: 19, sha256: "6".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/scripts/npc/npc_heroes_custom.txt", bytes: 23, sha256: "7".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/scripts/npc/npc_units_custom.txt", bytes: 29, sha256: "8".repeat(64) },
      { schemaVersion: "1.0", root: "game", path: "game/dota_addons/fixture_addon/scripts/vscripts/addon_game_mode.lua", bytes: 31, sha256: "9".repeat(64) }
    ] as const;
    const expectedCanonical = "[\"1.0\",[[\"content\",\"content/dota_addons/fixture_addon/materials/alpha|beta.bin\",3,\"0000000000000000000000000000000000000000000000000000000000000000\"],[\"content\",\"content/dota_addons/fixture_addon/materials/quote\\\"\\n.bin\",5,\"1111111111111111111111111111111111111111111111111111111111111111\"],[\"content\",\"content/dota_addons/fixture_addon/materials/控制-é.bin\",7,\"2222222222222222222222222222222222222222222222222222222222222222\"],[\"game\",\"game/dota_addons/fixture_addon/addoninfo.txt\",11,\"3333333333333333333333333333333333333333333333333333333333333333\"],[\"game\",\"game/dota_addons/fixture_addon/resource/addon_fixture_addon_english.txt\",13,\"4444444444444444444444444444444444444444444444444444444444444444\"],[\"game\",\"game/dota_addons/fixture_addon/scripts/npc/herolist.txt\",17,\"5555555555555555555555555555555555555555555555555555555555555555\"],[\"game\",\"game/dota_addons/fixture_addon/scripts/npc/npc_abilities_custom.txt\",19,\"6666666666666666666666666666666666666666666666666666666666666666\"],[\"game\",\"game/dota_addons/fixture_addon/scripts/npc/npc_heroes_custom.txt\",23,\"7777777777777777777777777777777777777777777777777777777777777777\"],[\"game\",\"game/dota_addons/fixture_addon/scripts/npc/npc_units_custom.txt\",29,\"8888888888888888888888888888888888888888888888888888888888888888\"],[\"game\",\"game/dota_addons/fixture_addon/scripts/vscripts/addon_game_mode.lua\",31,\"9999999999999999999999999999999999999999999999999999999999999999\"]]]";
    const expectedCombinedSha256 = "f5598e2fc3b94b81e821d4230e7e8f727781c43f0bb4bf9c197aacb7fc9ee0da";
    const facts = new Map<string, (typeof manifestEntries)[number]>(
      manifestEntries.map((entry) => [entry.path, entry])
    );

    const run = async (reverse: boolean) => {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      for (const entry of manifestEntries.filter((entry) => entry.root === "content")) {
        const relativePath = entry.path.slice("content/dota_addons/fixture_addon/".length);
        const path = join(fixture.contentAddonRoot, ...relativePath.split("/"));
        await mkdir(join(path, ".."), { recursive: true });
        await writeFile(path, Buffer.from([0x00]));
      }
      const observation = (path: string): unknown => {
        const fact = facts.get(path);
        if (fact === undefined) throw new Error("fixture integrity fact missing");
        return Object.defineProperty({
          ok: true,
          schemaVersion: "1.0",
          root: fact.root,
          path: fact.path,
          bytes: fact.bytes,
          sha256: fact.sha256,
          identityMatched: true,
          kindMatched: true,
          contained: true
        }, "host", { get: () => { throw new Error("host metadata must not be read"); } });
      };
      let candidateRoot: string | undefined;
      const observeSourceEntry = createAcceptedSourceObserver();
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, reverse ? "host-b-" : "host-a-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease: async (identity) => {
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        },
        observeAcceptedSourceEntry: async (input, entry) => {
          const observed = await observeSourceEntry(input, entry);
          if (!observed.ok) return observed;
          return {
            ...observed,
            canonicalPath: reverse
              ? observed.canonicalPath.replaceAll("/", "\\")
              : observed.canonicalPath,
            mtimeMs: reverse ? 2_000_000 : 1_000_000,
            ctimeMs: reverse ? 4_000_000 : 3_000_000,
            mode: reverse ? 0o444 : 0o755
          };
        },
        observeAcceptedSource: async (_input, entry) => observation(entry.path),
        observeCandidate: async (_identity, expected) => ({
          ok: true,
          schemaVersion: "1.0",
          observations: (reverse
            ? expected.filter((entry) => entry.kind === "file").reverse()
            : expected.filter((entry) => entry.kind === "file"))
            .map((entry) => observation(entry.path)),
          absoluteRoot: candidateRoot,
          target: reverse ? "ssh-private-host" : "local-private-host",
          generatedAt: reverse ? "2038-01-01T00:00:00Z" : "1970-01-01T00:00:00Z"
        })
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => "inspected",
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => reverse ? await readdir(path) : (await readdir(path)).reverse(),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );
      expect(result).toMatchObject({ ok: true, value: "inspected" });
      if (!result.ok) throw new Error("manifest fixture was blocked");
      return result.manifest;
    };

    vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => {
      throw new Error("locale-sensitive ordering is forbidden");
    });
    const originalLocale = process.env.LC_ALL;
    let forward;
    let shuffled;
    try {
      process.env.LC_ALL = "en_US.UTF-8";
      forward = await run(false);
      process.env.LC_ALL = "tr_TR.UTF-8";
      shuffled = await run(true);
    } finally {
      if (originalLocale === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = originalLocale;
    }

    expect(forward).toEqual({
      schemaVersion: "1.0",
      entries: manifestEntries,
      combinedSha256: expectedCombinedSha256
    });
    expect(shuffled).toEqual(forward);
    expect(JSON.stringify([forward.schemaVersion, forward.entries.map(({ root, path, bytes, sha256 }) => [root, path, bytes, sha256])])).toBe(expectedCanonical);
    expect(createHash("sha256").update(Buffer.from(expectedCanonical, "utf8")).digest("hex")).toBe(expectedCombinedSha256);
    expect(JSON.stringify(forward)).not.toContain("private-host");
    expect(forward.entries.map((entry) => entry.path)).toEqual(manifestEntries.map((entry) => entry.path));
    expect(forward.entries.every((entry) => !entry.path.includes("\\"))).toBe(true);
    expect(forward.entries.map((entry) => entry.path)).toContain("content/dota_addons/fixture_addon/materials/alpha|beta.bin");
    expect(forward.entries.map((entry) => entry.path)).toContain("content/dota_addons/fixture_addon/materials/quote\"\n.bin");
  });

  test("keeps nested JSON manifest identity collision-free", () => {
    const firstDigest = "a".repeat(64);
    const secondDigest = "b".repeat(64);
    const combinedPath = `content/dota_addons/fixture_addon/materials/quote\"-控制|1|${firstDigest}\ncontent|content/dota_addons/fixture_addon/materials/next`;
    const joinedManifest = [
      ["content", combinedPath, 2, secondDigest]
    ] as const;
    const splitManifest = [
      ["content", "content/dota_addons/fixture_addon/materials/quote\"-控制", 1, firstDigest],
      ["content", "content/dota_addons/fixture_addon/materials/next", 2, secondDigest]
    ] as const;
    const delimiterJoin = (entries: readonly (readonly [string, string, number, string])[]): string => (
      entries.map((entry) => entry.join("|")).join("\n")
    );
    const canonicalDigest = (entries: readonly (readonly [string, string, number, string])[]): string => (
      createHash("sha256")
        .update(Buffer.from(JSON.stringify(["1.0", entries]), "utf8"))
        .digest("hex")
    );

    expect(joinedManifest).not.toEqual(splitManifest);
    expect(delimiterJoin(joinedManifest)).toBe(delimiterJoin(splitManifest));
    expect(canonicalDigest(joinedManifest)).not.toBe(canonicalDigest(splitManifest));
    expect(canonicalDigest(joinedManifest)).toBe("e7fea908f4fd7b52efec2cb150a0f2eec758f14a77adad7482ab315622c963b4");
    expect(canonicalDigest(splitManifest)).toBe("d21f4762cf09cab91efca857c63bf1c89f7d5644b8bdfd00b4bd5404a5d04c1a");
  });

  test("rejects non-bijective candidate integrity ledgers", async () => {
    const runLedger = async (
      mutateFinal: (observations: FixtureIntegrityObservation[]) => unknown[],
      reconcileCandidateTree?: (
        identity: { root: string },
        expected: CandidateExpectedEntry[]
      ) => Promise<CandidateTreeReconciliationResult>
    ) => {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      await mkdir(join(fixture.contentAddonRoot, "materials/empty/nested"), { recursive: true });
      let candidateCalls = 0;
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: root, identity: { root } };
        },
        cleanupCandidateLease: async (identity) => {
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        },
        ...(reconcileCandidateTree === undefined ? {} : { reconcileCandidateTree }),
        observeCandidate: async (identity, expected) => {
          candidateCalls += 1;
          const observations = await Promise.all(expected
            .filter((entry) => entry.kind === "file")
            .map(async (entry) => {
              const [root] = entry.path.split("/");
              return await streamFixtureIntegrity(
                join(identity.root, ...entry.path.split("/")),
                root as "game" | "content",
                entry.path
              );
            }));
          return {
            ok: true,
            schemaVersion: "1.0",
            observations: candidateCalls === 1 ? observations : mutateFinal(observations)
          };
        }
      });
      const callback = vi.fn(async () => "inspected");
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );
      return { result, callback, candidateCalls };
    };

    const duplicateResults = [];
    for (const reverse of [false, true]) {
      const execution = await runLedger((observations) => {
        const first = observations[0];
        const omitted = observations.at(-1);
        if (first === undefined || omitted === undefined) throw new Error("ledger fixture is incomplete");
        const unexpected = {
          ...first,
          path: "game/dota_addons/fixture_addon/unexpected.bin"
        };
        const occurrences = [first, first, ...observations.slice(1, -1), unexpected];
        return reverse ? occurrences.reverse() : occurrences;
      });
      expect(execution.callback).toHaveBeenCalledTimes(1);
      expect(execution.candidateCalls).toBe(2);
      duplicateResults.push(execution.result);
    }
    expect(duplicateResults[1]).toEqual(duplicateResults[0]);
    expect(withoutCleanup(duplicateResults[0]!)).toEqual({
      ok: false,
      inclusionLedger: {
        schemaVersion: "1.0",
        expectedFileCount: 7,
        observedFileCount: 8,
        matchedFileCount: 5
      },
      blockers: [
        {
          code: "CANDIDATE_LEDGER_DUPLICATE",
          category: "integrity-duplicate",
          path: "game/dota_addons/fixture_addon/addoninfo.txt",
          count: 2
        },
        {
          code: "CANDIDATE_LEDGER_MISSING",
          category: "integrity-missing",
          path: "game/dota_addons/fixture_addon/scripts/vscripts/addon_game_mode.lua",
          count: 0
        },
        {
          code: "CANDIDATE_LEDGER_UNEXPECTED",
          category: "integrity-unexpected",
          path: "game/dota_addons/fixture_addon/unexpected.bin",
          count: 1
        }
      ]
    });

    const wrongFacts = await runLedger((observations) => observations.map((observation, index) => {
      if (index === 0) return { ...observation, root: "content" };
      if (index === 1) return { ...observation, path: "game/dota_addons/fixture_addon/wrong-path.bin" };
      if (index === 2) return { ...observation, kindMatched: false };
      if (index === 3) return { ...observation, identityMatched: false };
      return observation;
    }));
    expect(withoutCleanup(wrongFacts.result)).toEqual({
      ok: false,
      inclusionLedger: {
        schemaVersion: "1.0",
        expectedFileCount: 7,
        observedFileCount: 7,
        matchedFileCount: 3
      },
      blockers: [
        {
          code: "CANDIDATE_LEDGER_WRONG_ROOT",
          category: "integrity-wrong-root",
          path: "game/dota_addons/fixture_addon/addoninfo.txt",
          count: 1
        },
        {
          code: "CANDIDATE_LEDGER_WRONG_KIND",
          category: "integrity-wrong-kind",
          path: "game/dota_addons/fixture_addon/scripts/npc/herolist.txt",
          count: 1
        },
        {
          code: "CANDIDATE_LEDGER_UNOBSERVED",
          category: "integrity-unobserved",
          path: "game/dota_addons/fixture_addon/scripts/npc/npc_abilities_custom.txt",
          count: 1
        },
        {
          code: "CANDIDATE_LEDGER_MISSING",
          category: "integrity-missing",
          path: "game/dota_addons/fixture_addon/resource/addon_fixture_addon_english.txt",
          count: 0
        },
        {
          code: "CANDIDATE_LEDGER_UNEXPECTED",
          category: "integrity-unexpected",
          path: "game/dota_addons/fixture_addon/wrong-path.bin",
          count: 1
        }
      ]
    });

    const missingDirectory = await runLedger(
      (observations) => observations,
      async () => ({
        ok: false,
        code: "CANDIDATE_TREE_MISMATCH",
        issues: [{
          code: "CANDIDATE_TREE_MISSING",
          path: "content/dota_addons/fixture_addon/materials/empty/nested"
        }]
      })
    );
    expect(withoutCleanup(missingDirectory.result)).toEqual({
      ok: false,
      blockers: [{
        code: "CANDIDATE_TREE_MISSING",
        category: "assembly",
        path: "content/dota_addons/fixture_addon/materials/empty/nested"
      }]
    });
    expect(missingDirectory.callback).not.toHaveBeenCalled();
    expect(missingDirectory.candidateCalls).toBe(0);
    expect(JSON.stringify(missingDirectory.result)).not.toContain("manifest");
    expect(JSON.stringify(duplicateResults[0])).not.toContain("manifest");
  });

  test("collects final source evidence when candidate ledger is invalid", async () => {
    for (const candidateFailure of ["malformed", "duplicate"] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const events: string[] = [];
      let callbackSettled = false;
      let candidateCalls = 0;
      let finalSourceIntegrityRecorded = false;
      let finalSourceStabilityRecorded = false;
      const observeSourceEntry = createAcceptedSourceObserver();
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: root, identity: { root } };
        },
        cleanupCandidateLease: async (identity) => {
          events.push("cleanup");
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        },
        observeAcceptedSourceEntry: async (input, entry) => {
          if (callbackSettled && !finalSourceStabilityRecorded) {
            finalSourceStabilityRecorded = true;
            events.push("final-source-stability");
          }
          return await observeSourceEntry(input, entry);
        },
        observeAcceptedSource: async (input, entry) => {
          if (callbackSettled && !finalSourceIntegrityRecorded) {
            finalSourceIntegrityRecorded = true;
            events.push("final-source-integrity");
          }
          const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
          const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
          return await streamFixtureIntegrity(
            join(sourceRoot, ...entry.path.slice(prefix.length).split("/")),
            entry.root,
            entry.path
          );
        },
        observeCandidate: async (identity, expected) => {
          candidateCalls += 1;
          if (callbackSettled) events.push("final-candidate-integrity");
          const observations = await Promise.all(expected
            .filter((entry) => entry.kind === "file")
            .map(async (entry) => {
              const [root] = entry.path.split("/");
              return await streamFixtureIntegrity(
                join(identity.root, ...entry.path.split("/")),
                root as "game" | "content",
                entry.path
              );
            }));
          if (candidateCalls === 1) return { ok: true, schemaVersion: "1.0", observations };
          if (candidateFailure === "malformed") {
            return { ok: true, schemaVersion: "1.0", observations: null };
          }
          const first = observations[0];
          if (first === undefined) throw new Error("candidate fixture has no files");
          return { ok: true, schemaVersion: "1.0", observations: [first, ...observations] };
        }
      });

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => {
          events.push("callback");
          await writeFile(join(fixture.gameAddonRoot, "addoninfo.txt"), "source changed after callback\n");
          callbackSettled = true;
          return "must not survive";
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(withoutCleanup(result), candidateFailure).toEqual(candidateFailure === "malformed"
        ? {
            ok: false,
            blockers: [
              { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" },
              { code: "CANDIDATE_INTEGRITY_RESULT_INVALID", category: "integrity" }
            ]
          }
        : {
            ok: false,
            inclusionLedger: {
              schemaVersion: "1.0",
              expectedFileCount: 7,
              observedFileCount: 8,
              matchedFileCount: 6
            },
            blockers: [
              { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" },
              {
                code: "CANDIDATE_LEDGER_DUPLICATE",
                category: "integrity-duplicate",
                path: "game/dota_addons/fixture_addon/addoninfo.txt",
                count: 2
              }
            ]
          });
      expect(events, candidateFailure).toEqual([
        "callback",
        "final-source-stability",
        "final-candidate-integrity",
        "final-source-integrity",
        "cleanup"
      ]);
      expect(candidateCalls, candidateFailure).toBe(2);
      expect(JSON.stringify(result), candidateFailure).not.toContain("manifest");
    }
  });

  test("prioritizes changed final source hashes over candidate ledger failures", async () => {
    for (const candidateFailure of ["malformed", "duplicate"] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const events: string[] = [];
      const stableMetadata = new Map<string, AcceptedSourceObservationResult>();
      const observeSourceEntry = createAcceptedSourceObserver();
      let callbackSettled = false;
      let candidateCalls = 0;
      let finalSourceIntegrityRecorded = false;
      let finalSourceStabilityRecorded = false;
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: root, identity: { root } };
        },
        cleanupCandidateLease: async (identity) => {
          events.push("cleanup");
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        },
        observeAcceptedSourceEntry: async (input, entry) => {
          if (callbackSettled && !finalSourceStabilityRecorded) {
            finalSourceStabilityRecorded = true;
            events.push("final-source-stability");
          }
          const cached = stableMetadata.get(entry.path);
          if (cached !== undefined) return cached;
          const observed = await observeSourceEntry(input, entry);
          stableMetadata.set(entry.path, observed);
          return observed;
        },
        observeAcceptedSource: async (input, entry) => {
          if (callbackSettled && !finalSourceIntegrityRecorded) {
            finalSourceIntegrityRecorded = true;
            events.push("final-source-integrity");
          }
          const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
          const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
          return await streamFixtureIntegrity(
            join(sourceRoot, ...entry.path.slice(prefix.length).split("/")),
            entry.root,
            entry.path
          );
        },
        observeCandidate: async (identity, expected) => {
          candidateCalls += 1;
          if (callbackSettled) events.push("final-candidate-integrity");
          const observations = await Promise.all(expected
            .filter((entry) => entry.kind === "file")
            .map(async (entry) => {
              const [root] = entry.path.split("/");
              return await streamFixtureIntegrity(
                join(identity.root, ...entry.path.split("/")),
                root as "game" | "content",
                entry.path
              );
            }));
          if (candidateCalls === 1) return { ok: true, schemaVersion: "1.0", observations };
          if (candidateFailure === "malformed") {
            return { ok: true, schemaVersion: "1.0", observations: null };
          }
          const first = observations[0];
          if (first === undefined) throw new Error("candidate fixture has no files");
          return { ok: true, schemaVersion: "1.0", observations: [first, ...observations] };
        }
      });

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => {
          events.push("callback");
          await writeFile(join(fixture.gameAddonRoot, "addoninfo.txt"), "changed bytes with stable metadata\n");
          callbackSettled = true;
          return "must not survive";
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(withoutCleanup(result), candidateFailure).toEqual(candidateFailure === "malformed"
        ? {
            ok: false,
            blockers: [
              { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" },
              { code: "CANDIDATE_INTEGRITY_RESULT_INVALID", category: "integrity" }
            ]
          }
        : {
            ok: false,
            inclusionLedger: {
              schemaVersion: "1.0",
              expectedFileCount: 7,
              observedFileCount: 8,
              matchedFileCount: 6
            },
            blockers: [
              { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" },
              {
                code: "CANDIDATE_LEDGER_DUPLICATE",
                category: "integrity-duplicate",
                path: "game/dota_addons/fixture_addon/addoninfo.txt",
                count: 2
              }
            ]
          });
      expect(events, candidateFailure).toEqual([
        "callback",
        "final-source-stability",
        "final-candidate-integrity",
        "final-source-integrity",
        "cleanup"
      ]);
      expect(candidateCalls, candidateFailure).toBe(2);
      expect(JSON.stringify(result), candidateFailure).not.toContain("manifest");
    }
  });

  test("preserves candidate ledger evidence with changed final source hashes", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const events: string[] = [];
    const stableMetadata = new Map<string, AcceptedSourceObservationResult>();
    const observeSourceEntry = createAcceptedSourceObserver();
    let callbackSettled = false;
    let candidateCalls = 0;
    let finalSourceIntegrityRecorded = false;
    let finalSourceStabilityRecorded = false;
    const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
      createCandidateLease: async (validated) => {
        const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: root, identity: { root } };
      },
      cleanupCandidateLease: async (identity) => {
        events.push("cleanup");
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true, removed: true, absent: true, identityMatched: true };
      },
      observeAcceptedSourceEntry: async (input, entry) => {
        if (callbackSettled && !finalSourceStabilityRecorded) {
          finalSourceStabilityRecorded = true;
          events.push("final-source-stability");
        }
        const cached = stableMetadata.get(entry.path);
        if (cached !== undefined) return cached;
        const observed = await observeSourceEntry(input, entry);
        stableMetadata.set(entry.path, observed);
        return observed;
      },
      observeAcceptedSource: async (input, entry) => {
        if (callbackSettled && !finalSourceIntegrityRecorded) {
          finalSourceIntegrityRecorded = true;
          events.push("final-source-integrity");
        }
        const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
        const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        return await streamFixtureIntegrity(
          join(sourceRoot, ...entry.path.slice(prefix.length).split("/")),
          entry.root,
          entry.path
        );
      },
      observeCandidate: async (identity, expected) => {
        candidateCalls += 1;
        if (callbackSettled) events.push("final-candidate-integrity");
        const observations = await Promise.all(expected
          .filter((entry) => entry.kind === "file")
          .map(async (entry) => {
            const [root] = entry.path.split("/");
            return await streamFixtureIntegrity(
              join(identity.root, ...entry.path.split("/")),
              root as "game" | "content",
              entry.path
            );
          }));
        if (candidateCalls === 1) return { ok: true, schemaVersion: "1.0", observations };
        const first = observations[0];
        if (first === undefined) throw new Error("candidate fixture has no files");
        return {
          ok: true,
          schemaVersion: "1.0",
          observations: [
            first,
            first,
            ...observations.slice(1, -1),
            { ...first, path: "game/dota_addons/fixture_addon/unexpected.bin" }
          ]
        };
      }
    });

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => {
        events.push("callback");
        await writeFile(join(fixture.gameAddonRoot, "addoninfo.txt"), "changed bytes with stable metadata\n");
        callbackSettled = true;
        return "must not survive";
      },
      {
        repositoryRoot: fixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: lifecycle
        }
      }
    );

    expect(withoutCleanup(result)).toEqual({
      ok: false,
      inclusionLedger: {
        schemaVersion: "1.0",
        expectedFileCount: 7,
        observedFileCount: 8,
        matchedFileCount: 5
      },
      blockers: [
        { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" },
        {
          code: "CANDIDATE_LEDGER_DUPLICATE",
          category: "integrity-duplicate",
          path: "game/dota_addons/fixture_addon/addoninfo.txt",
          count: 2
        },
        {
          code: "CANDIDATE_LEDGER_MISSING",
          category: "integrity-missing",
          path: "game/dota_addons/fixture_addon/scripts/vscripts/addon_game_mode.lua",
          count: 0
        },
        {
          code: "CANDIDATE_LEDGER_UNEXPECTED",
          category: "integrity-unexpected",
          path: "game/dota_addons/fixture_addon/unexpected.bin",
          count: 1
        }
      ]
    });
    expect(events).toEqual([
      "callback",
      "final-source-stability",
      "final-candidate-integrity",
      "final-source-integrity",
      "cleanup"
    ]);
    expect(candidateCalls).toBe(2);
    expect(JSON.stringify(result)).not.toContain("manifest");
  });

  test("composes independent final failure evidence without duplication", async () => {
    const scenarios = [
      {
        name: "source hash mismatch and malformed candidate",
        primary: "source-hash" as const,
        candidate: "malformed" as const,
        expectedPrimary: { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" }
      },
      {
        name: "malformed source integrity and candidate ledger",
        primary: "source-malformed" as const,
        candidate: "ledger" as const,
        expectedPrimary: { code: "SOURCE_INTEGRITY_RESULT_INVALID", category: "integrity" }
      },
      {
        name: "final source stability and candidate ledger",
        primary: "source-stability" as const,
        candidate: "ledger" as const,
        expectedPrimary: { code: "SOURCE_CHANGED_DURING_ASSEMBLY", category: "assembly" }
      },
      {
        name: "final candidate topology and candidate ledger",
        primary: "topology" as const,
        candidate: "ledger" as const,
        expectedPrimary: {
          code: "CANDIDATE_TREE_UNEXPECTED",
          category: "unexpected-entry",
          path: "game/dota_addons/fixture_addon/[redacted]"
        }
      }
    ];

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const events: string[] = [];
      const stableMetadata = new Map<string, AcceptedSourceObservationResult>();
      const observeSourceEntry = createAcceptedSourceObserver();
      const privateTopologySegment = credentialPasswordFixture("private-topology-value");
      let callbackSettled = false;
      let candidateCalls = 0;
      let finalSourceIntegrityInjected = false;
      let finalStabilityInjected = false;
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: root, identity: { root } };
        },
        cleanupCandidateLease: async (identity) => {
          events.push("cleanup");
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        },
        observeAcceptedSourceEntry: async (input, entry) => {
          const cached = stableMetadata.get(entry.path);
          const observed = cached ?? await observeSourceEntry(input, entry);
          if (cached === undefined) stableMetadata.set(entry.path, observed);
          if (
            callbackSettled
            && scenario.primary === "source-stability"
            && !finalStabilityInjected
            && observed.ok
          ) {
            finalStabilityInjected = true;
            events.push("final-source-stability");
            return { ...observed, mtimeMs: observed.mtimeMs + 1 };
          }
          return observed;
        },
        observeAcceptedSource: async (input, entry) => {
          const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
          const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
          const observed = await streamFixtureIntegrity(
            join(sourceRoot, ...entry.path.slice(prefix.length).split("/")),
            entry.root,
            entry.path
          );
          if (callbackSettled && !finalSourceIntegrityInjected) {
            finalSourceIntegrityInjected = true;
            events.push("final-source-integrity");
            if (scenario.primary === "source-malformed") return null;
            if (scenario.primary === "source-hash") {
              return { ...observed, sha256: observed.sha256 === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64) };
            }
          }
          return observed;
        },
        observeCandidate: async (identity, expected) => {
          candidateCalls += 1;
          if (callbackSettled) events.push("final-candidate-integrity");
          const observations = await Promise.all(expected
            .filter((entry) => entry.kind === "file")
            .map(async (entry) => {
              const [root] = entry.path.split("/");
              return await streamFixtureIntegrity(
                join(identity.root, ...entry.path.split("/")),
                root as "game" | "content",
                entry.path
              );
            }));
          if (candidateCalls === 1) return { ok: true, schemaVersion: "1.0", observations };
          if (scenario.candidate === "malformed") {
            return { ok: true, schemaVersion: "1.0", observations: null };
          }
          const first = observations[0];
          if (first === undefined) throw new Error("candidate fixture has no files");
          return {
            ok: true,
            schemaVersion: "1.0",
            observations: [
              first,
              first,
              ...observations.slice(1, -1),
              { ...first, path: "game/dota_addons/fixture_addon/unexpected.bin" }
            ]
          };
        },
        reconcileCandidateTree: async () => {
          if (callbackSettled && scenario.primary === "topology") {
            events.push("final-topology");
            return {
              ok: false,
              code: "CANDIDATE_TREE_MISMATCH",
              issues: [{
                code: "CANDIDATE_TREE_UNEXPECTED",
                path: `game/dota_addons/fixture_addon/${privateTopologySegment}`,
                kind: "file"
              }]
            };
          }
          return { ok: true, exact: true, identityMatched: true };
        }
      });

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => {
          events.push("callback");
          callbackSettled = true;
          return "must not survive";
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      const expectedCandidateBlockers = scenario.candidate === "malformed"
        ? [{ code: "CANDIDATE_INTEGRITY_RESULT_INVALID", category: "integrity" }]
        : [
            {
              code: "CANDIDATE_LEDGER_DUPLICATE",
              category: "integrity-duplicate",
              path: "game/dota_addons/fixture_addon/addoninfo.txt",
              count: 2
            },
            {
              code: "CANDIDATE_LEDGER_MISSING",
              category: "integrity-missing",
              path: "game/dota_addons/fixture_addon/scripts/vscripts/addon_game_mode.lua",
              count: 0
            },
            {
              code: "CANDIDATE_LEDGER_UNEXPECTED",
              category: "integrity-unexpected",
              path: "game/dota_addons/fixture_addon/unexpected.bin",
              count: 1
            }
          ];
      expect.soft(withoutCleanup(result), scenario.name).toEqual({
        ok: false,
        ...(scenario.candidate === "ledger"
          ? {
              inclusionLedger: {
                schemaVersion: "1.0",
                expectedFileCount: 7,
                observedFileCount: 8,
                matchedFileCount: 5
              }
            }
          : {}),
        blockers: [scenario.expectedPrimary, ...expectedCandidateBlockers]
      });
      if (result.ok) throw new Error(`${scenario.name}: expected final failure`);
      expect.soft(result.blockers.filter((blocker) => blocker.code === expectedCandidateBlockers[0]?.code), scenario.name)
        .toHaveLength(1);
      expect.soft(events.at(-1), scenario.name).toBe("cleanup");
      expect.soft(candidateCalls, scenario.name).toBe(2);
      expect.soft(JSON.stringify(result), scenario.name).not.toContain("manifest");
      expect.soft(JSON.stringify(result), scenario.name).not.toContain("private-topology-value");
      expect.soft(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
    }
  });

  test("reconciles final candidate topology after inspection", async () => {
    for (const scenario of [
      { name: "missing empty directory", mutation: "remove", callbackThrows: false },
      { name: "unexpected empty directory", mutation: "add", callbackThrows: false },
      { name: "mutation before throw", mutation: "remove", callbackThrows: true }
    ] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      await mkdir(join(fixture.contentAddonRoot, "materials/empty/nested"), { recursive: true });
      const events: string[] = [];
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return {
            inspectionRoot: root,
            identity: {
              root,
              beforeReconcile: async () => { events.push("reconcile"); }
            }
          };
        },
        cleanupCandidateLease: async (identity) => {
          events.push("cleanup");
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        }
      });

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async (root) => {
          events.push("callback");
          if (scenario.mutation === "remove") {
            await rm(
              join(root, "content/dota_addons/fixture_addon/materials/empty/nested"),
              { recursive: true }
            );
          } else {
            await mkdir(join(root, "content/dota_addons/fixture_addon/unexpected-empty"));
          }
          if (scenario.callbackThrows) throw new Error(`private callback failure ${fixture.root}`);
          return "must not survive";
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(withoutCleanup(result), scenario.name).toEqual({
        ok: false,
        blockers: [{
          code: scenario.mutation === "remove" ? "CANDIDATE_TREE_MISSING" : "CANDIDATE_TREE_UNEXPECTED",
          category: scenario.mutation === "remove" ? "assembly" : "unexpected-entry",
          path: scenario.mutation === "remove"
            ? "content/dota_addons/fixture_addon/materials/empty/nested"
            : "content/dota_addons/fixture_addon/unexpected-empty"
        }]
      });
      expect(events, scenario.name).toEqual(["reconcile", "callback", "reconcile", "cleanup"]);
      expect(JSON.stringify(result), scenario.name).not.toContain("manifest");
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
    }
  });

  test("rejects malformed final integrity observations without retry or repair", async () => {
    const malformedCandidateResults: Array<Readonly<{ name: string; result(path: string): unknown }>> = [
      { name: "uppercase digest", result: (path) => ({ ok: true, schemaVersion: "1.0", observations: [{ ...validObservation(path), sha256: "A".repeat(64) }] }) },
      { name: "short digest", result: (path) => ({ ok: true, schemaVersion: "1.0", observations: [{ ...validObservation(path), sha256: "0".repeat(63) }] }) },
      { name: "negative count", result: (path) => ({ ok: true, schemaVersion: "1.0", observations: [{ ...validObservation(path), bytes: -1 }] }) },
      { name: "fractional count", result: (path) => ({ ok: true, schemaVersion: "1.0", observations: [{ ...validObservation(path), bytes: 0.5 }] }) },
      { name: "unsafe count", result: (path) => ({ ok: true, schemaVersion: "1.0", observations: [{ ...validObservation(path), bytes: Number.MAX_SAFE_INTEGER + 1 }] }) },
      { name: "containment false", result: (path) => ({ ok: true, schemaVersion: "1.0", observations: [{ ...validObservation(path), contained: false }] }) },
      { name: "getter throws", result: () => Object.defineProperty({}, "ok", { get: () => { throw new Error("private getter"); } }) },
      { name: "proxy throws", result: () => new Proxy({}, { get: () => { throw new Error("private proxy"); } }) },
      { name: "iterator throws", result: () => ({ ok: true, schemaVersion: "1.0", observations: new Proxy([], { get: (_target, key) => { if (key === Symbol.iterator) throw new Error("private iterator"); return Reflect.get([], key); } }) }) },
      { name: "thenable throws", result: () => ({ then: () => { throw new Error("private thenable"); } }) }
    ];

    function validObservation(path: string): FixtureIntegrityObservation {
      return {
        ok: true,
        schemaVersion: "1.0",
        root: path.startsWith("game/") ? "game" : "content",
        path,
        bytes: 0,
        sha256: "0".repeat(64),
        identityMatched: true,
        kindMatched: true,
        contained: true
      };
    }

    for (const scenario of malformedCandidateResults) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      let candidateCalls = 0;
      let materializationCalls = 0;
      let candidateRoot: string | undefined;
      const cleanup = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease: cleanup,
        materializeCandidateEntry: async (identity, input, operation) => {
          materializationCalls += 1;
          const destination = join((identity as { root: string }).root, ...operation.destination.split("/"));
          if (operation.kind === "directory") await mkdir(destination);
          else {
            const prefix = `${operation.source.root}/dota_addons/${input.addonName}/`;
            const sourceRoot = operation.source.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
            await copyFile(join(sourceRoot, ...operation.source.path.slice(prefix.length).split("/")), destination);
          }
          return { ok: true, created: true, identityMatched: true, kindMatched: true, contained: true };
        },
        observeCandidate: async (identity, expected) => {
          candidateCalls += 1;
          if (candidateCalls === 1) {
            const root = (identity as { root: string }).root;
            return {
              ok: true,
              schemaVersion: "1.0",
              observations: await Promise.all(expected.filter((entry) => entry.kind === "file").map(async (entry) => {
                const [observationRoot] = entry.path.split("/");
                return await streamFixtureIntegrity(join(root, ...entry.path.split("/")), observationRoot as "game" | "content", entry.path);
              }))
            };
          }
          return scenario.result(expected.find((entry) => entry.kind === "file")?.path ?? "game/dota_addons/fixture_addon/addoninfo.txt");
        }
      });
      const callback = vi.fn(async () => "must not survive");
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(withoutCleanup(result), scenario.name).toEqual({ ok: false, blockers: [{ code: "CANDIDATE_INTEGRITY_RESULT_INVALID", category: "integrity" }] });
      expect(candidateCalls, scenario.name).toBe(2);
      expect(callback, scenario.name).toHaveBeenCalledTimes(1);
      expect(cleanup, scenario.name).toHaveBeenCalledTimes(1);
      expect(materializationCalls, scenario.name).toBeGreaterThan(0);
      expect(JSON.stringify(result), scenario.name).not.toContain("private");
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  test("reports collisions between unsafe and accepted identities", async () => {
    const fixture = await createFixture();
    const privateTarget = join(fixture.repositoryRoot, "private-target");
    const scenarios: Array<{
      name: string;
      unsafeKind: ReleaseCandidateEntryKind;
      escape: boolean;
      unsafeBlocker: { code: string; category: string };
    }> = [
      {
        name: "symbolic link collides with regular file",
        unsafeKind: "symbolic-link",
        escape: false,
        unsafeBlocker: { code: "SOURCE_ENTRY_UNSAFE", category: "symbolic-link" }
      },
      {
        name: "reparse point collides with regular file",
        unsafeKind: "reparse",
        escape: false,
        unsafeBlocker: { code: "SOURCE_ENTRY_UNSAFE", category: "reparse" }
      },
      {
        name: "canonical escape collides with contained file",
        unsafeKind: "file",
        escape: true,
        unsafeBlocker: { code: "SOURCE_ENTRY_OUTSIDE_ROOT", category: "escape" }
      }
    ];

    for (const scenario of scenarios) {
      for (const reverse of [false, true]) {
        const names = ["Alpha.txt", "alpha.txt"];
        const unsafePath = join(fixture.gameAddonRoot, "Alpha.txt");
        const acceptedPath = join(fixture.gameAddonRoot, "alpha.txt");
        const classifiedPaths: string[] = [];
        const canonicalizedPaths: string[] = [];
        const createCandidateRoot = vi.fn(async (validated: ValidatedReleaseCandidateInput) => (
          join(validated.tempParent, "candidate")
        ));
        const filesystem: ReleaseCandidateFilesystem = {
          lstat,
          realpath: async (path) => {
            canonicalizedPaths.push(path);
            if (scenario.escape && path === unsafePath) return privateTarget;
            return path;
          },
          readDirectory: async (path) => {
            if (path !== fixture.gameAddonRoot) return [];
            return reverse ? [...names].reverse() : [...names];
          },
          classifySourceEntry: async (path) => {
            classifiedPaths.push(path);
            return path === unsafePath ? scenario.unsafeKind : "file";
          },
          createCandidateRoot
        };
        const prepared = await prepareReleaseCandidateInput(
          { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
          { repositoryRoot: fixture.repositoryRoot, filesystem }
        );
        expect(prepared.ok, scenario.name).toBe(true);
        if (!prepared.ok) throw new Error(`${scenario.name} fixture input was rejected`);

        const result = await inventoryReleaseCandidateSources(prepared.value);

        expect(result, `${scenario.name}, reverse=${reverse}`).toEqual({
          ok: false,
          blockers: [
            {
              code: scenario.unsafeBlocker.code,
              path: "game/dota_addons/fixture_addon/Alpha.txt",
              category: scenario.unsafeBlocker.category
            },
            {
              code: "SOURCE_IDENTITY_COLLISION",
              path: "game/dota_addons/fixture_addon/Alpha.txt",
              category: "case-fold"
            },
            {
              code: "SOURCE_IDENTITY_COLLISION",
              path: "game/dota_addons/fixture_addon/alpha.txt",
              category: "case-fold"
            }
          ]
        });
        expect(classifiedPaths.filter((path) => path === unsafePath)).toHaveLength(1);
        expect(classifiedPaths.filter((path) => path === acceptedPath)).toHaveLength(1);
        if (scenario.unsafeKind === "symbolic-link" || scenario.unsafeKind === "reparse") {
          expect(canonicalizedPaths).not.toContain(unsafePath);
        }
        expect(createCandidateRoot).not.toHaveBeenCalled();
      }
    }
  });

  test("reports complete release candidate scan coverage across included file classes", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    const optionalFiles: Array<[string, string | Buffer]> = [
      [join(fixture.gameAddonRoot, "scripts/vscripts/optional-readable.lua"), "print('safe')\n"],
      [join(fixture.gameAddonRoot, "scripts/vscripts/optional-unreadable.lua"), "unreadable evidence\n"],
      [join(fixture.gameAddonRoot, "scripts/vscripts/optional-invalid.txt"), Buffer.from([0x66, 0x80, 0x67])],
      [join(fixture.contentAddonRoot, "materials/arbitrary.bin"), Buffer.from([0x00, 0xff, 0x10, 0x80])],
      [join(fixture.contentAddonRoot, "panorama/optional-oversized.txt"), Buffer.alloc(MAX_SECRET_SCAN_BYTES + 1, 0x61)]
    ];
    for (const [path, content] of optionalFiles) {
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, content);
    }
    const sourceBefore = await snapshotSourceTrees(fixture);

    const openedForText: string[] = [];
    let candidateRoot: string | undefined;
    const scanAcceptedSourceFile = vi.fn(async (
      input: ValidatedReleaseCandidateInput,
      entry: { root: "game" | "content"; path: string; kind: "file" | "directory" },
      maxBytes: number
    ) => {
      const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
      const relativePath = entry.path.slice(prefix.length);
      const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
      const sourcePath = join(sourceRoot, ...relativePath.split("/"));
      const info = await lstat(sourcePath);
      const base = {
        ok: true as const,
        schemaVersion: "1.0" as const,
        size: info.size,
        identityMatched: true as const,
        kindMatched: true as const,
        contained: true as const
      };
      if (!isReleaseTextPath(relativePath)) return { ...base, state: "binary" as const };
      if (relativePath === "scripts/vscripts/optional-unreadable.lua") return { ...base, state: "unreadable" as const };
      if (info.size > maxBytes) return { ...base, state: "oversized" as const };
      openedForText.push(entry.path);
      return { ...base, state: "readable" as const, bytes: await readFile(sourcePath) };
    });
    const filesystem: ReleaseCandidateFilesystem = {
      lstat,
      realpath,
      readDirectory: async (path) => (await readdir(path)).reverse(),
      classifySourceEntry: classifyFixtureEntry,
      createCandidateRoot: vi.fn(async () => {
        throw new Error("raw candidate creation must not be used");
      }),
      candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease: async (identity) => {
          await rm(identity.root, { recursive: true, force: false });
          return { ok: true, removed: true, absent: true, identityMatched: true };
        },
        readAcceptedSourceFile: scanAcceptedSourceFile as unknown as ReturnType<typeof createNoFollowSourceReader>
      })
    };

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => "inspected",
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(result).toMatchObject({
      ok: true,
      value: "inspected",
      scanCoverage: {
        schemaVersion: "1.0",
        totalFileCount: 12,
        text: { count: 8 },
        binary: { count: 1, paths: ["content/materials/arbitrary.bin"] },
        unreadable: {
          count: 2,
          paths: ["game/scripts/vscripts/optional-invalid.txt", "game/scripts/vscripts/optional-unreadable.lua"]
        },
        oversized: { count: 1, paths: ["content/panorama/optional-oversized.txt"] }
      }
    });
    if (!result.ok) throw new Error("complete scan coverage fixture was blocked");
    expect(result.manifest.entries).toHaveLength(12);
    expect(result.manifest.entries.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      "content/dota_addons/fixture_addon/materials/arbitrary.bin",
      "content/dota_addons/fixture_addon/panorama/optional-oversized.txt",
      "game/dota_addons/fixture_addon/scripts/vscripts/optional-invalid.txt",
      "game/dota_addons/fixture_addon/scripts/vscripts/optional-unreadable.lua"
    ]));
    expect(openedForText).not.toContain("content/dota_addons/fixture_addon/materials/arbitrary.bin");
    expect(scanAcceptedSourceFile).toHaveBeenCalledTimes(12);
    expect(await snapshotSourceTrees(fixture)).toEqual(sourceBefore);
    if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
    await expect(lstat(candidateRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("reports complete release candidate scan coverage for required text blockers", async () => {
    const scenarios = [
      { name: "unreadable", path: "scripts/vscripts/addon_game_mode.lua", state: "unreadable", code: "REQUIRED_TEXT_UNREADABLE" },
      { name: "invalid utf8", path: "scripts/npc/herolist.txt", state: "invalid", code: "REQUIRED_TEXT_UNREADABLE" },
      { name: "oversized", path: "scripts/npc/npc_units_custom.txt", state: "oversized", code: "REQUIRED_TEXT_OVERSIZED" },
      { name: "sensitive", path: "scripts/vscripts/optional-sensitive.lua", state: "sensitive", code: "SENSITIVE_MATERIAL" }
    ] as const;

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      if (scenario.state === "invalid") {
        await writeFile(join(fixture.gameAddonRoot, ...scenario.path.split("/")), Buffer.from([0x66, 0x80, 0x67]));
      }
      if (scenario.state === "oversized") {
        await writeFile(join(fixture.gameAddonRoot, ...scenario.path.split("/")), Buffer.alloc(MAX_SECRET_SCAN_BYTES + 1, 0x61));
      }
      if (scenario.state === "sensitive") {
        const path = join(fixture.gameAddonRoot, ...scenario.path.split("/"));
        await mkdir(join(path, ".."), { recursive: true });
        await writeFile(path, `${compactAssignment("password", "synthetic-private-value")}\n`);
      }
      const sourceBefore = await snapshotSourceTrees(fixture);
      const createCandidateLease = vi.fn(async () => {
        throw new Error("required scan blockers must precede candidate creation");
      });
      const scanAcceptedSourceFile = vi.fn(async (
        input: ValidatedReleaseCandidateInput,
        entry: { root: "game" | "content"; path: string; kind: "file" | "directory" },
        maxBytes: number
      ) => {
        const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
        const relativePath = entry.path.slice(prefix.length);
        const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const sourcePath = join(sourceRoot, ...relativePath.split("/"));
        const info = await lstat(sourcePath);
        const base = {
          ok: true as const,
          schemaVersion: "1.0" as const,
          size: info.size,
          identityMatched: true as const,
          kindMatched: true as const,
          contained: true as const
        };
        if (!isReleaseTextPath(relativePath)) return { ...base, state: "binary" as const };
        if (relativePath === scenario.path && scenario.state === "unreadable") return { ...base, state: "unreadable" as const };
        if (info.size > maxBytes) return { ...base, state: "oversized" as const };
        return { ...base, state: "readable" as const, bytes: await readFile(sourcePath) };
      });
      const filesystem: ReleaseCandidateFilesystem = {
        lstat,
        realpath,
        readDirectory: async (path) => await readdir(path),
        classifySourceEntry: classifyFixtureEntry,
        createCandidateRoot: vi.fn(async () => {
          throw new Error("raw candidate creation must not be used");
        }),
        candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
          createCandidateLease,
          cleanupCandidateLease: vi.fn(async () => ({ ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const })),
          readAcceptedSourceFile: scanAcceptedSourceFile as unknown as ReturnType<typeof createNoFollowSourceReader>
        })
      };

      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async () => "unexpected",
        { repositoryRoot: fixture.repositoryRoot, filesystem }
      );

      expect(result, scenario.name).toMatchObject({
        ok: false,
        scanCoverage: {
          schemaVersion: "1.0",
          totalFileCount: scenario.state === "sensitive" ? 8 : 7,
          unreadable: { count: scenario.state === "unreadable" || scenario.state === "invalid" ? 1 : 0 },
          oversized: { count: scenario.state === "oversized" ? 1 : 0 }
        },
        blockers: [{ code: scenario.code, disposition: "blocker", path: scenario.path }]
      });
      expect(createCandidateLease, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("synthetic-private-value");
      expect(await snapshotSourceTrees(fixture), scenario.name).toEqual(sourceBefore);
    }
  });

  test("cleans every post-create outcome exactly once", async () => {
    const acquisitionScenarios = [
      {
        name: "malformed acquisition",
        acquire: async () => null
      },
      {
        name: "throwing acquisition getter",
        acquire: async () => Object.defineProperty({}, "inspectionRoot", {
          get: () => {
            throw new Error("private acquisition getter");
          }
        })
      },
      {
        name: "throwing acquisition proxy",
        acquire: async () => new Proxy({}, {
          get: () => {
            throw new Error("private acquisition proxy");
          }
        })
      },
      {
        name: "rejecting acquisition thenable",
        acquire: async () => await ({
          then: (_resolve: unknown, reject: (reason: unknown) => void) => {
            reject(new Error("private acquisition thenable"));
          }
        } as PromiseLike<unknown>)
      },
      {
        name: "exceptional acquisition",
        acquire: async () => {
          throw new Error("private acquisition failure");
        }
      }
    ];

    for (const scenario of acquisitionScenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      let candidateRoot: string | undefined;
      let creationCount = 0;
      const callback = vi.fn(async () => "unexpected");
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          creationCount += 1;
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        acquireCandidateLease: async (_validated, createRegisteredCandidate) => {
          await createRegisteredCandidate();
          await Promise.resolve();
          return await scenario.acquire();
        },
        cleanupCandidateLease
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(result, scenario.name).toMatchObject({
        ok: false,
        cleanup: {
          schemaVersion: "1.0",
          attempted: true,
          attempts: 1,
          status: "verified",
          identityMatched: true,
          removed: true,
          absent: true
        },
        blockers: [{ code: "CANDIDATE_ACQUISITION_RESULT_INVALID", category: "creation" }]
      });
      expect(creationCount, scenario.name).toBe(1);
      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      expect(callback, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("private acquisition");
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }

    const unusableRegistrationScenarios = [
      { name: "malformed registered result", registered: () => null },
      {
        name: "throwing registered result getter",
        registered: () => Object.defineProperty({}, "inspectionRoot", {
          get: () => {
            throw new Error("private registered getter");
          }
        })
      },
      {
        name: "throwing registered result proxy",
        registered: () => new Proxy({}, {
          get: () => {
            throw new Error("private registered proxy");
          }
        })
      },
      {
        name: "throwing registered result",
        registered: () => {
          throw new Error("private registered throw");
        }
      }
    ];

    for (const scenario of unusableRegistrationScenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      let candidateRoot: string | undefined;
      let creationCount = 0;
      const callback = vi.fn(async () => "unexpected");
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return {
          ok: true as const,
          removed: true as const,
          absent: true as const,
          identityMatched: true as const
        };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async () => {
          throw new Error("custom creation boundary must be used");
        },
        createCandidateState: async (validated, registerCreatedCandidate) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          creationCount += 1;
          registerCreatedCandidate(candidateRoot, { root: candidateRoot });
          return scenario.registered();
        },
        cleanupCandidateLease
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(withoutResultDomains(result), scenario.name).toEqual({
        ok: false,
        scanCoverage: expect.any(Object),
        cleanup: {
          schemaVersion: "1.0",
          attempted: true,
          attempts: 1,
          status: "verified",
          verified: true,
          identityMatched: true,
          removed: true,
          absent: true
        },
        blockers: [{ code: "CANDIDATE_ACQUISITION_RESULT_INVALID", category: "creation" }]
      });
      expect(creationCount, scenario.name).toBe(1);
      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      expect(callback, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("private registered");
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }

    const createFactoryOwnedLifecycle = createIdentityBoundCandidateLifecycle as unknown as <TIdentity extends object>(
      operations: {
        createCandidateState(
          input: ValidatedReleaseCandidateInput,
          registerCreatedCandidate: (inspectionRoot: string, identity: TIdentity) => object
        ): Promise<unknown>;
        acquireCandidateLease(
          input: ValidatedReleaseCandidateInput,
          createRegisteredCandidate: () => Promise<object>
        ): Promise<unknown>;
        cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
      }
    ) => IdentityBoundCandidateLifecycle;

    const ownershipFixture = await createFixture();
    await populateReadyFixture(ownershipFixture);
    const preparedOwnership = await prepareReleaseCandidateInput(
      {
        addonName: "fixture_addon",
        dotaRoot: ownershipFixture.dotaRoot,
        tempParent: ownershipFixture.tempParent
      },
      {
        repositoryRoot: ownershipFixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); })
        }
      }
    );
    if (!preparedOwnership.ok) throw new Error("ownership fixture input was rejected");

    let ownedRoot: string | undefined;
    const ownedCleanup = vi.fn(async (identity: { root: string }) => {
      await rm(identity.root, { recursive: true, force: false });
      return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
    });
    const ownedLifecycle = createFactoryOwnedLifecycle<{ root: string }>({
      createCandidateState: async (validated, registerCreatedCandidate) => {
        ownedRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return registerCreatedCandidate(ownedRoot, { root: ownedRoot });
      },
      acquireCandidateLease: async (_validated, createRegisteredCandidate) => {
        await createRegisteredCandidate();
        await Promise.resolve();
        throw new Error("private post-create provider failure");
      },
      cleanupCandidateLease: ownedCleanup
    });
    const ownedFailure = await ownedLifecycle.createCandidateLease(preparedOwnership.value);
    expect(ownedFailure).toEqual({
      ok: false,
      schemaVersion: "1.0",
      state: "created-failure",
      code: "CANDIDATE_ACQUISITION_RESULT_INVALID",
      cleanup: {
        schemaVersion: "1.0",
        attempted: true,
        attempts: 1,
        status: "verified",
        verified: true,
        identityMatched: true,
        removed: true,
        absent: true
      }
    });
    expect(ownedCleanup).toHaveBeenCalledTimes(1);
    if (ownedRoot === undefined) throw new Error("factory-owned root was not recorded");
    await expect(lstat(ownedRoot)).rejects.toMatchObject({ code: "ENOENT" });

    {
      const scenario = "skip primitive";
      const createCandidateState = vi.fn(async () => {
        throw new Error("creation primitive must not run");
      });
      const cleanupCandidateLease = vi.fn(async () => ({
        ok: true as const,
        removed: true as const,
        absent: true as const,
        identityMatched: true as const
      }));
      const lifecycle = createFactoryOwnedLifecycle<{ root: string }>({
        createCandidateState,
        acquireCandidateLease: async () => {
          throw new Error("private unsupported provider failure");
        },
        cleanupCandidateLease
      });
      const result = await lifecycle.createCandidateLease(preparedOwnership.value);
      expect(result, scenario).toEqual({
        ok: false,
        schemaVersion: "1.0",
        state: "contract-failure",
        code: "CANDIDATE_CREATION_CONTRACT_FAILED",
        cleanup: {
          schemaVersion: "1.0",
          attempted: false,
          attempts: 0,
          status: "failed",
          verified: false,
          code: "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE"
        }
      });
      expect(createCandidateState, scenario).not.toHaveBeenCalled();
      expect(cleanupCandidateLease, scenario).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario).not.toContain(ownershipFixture.root);
      expect(JSON.stringify(result), scenario).not.toContain('"absent":true');
    }

    let reentrantPrimitive: (() => Promise<object>) | undefined;
    let reentrantAttempt: Promise<object> | undefined;
    let reentrantRejected = false;
    let reentrantCreateCalls = 0;
    const reentrantRoots: string[] = [];
    const reentrantCreate = vi.fn(async (
      validated: ValidatedReleaseCandidateInput,
      registerCreatedCandidate: (inspectionRoot: string, identity: { root: string }) => object
    ) => {
      reentrantCreateCalls += 1;
      if (reentrantCreateCalls === 1) {
        if (reentrantPrimitive === undefined) throw new Error("reentrant primitive was not registered");
        reentrantAttempt = reentrantPrimitive();
      }
      const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
      reentrantRoots.push(root);
      return registerCreatedCandidate(root, { root });
    });
    const reentrantCleanup = vi.fn(async (identity: { root: string }) => {
      await rm(identity.root, { recursive: true, force: false });
      return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
    });
    const reentrantLifecycle = createFactoryOwnedLifecycle<{ root: string }>({
      createCandidateState: reentrantCreate,
      acquireCandidateLease: async (_validated, createRegisteredCandidate) => {
        reentrantPrimitive = createRegisteredCandidate;
        const registration = await createRegisteredCandidate();
        if (reentrantAttempt === undefined) throw new Error("reentrant creation was not attempted");
        try {
          await reentrantAttempt;
        } catch {
          reentrantRejected = true;
        }
        return registration;
      },
      cleanupCandidateLease: reentrantCleanup
    });
    const reentrantResult = await reentrantLifecycle.createCandidateLease(preparedOwnership.value);
    expect(reentrantResult).toMatchObject({
      ok: false,
      state: "created-failure",
      cleanup: { attempted: true, attempts: 1, status: "verified", verified: true }
    });
    expect(reentrantRejected).toBe(true);
    expect(reentrantCreate).toHaveBeenCalledTimes(1);
    expect(reentrantCleanup).toHaveBeenCalledTimes(1);
    expect(reentrantRoots).toHaveLength(1);
    await expect(lstat(reentrantRoots[0]!)).rejects.toMatchObject({ code: "ENOENT" });

    for (const scenario of ["provider throws", "provider returns malformed"] as const) {
      let inFlightRoot: string | undefined;
      let settleCreation: (() => void) | undefined;
      const creationSettled = new Promise<void>((resolve) => {
        settleCreation = resolve;
      });
      const createCandidateState = vi.fn(async (
        validated: ValidatedReleaseCandidateInput,
        registerCreatedCandidate: (inspectionRoot: string, identity: { root: string }) => object
      ) => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        inFlightRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        settleCreation?.();
        return registerCreatedCandidate(inFlightRoot, { root: inFlightRoot });
      });
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFactoryOwnedLifecycle<{ root: string }>({
        createCandidateState,
        acquireCandidateLease: async (_validated, createRegisteredCandidate) => {
          void createRegisteredCandidate();
          if (scenario === "provider throws") throw new Error("private provider failure");
          return null;
        },
        cleanupCandidateLease
      });
      const result = await lifecycle.createCandidateLease(preparedOwnership.value);
      await creationSettled;
      expect(result, scenario).toEqual({
        ok: false,
        schemaVersion: "1.0",
        state: "created-failure",
        code: "CANDIDATE_ACQUISITION_RESULT_INVALID",
        cleanup: {
          schemaVersion: "1.0",
          attempted: true,
          attempts: 1,
          status: "verified",
          verified: true,
          identityMatched: true,
          removed: true,
          absent: true
        }
      });
      expect(createCandidateState, scenario).toHaveBeenCalledTimes(1);
      expect(cleanupCandidateLease, scenario).toHaveBeenCalledTimes(1);
      if (inFlightRoot === undefined) throw new Error("in-flight candidate root was not recorded");
      await expect(lstat(inFlightRoot), scenario).rejects.toMatchObject({ code: "ENOENT" });
    }

    let concurrentRoot: string | undefined;
    let concurrentSettled: (() => void) | undefined;
    const concurrentCreationSettled = new Promise<void>((resolve) => {
      concurrentSettled = resolve;
    });
    const concurrentCreate = vi.fn(async (
      validated: ValidatedReleaseCandidateInput,
      registerCreatedCandidate: (inspectionRoot: string, identity: { root: string }) => object
    ) => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      concurrentRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
      concurrentSettled?.();
      return registerCreatedCandidate(concurrentRoot, { root: concurrentRoot });
    });
    const concurrentCleanup = vi.fn(async (identity: { root: string }) => {
      await rm(identity.root, { recursive: true, force: false });
      return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
    });
    const concurrentLifecycle = createFactoryOwnedLifecycle<{ root: string }>({
      createCandidateState: concurrentCreate,
      acquireCandidateLease: async (_validated, createRegisteredCandidate) => {
        void createRegisteredCandidate();
        await expect(createRegisteredCandidate()).rejects.toBeDefined();
        return null;
      },
      cleanupCandidateLease: concurrentCleanup
    });
    const concurrentResult = await concurrentLifecycle.createCandidateLease(preparedOwnership.value);
    await concurrentCreationSettled;
    expect(concurrentResult).toMatchObject({
      ok: false,
      state: "created-failure",
      cleanup: { attempted: true, attempts: 1, status: "verified", verified: true }
    });
    expect(concurrentCreate).toHaveBeenCalledTimes(1);
    expect(concurrentCleanup).toHaveBeenCalledTimes(1);
    if (concurrentRoot === undefined) throw new Error("concurrent candidate root was not recorded");
    await expect(lstat(concurrentRoot)).rejects.toMatchObject({ code: "ENOENT" });

    let retainedPrimitive: (() => Promise<object>) | undefined;
    const lateCreate = vi.fn(async () => {
      throw new Error("late primitive must reject before candidate creation");
    });
    const lateCleanup = vi.fn(async () => ({
      ok: true as const,
      removed: true as const,
      absent: true as const,
      identityMatched: true as const
    }));
    const lateLifecycle = createFactoryOwnedLifecycle<{ root: string }>({
      createCandidateState: lateCreate,
      acquireCandidateLease: async (_validated, createRegisteredCandidate) => {
        retainedPrimitive = createRegisteredCandidate;
        return null;
      },
      cleanupCandidateLease: lateCleanup
    });
    const lateResult = await lateLifecycle.createCandidateLease(preparedOwnership.value);
    expect(lateResult).toMatchObject({
      ok: false,
      state: "contract-failure",
      cleanup: { attempted: false, attempts: 0, verified: false }
    });
    if (retainedPrimitive === undefined) throw new Error("creation primitive was not retained");
    await expect(retainedPrimitive()).rejects.toBeDefined();
    expect(lateCreate).not.toHaveBeenCalled();
    expect(lateCleanup).not.toHaveBeenCalled();

    const postLeaseScenarios = [
      { name: "success", fault: "none", callbackCount: 1 },
      { name: "root inspection blocker", fault: "inspection", callbackCount: 0 },
      { name: "copy result malformed", fault: "copy", callbackCount: 0 },
      { name: "candidate hash result hostile", fault: "hash", callbackCount: 0 },
      { name: "ledger result malformed", fault: "ledger", callbackCount: 0 },
      { name: "callback failure", fault: "callback", callbackCount: 1 },
      { name: "cleanup result malformed", fault: "cleanup", callbackCount: 1 }
    ] as const;

    for (const scenario of postLeaseScenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      let candidateRoot: string | undefined;
      let creationCount = 0;
      const callback = vi.fn(async () => {
        if (scenario.fault === "callback") throw new Error("private callback failure");
        return "inspected";
      });
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        if (scenario.fault === "cleanup") return null as unknown as CandidateLeaseCleanupResult;
        return { ok: true as const, removed: true as const, absent: true as const, identityMatched: true as const };
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          creationCount += 1;
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease,
        ...(scenario.fault === "inspection" ? {
          inspectCandidateRoot: async () => null as unknown as CandidateRootInspectionResult
        } : {}),
        ...(scenario.fault === "copy" ? {
          materializeCandidateEntry: async () => null as unknown as CandidateMaterializationResult
        } : {}),
        ...(scenario.fault === "hash" ? {
          observeCandidate: async () => new Proxy({}, { get: () => { throw new Error("private hash result"); } })
        } : {}),
        ...(scenario.fault === "ledger" ? {
          reconcileCandidateTree: async () => null as unknown as CandidateTreeReconciliationResult
        } : {})
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(creationCount, scenario.name).toBe(1);
      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      expect(callback, scenario.name).toHaveBeenCalledTimes(scenario.callbackCount);
      expect(result, scenario.name).toHaveProperty("cleanup.attempted", true);
      expect(result, scenario.name).toHaveProperty("cleanup.attempts", 1);
      expect(result, scenario.name).toHaveProperty(
        "cleanup.status",
        scenario.fault === "cleanup" ? "failed" : "verified"
      );
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }

    const precreationFixture = await createFixture();
    let precreationCount = 0;
    let precreationCleanupCount = 0;
    const precreationResult = await withAssembledReleaseCandidate(
      { addonName: "invalid/name", dotaRoot: precreationFixture.dotaRoot, tempParent: precreationFixture.tempParent },
      async () => "unexpected",
      {
        repositoryRoot: precreationFixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
            createCandidateLease: async () => {
              precreationCount += 1;
              throw new Error("must not create");
            },
            cleanupCandidateLease: async () => {
              precreationCleanupCount += 1;
              return { ok: true, removed: true, absent: true, identityMatched: true };
            }
          })
        }
      }
    );
    expect(precreationResult).toMatchObject({ ok: false, blockers: [{ code: "INVALID_ADDON_NAME" }] });
    expect(precreationCount).toBe(0);
    expect(precreationCleanupCount).toBe(0);
  });

  test("preserves final artifact truth across callback and cleanup failures", async () => {
    const verifiedCleanup = {
      schemaVersion: "1.0",
      attempted: true,
      attempts: 1,
      ok: true,
      removed: true,
      absent: true,
      identityMatched: true
    } as const;
    const cleanupScenarios: Array<Readonly<{
      name: string;
      result: unknown;
      expectedCode?: string;
    }>> = [
      { name: "verified", result: verifiedCleanup },
      {
        name: "identity mismatch",
        result: {
          schemaVersion: "1.0",
          attempted: true,
          attempts: 1,
          ok: false,
          removed: true,
          absent: true,
          identityMatched: false,
          code: "CANDIDATE_IDENTITY_MISMATCH"
        },
        expectedCode: "CANDIDATE_IDENTITY_MISMATCH"
      },
      {
        name: "removal false",
        result: {
          schemaVersion: "1.0",
          attempted: true,
          attempts: 1,
          ok: false,
          removed: false,
          absent: false,
          identityMatched: true,
          code: "CANDIDATE_REMOVAL_FAILED"
        },
        expectedCode: "CANDIDATE_REMOVAL_FAILED"
      },
      {
        name: "absence false",
        result: {
          schemaVersion: "1.0",
          attempted: true,
          attempts: 1,
          ok: false,
          removed: true,
          absent: false,
          identityMatched: true,
          code: "CANDIDATE_ABSENCE_UNVERIFIED"
        },
        expectedCode: "CANDIDATE_ABSENCE_UNVERIFIED"
      },
      {
        name: "missing absence",
        result: { schemaVersion: "1.0", attempted: true, attempts: 1, ok: true, removed: true, identityMatched: true },
        expectedCode: "CANDIDATE_CLEANUP_RESULT_INVALID"
      },
      {
        name: "unsupported version",
        result: { ...verifiedCleanup, schemaVersion: "2.0" },
        expectedCode: "CANDIDATE_CLEANUP_RESULT_INVALID"
      },
      {
        name: "unsafe attempt count",
        result: { ...verifiedCleanup, attempts: 2 },
        expectedCode: "CANDIDATE_CLEANUP_RESULT_INVALID"
      },
      {
        name: "throwing getter",
        result: Object.defineProperty({}, "ok", { get: () => { throw new Error("private cleanup getter"); } }),
        expectedCode: "CANDIDATE_CLEANUP_RESULT_INVALID"
      },
      {
        name: "throwing proxy",
        result: new Proxy({}, { get: () => { throw new Error("private cleanup proxy"); } }),
        expectedCode: "CANDIDATE_CLEANUP_RESULT_INVALID"
      },
      {
        name: "rejecting thenable",
        result: { then: (_resolve: unknown, reject: (reason: unknown) => void) => reject(new Error("private cleanup thenable")) },
        expectedCode: "CANDIDATE_CLEANUP_RESULT_INVALID"
      }
    ];

    for (const scenario of cleanupScenarios) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const sourceBefore = await snapshotSourceTrees(fixture);
      let candidateRoot: string | undefined;
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        await rm(identity.root, { recursive: true, force: false });
        return scenario.result as CandidateLeaseCleanupResult;
      });
      const callback = vi.fn(async () => Object.freeze({ result: "inspected", candidateRoot: "must-not-escape" }));
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      expect(callback, scenario.name).toHaveBeenCalledTimes(1);
      expect(Object.isFrozen(result), scenario.name).toBe(true);
      expect(Object.isFrozen(Reflect.get(result, "artifactValidation")), scenario.name).toBe(true);
      expect(Object.isFrozen(Reflect.get(result, "operation")), scenario.name).toBe(true);
      expect(Object.isFrozen(Reflect.get(result, "cleanup")), scenario.name).toBe(true);
      expect(result, scenario.name).toMatchObject({
        ok: scenario.expectedCode === undefined,
        operation: { status: "completed" },
        artifactValidation: {
          status: "passed",
          manifest: { schemaVersion: "1.0", entries: expect.any(Array), combinedSha256: expect.stringMatching(/^[0-9a-f]{64}$/) },
          inclusionLedger: { schemaVersion: "1.0", expectedFileCount: 7, observedFileCount: 7, matchedFileCount: 7 },
          scanCoverage: expect.any(Object)
        },
        cleanup: scenario.expectedCode === undefined
          ? { schemaVersion: "1.0", attempted: true, attempts: 1, status: "verified", verified: true }
          : { schemaVersion: "1.0", attempted: true, attempts: 1, status: "failed", verified: false, code: scenario.expectedCode }
      });
      if (scenario.expectedCode === undefined) {
        expect(result, scenario.name).toHaveProperty("value");
      } else {
        expect(result, scenario.name).not.toHaveProperty("value");
        expect(JSON.stringify(result), scenario.name).not.toContain("must-not-escape");
      }
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("private cleanup");
      expect(await snapshotSourceTrees(fixture), scenario.name).toEqual(sourceBefore);
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }

    for (const scenario of [
      { name: "callback failure", mutation: false, callbackThrows: true, artifactStatus: "passed", artifactCode: undefined },
      { name: "callback mutation", mutation: true, callbackThrows: false, artifactStatus: "blocked", artifactCode: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH" },
      { name: "mutation before throw", mutation: true, callbackThrows: true, artifactStatus: "blocked", artifactCode: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH" }
    ] as const) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const sourceBefore = await snapshotSourceTrees(fixture);
      const events: string[] = [];
      let candidateRoot: string | undefined;
      let callbackSettled = false;
      const cleanupCandidateLease = vi.fn(async (identity: { root: string }) => {
        events.push("cleanup");
        await rm(identity.root, { recursive: true, force: false });
        return verifiedCleanup;
      });
      const lifecycle = createFixtureIdentityBoundCandidateLifecycle({
        createCandidateLease: async (validated) => {
          candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
          return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
        },
        cleanupCandidateLease,
        observeAcceptedSource: async (input, entry) => {
          if (callbackSettled) events.push(`source-after:${entry.path}`);
          const prefix = `${entry.root}/dota_addons/${input.addonName}/`;
          const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
          return await streamFixtureIntegrity(join(sourceRoot, ...entry.path.slice(prefix.length).split("/")), entry.root, entry.path);
        },
        observeCandidate: async (identity, expected) => {
          events.push(callbackSettled ? "candidate-after" : "candidate-before");
          return {
            ok: true,
            schemaVersion: "1.0",
            observations: await Promise.all(expected.filter((entry) => entry.kind === "file").map(async (entry) => {
              const [root] = entry.path.split("/");
              return await streamFixtureIntegrity(join(identity.root, ...entry.path.split("/")), root as "game" | "content", entry.path);
            }))
          };
        },
        reconcileCandidateTree: async (identity, expected) => {
          if (callbackSettled) events.push("reconcile-after");
          const actual: CandidateExpectedEntry[] = [];
          const walk = async (directory: string): Promise<void> => {
            for (const name of (await readdir(directory)).sort()) {
              const path = join(directory, name);
              const info = await lstat(path);
              actual.push({ path: relative(identity.root, path).replaceAll("\\", "/"), kind: info.isDirectory() ? "directory" : "file" });
              if (info.isDirectory()) await walk(path);
            }
          };
          await walk(identity.root);
          return JSON.stringify(actual) === JSON.stringify(expected)
            ? { ok: true, exact: true, identityMatched: true }
            : { ok: false, code: "CANDIDATE_TREE_MISMATCH", issues: [{ code: "CANDIDATE_TREE_MISSING", path: "game/dota_addons/fixture_addon/addoninfo.txt" }] };
        }
      });
      const result = await withAssembledReleaseCandidate(
        { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        async (root) => {
          events.push("callback");
          if (scenario.mutation) await writeFile(join(root, "game/dota_addons/fixture_addon/addoninfo.txt"), "mutated candidate\n");
          callbackSettled = true;
          if (scenario.callbackThrows) throw new Error(`private callback failure ${fixture.root}`);
          return Object.freeze({ candidateRoot: "withheld" });
        },
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: lifecycle
          }
        }
      );

      expect(result, scenario.name).toMatchObject({
        ok: false,
        operation: { status: scenario.callbackThrows ? "failed" : "completed" },
        artifactValidation: scenario.artifactStatus === "passed"
          ? { status: "passed", manifest: expect.any(Object), inclusionLedger: expect.any(Object), scanCoverage: expect.any(Object) }
          : { status: "blocked", blockers: [{ code: scenario.artifactCode, category: "integrity" }] },
        cleanup: { status: "verified", attempts: 1 }
      });
      expect(result, scenario.name).not.toHaveProperty("value");
      expect(events.indexOf("callback"), scenario.name).toBeGreaterThan(events.indexOf("candidate-before"));
      expect(events.indexOf("candidate-after"), scenario.name).toBeGreaterThan(events.indexOf("callback"));
      expect(events.some((event) => event.startsWith("source-after:")), scenario.name).toBe(true);
      expect(events.indexOf("cleanup"), scenario.name).toBeGreaterThan(events.indexOf("candidate-after"));
      expect(cleanupCandidateLease, scenario.name).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result), scenario.name).not.toContain(fixture.root);
      expect(JSON.stringify(result), scenario.name).not.toContain("private callback");
      expect(await snapshotSourceTrees(fixture), scenario.name).toEqual(sourceBefore);
      if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
      await expect(lstat(candidateRoot), scenario.name).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  test("keeps precreation and failed acquisition evidence explicit without cleanup invention", async () => {
    const scenarios = [
      {
        name: "precreation",
        addonName: "invalid/name",
        populate: false,
        createCandidateLease: async () => { throw new Error("must not create"); },
        expectedCode: "INVALID_ADDON_NAME",
        cleanupStatus: "not-reached",
        cleanupCode: undefined
      },
      {
        name: "failed acquisition",
        addonName: "fixture_addon",
        populate: true,
        createCandidateLease: async () => { throw new Error("private acquisition failure"); },
        expectedCode: "CANDIDATE_CREATION_CONTRACT_FAILED",
        cleanupStatus: "failed",
        cleanupCode: "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE"
      }
    ] as const;

    for (const scenario of scenarios) {
      const fixture = await createFixture();
      if (scenario.populate) await populateReadyFixture(fixture);
      const cleanupCandidateLease = vi.fn(async () => ({
        ok: true as const,
        removed: true as const,
        absent: true as const,
        identityMatched: true as const
      }));
      const callback = vi.fn(async () => "unexpected");
      const result = await withAssembledReleaseCandidate(
        { addonName: scenario.addonName, dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
        callback,
        {
          repositoryRoot: fixture.repositoryRoot,
          filesystem: {
            lstat,
            realpath,
            readDirectory: async (path) => await readdir(path),
            classifySourceEntry: classifyFixtureEntry,
            createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
            candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
              createCandidateLease: scenario.createCandidateLease,
              cleanupCandidateLease
            })
          }
        }
      );

      expect(result, scenario.name).toMatchObject({
        ok: false,
        operation: { status: "not-reached" },
        artifactValidation: { status: "not-reached" },
        cleanup: {
          schemaVersion: "1.0",
          attempted: false,
          attempts: 0,
          status: scenario.cleanupStatus,
          verified: false,
          ...(scenario.cleanupCode === undefined ? {} : { code: scenario.cleanupCode })
        },
        blockers: [{ code: scenario.expectedCode }]
      });
      expect(callback, scenario.name).not.toHaveBeenCalled();
      expect(cleanupCandidateLease, scenario.name).not.toHaveBeenCalled();
      expect(JSON.stringify(result), scenario.name).not.toContain("private acquisition failure");
    }
  });

  test("normalizes a directly thrown cleanup failure without leaking the exception", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    let candidateRoot: string | undefined;
    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async () => "must-not-survive",
      {
        repositoryRoot: fixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
            createCandidateLease: async (validated) => {
              candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
              return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
            },
            cleanupCandidateLease: async () => { throw new Error("private direct cleanup failure"); }
          })
        }
      }
    );

    expect(result).toMatchObject({
      ok: false,
      operation: { status: "completed" },
      artifactValidation: { status: "passed" },
      cleanup: {
        schemaVersion: "1.0",
        attempted: true,
        attempts: 1,
        status: "failed",
        verified: false,
        code: "CANDIDATE_CLEANUP_RESULT_INVALID"
      },
      blockers: [{ code: "CANDIDATE_CLEANUP_RESULT_INVALID", category: "removal" }]
    });
    expect(result).not.toHaveProperty("value");
    expect(JSON.stringify(result)).not.toContain("must-not-survive");
    expect(JSON.stringify(result)).not.toContain("private direct cleanup failure");
    if (candidateRoot === undefined) throw new Error("candidate root was not recorded");
    await rm(candidateRoot, { recursive: true, force: false });
  });

  test("separates blocked artifact evidence from cleanup failure evidence", async () => {
    const fixture = await createFixture();
    await populateReadyFixture(fixture);
    let candidateRoot: string | undefined;
    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      async (root) => {
        await writeFile(join(root, "game/dota_addons/fixture_addon/addoninfo.txt"), "mutated\n");
        return Object.freeze({ path: "withheld" });
      },
      {
        repositoryRoot: fixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: createFixtureIdentityBoundCandidateLifecycle({
            createCandidateLease: async (validated) => {
              candidateRoot = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
              return { inspectionRoot: candidateRoot, identity: { root: candidateRoot } };
            },
            cleanupCandidateLease: async (identity) => {
              await rm(identity.root, { recursive: true, force: false });
              return {
                ok: false,
                removed: true,
                absent: false,
                identityMatched: true,
                code: "CANDIDATE_ABSENCE_UNVERIFIED"
              };
            }
          })
        }
      }
    );

    expect(result).toMatchObject({
      ok: false,
      operation: { status: "completed" },
      artifactValidation: {
        status: "blocked",
        blockers: [{ code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" }]
      },
      cleanup: { status: "failed", code: "CANDIDATE_ABSENCE_UNVERIFIED" },
      blockers: [
        { code: "RELEASE_CANDIDATE_INTEGRITY_MISMATCH", category: "integrity" },
        { code: "CANDIDATE_ABSENCE_UNVERIFIED", category: "removal" }
      ]
    });
    expect(result).not.toHaveProperty("value");
    expect(JSON.stringify(result)).not.toContain(fixture.root);
    if (!result.ok && result.artifactValidation.status === "blocked") {
      expect(result.artifactValidation.blockers).toHaveLength(1);
      expect(result.blockers).toHaveLength(2);
      expect(result.artifactValidation.blockers[0]).not.toBe(result.blockers[0]);
    }
  });

  test("freezes independent blocker snapshots across every lifecycle domain", async () => {
    const assertFrozenBlockerEvidence = (
      result: Awaited<ReturnType<typeof withAssembledReleaseCandidate>>,
      label: string
    ): void => {
      if (result.ok) throw new Error(`${label} unexpectedly succeeded`);
      expect(Object.isFrozen(result.blockers), label).toBe(true);
      const serializedBefore = JSON.stringify(result);
      for (const blocker of result.blockers) {
        expect(Object.isFrozen(blocker), label).toBe(true);
        expect(Reflect.set(blocker, "code", "MUTATED"), label).toBe(false);
        expect(Reflect.set(blocker, "path", "private/mutated"), label).toBe(false);
      }
      if (result.artifactValidation.status === "blocked") {
        expect(Object.isFrozen(result.artifactValidation.blockers), label).toBe(true);
        expect(result.artifactValidation.blockers).toHaveLength(result.blockers.length - (
          result.cleanup.status === "failed" ? 1 : 0
        ));
        for (const [index, blocker] of result.artifactValidation.blockers.entries()) {
          expect(Object.isFrozen(blocker), label).toBe(true);
          expect(blocker, label).not.toBe(result.blockers[index]);
          expect(Reflect.set(blocker, "category", "mutated"), label).toBe(false);
        }
      }
      expect(JSON.stringify(result), label).toBe(serializedBefore);
    };

    const invalidFixture = await createFixture();
    const invalidResult = await withAssembledReleaseCandidate(
      { addonName: "invalid/name", dotaRoot: invalidFixture.dotaRoot, tempParent: invalidFixture.tempParent },
      async () => "unexpected",
      { repositoryRoot: invalidFixture.repositoryRoot }
    );
    assertFrozenBlockerEvidence(invalidResult, "precreation");

    const readinessFixture = await createFixture();
    await populateReadyFixture(readinessFixture);
    await rm(join(readinessFixture.gameAddonRoot, "addoninfo.txt"));
    const readinessLifecycle = createFixtureIdentityBoundCandidateLifecycle({
      createCandidateLease: async () => { throw new Error("readiness blocker must not create"); },
      cleanupCandidateLease: async () => ({ ok: true, removed: true, absent: true, identityMatched: true })
    });
    const readinessResult = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: readinessFixture.dotaRoot, tempParent: readinessFixture.tempParent },
      async () => "unexpected",
      {
        repositoryRoot: readinessFixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: readinessLifecycle
        }
      }
    );
    assertFrozenBlockerEvidence(readinessResult, "readiness");

    const acquisitionFixture = await createFixture();
    await populateReadyFixture(acquisitionFixture);
    const acquisitionLifecycle = createFixtureIdentityBoundCandidateLifecycle({
      createCandidateLease: async (validated) => {
        const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: root, identity: { root } };
      },
      acquireCandidateLease: async (_input, createRegisteredCandidate) => {
        await createRegisteredCandidate();
        return Object.freeze({ invalid: true });
      },
      cleanupCandidateLease: async (identity) => {
        await rm(identity.root, { recursive: true, force: false });
        return { ok: true, removed: true, absent: true, identityMatched: true };
      }
    });
    const acquisitionResult = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: acquisitionFixture.dotaRoot, tempParent: acquisitionFixture.tempParent },
      async () => "unexpected",
      {
        repositoryRoot: acquisitionFixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: acquisitionLifecycle
        }
      }
    );
    assertFrozenBlockerEvidence(acquisitionResult, "acquisition");

    const finalFixture = await createFixture();
    await populateReadyFixture(finalFixture);
    const finalLifecycle = createFixtureIdentityBoundCandidateLifecycle({
      createCandidateLease: async (validated) => {
        const root = await mkdtemp(join(validated.tempParent, "dota-release-candidate-"));
        return { inspectionRoot: root, identity: { root } };
      },
      cleanupCandidateLease: async (identity) => {
        await rm(identity.root, { recursive: true, force: false });
        return {
          ok: false,
          removed: true,
          absent: false,
          identityMatched: true,
          code: "CANDIDATE_ABSENCE_UNVERIFIED"
        };
      }
    });
    const finalResult = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: finalFixture.dotaRoot, tempParent: finalFixture.tempParent },
      async (root) => {
        await writeFile(join(root, "game/dota_addons/fixture_addon/addoninfo.txt"), "mutated\n");
        return "must not survive";
      },
      {
        repositoryRoot: finalFixture.repositoryRoot,
        filesystem: {
          lstat,
          realpath,
          readDirectory: async (path) => await readdir(path),
          classifySourceEntry: classifyFixtureEntry,
          createCandidateRoot: vi.fn(async () => { throw new Error("raw creation is forbidden"); }),
          candidateLifecycle: finalLifecycle
        }
      }
    );
    assertFrozenBlockerEvidence(finalResult, "final blocked plus cleanup failure");
  });
});

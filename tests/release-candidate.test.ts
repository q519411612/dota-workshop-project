import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  utimes,
  writeFile
} from "node:fs/promises";
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
  type IdentityBoundCandidateLifecycle,
  type ReleaseCandidateEntryKind,
  type ReleaseCandidateFilesystem,
  type ValidatedReleaseCandidateInput
} from "../src/release-candidate.js";

type Fixture = {
  root: string;
  dotaRoot: string;
  repositoryRoot: string;
  tempParent: string;
  gameAddonRoot: string;
  contentAddonRoot: string;
};

const fixtureRoots: string[] = [];

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
        if (info.size > maxBytes) return { ok: true as const, state: "oversized" as const, size: info.size, identityMatched: true as const, kindMatched: true as const, contained: true as const };
        return { ok: true as const, state: "readable" as const, size: info.size, content: await handle.readFile("utf8"), identityMatched: true as const, kindMatched: true as const, contained: true as const };
      } finally {
        await handle.close();
      }
    } catch {
      return { ok: false as const, code: "SOURCE_FILE_IDENTITY_CHANGED" as const };
    }
  };
}

function createFixtureIdentityBoundCandidateLifecycle<TIdentity extends object>(operations: {
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<{ inspectionRoot: string; identity: TIdentity }>;
  cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
  readAcceptedSourceFile?(input: ValidatedReleaseCandidateInput, entry: Parameters<ReturnType<typeof createNoFollowSourceReader>>[1], maxBytes: number): Promise<AcceptedSourceReadResult>;
  inspectCandidateRoot?(identity: TIdentity): Promise<CandidateRootInspectionResult>;
  materializeCandidateEntry?(identity: TIdentity, input: ValidatedReleaseCandidateInput, operation: CandidateMaterializationOperation): Promise<CandidateMaterializationResult>;
  reconcileCandidateTree?(identity: TIdentity, expected: CandidateExpectedEntry[]): Promise<CandidateTreeReconciliationResult>;
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
      return { ok: true, created: true, identityMatched: true, kindMatched: true, contained: true };
    } catch {
      return { ok: false, code: "CANDIDATE_MATERIALIZATION_FAILED" };
    }
  };
  const defaultReconcile = async (
    identity: TIdentity,
    expected: CandidateExpectedEntry[]
  ): Promise<CandidateTreeReconciliationResult> => {
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
  return createIdentityBoundCandidateLifecycle({
    readAcceptedSourceFile: createNoFollowSourceReader(),
    inspectCandidateRoot: defaultInspect,
    materializeCandidateEntry: defaultMaterialize,
    reconcileCandidateTree: defaultReconcile,
    ...operations
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("release candidate input validation", () => {
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
    expect(success).toEqual({ ok: true, value: "complete" });
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
    expect(copyFailure).toEqual({
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
    expect(destinationAlias).toEqual({
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
    await writeFile(join(fixture.gameAddonRoot, "private.txt"), "password=synthetic-private-value\n");
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
      expect(result, kind).toEqual({
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
    await writeFile(externalPath, "password=synthetic-private-value\n");
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
            if (info.size > maxBytes) {
              return { ok: true as const, state: "oversized" as const, size: info.size, identityMatched: true as const, kindMatched: true as const, contained: true as const };
            }
            return { ok: true as const, state: "readable" as const, size: info.size, content: await handle.readFile("utf8"), identityMatched: true as const, kindMatched: true as const, contained: true as const };
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

    expect(result).toEqual({
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
          return { ok: true as const, state: "oversized" as const, size: maxBytes + 1, identityMatched: true as const, kindMatched: true as const, contained: true as const };
        }
        const sourceRoot = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const handle = await open(join(sourceRoot, ...relativePath.split("/")), filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
        try {
          const info = await handle.stat();
          return { ok: true as const, state: "readable" as const, size: info.size, content: await handle.readFile("utf8"), identityMatched: true as const, kindMatched: true as const, contained: true as const };
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
    expect(oversized).toEqual({
      ok: false,
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
      candidateLifecycle: createIdentityBoundCandidateLifecycle(operations)
    };
    const inspect = vi.fn(async () => "unexpected");

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      inspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(result).toEqual({
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
      candidateLifecycle: createIdentityBoundCandidateLifecycle(operations)
    };
    const inspect = vi.fn(async () => "unexpected");

    const result = await withAssembledReleaseCandidate(
      { addonName: "fixture_addon", dotaRoot: fixture.dotaRoot, tempParent: fixture.tempParent },
      inspect,
      { repositoryRoot: fixture.repositoryRoot, filesystem }
    );

    expect(result).toEqual({
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
      const privateFailure = `${fixture.root}/credential_password=synthetic-private-value`;
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
      expect(result, stage).toEqual({
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
        content: "ok🙂password=synthetic-private-value"
      }
    ];
    for (const scenario of cases) {
      const fixture = await createFixture();
      await populateReadyFixture(fixture);
      const createCandidateLease = vi.fn(async () => {
        throw new Error("invalid readable result must precede candidate creation");
      });
      const operations = {
        createCandidateLease,
        cleanupCandidateLease: vi.fn(async () => ({
          ok: true as const,
          removed: true as const,
          absent: true as const,
          identityMatched: true as const
        })),
        readAcceptedSourceFile: vi.fn(async () => ({
          ok: true as const,
          state: "readable" as const,
          size: scenario.size,
          content: scenario.content,
          identityMatched: true as const,
          kindMatched: true as const,
          contained: true as const
        })),
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

      expect(result, scenario.name).toEqual({
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
        createCandidateLease,
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

    expect(result).toEqual({
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

    expect(successfulResult).toEqual({ ok: true, value: "inspected" });
    expect(successfulLifecycle.createCandidateLease).toHaveBeenCalledTimes(1);
    expect(successfulLifecycle.cleanupCandidateLease).toHaveBeenCalledTimes(1);
    expect(inspectSuccess).toHaveBeenCalledTimes(1);
    expect(successfulLifecycle.writes.map(({ operation }) => operation)).toEqual(["create", "remove"]);
    const successfulRoot = successfulLifecycle.candidateRoot();
    if (successfulRoot === undefined) throw new Error("candidate root was not recorded");
    await expect(lstat(successfulRoot)).rejects.toMatchObject({ code: "ENOENT" });

    const callbackFixture = await createFixture();
    await populateReadyFixture(callbackFixture);
    const callbackLifecycle = createLifecycleFilesystem(callbackFixture);
    const privateFailure = join(callbackFixture.root, "credential_password=private-value");
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

    expect(callbackResult).toEqual({
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

    expect(aliasResult).toEqual({
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

    expect(removalResult).toEqual({
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
      expect(result, scenario.name).toEqual({
        ok: false,
        blockers: [{ code: "CANDIDATE_IDENTITY_MISMATCH", category: "removal" }]
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

    expect(swappedResult).toEqual({
      ok: false,
      blockers: [{ code: "CANDIDATE_IDENTITY_MISMATCH", category: "removal" }]
    });
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

    expect(mutableResult).toEqual({ ok: true, value: "inspected" });
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
    expect(unmarkedResult).toEqual({
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
    expect(forgedResult).toEqual({
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
    const privateCode = `PRIVATE_${fixture.root}_credential_password=private-value`;
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

    expect(result).toEqual({
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
      const privateFailure = `${fixture.root}/credential_password=synthetic-private-value`;
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

      expect(result, scenario.name).toEqual({
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
      const privateFailure = join(fixture.root, "credential_password=private-value");
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
    const privateRoot = join(fixture.root, "private", "credential_password=private-value");
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
});

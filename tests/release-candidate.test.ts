import { lstat, mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  continueReleaseCandidatePreparation,
  inventoryReleaseCandidateSources,
  prepareReleaseCandidateInput,
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

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("release candidate input validation", () => {
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

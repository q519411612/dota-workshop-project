import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prepareReleaseCandidateInput } from "../src/release-candidate.js";

type Fixture = {
  root: string;
  dotaRoot: string;
  repositoryRoot: string;
  tempParent: string;
  gameAddonRoot: string;
  contentAddonRoot: string;
};

const fixtureRoots: string[] = [];

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
});

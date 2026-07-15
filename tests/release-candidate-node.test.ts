import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createNodeReleaseCandidateFilesystem,
  preflightNodeReleaseCandidate
} from "../src/release-candidate-node.js";

const roots: string[] = [];

type SnapshotEntry = Readonly<{
  path: string;
  kind: "directory" | "file" | "symbolic-link" | "special";
  bytes?: string;
}>;

async function createReadyFixture(addonName = "fixture_addon") {
  const root = await mkdtemp(join(tmpdir(), "node-release-candidate-"));
  roots.push(root);
  const dotaRoot = join(root, "dota");
  const repositoryRoot = join(root, "repository");
  const tempParent = join(root, "temporary");
  const gameAddonRoot = join(dotaRoot, "game", "dota_addons", addonName);
  const contentAddonRoot = join(dotaRoot, "content", "dota_addons", addonName);
  await Promise.all([
    mkdir(gameAddonRoot, { recursive: true }),
    mkdir(contentAddonRoot, { recursive: true }),
    mkdir(repositoryRoot, { recursive: true }),
    mkdir(tempParent, { recursive: true })
  ]);
  const files: Array<[string, string | Uint8Array]> = [
    [join(gameAddonRoot, "addoninfo.txt"), `
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
    [join(gameAddonRoot, "scripts/vscripts/addon_game_mode.lua"), "function Activate() end\n"],
    [join(gameAddonRoot, `resource/addon_${addonName}_english.txt`), "localization\n"],
    [join(gameAddonRoot, "scripts/npc/herolist.txt"), "heroes\n"],
    [join(gameAddonRoot, "scripts/npc/npc_heroes_custom.txt"), "heroes\n"],
    [join(gameAddonRoot, "scripts/npc/npc_units_custom.txt"), "units\n"],
    [join(gameAddonRoot, "scripts/npc/npc_abilities_custom.txt"), "abilities\n"],
    [join(contentAddonRoot, "materials/texture.bin"), new Uint8Array([0, 1, 2, 3])]
  ];
  for (const [path, bytes] of files) {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, bytes);
  }
  await mkdir(join(contentAddonRoot, "maps"), { recursive: true });
  return { root, dotaRoot, repositoryRoot, tempParent, gameAddonRoot, contentAddonRoot, addonName };
}

async function snapshot(root: string): Promise<SnapshotEntry[]> {
  const output: SnapshotEntry[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name);
      const stats = await lstat(path);
      const identity = relative(root, path).replaceAll("\\", "/");
      if (stats.isSymbolicLink()) output.push({ path: identity, kind: "symbolic-link" });
      else if (stats.isDirectory()) {
        output.push({ path: identity, kind: "directory" });
        await walk(path);
      } else if (stats.isFile()) {
        output.push({ path: identity, kind: "file", bytes: (await readFile(path)).toString("base64") });
      } else output.push({ path: identity, kind: "special" });
    }
  };
  await walk(root);
  return output;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe("production Node release candidate preflight", () => {
  test("runs the complete fixture lifecycle and returns only durable evidence after cleanup", async () => {
    const fixture = await createReadyFixture();
    const before = await snapshot(fixture.dotaRoot);
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" }
    );

    expect(detail).toMatchObject({
      ok: true,
      operation: { status: "completed" },
      artifactValidation: { status: "passed" },
      inclusionLedger: { expectedFileCount: 8, observedFileCount: 8, matchedFileCount: 8 },
      scanCoverage: {
        totalFileCount: 8,
        text: { count: 7 },
        binary: { count: 1 },
        unreadable: { count: 0 },
        oversized: { count: 0 }
      },
      cleanup: { attempted: true, attempts: 1, status: "verified", absent: true },
      execution: { kind: "fixture", outcome: "completed" }
    });
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
    expect(JSON.stringify(detail)).not.toContain(fixture.tempParent);
    expect(JSON.stringify(detail)).not.toContain("dota-release-candidate-");
    expect(JSON.stringify(detail)).not.toContain("inspectionRoot");
    expect(JSON.stringify(detail)).not.toContain("lease");
  });

  test("uses one production implementation for fixture and injected local roots", async () => {
    const fixture = await createReadyFixture();
    const dependencies = {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin" as const
    };
    const fixtureDetail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      dependencies
    );
    const localDetail = await preflightNodeReleaseCandidate(
      { target: { kind: "local", dotaRoot: fixture.dotaRoot }, addonName: fixture.addonName },
      dependencies
    );
    const substantive = (value: unknown) => {
      const copy = structuredClone(value) as Record<string, unknown>;
      delete copy.execution;
      delete copy.commands;
      delete copy.logs;
      return copy;
    };

    expect(substantive(localDetail)).toEqual(substantive(fixtureDetail));
    expect(localDetail).toMatchObject({ execution: { kind: "local", outcome: "completed" } });
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("fails local Windows before candidate creation without positive reparse classification", async () => {
    const fixture = await createReadyFixture();
    let created = 0;
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "win32",
      operations: {
        createTemporaryDirectory: async () => {
          created += 1;
          throw new Error("must not create");
        }
      }
    });
    const before = await snapshot(fixture.dotaRoot);
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "local", dotaRoot: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "win32"
      }
    );

    expect(detail).toMatchObject({
      ok: false,
      operation: { status: "not-reached" },
      artifactValidation: { status: "not-reached" },
      blockers: [{ code: "WINDOWS_REPARSE_CLASSIFIER_REQUIRED" }],
      cleanup: { attempted: false, attempts: 0, status: "not-reached", verified: false },
      execution: { kind: "local", outcome: "failed" }
    });
    expect(created).toBe(0);
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("preserves sources and cleans exactly once after an inspection failure", async () => {
    const fixture = await createReadyFixture();
    let cleanupAttempts = 0;
    const before = await snapshot(fixture.dotaRoot);
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin",
        inspectCandidate: async () => {
          throw new Error("inspection failed");
        },
        onCleanupAttempt: () => { cleanupAttempts += 1; }
      }
    );

    expect(detail).toMatchObject({
      ok: false,
      operation: { status: "failed", code: "CANDIDATE_INSPECTION_FAILED" },
      artifactValidation: { status: "passed" },
      cleanup: { attempted: true, attempts: 1, status: "verified", absent: true }
    });
    expect(cleanupAttempts).toBe(1);
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });
});

import { lstat, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants as filesystemConstants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
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

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
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
    expect(collectKeys(detail)).not.toContain("inspectionRoot");
    expect(collectKeys(detail)).not.toContain("lease");
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

  test("runs the uninjected public local Windows route through the target-native classifier", async () => {
    const fixture = await createReadyFixture();
    let classifierCalls = 0;
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "local", dotaRoot: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "win32",
        windowsClassifierExecutor: async ({ path }) => {
          classifierCalls += 1;
          const stats = await lstat(path);
          const kind = stats.isFile() ? "file" : stats.isDirectory() ? "directory" : "special";
          return {
            exitCode: 0,
            stdout: JSON.stringify({ schemaVersion: "1.0", kind, reparsePoint: false }),
            stderr: ""
          };
        }
      }
    );

    expect(classifierCalls).toBeGreaterThan(0);
    expect(detail).toMatchObject({
      ok: true,
      execution: { kind: "local", outcome: "completed" },
      cleanup: { status: "verified", absent: true }
    });
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("classifies Windows file and directory reparse points and rejects uncertain output", async () => {
    const outputs = new Map<string, unknown>([
      ["file-link", { schemaVersion: "1.0", kind: "file", reparsePoint: true }],
      ["directory-link", { schemaVersion: "1.0", kind: "directory", reparsePoint: true }],
      ["malformed", { schemaVersion: "1.0", kind: "file", reparsePoint: false, private: true }]
    ]);
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "win32",
      windowsClassifierExecutor: async ({ path }) => ({
        exitCode: 0,
        stdout: JSON.stringify(outputs.get(path)),
        stderr: ""
      })
    });

    expect(filesystem.reparsePointAware).toBe(true);
    expect(await filesystem.classifySourceEntry("file-link")).toBe("reparse");
    expect(await filesystem.classifySourceEntry("directory-link")).toBe("reparse");
    await expect(filesystem.classifySourceEntry("malformed")).rejects.toThrow("WINDOWS_REPARSE_CLASSIFICATION_INVALID");
  });

  test("runs local Windows contract execution only with a positive reparse-aware classifier", async () => {
    const fixture = await createReadyFixture();
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "win32",
      windowsClassifySourceEntry: async (path) => {
        const stats = await lstat(path);
        if (stats.isSymbolicLink()) return "reparse";
        if (stats.isFile()) return "file";
        if (stats.isDirectory()) return "directory";
        return "special";
      }
    });
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "local", dotaRoot: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "win32"
      }
    );

    expect(filesystem.reparsePointAware).toBe(true);
    expect(detail).toMatchObject({
      ok: true,
      execution: { kind: "local", outcome: "completed" },
      cleanup: { status: "verified", absent: true }
    });
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

  test("blocks readiness before creation and leaves the source trees unchanged", async () => {
    const fixture = await createReadyFixture();
    await rm(join(fixture.gameAddonRoot, "addoninfo.txt"));
    const before = await snapshot(fixture.dotaRoot);
    let cleanupAttempts = 0;
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin",
        onCleanupAttempt: () => { cleanupAttempts += 1; }
      }
    );

    expect(detail).toMatchObject({
      ok: false,
      operation: { status: "not-reached" },
      artifactValidation: { status: "not-reached" },
      cleanup: { attempted: false, attempts: 0, status: "not-reached" }
    });
    expect("blockers" in detail && detail.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "REQUIRED_PATH_MISSING" })
    ]));
    expect(cleanupAttempts).toBe(0);
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("cleans once after an exclusive copy failure without mutating sources", async () => {
    const fixture = await createReadyFixture();
    const before = await snapshot(fixture.dotaRoot);
    let cleanupAttempts = 0;
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "darwin",
      onCleanupAttempt: () => { cleanupAttempts += 1; },
      operations: {
        openFile: async (path, flags) => {
          if ((flags & filesystemConstants.O_WRONLY) !== 0) throw new Error("copy failed");
          return await open(path, flags);
        }
      }
    });
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin"
      }
    );

    expect(detail).toMatchObject({
      ok: false,
      artifactValidation: { status: "blocked" },
      cleanup: { attempted: true, attempts: 1, status: "verified", absent: true }
    });
    expect("blockers" in detail && detail.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CANDIDATE_MATERIALIZATION_FAILED" })
    ]));
    expect(cleanupAttempts).toBe(1);
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("cleans once after a candidate hash read failure without mutating sources", async () => {
    const fixture = await createReadyFixture();
    const before = await snapshot(fixture.dotaRoot);
    let cleanupAttempts = 0;
    let candidateReadFailed = false;
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "darwin",
      onCleanupAttempt: () => { cleanupAttempts += 1; },
      operations: {
        openFile: async (path, flags) => {
          if (
            !candidateReadFailed
            && path.includes("dota-release-candidate-")
            && (flags & filesystemConstants.O_WRONLY) === 0
          ) {
            candidateReadFailed = true;
            throw new Error("hash read failed");
          }
          return await open(path, flags);
        }
      }
    });
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin"
      }
    );

    expect(detail).toMatchObject({
      ok: false,
      artifactValidation: { status: "blocked" },
      cleanup: { attempted: true, attempts: 1, status: "verified", absent: true }
    });
    expect(cleanupAttempts).toBe(1);
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("reports cleanup failure truthfully and never masks passed artifact evidence", async () => {
    const fixture = await createReadyFixture();
    const before = await snapshot(fixture.dotaRoot);
    let cleanupAttempts = 0;
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "darwin",
      onCleanupAttempt: () => { cleanupAttempts += 1; },
      operations: {
        removeTree: async () => { throw new Error("remove failed"); }
      }
    });
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin"
      }
    );

    expect(detail).toMatchObject({
      ok: false,
      operation: { status: "completed" },
      artifactValidation: { status: "passed" },
      cleanup: {
        attempted: true,
        attempts: 1,
        status: "failed",
        code: "CANDIDATE_REMOVAL_FAILED",
        removed: false,
        absent: false
      },
      blockers: [{ code: "CANDIDATE_REMOVAL_FAILED", category: "removal" }]
    });
    expect(cleanupAttempts).toBe(1);
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect((await readdir(fixture.tempParent)).length).toBe(1);
  });

  test("registers cleanup ownership before post-create identity observation can fail", async () => {
    const fixture = await createReadyFixture();
    const before = await snapshot(fixture.dotaRoot);
    let failedCandidateObservation = false;
    let cleanupAttempts = 0;
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "darwin",
      onCleanupAttempt: () => { cleanupAttempts += 1; },
      operations: {
        lstat: async (path) => {
          if (!failedCandidateObservation && basename(path).startsWith("dota-release-candidate-")) {
            failedCandidateObservation = true;
            throw new Error("identity observation failed");
          }
          return await lstat(path);
        }
      }
    });
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin"
      }
    );

    expect(cleanupAttempts).toBe(1);
    expect(detail).toMatchObject({
      ok: false,
      cleanup: {
        attempted: true,
        attempts: 1,
        status: "failed",
        code: "CANDIDATE_IDENTITY_MISMATCH",
        identityMatched: false,
        removed: false,
        absent: false
      }
    });
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect((await readdir(fixture.tempParent)).length).toBe(1);
  });

  test("rejects an adapter-selected protected root without registering destructive cleanup", async () => {
    const fixture = await createReadyFixture();
    const before = await snapshot(fixture.dotaRoot);
    let cleanupAttempts = 0;
    const filesystem = createNodeReleaseCandidateFilesystem({
      platform: "darwin",
      onCleanupAttempt: () => { cleanupAttempts += 1; },
      operations: {
        createTemporaryDirectory: async () => fixture.dotaRoot
      }
    });
    const detail = await preflightNodeReleaseCandidate(
      { target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName },
      {
        filesystem,
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin"
      }
    );

    expect(cleanupAttempts).toBe(0);
    expect(detail).toMatchObject({
      ok: false,
      operation: { status: "not-reached" },
      artifactValidation: { status: "not-reached" },
      cleanup: { attempted: false, attempts: 0, status: "failed", code: "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE" }
    });
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
  });
});

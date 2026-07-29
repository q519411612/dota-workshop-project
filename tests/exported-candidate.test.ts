import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  cleanupNodeExportedCandidate,
  EXPORTED_CANDIDATE_HANDOFF_SUFFIX,
  exportNodeReleaseCandidate
} from "../src/exported-candidate.js";

const roots: string[] = [];

async function createFixture(addonName = "export_fixture") {
  const root = await mkdtemp(join(tmpdir(), "exported-candidate-"));
  roots.push(root);
  const dotaRoot = join(root, "dota");
  const repositoryRoot = join(root, "repository");
  const tempParent = join(root, "temporary");
  const exportRoot = join(root, "exports");
  const gameAddon = join(dotaRoot, "game", "dota_addons", addonName);
  const contentAddon = join(dotaRoot, "content", "dota_addons", addonName);
  await Promise.all([
    mkdir(gameAddon, { recursive: true }),
    mkdir(contentAddon, { recursive: true }),
    mkdir(repositoryRoot),
    mkdir(tempParent),
    mkdir(exportRoot)
  ]);
  const files: Array<[string, string | Uint8Array]> = [
    [join(gameAddon, "addoninfo.txt"), `
"AddonInfo"
{
  "addonSteamAppID" "570"
  "addontitle" "Export Fixture"
  "addonAuthor" "Author"
  "addonDescription" "Ready"
  "addonVersion" "1"
  "DefaultMap" "fixture_map"
  "maps" "fixture_map"
}
`],
    [join(gameAddon, "scripts/vscripts/addon_game_mode.lua"), "function Activate() end\n"],
    [join(gameAddon, `resource/addon_${addonName}_english.txt`), "localization\n"],
    [join(gameAddon, "scripts/npc/herolist.txt"), "heroes\n"],
    [join(gameAddon, "scripts/npc/npc_heroes_custom.txt"), "heroes\n"],
    [join(gameAddon, "scripts/npc/npc_units_custom.txt"), "units\n"],
    [join(gameAddon, "scripts/npc/npc_abilities_custom.txt"), "abilities\n"],
    [join(contentAddon, "materials/texture.bin"), new Uint8Array([0, 1, 2, 3])]
  ];
  for (const [path, contents] of files) {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, contents);
  }
  await mkdir(join(contentAddon, "maps"));
  return { root, dotaRoot, repositoryRoot, tempParent, exportRoot, addonName };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe("exported release candidate lifecycle", () => {
  test("exports a validated fixture candidate and publishes external handoff evidence", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-1");
    const result = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin"
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "export_release_candidate",
      manifest: { schemaVersion: "1.0", fileCount: 8 },
      ownership: { schemaVersion: "1.0" },
      cleanup: { status: "verified", stagingAbsent: true }
    });
    expect(await readdir(destination)).toEqual(["content", "game"]);
    const handoffPath = `${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`;
    const handoff = JSON.parse(await readFile(handoffPath, "utf8"));
    expect(handoff.combinedSha256).toBe(result.manifest?.combinedSha256);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("refuses existing destinations without changing them", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-1");
    await mkdir(destination);
    await writeFile(join(destination, "owned.txt"), "keep");

    const result = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });

    expect(result).toMatchObject({ ok: false, error: { code: "EXPORT_DESTINATION_EXISTS" } });
    expect(await readFile(join(destination, "owned.txt"), "utf8")).toBe("keep");
  });

  test("dry-runs and executes cleanup only with exact ownership and digest evidence", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-1");
    const exported = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    if (!exported.ok || exported.manifest == null || exported.ownership == null) throw new Error("export failed");

    const base = {
      target: { kind: "fixture" as const, root: fixture.dotaRoot },
      exportRoot: fixture.exportRoot,
      destination,
      ownershipId: exported.ownership.ownershipId,
      manifestVersion: "1.0" as const,
      combinedSha256: exported.manifest.combinedSha256
    };
    const dryRun = await cleanupNodeExportedCandidate({ ...base, dryRun: true }, { repositoryRoot: fixture.repositoryRoot });
    expect(dryRun).toMatchObject({ ok: true, cleanup: { mode: "dry-run", authorized: true, attempted: false } });
    expect(await readdir(destination)).toEqual(["content", "game"]);

    const mismatch = await cleanupNodeExportedCandidate({ ...base, ownershipId: "00000000-0000-4000-8000-000000000000", dryRun: false }, { repositoryRoot: fixture.repositoryRoot });
    expect(mismatch).toMatchObject({ ok: false, error: { code: "CLEANUP_AUTHORIZATION_MISMATCH" }, cleanup: { attempted: false } });

    const executed = await cleanupNodeExportedCandidate({ ...base, dryRun: false }, { repositoryRoot: fixture.repositoryRoot });
    expect(executed).toMatchObject({
      ok: true,
      cleanup: { mode: "execute", candidateAbsent: true, manifestAbsent: true, status: "verified" }
    });
    await expect(readdir(destination)).rejects.toThrow();
    await expect(readFile(`${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`)).rejects.toThrow();
  });

  test("rejects protected and symbolic-link export roots", async () => {
    const fixture = await createFixture();
    const protectedResult = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.dotaRoot,
      destination: join(fixture.dotaRoot, "candidate")
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    expect(protectedResult).toMatchObject({ ok: false, error: { code: "EXPORT_ROOT_PROTECTED" }, manifest: null, ownership: null });

    const alias = join(fixture.root, "export-alias");
    await symlink(fixture.exportRoot, alias);
    const linkedResult = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: alias,
      destination: join(alias, "candidate")
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    expect(linkedResult).toMatchObject({ ok: false, error: { code: "EXPORT_ROOT_UNSAFE" } });
  });

  test("reports promotion and staging cleanup failures independently", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-1");
    const promotion = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin",
      rename: async () => { throw new Error("promotion failure"); }
    });
    expect(promotion).toMatchObject({ ok: false, error: { code: "EXPORT_PROMOTION_FAILED" }, cleanup: { status: "verified", stagingAbsent: true } });

    const cleanupFailure = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin",
      rename: async () => { throw new Error("promotion failure"); },
      remove: async () => { throw new Error("cleanup failure"); }
    });
    expect(cleanupFailure).toMatchObject({ ok: false, error: { code: "EXPORT_PROMOTION_FAILED" }, cleanup: { status: "failed", stagingAbsent: false } });
  });

  test("fails closed when the promoted candidate changes or handoff publication fails", async () => {
    const fixture = await createFixture();
    const changedDestination = join(fixture.exportRoot, "candidate-changed");
    let renameCalls = 0;
    const changed = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination: changedDestination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin",
      rename: async (source, destination) => {
        renameCalls += 1;
        await rename(source, destination);
        if (renameCalls === 1) await writeFile(join(String(destination), "game/dota_addons", fixture.addonName, "addoninfo.txt"), "changed");
      }
    });
    expect(changed).toMatchObject({ ok: false, error: { code: "PROMOTED_MANIFEST_MISMATCH" }, cleanup: { attempted: false } });
    expect(await readFile(join(changedDestination, "game/dota_addons", fixture.addonName, "addoninfo.txt"), "utf8")).toBe("changed");

    const handoffDestination = join(fixture.exportRoot, "candidate-handoff-failure");
    const handoffFailure = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination: handoffDestination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin",
      write: async () => { throw new Error("handoff write failure"); }
    });
    expect(handoffFailure).toMatchObject({ ok: false, error: { code: "HANDOFF_MANIFEST_PUBLICATION_FAILED" }, cleanup: { attempted: false } });
    expect(await readdir(handoffDestination)).toEqual(["content", "game"]);
  });

  test("reports partial execute cleanup without broad retry", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-partial-cleanup");
    const exported = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    if (!exported.ok || exported.manifest == null || exported.ownership == null) throw new Error("export failed");
    const result = await cleanupNodeExportedCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      exportRoot: fixture.exportRoot,
      destination,
      ownershipId: exported.ownership.ownershipId,
      manifestVersion: "1.0",
      combinedSha256: exported.manifest.combinedSha256,
      dryRun: false
    }, {
      repositoryRoot: fixture.repositoryRoot,
      remove: async () => { throw new Error("candidate removal failure"); }
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE" },
      cleanup: { candidateRemoved: false, candidateAbsent: false, manifestRemoved: true, manifestAbsent: true, status: "failed" }
    });
    expect(await readdir(destination)).toEqual(["content", "game"]);
  });
});

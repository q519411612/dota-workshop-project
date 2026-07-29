import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  cleanupNodeExportedCandidate,
  EXPORTED_CANDIDATE_HANDOFF_SUFFIX,
  exportNodeReleaseCandidate
} from "../src/exported-candidate.js";
import { atomicMoveNoReplace } from "../src/exported-candidate-native.js";
import { createNodeReleaseCandidateFilesystem } from "../src/release-candidate-node.js";

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

  test("uses atomic no-replace when promotion and handoff targets appear at mutation time", async () => {
    const promotionFixture = await createFixture("promotion_race");
    const promotionDestination = join(promotionFixture.exportRoot, "candidate-race");
    const promotion = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: promotionFixture.dotaRoot },
      addonName: promotionFixture.addonName,
      exportRoot: promotionFixture.exportRoot,
      destination: promotionDestination
    }, {
      repositoryRoot: promotionFixture.repositoryRoot,
      tempParent: promotionFixture.tempParent,
      platform: "darwin",
      atomicMove: async (source, destination) => {
        await mkdir(destination);
        await writeFile(join(destination, "owned.txt"), "keep");
        await atomicMoveNoReplace(source, destination, "darwin");
      }
    });
    expect(promotion).toMatchObject({ ok: false, error: { code: "ATOMIC_NO_REPLACE_DESTINATION_EXISTS" } });
    expect(await readFile(join(promotionDestination, "owned.txt"), "utf8")).toBe("keep");

    const handoffFixture = await createFixture("handoff_race");
    const handoffDestination = join(handoffFixture.exportRoot, "candidate-race");
    const handoffPath = `${handoffDestination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`;
    const handoff = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: handoffFixture.dotaRoot },
      addonName: handoffFixture.addonName,
      exportRoot: handoffFixture.exportRoot,
      destination: handoffDestination
    }, {
      repositoryRoot: handoffFixture.repositoryRoot,
      tempParent: handoffFixture.tempParent,
      platform: "darwin",
      atomicMove: async (source, destination) => {
        if (destination.endsWith(EXPORTED_CANDIDATE_HANDOFF_SUFFIX)) await writeFile(destination, "owner data", { flag: "wx" });
        await atomicMoveNoReplace(source, destination, "darwin");
      }
    });
    expect(handoff).toMatchObject({ ok: false, error: { code: "ATOMIC_NO_REPLACE_DESTINATION_EXISTS" }, cleanup: { candidateState: "present" } });
    expect(await readFile(handoffPath, "utf8")).toBe("owner data");
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
      cleanup: {
        mode: "execute",
        candidateRemoved: true,
        candidateAbsent: true,
        manifestRemoved: true,
        manifestAbsent: true,
        candidateState: "absent",
        manifestState: "absent",
        status: "verified"
      }
    });
    await expect(readdir(destination)).rejects.toThrow();
    await expect(readFile(`${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`, "utf8")).rejects.toThrow();
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

  test("fails before staging when the declared POSIX atomic primitive prerequisite is unavailable", async () => {
    const fixture = await createFixture("atomic_prerequisite");
    const destination = join(fixture.exportRoot, "candidate");
    let stagingAttempted = false;
    const result = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      platform: "darwin",
      verifyAtomicMove: async () => { throw new Error("compiler unavailable"); },
      createStaging: async () => {
        stagingAttempted = true;
        throw new Error("staging must not start");
      }
    });
    expect(result).toMatchObject({ ok: false, error: { code: "ATOMIC_NO_REPLACE_UNAVAILABLE" } });
    expect(stagingAttempted).toBe(false);
  });

  test("requires the Windows reparse-aware classifier across export boundaries", async () => {
    const fixture = await createFixture("windows_reparse");
    const destination = join(fixture.exportRoot, "candidate");
    const rootReparse = createNodeReleaseCandidateFilesystem({
      platform: "win32",
      windowsClassifySourceEntry: async (path) => path === fixture.exportRoot ? "reparse" : "directory"
    });
    const rejectedRoot = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "win32", filesystem: rootReparse });
    expect(rejectedRoot).toMatchObject({ ok: false, error: { code: "EXPORT_ROOT_UNSAFE" } });

    const entryReparse = createNodeReleaseCandidateFilesystem({
      platform: "win32",
      windowsClassifySourceEntry: async (path) => path.endsWith("addoninfo.txt") ? "reparse" : (await lstat(path)).isDirectory() ? "directory" : "file"
    });
    const rejectedEntry = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "win32", filesystem: entryReparse });
    expect(rejectedEntry).toMatchObject({ ok: false, error: { code: "EXPORT_PREFLIGHT_FAILED" } });
    await expect(readdir(destination)).rejects.toThrow();
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

  test("normalizes staging creation failure without rejecting the handler", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-unwritable");
    await expect(exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin",
      createStaging: async () => { throw new Error("EACCES"); }
    })).resolves.toMatchObject({
      ok: false,
      error: { code: "EXPORT_STAGING_CREATION_FAILED" },
      paths: { destination: expect.any(String) },
      cleanup: { status: "not-reached", attempted: false }
    });
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

  test("rejects a post-promotion topology injection", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-topology-injected");
    let renameCalls = 0;
    const result = await exportNodeReleaseCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName, exportRoot: fixture.exportRoot, destination }, {
      repositoryRoot: fixture.repositoryRoot,
      tempParent: fixture.tempParent,
      platform: "darwin",
      rename: async (source, target) => {
        renameCalls += 1;
        await rename(source, target);
        if (renameCalls === 1) await mkdir(join(String(target), "unexpected-empty"));
      }
    });
    expect(result).toMatchObject({ ok: false, error: { code: "PROMOTED_MANIFEST_MISMATCH" } });
    expect(await readdir(join(destination, "unexpected-empty"))).toEqual([]);
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
      cleanup: { candidateState: "present", candidateRemoved: false, candidateAbsent: false, manifestRemoved: false, manifestAbsent: false, status: "failed" }
    });
    expect(await readdir(destination)).toEqual(["content", "game"]);
    expect(JSON.parse(await readFile(`${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`, "utf8"))).toMatchObject({ ownership: { ownershipId: exported.ownership.ownershipId } });
  });

  test("preserves the handoff when candidate removal succeeds but handoff removal fails", async () => {
    const fixture = await createFixture("handoff_removal_failure");
    const destination = join(fixture.exportRoot, "candidate");
    const exported = await exportNodeReleaseCandidate({
      target: { kind: "fixture", root: fixture.dotaRoot },
      addonName: fixture.addonName,
      exportRoot: fixture.exportRoot,
      destination
    }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    if (!exported.ok || exported.manifest == null || exported.ownership == null) throw new Error("export failed");
    let removalCount = 0;
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
      remove: async (path, options) => {
        removalCount += 1;
        if (removalCount === 2) throw new Error("handoff removal failure");
        await rm(path, options);
      }
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE" },
      cleanup: {
        candidateRemoved: true,
        candidateAbsent: true,
        candidateState: "absent",
        manifestRemoved: false,
        manifestAbsent: false,
        manifestState: "present",
        status: "failed"
      }
    });
    await expect(readdir(destination)).rejects.toThrow();
    expect(await readFile(`${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`, "utf8")).toContain(exported.ownership.ownershipId);
  });

  test("rejects unexpected empty directories during cleanup authorization", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-topology");
    const exported = await exportNodeReleaseCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName, exportRoot: fixture.exportRoot, destination }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    if (!exported.ok || exported.manifest == null || exported.ownership == null) throw new Error("export failed");
    await mkdir(join(destination, "unexpected-empty"));
    const result = await cleanupNodeExportedCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, exportRoot: fixture.exportRoot, destination, ownershipId: exported.ownership.ownershipId, manifestVersion: "1.0", combinedSha256: exported.manifest.combinedSha256, dryRun: false }, { repositoryRoot: fixture.repositoryRoot });
    expect(result).toMatchObject({ ok: false, error: { code: "CANDIDATE_DIGEST_MISMATCH" }, cleanup: { attempted: false } });
    expect(await readdir(join(destination, "unexpected-empty"))).toEqual([]);
  });

  test("rejects a symbolic-link handoff without following it", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-linked-handoff");
    const exported = await exportNodeReleaseCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName, exportRoot: fixture.exportRoot, destination }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    if (!exported.ok || exported.manifest == null || exported.ownership == null) throw new Error("export failed");
    const handoffPath = `${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`;
    const external = join(fixture.root, "external-handoff.json");
    await rename(handoffPath, external);
    await symlink(external, handoffPath);
    const result = await cleanupNodeExportedCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, exportRoot: fixture.exportRoot, destination, ownershipId: exported.ownership.ownershipId, manifestVersion: "1.0", combinedSha256: exported.manifest.combinedSha256, dryRun: false }, { repositoryRoot: fixture.repositoryRoot });
    expect(result).toMatchObject({ ok: false, error: { code: "EXPORTED_CANDIDATE_STATE_UNSAFE" } });
    expect(await readdir(destination)).toEqual(["content", "game"]);
    expect(JSON.parse(await readFile(external, "utf8"))).toMatchObject({ ownership: { ownershipId: exported.ownership.ownershipId } });
  });

  test("does not delete an identity swapped at the mutation boundary", async () => {
    const fixture = await createFixture();
    const destination = join(fixture.exportRoot, "candidate-swapped");
    const exported = await exportNodeReleaseCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, addonName: fixture.addonName, exportRoot: fixture.exportRoot, destination }, { repositoryRoot: fixture.repositoryRoot, tempParent: fixture.tempParent, platform: "darwin" });
    if (!exported.ok || exported.manifest == null || exported.ownership == null) throw new Error("export failed");
    const original = join(fixture.exportRoot, "candidate-original-preserved");
    let renameCalls = 0;
    const result = await cleanupNodeExportedCandidate({ target: { kind: "fixture", root: fixture.dotaRoot }, exportRoot: fixture.exportRoot, destination, ownershipId: exported.ownership.ownershipId, manifestVersion: "1.0", combinedSha256: exported.manifest.combinedSha256, dryRun: false }, {
      repositoryRoot: fixture.repositoryRoot,
      rename: async (source, target) => {
        renameCalls += 1;
        if (renameCalls === 1) {
          await rename(source, original);
          await mkdir(source);
          await writeFile(join(String(source), "hostile.txt"), "must remain");
        }
        await rename(source, target);
      }
    });
    expect(result).toMatchObject({ ok: false, cleanup: { candidateRemoved: false, manifestRemoved: false } });
    expect(await readdir(original)).toEqual(["content", "game"]);
    expect(await readFile(`${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`, "utf8")).toContain(exported.ownership.ownershipId);
  });

  test("preserves substituted candidate tombstones and handoff objects", async () => {
    const candidateFixture = await createFixture("candidate_substitution");
    const candidateDestination = join(candidateFixture.exportRoot, "candidate");
    const candidateExport = await exportNodeReleaseCandidate({ target: { kind: "fixture", root: candidateFixture.dotaRoot }, addonName: candidateFixture.addonName, exportRoot: candidateFixture.exportRoot, destination: candidateDestination }, { repositoryRoot: candidateFixture.repositoryRoot, tempParent: candidateFixture.tempParent, platform: "darwin" });
    if (!candidateExport.ok || candidateExport.manifest == null || candidateExport.ownership == null) throw new Error("export failed");
    const preservedCandidate = join(candidateFixture.exportRoot, "preserved-owned-candidate");
    const candidateResult = await cleanupNodeExportedCandidate({ target: { kind: "fixture", root: candidateFixture.dotaRoot }, exportRoot: candidateFixture.exportRoot, destination: candidateDestination, ownershipId: candidateExport.ownership.ownershipId, manifestVersion: "1.0", combinedSha256: candidateExport.manifest.combinedSha256, dryRun: false }, {
      repositoryRoot: candidateFixture.repositoryRoot,
      platform: "darwin",
      afterCandidateTombstoneMove: async (tombstone) => {
        await rename(tombstone, preservedCandidate);
        await mkdir(tombstone);
        await writeFile(join(tombstone, "substitute.txt"), "must remain");
      }
    });
    expect(candidateResult).toMatchObject({ ok: false, cleanup: { candidateState: "unknown", candidateRemoved: false }, paths: { candidateTombstone: expect.any(String) } });
    expect(await readdir(preservedCandidate)).toEqual(["content", "game"]);
    const substitutedTombstone = candidateResult.paths.candidateTombstone;
    if (typeof substitutedTombstone !== "string") throw new Error("missing tombstone path");
    expect(await readFile(join(substitutedTombstone, "substitute.txt"), "utf8")).toBe("must remain");

    const handoffFixture = await createFixture("handoff_substitution");
    const handoffDestination = join(handoffFixture.exportRoot, "candidate");
    const handoffExport = await exportNodeReleaseCandidate({ target: { kind: "fixture", root: handoffFixture.dotaRoot }, addonName: handoffFixture.addonName, exportRoot: handoffFixture.exportRoot, destination: handoffDestination }, { repositoryRoot: handoffFixture.repositoryRoot, tempParent: handoffFixture.tempParent, platform: "darwin" });
    if (!handoffExport.ok || handoffExport.manifest == null || handoffExport.ownership == null) throw new Error("export failed");
    const handoffPath = `${handoffDestination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`;
    const preservedHandoff = join(handoffFixture.exportRoot, "preserved-handoff.json");
    const handoffResult = await cleanupNodeExportedCandidate({ target: { kind: "fixture", root: handoffFixture.dotaRoot }, exportRoot: handoffFixture.exportRoot, destination: handoffDestination, ownershipId: handoffExport.ownership.ownershipId, manifestVersion: "1.0", combinedSha256: handoffExport.manifest.combinedSha256, dryRun: false }, {
      repositoryRoot: handoffFixture.repositoryRoot,
      platform: "darwin",
      afterHandoffAuthorization: async () => {
        await rename(handoffPath, preservedHandoff);
        await writeFile(handoffPath, "substitute", { flag: "wx" });
      }
    });
    expect(handoffResult).toMatchObject({ ok: false, cleanup: { attempted: true, candidateState: "present", manifestState: "unknown", candidateRemoved: false, manifestRemoved: false } });
    expect(await readFile(handoffPath, "utf8")).toBe("substitute");
    expect(await readFile(preservedHandoff, "utf8")).toContain(handoffExport.ownership.ownershipId);
  });
});

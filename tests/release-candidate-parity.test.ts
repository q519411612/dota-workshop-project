import { lstat, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { preflightNodeReleaseCandidate } from "../src/release-candidate-node.js";
import { buildRemoteReleaseCandidateScript } from "../src/release-candidate-remote-script.js";
import { preflightRemoteReleaseCandidate } from "../src/release-candidate-remote.js";
import { createReleaseCandidateToolResult } from "../src/release-candidate-result.js";
import { evaluateReleaseReadiness } from "../src/release-readiness.js";
import { handleTool } from "../src/tools.js";
import type { ToolResult } from "../src/types.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe("release-candidate four-target parity", () => {
  test.each(["success", "required-path-blocked"] as const)("preserves exact %s semantics across fixture, local, SSH, and PowerShell", async (scenario) => {
    const fixture = await createReadyFixture();
    if (scenario === "required-path-blocked") {
      await unlink(join(fixture.gameAddonRoot, "scripts/vscripts/addon_game_mode.lua"));
    }
    const before = await snapshot(fixture.dotaRoot);
    const fixtureResult = await runNodeRoute("fixture", fixture);
    const localResult = await runNodeRoute("local", fixture);
    const sshResult = await runRemoteRoute("ssh", fixtureResult);
    const powershellResult = await runRemoteRoute("powershell", fixtureResult);

    const expected = semanticProjection(fixtureResult);
    expect(semanticProjection(localResult)).toEqual(expected);
    expect(semanticProjection(sshResult)).toEqual(expected);
    expect(semanticProjection(powershellResult)).toEqual(expected);
    expect([fixtureResult.ok, localResult.ok, sshResult.ok, powershellResult.ok]).toEqual(
      scenario === "success" ? [true, true, true, true] : [false, false, false, false]
    );
    if (scenario === "required-path-blocked") {
      for (const result of [fixtureResult, localResult, sshResult, powershellResult]) {
        expect(result.releaseCandidate).toMatchObject({
          artifactValidation: { status: "not-reached" },
          blockers: [{ code: "REQUIRED_PATH_MISSING" }],
          cleanup: { status: "not-reached", attempted: false }
        });
      }
    }
    for (const result of [fixtureResult, localResult, sshResult, powershellResult]) {
      expect(result.releaseCandidate).toMatchObject({
        warnings: [expect.stringContaining("contract evidence only")],
        boundaries: { realWindowsRuntimeProven: false, persistentCandidate: false, evidenceOnly: true }
      });
      expect(JSON.stringify(result)).not.toContain("dota-release-candidate-");
    }
    expect(await snapshot(fixture.dotaRoot)).toEqual(before);
    expect(await readdir(fixture.tempParent)).toEqual([]);
  });

  test("keeps transport uncertainty semantically visible and performs no local fallback", async () => {
    let remoteCalls = 0;
    let nodeCalls = 0;
    const result = await (handleTool as any)(
      "preflight_release_candidate",
      {
        target: { kind: "remote", name: "private", transport: "ssh", host: "example.test", dotaRoot: "C:/Dota" },
        addonName: "demo"
      },
      {
        preflightNodeReleaseCandidate: async () => { nodeCalls += 1; throw new Error("fallback forbidden"); },
        preflightRemoteReleaseCandidate: async () => {
          remoteCalls += 1;
          return preflightRemoteReleaseCandidate({
            target: { kind: "remote", name: "private", transport: "ssh", host: "example.test", dotaRoot: "C:/Dota" },
            addonName: "demo",
            executor: async () => { throw { signal: "SIGTERM" }; }
          });
        }
      }
    );

    expect({ remoteCalls, nodeCalls }).toEqual({ remoteCalls: 1, nodeCalls: 0 });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_FAILED" },
      releaseCandidate: {
        operation: { status: "not-reached" },
        artifactValidation: { status: "not-reached" },
        cleanup: { status: "unknown", verified: false },
        execution: { kind: "ssh", outcome: "uncertain" }
      }
    });
    expect(result.paths).toEqual({});
    expect(result.releaseCandidate).not.toHaveProperty("manifest");
  });

  test("the semantic projector removes only target-specific execution metadata", async () => {
    const fixture = await createReadyFixture();
    const result = await runNodeRoute("fixture", fixture);
    const detail = result.releaseCandidate as Record<string, unknown>;
    const projected = semanticProjection(result) as Record<string, unknown>;
    expect(Object.keys(detail).filter((key) => !Object.hasOwn(projected, key)).sort()).toEqual([
      "commands",
      "execution",
      "logs"
    ]);
    for (const key of [
      "operation", "artifactValidation", "manifest", "inclusionLedger", "scanCoverage", "blockers",
      "cleanup", "paths", "warnings", "boundaries"
    ]) {
      expect(projected).toHaveProperty(key);
    }
  });

  test("executes embedded remote sensitive policy semantics against shared local findings", () => {
    const content = 'ghp_12345678901234567890\npassword = "private"';
    const localCategories = evaluateReleaseReadiness({
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [{ root: "game", files: [{ relativePath: "scripts/secret.lua", state: "text", content }] }]
    })
      .filter((finding) => finding.code === "SENSITIVE_MATERIAL")
      .map((finding) => finding.category);
    const script = buildRemoteReleaseCandidateScript({ dotaRoot: "C:/Dota", addonName: "fixture_addon" });
    const match = script.match(/\$SensitiveMaterialRulesJson = '((?:''|[^'])*)'/);
    expect(match).not.toBeNull();
    const rules = JSON.parse(match![1]!.replaceAll("''", "'")) as Array<{
      category: string;
      pattern: string;
      ignoreCase: boolean;
    }>;
    const remoteCategories = rules
      .filter((rule) => new RegExp(rule.pattern, rule.ignoreCase ? "i" : "").test(content))
      .map((rule) => rule.category);

    expect(localCategories).toEqual(["github token", "password"]);
    expect(remoteCategories).toEqual(localCategories);
  });
});

async function runNodeRoute(kind: "fixture" | "local", fixture: Awaited<ReturnType<typeof createReadyFixture>>): Promise<ToolResult> {
  const target = kind === "fixture"
    ? { kind: "fixture" as const, root: fixture.dotaRoot }
    : { kind: "local" as const, dotaRoot: fixture.dotaRoot };
  return (handleTool as any)("preflight_release_candidate", { target, addonName: fixture.addonName }, {
    preflightNodeReleaseCandidate: async (input: any) => {
      const detail = await preflightNodeReleaseCandidate(input, {
        repositoryRoot: fixture.repositoryRoot,
        tempParent: fixture.tempParent,
        platform: "darwin"
      });
      return createReleaseCandidateToolResult({
        target: kind === "fixture" ? { kind: "fixture", root: "[redacted]" } : { kind: "local" },
        operation: "preflight_release_candidate",
        releaseCandidate: detail
      });
    },
    preflightRemoteReleaseCandidate: async () => { throw new Error("remote route forbidden"); }
  });
}

async function runRemoteRoute(transport: "ssh" | "powershell", source: ToolResult): Promise<ToolResult> {
  const payload = structuredClone(source.releaseCandidate) as Record<string, unknown>;
  delete payload.normalization;
  return (handleTool as any)("preflight_release_candidate", {
    target: { kind: "remote", name: "private", transport, host: "example.test", dotaRoot: "C:/Dota" },
    addonName: "fixture_addon"
  }, {
    preflightNodeReleaseCandidate: async () => { throw new Error("local fallback forbidden"); },
    preflightRemoteReleaseCandidate: async () => preflightRemoteReleaseCandidate({
      target: { kind: "remote", name: "private", transport, host: "example.test", dotaRoot: "C:/Dota" },
      addonName: "fixture_addon",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
    })
  });
}

function semanticProjection(result: ToolResult): unknown {
  const detail = structuredClone(result.releaseCandidate) as Record<string, unknown>;
  delete detail.execution;
  delete detail.commands;
  delete detail.logs;
  return detail;
}

async function createReadyFixture(addonName = "fixture_addon") {
  const root = await mkdtemp(join(tmpdir(), "parity-release-candidate-"));
  roots.push(root);
  const dotaRoot = join(root, "dota");
  const repositoryRoot = join(root, "repository");
  const tempParent = join(root, "temporary");
  const gameAddonRoot = join(dotaRoot, "game/dota_addons", addonName);
  const contentAddonRoot = join(dotaRoot, "content/dota_addons", addonName);
  await Promise.all([mkdir(gameAddonRoot, { recursive: true }), mkdir(contentAddonRoot, { recursive: true }), mkdir(repositoryRoot), mkdir(tempParent)]);
  const files: Array<[string, string | Uint8Array]> = [
    [join(gameAddonRoot, "addoninfo.txt"), `"AddonInfo"\n{\n"addonSteamAppID" "570"\n"addontitle" "Fixture"\n"addonAuthor" "Author"\n"addonDescription" "Ready"\n"addonVersion" "1"\n"DefaultMap" "fixture_map"\n"maps" "fixture_map"\n}\n`],
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
  return { dotaRoot, repositoryRoot, tempParent, gameAddonRoot, contentAddonRoot, addonName };
}

async function snapshot(root: string): Promise<Array<{ path: string; kind: string; bytes?: string }>> {
  const output: Array<{ path: string; kind: string; bytes?: string }> = [];
  const walk = async (directory: string): Promise<void> => {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name);
      const stats = await lstat(path);
      const identity = relative(root, path).replaceAll("\\", "/");
      if (stats.isDirectory()) { output.push({ path: identity, kind: "directory" }); await walk(path); }
      else if (stats.isFile()) output.push({ path: identity, kind: "file", bytes: (await readFile(path)).toString("base64") });
      else output.push({ path: identity, kind: "other" });
    }
  };
  await walk(root);
  return output;
}

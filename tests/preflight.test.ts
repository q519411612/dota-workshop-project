import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAddon } from "../src/addon.js";
import { dryRunReleaseReport, inspectWorkshopPreflight } from "../src/preflight.js";
import { DryRunReleaseReportInputSchema, InspectWorkshopPreflightInputSchema } from "../src/schemas.js";
import { handleTool, toolNames } from "../src/tools.js";

describe("workshop preflight inspection", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-preflight-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("exposes inspect_workshop_preflight through schema and dispatcher", async () => {
    const parsed = InspectWorkshopPreflightInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(parsed.addonName).toBe("demo_addon");
    expect(toolNames).toContain("inspect_workshop_preflight");

    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    const result = await handleTool("inspect_workshop_preflight", {
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.operation).toBe("inspect_workshop_preflight");
    expect(result.evidence).toContain("addon metadata exists");
  });

  test("reports addon layout, absent boundaries, and publishing blockers", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold: {
        unitName: "npc_dota_workshop_mcp_dummy",
        abilityName: "ability_dota_workshop_mcp_dummy"
      }
    });

    const result = await inspectWorkshopPreflight({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("game addon root exists");
    expect(result.evidence).toContain("content addon root exists");
    expect(result.evidence).toContain("addon metadata exists");
    expect(result.evidence).toContain("lua entry exists");
    expect(result.evidence).toContain("localization file exists");
    expect(result.evidence).toContain("unit support file exists");
    expect(result.evidence).toContain("ability support file exists");
    expect(result.evidence).toContain("content maps directory exists");
    expect(result.evidence).toContain("panorama source directory missing");
    expect(result.evidence).toContain("panorama runtime directory missing");
    expect(result.evidence).toContain("toolchain marker missing: package.json");
    expect(result.warnings).toContain("publishing credentials are not accepted or inspected");
    expect(result.warnings).toContain("Workshop upload is not supported by preflight");
    expect(result.warnings).toContain("content encryption is not supported by preflight");
    expect(result.paths.panoramaSource).toContain("content/dota_addons/demo_addon/panorama");
  });

  test("reports Panorama files and toolchain markers without running tools", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await mkdir(join(root, "content/dota_addons/demo_addon/panorama/layout/custom_game"), { recursive: true });
    await mkdir(join(root, "content/dota_addons/demo_addon/panorama/scripts/custom_game"), { recursive: true });
    await mkdir(join(root, "content/dota_addons/demo_addon/panorama/styles/custom_game"), { recursive: true });
    await writeFile(join(root, "content/dota_addons/demo_addon/panorama/layout/custom_game/custom.xml"), "<root />");
    await writeFile(join(root, "content/dota_addons/demo_addon/panorama/scripts/custom_game/custom.js"), "GameUI.CustomUIConfig().x = 1;");
    await writeFile(join(root, "content/dota_addons/demo_addon/panorama/styles/custom_game/custom.css"), ".Root {}");
    await writeFile(join(root, "content/dota_addons/demo_addon/package.json"), "{\"scripts\":{\"build\":\"vite\"},\"dependencies\":{\"react\":\"latest\"}}");
    await writeFile(join(root, "content/dota_addons/demo_addon/tsconfig.tstl.json"), "{}");

    const result = await inspectWorkshopPreflight({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("panorama source directory exists");
    expect(result.evidence).toContain("panorama source file exists: panorama/layout/custom_game/custom.xml");
    expect(result.evidence).toContain("panorama source file exists: panorama/scripts/custom_game/custom.js");
    expect(result.evidence).toContain("panorama source file exists: panorama/styles/custom_game/custom.css");
    expect(result.evidence).toContain("toolchain marker exists: package.json");
    expect(result.evidence).toContain("toolchain marker exists: tsconfig.tstl.json");
    expect(result.evidence).toContain("react panorama marker detected in package.json");
    expect(result.warnings).toContain("toolchain markers are inspection-only; builds are not run");
  });

  test("rejects invalid input before filesystem inspection", async () => {
    const invalidName = await inspectWorkshopPreflight({
      target: { kind: "fixture", root },
      addonName: "../demo"
    });
    const missingRoot = await inspectWorkshopPreflight({
      target: { kind: "local" },
      addonName: "demo_addon"
    });

    expect(invalidName.ok).toBe(false);
    expect(invalidName.error?.code).toBe("INVALID_ADDON_NAME");
    expect(invalidName.evidence).toContain("rejected preflight addon name: ../demo");
    expect(missingRoot.ok).toBe(false);
    expect(missingRoot.error?.code).toBe("TARGET_ROOT_REQUIRED");
    expect(missingRoot.evidence).toContain("target did not include a Dota root");
  });

  test("exposes dry_run_release_report through schema and dispatcher", async () => {
    const parsed = DryRunReleaseReportInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(parsed.addonName).toBe("demo_addon");
    expect(toolNames).toContain("dry_run_release_report");

    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await writeCompleteAddonInfo(root, "demo_addon", "dota");

    const result = await handleTool("dry_run_release_report", {
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.operation).toBe("dry_run_release_report");
    expect(result.evidence).toContain("dry-run release report generated");
    expect(result.evidence).toContain("release blockers: 0");
    expect(result.evidence).toContain("metadata evidence: addonVersion present");
    expect(result.evidence).toContain("metadata evidence: DefaultMap present");
    expect(result.evidence).toContain("metadata evidence: maps present");
    expect(result.warnings).toContain("Steam login is manual and out of scope");
    expect(result.warnings).toContain("Workshop upload is not performed by dry run");
  });

  test("reports metadata and package blockers without packaging", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await writeAddonInfo(root, "demo_addon", `"AddonInfo"\n{\n  "AddonName" "demo_addon"\n  "IsPlayable" "1"\n  "DefaultMap" "dota"\n  "maps" "dota"\n  "MinPlayers" "1"\n  "MaxPlayers" "10"\n}\n`);
    await rm(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"));

    const result = await dryRunReleaseReport({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(false);
    expect(result.evidence).toContain("release blockers: 6");
    expect(result.evidence).toContain("metadata blocker: addonSteamAppID missing");
    expect(result.evidence).toContain("metadata blocker: addontitle missing");
    expect(result.evidence).toContain("metadata blocker: addonAuthor missing");
    expect(result.evidence).toContain("metadata blocker: addonDescription missing");
    expect(result.evidence).toContain("metadata blocker: addonVersion missing");
    expect(result.evidence).toContain("package blocker: lua entry missing");
    expect(result.evidence).toContain("no package archive created");
    expect(result.evidence).toContain("no Workshop upload attempted");
  });

  test("reports placeholder metadata blockers", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await writeAddonInfo(root, "demo_addon", `"AddonInfo"\n{\n  "AddonName" "demo_addon"\n  "addonSteamAppID" "570"\n  "addontitle" "TBD"\n  "addonAuthor" "Workshop Team"\n  "addonDescription" "Dry run release fixture."\n  "addonVersion" "0.1.0"\n  "IsPlayable" "1"\n  "DefaultMap" "dota"\n  "maps" "dota"\n  "MinPlayers" "1"\n  "MaxPlayers" "10"\n}\n`);

    const result = await dryRunReleaseReport({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(false);
    expect(result.evidence).toContain("metadata blocker: addontitle placeholder");
    expect(result.evidence).toContain("release blockers: 1");
  });

  test("redacts sensitive material findings in dry-run report", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await writeCompleteAddonInfo(root, "demo_addon", "dota");
    const credentialName = ["steam", "password"].join("_");
    const credentialValue = ["super", "secret", "value", "123"].join("_");
    await writeFile(
      join(root, "game/dota_addons/demo_addon/scripts/vscripts/secrets.lua"),
      `local ${credentialName} = '${credentialValue}'\n`
    );

    const result = await dryRunReleaseReport({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(false);
    expect(result.evidence).toContain("secret blocker: scripts/vscripts/secrets.lua matches password");
    expect(result.evidence.join("\n")).not.toContain(credentialValue);
  });

  test("rejects invalid dry-run input before filesystem inspection", async () => {
    const invalidName = await dryRunReleaseReport({
      target: { kind: "fixture", root },
      addonName: "../demo"
    });
    const missingRoot = await dryRunReleaseReport({
      target: { kind: "local" },
      addonName: "demo_addon"
    });

    expect(invalidName.ok).toBe(false);
    expect(invalidName.error?.code).toBe("INVALID_ADDON_NAME");
    expect(invalidName.evidence).toContain("rejected release report addon name: ../demo");
    expect(missingRoot.ok).toBe(false);
    expect(missingRoot.error?.code).toBe("TARGET_ROOT_REQUIRED");
    expect(missingRoot.evidence).toContain("target did not include a Dota root");
  });
});

async function writeCompleteAddonInfo(root: string, addonName: string, mapName: string): Promise<void> {
  await writeAddonInfo(
    root,
    addonName,
    `"AddonInfo"\n{\n  "AddonName" "${addonName}"\n  "addonSteamAppID" "570"\n  "addontitle" "Demo Addon"\n  "addonAuthor" "Workshop Team"\n  "addonDescription" "Dry run release fixture."\n  "addonVersion" "0.1.0"\n  "IsPlayable" "1"\n  "DefaultMap" "${mapName}"\n  "maps" "${mapName}"\n  "MinPlayers" "1"\n  "MaxPlayers" "10"\n}\n`
  );
}

async function writeAddonInfo(root: string, addonName: string, content: string): Promise<void> {
  await writeFile(join(root, "game/dota_addons", addonName, "addoninfo.txt"), content);
}

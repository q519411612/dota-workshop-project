import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

    expect(result).toEqual(expectedReleaseResult(root));
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

    expect(result).toEqual(
      expectedReleaseResult(root, {
        metadataEvidence: ["metadata evidence: DefaultMap present", "metadata evidence: maps present"],
        blockers: [
          "package blocker: lua entry missing",
          "metadata blocker: addonSteamAppID missing",
          "metadata blocker: addontitle missing",
          "metadata blocker: addonAuthor missing",
          "metadata blocker: addonDescription missing",
          "metadata blocker: addonVersion missing"
        ]
      })
    );
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

    expect(result).toEqual(
      expectedReleaseResult(root, {
        metadataEvidence: COMPLETE_METADATA_EVIDENCE.filter((entry) => entry !== "metadata evidence: addontitle present"),
        blockers: ["metadata blocker: addontitle placeholder"]
      })
    );
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

    expect(result).toEqual(
      expectedReleaseResult(root, {
        blockers: [
          "secret blocker: scripts/vscripts/secrets.lua matches steam credential",
          "secret blocker: scripts/vscripts/secrets.lua matches password"
        ]
      })
    );
    expect(JSON.stringify(result)).not.toContain(credentialValue);
  });

  test("classifies unreadable required text without exposing filesystem errors", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await writeCompleteAddonInfo(root, "demo_addon", "dota");
    const localization = join(root, "game/dota_addons/demo_addon/resource/addon_demo_addon_english.txt");
    await chmod(localization, 0o000);

    const result = await dryRunReleaseReport({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      code: "RELEASE_PREFLIGHT_BLOCKED",
      message: "Release dry run found blockers."
    });
    expect(result.evidence).toContain("required text blocker: resource/addon_demo_addon_english.txt unreadable");
    expect(JSON.stringify({ error: result.error, evidence: result.evidence })).not.toContain("EACCES");
    expect(JSON.stringify({ error: result.error, evidence: result.evidence })).not.toContain("permission denied");
  });

  test("classifies required-text stat failures through the filesystem adapter", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });
    await writeCompleteAddonInfo(root, "demo_addon", "dota");
    const localization = join(root, "game/dota_addons/demo_addon/resource/addon_demo_addon_english.txt");

    const result = await dryRunReleaseReport(
      { target: { kind: "fixture", root }, addonName: "demo_addon" },
      {
        readFile: (path) => readFile(path, "utf8"),
        stat: async (path) => {
          if (path === localization) throw new Error(`stat failed at ${root}`);
          return stat(path);
        }
      }
    );

    expect(result.ok).toBe(false);
    expect(result.evidence).toContain("required text blocker: resource/addon_demo_addon_english.txt unreadable");
    expect(JSON.stringify({ error: result.error, evidence: result.evidence })).not.toContain("stat failed");
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

    expect(invalidName).toEqual({
      ok: false,
      target: { kind: "fixture", root },
      operation: "dry_run_release_report",
      error: {
        code: "INVALID_ADDON_NAME",
        message: "Addon names must start with a lowercase letter and contain only lowercase letters, digits, and underscores."
      },
      evidence: ["rejected release report addon name: ../demo"],
      warnings: [],
      paths: {},
      commands: [],
      logs: []
    });
    expect(missingRoot).toEqual({
      ok: false,
      target: { kind: "local" },
      operation: "dry_run_release_report",
      error: {
        code: "TARGET_ROOT_REQUIRED",
        message: "Release dry run requires a fixture root or target Dota root."
      },
      evidence: ["target did not include a Dota root"],
      warnings: [],
      paths: {},
      commands: [],
      logs: []
    });
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

const COMPLETE_METADATA_EVIDENCE = [
  "metadata evidence: addonSteamAppID present",
  "metadata evidence: addontitle present",
  "metadata evidence: addonAuthor present",
  "metadata evidence: addonDescription present",
  "metadata evidence: addonVersion present",
  "metadata evidence: DefaultMap present",
  "metadata evidence: maps present"
];

function expectedReleaseResult(
  root: string,
  overrides: { metadataEvidence?: string[]; blockers?: string[] } = {}
) {
  const addonName = "demo_addon";
  const paths = {
    gameAddon: join(root, "game/dota_addons", addonName),
    contentAddon: join(root, "content/dota_addons", addonName),
    addonInfo: join(root, "game/dota_addons", addonName, "addoninfo.txt"),
    luaEntry: join(root, "game/dota_addons", addonName, "scripts/vscripts/addon_game_mode.lua"),
    localization: join(root, "game/dota_addons", addonName, `resource/addon_${addonName}_english.txt`),
    heroList: join(root, "game/dota_addons", addonName, "scripts/npc/herolist.txt"),
    heroData: join(root, "game/dota_addons", addonName, "scripts/npc/npc_heroes_custom.txt"),
    unitData: join(root, "game/dota_addons", addonName, "scripts/npc/npc_units_custom.txt"),
    abilityData: join(root, "game/dota_addons", addonName, "scripts/npc/npc_abilities_custom.txt"),
    contentMaps: join(root, "content/dota_addons", addonName, "maps"),
    panoramaSource: join(root, "content/dota_addons", addonName, "panorama"),
    panoramaRuntime: join(root, "game/dota_addons", addonName, "panorama"),
    packageJson: join(root, "content/dota_addons", addonName, "package.json")
  };
  const blockers = overrides.blockers ?? [];
  const missingPackageLabels = new Set(
    blockers.filter((entry) => entry.startsWith("package blocker: ")).map((entry) => entry.slice(17, -8))
  );
  const packageEvidence = [
    "game addon root",
    "content addon root",
    "addon metadata",
    "lua entry",
    "localization file",
    "content maps directory",
    "hero list",
    "hero data",
    "unit support file",
    "ability support file"
  ]
    .filter((label) => !missingPackageLabels.has(label))
    .map((label) => `package evidence: ${label} exists`);

  return {
    ok: blockers.length === 0,
    target: { kind: "fixture", root },
    operation: "dry_run_release_report",
    ...(blockers.length > 0
      ? { error: { code: "RELEASE_PREFLIGHT_BLOCKED", message: "Release dry run found blockers." } }
      : {}),
    evidence: [
      ...packageEvidence,
      ...(overrides.metadataEvidence ?? COMPLETE_METADATA_EVIDENCE),
      `secret scan completed: ${paths.gameAddon}`,
      `secret scan completed: ${paths.contentAddon}`,
      `release blockers: ${blockers.length}`,
      "release warnings: 4",
      "dry-run release report generated",
      "no package archive created",
      "no content encryption performed",
      "no Workshop upload attempted",
      "release dry run is not runtime validation",
      ...blockers
    ],
    warnings: [
      "Steam login is manual and out of scope",
      "content encryption is manual and out of scope",
      "Workshop upload is not performed by dry run",
      "dry run does not prove runtime validation"
    ],
    paths,
    commands: [],
    logs: []
  };
}

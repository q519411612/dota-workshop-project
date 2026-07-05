import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAddon } from "../src/addon.js";
import { inspectWorkshopPreflight } from "../src/preflight.js";
import { InspectWorkshopPreflightInputSchema } from "../src/schemas.js";
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
});

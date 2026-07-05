import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { prepareCustomMap } from "../src/map.js";
import { PrepareCustomMapInputSchema } from "../src/schemas.js";
import { handleTool, toolNames } from "../src/tools.js";

describe("custom map preparation", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-map-"));
    await mkdir(join(root, "content/dota_addons/addon_template/maps"), { recursive: true });
    await mkdir(join(root, "game/bin/win64"), { recursive: true });
    await mkdir(join(root, "game/dota"), { recursive: true });
    await writeFile(join(root, "game/bin/win64/resourcecompiler.exe"), "");
    await writeFile(join(root, "game/dota/gameinfo.gi"), "");
    await writeTemplateMap("info_player_start_goodguys\ninfo_player_start_badguys\n");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("exposes prepare_custom_map schema and dispatcher contract", async () => {
    const parsed = PrepareCustomMapInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo_map"
    });

    expect(parsed.mapName).toBe("demo_map");
    expect(toolNames).toContain("prepare_custom_map");

    const result = await handleTool("prepare_custom_map", {
      target: { kind: "fixture", root },
      addonName: "BadAddon",
      mapName: "demo_map"
    });

    expect(result.ok).toBe(false);
    expect(result.operation).toBe("prepare_custom_map");
    expect(result.error?.code).toBe("INVALID_ADDON_NAME");
    expect(result.commands).toHaveLength(0);
  });

  test("copies a template map, verifies spawn markers, and compiles the copied source", async () => {
    const result = await prepareCustomMap({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo_map",
      executor: async (command) => {
        expect(command.command).toContain("resourcecompiler.exe");
        expect(command.command).toContain("demo_map.vmap");
        const compiledMap = join(root, "game/dota_addons/demo_addon/maps/demo_map.vpk");
        await mkdir(dirname(compiledMap), { recursive: true });
        await writeFile(compiledMap, "compiled");
        return { exitCode: 0, stdout: "compiled ok", stderr: "" };
      }
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("prepared custom map source for demo_addon/demo_map");
    expect(result.evidence).toContain("found spawn entity marker: info_player_start_goodguys");
    expect(result.evidence).toContain("found spawn entity marker: info_player_start_badguys");
    expect(result.evidence).toContain("compiled custom map with resourcecompiler");
    expect(result.paths.templateMap).toContain("addon_template");
    expect(result.paths.contentMap).toContain("demo_addon");
    expect(result.paths.compiledMap).toContain("demo_map.vpk");
    expect(result.commands[0].exitCode).toBe(0);
    await expect(readFile(join(root, "content/dota_addons/demo_addon/maps/demo_map.vmap"), "utf8"))
      .resolves.toContain("info_player_start_goodguys");
  });

  test("refuses to overwrite an existing destination map unless replacement is requested", async () => {
    const destination = join(root, "content/dota_addons/demo_addon/maps/demo_map.vmap");
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, "existing");

    const result = await prepareCustomMap({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo_map"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CUSTOM_MAP_ALREADY_EXISTS");
    expect(result.evidence).toContain("custom map source already exists: demo_map");
    expect(result.commands).toHaveLength(0);
  });

  test("fails explicitly when a copied map is missing a required spawn marker", async () => {
    await writeTemplateMap("info_player_start_goodguys\n");

    const result = await prepareCustomMap({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo_map",
      executor: async () => {
        throw new Error("compiler should not run without spawn evidence");
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CUSTOM_MAP_SPAWN_MARKER_MISSING");
    expect(result.evidence).toContain("missing spawn entity marker: info_player_start_badguys");
    expect(result.commands).toHaveLength(0);
  });

  test("fails explicitly when resourcecompiler is missing", async () => {
    await rm(join(root, "game/bin/win64/resourcecompiler.exe"), { force: true });

    const result = await prepareCustomMap({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo_map"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CUSTOM_MAP_COMPILER_MISSING");
    expect(result.evidence).toContain("missing resourcecompiler.exe");
    expect(result.commands).toHaveLength(0);
  });

  async function writeTemplateMap(content: string): Promise<void> {
    await writeFile(join(root, "content/dota_addons/addon_template/maps/template_map.vmap"), content);
  }
});

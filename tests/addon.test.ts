import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAddon, inspectAddon, validateAddonName } from "../src/addon.js";

describe("addon template", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-addon-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("validates Dota-safe addon names", () => {
    expect(validateAddonName("demo_addon_01").ok).toBe(true);
    expect(validateAddonName("DemoAddon").ok).toBe(false);
    expect(validateAddonName("../demo").ok).toBe(false);
    expect(validateAddonName("demo-addon").ok).toBe(false);
  });

  test("creates the minimal game and content addon trees", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo_map"
    });

    expect(result.ok).toBe(true);
    expect(result.paths.gameAddon).toBe(join(root, "game/dota_addons/demo_addon"));
    expect(result.paths.contentAddon).toBe(join(root, "content/dota_addons/demo_addon"));
    expect(result.evidence).toContain("created Lua validation marker for demo_addon");

    const lua = await readFile(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"), "utf8");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] addon loaded: demo_addon");

    const addonInfo = await readFile(join(root, "game/dota_addons/demo_addon/addoninfo.txt"), "utf8");
    expect(addonInfo).toContain("\"DefaultMap\" \"demo_map\"");
  });

  test("refuses to overwrite existing addon roots by default", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("ADDON_ALREADY_EXISTS");
    expect(result.evidence.join("\n")).toContain("game addon root exists");
  });

  test("inspects addon roots without modifying them", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    const result = await inspectAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("game addon root exists");
    expect(result.evidence).toContain("content addon root exists");
  });
});

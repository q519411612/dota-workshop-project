import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAddon, inspectAddon, validateAddonName, validateMapName } from "../src/addon.js";

describe("addon template", () => {
  let root: string;
  const gameplayMarkers = [
    "[DOTA_WORKSHOP_MCP] addon loaded: demo_addon",
    "[DOTA_WORKSHOP_MCP] gamemode initialized: demo_addon",
    "[DOTA_WORKSHOP_MCP] round started: demo_addon",
    "[DOTA_WORKSHOP_MCP] score updated: demo_addon",
    "[DOTA_WORKSHOP_MCP] win condition reached: demo_addon"
  ];

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

  test("validates Dota-safe map names", () => {
    expect(validateMapName("dota").ok).toBe(true);
    expect(validateMapName("overthrow/forest_solo").ok).toBe(true);
    expect(validateMapName("../demo").ok).toBe(false);
    expect(validateMapName("demo map").ok).toBe(false);
    expect(validateMapName("demo;Start-Process").ok).toBe(false);
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

  test("creates a playable gameplay loop by default", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "dota"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("created playable gameplay loop for demo_addon");

    const lua = await readFile(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"), "utf8");
    expect(lua).toContain("function Precache(context)");
    expect(lua).toContain("function Activate()");
    expect(lua).toContain("ListenToGameEvent(\"game_rules_state_change\"");
    expect(lua).toContain("ListenToGameEvent(\"entity_killed\"");
    expect(lua).toContain("SetContextThink");
    expect(lua).toContain("GameRules:SetGameWinner");
    for (const marker of gameplayMarkers) {
      expect(lua).toContain(marker);
    }

    const unitData = await readFile(join(root, "game/dota_addons/demo_addon/scripts/npc/npc_units_custom.txt"), "utf8");
    expect(unitData).toContain("\"DOTAUnits\"");
  });

  test("configures playable runtime to advance without manual hero selection", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "dota"
    });

    const lua = await readFile(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"), "utf8");
    expect(lua).toContain("GameRules:EnableCustomGameSetupAutoLaunch(true)");
    expect(lua).toContain("GameRules:SetCustomGameSetupAutoLaunchDelay(0)");
    expect(lua).toContain("GameRules:LockCustomGameSetupTeamAssignment(true)");
    expect(lua).toContain("GameRules:SetHeroSelectionTime(0)");
    expect(lua).toContain("GameRules:SetStrategyTime(0)");
    expect(lua).toContain("GameRules:SetShowcaseTime(0)");
    expect(lua).toContain("GameRules:SetPreGameTime(0)");

    const heroList = await readFile(join(root, "game/dota_addons/demo_addon/scripts/npc/herolist.txt"), "utf8");
    expect(heroList).toContain("\"npc_dota_hero_lina\" \"1\"");
  });

  test("can still create a marker-only minimal template", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      template: "minimal"
    });

    const lua = await readFile(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"), "utf8");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] addon loaded: demo_addon");
    expect(lua).not.toContain("gamemode initialized");
  });

  test("refuses unsafe map names before writing addon metadata", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "demo map"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_MAP_NAME");
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
    expect(result.evidence).toContain("playable gameplay markers exist");
    expect(result.evidence).toContain("unit support file exists");
  });
});

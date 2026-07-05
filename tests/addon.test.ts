import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAddon, inspectAddon, validateAddonName, validateMapName } from "../src/addon.js";
import { CreateAddonInputSchema, RunPlayableSmokeInputSchema } from "../src/schemas.js";

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

  test("parses runtime placement through MCP input schemas", () => {
    const placement = {
      unitName: "npc_dota_creep_badguys_melee",
      team: "badguys" as const,
      origin: { x: 128, y: -64, z: 256 }
    };

    const createInput = CreateAddonInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      placement
    });
    const smokeInput = RunPlayableSmokeInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      placement
    });

    expect(createInput.placement?.origin.x).toBe(128);
    expect(smokeInput.placement?.unitName).toBe("npc_dota_creep_badguys_melee");
  });

  test("parses score objective through MCP input schemas", () => {
    const objective = {
      type: "score" as const,
      targetScore: 2,
      tickIntervalSeconds: 1
    };

    const createInput = CreateAddonInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      objective
    });
    const smokeInput = RunPlayableSmokeInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      objective
    });

    expect(createInput.objective?.targetScore).toBe(2);
    expect(smokeInput.objective?.tickIntervalSeconds).toBe(1);
  });

  test("parses unit ability scaffold through MCP input schemas", () => {
    const unitAbilityScaffold = {
      unitName: "npc_dota_workshop_mcp_dummy",
      abilityName: "ability_dota_workshop_mcp_dummy"
    };

    const createInput = CreateAddonInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold
    });
    const smokeInput = RunPlayableSmokeInputSchema.parse({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold
    });

    expect(createInput.unitAbilityScaffold?.unitName).toBe("npc_dota_workshop_mcp_dummy");
    expect(smokeInput.unitAbilityScaffold?.abilityName).toBe("ability_dota_workshop_mcp_dummy");
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
    const abilityData = await readFile(join(root, "game/dota_addons/demo_addon/scripts/npc/npc_abilities_custom.txt"), "utf8");
    expect(abilityData).toContain("\"DOTAAbilities\"");
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

  test("renders configured runtime placement markers in playable Lua", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "dota",
      placement: {
        unitName: "npc_dota_creep_badguys_melee",
        team: "badguys",
        origin: { x: 128, y: -64, z: 256 }
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("created runtime placement config for demo_addon");

    const lua = await readFile(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"), "utf8");
    expect(lua).toContain("self.placementOrigin = Vector(128, -64, 256)");
    expect(lua).toContain("self.placementUnitName = \"npc_dota_creep_badguys_melee\"");
    expect(lua).toContain("self.placementTeam = DOTA_TEAM_BADGUYS");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] placement configured: demo_addon");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] placement origin: demo_addon x=128 y=-64 z=256");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] placement unit: demo_addon npc_dota_creep_badguys_melee team=badguys");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] placement spawned: demo_addon");
  });

  test("renders configured score objective markers in playable Lua", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      mapName: "dota",
      objective: {
        type: "score",
        targetScore: 2,
        tickIntervalSeconds: 1
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("created score objective config for demo_addon");

    const lua = await readFile(join(root, "game/dota_addons/demo_addon/scripts/vscripts/addon_game_mode.lua"), "utf8");
    expect(lua).toContain("self.objectiveType = \"score\"");
    expect(lua).toContain("self.targetScore = 2");
    expect(lua).toContain("return 1");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] objective configured: demo_addon type=score target=2");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] objective progress: demo_addon");
    expect(lua).toContain("[DOTA_WORKSHOP_MCP] objective complete: demo_addon type=score");
  });

  test("renders configured unit ability scaffold files", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold: {
        unitName: "npc_dota_workshop_mcp_dummy",
        abilityName: "ability_dota_workshop_mcp_dummy"
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("created unit ability scaffold for demo_addon");

    const unitData = await readFile(join(root, "game/dota_addons/demo_addon/scripts/npc/npc_units_custom.txt"), "utf8");
    const abilityData = await readFile(join(root, "game/dota_addons/demo_addon/scripts/npc/npc_abilities_custom.txt"), "utf8");

    expect(unitData).toContain("\"npc_dota_workshop_mcp_dummy\"");
    expect(unitData).toContain("\"Ability1\" \"ability_dota_workshop_mcp_dummy\"");
    expect(abilityData).toContain("\"DOTAAbilities\"");
    expect(abilityData).toContain("\"ability_dota_workshop_mcp_dummy\"");
    expect(abilityData).toContain("\"AbilityBehavior\" \"DOTA_ABILITY_BEHAVIOR_PASSIVE\"");
  });

  test("rejects invalid runtime placement before writing addon files", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      placement: {
        unitName: "../bad",
        team: "badguys",
        origin: { x: 0, y: 0, z: 256 }
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_PLACEMENT");
    expect(result.evidence).toContain("rejected placement unit name: ../bad");
  });

  test("rejects runtime placement on marker-only minimal template", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      template: "minimal",
      placement: {
        unitName: "npc_dota_creep_badguys_melee",
        team: "badguys",
        origin: { x: 0, y: 0, z: 256 }
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_PLACEMENT");
    expect(result.evidence).toContain("runtime placement requires the playable template");
  });

  test("rejects invalid score objective before writing addon files", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      objective: {
        type: "score",
        targetScore: 0,
        tickIntervalSeconds: 1
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_OBJECTIVE");
    expect(result.evidence).toContain("rejected objective target score: 0");
  });

  test("rejects score objective on marker-only minimal template", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      template: "minimal",
      objective: {
        type: "score",
        targetScore: 2
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_OBJECTIVE");
    expect(result.evidence).toContain("score objective requires the playable template");
  });

  test("rejects invalid unit ability scaffold before writing addon files", async () => {
    const result = await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold: {
        unitName: "bad_unit",
        abilityName: "ability_dota_workshop_mcp_dummy"
      }
    } as Parameters<typeof createAddon>[0]);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_SCAFFOLD");
    expect(result.evidence).toContain("rejected scaffold unit name: bad_unit");
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
    expect(result.evidence).toContain("ability support file exists");
    expect(result.evidence).toContain("unit ability scaffold missing");
  });

  test("inspects runtime placement evidence when present", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      placement: {
        unitName: "npc_dota_creep_badguys_melee",
        team: "badguys",
        origin: { x: 128, y: -64, z: 256 }
      }
    } as Parameters<typeof createAddon>[0]);

    const result = await inspectAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("runtime placement config exists");
    expect(result.evidence).toContain("runtime placement markers exist");
  });

  test("inspects score objective evidence when present", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      objective: {
        type: "score",
        targetScore: 2,
        tickIntervalSeconds: 1
      }
    } as Parameters<typeof createAddon>[0]);

    const result = await inspectAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("score objective config exists");
    expect(result.evidence).toContain("score objective markers exist");
  });

  test("inspects unit ability scaffold evidence when present", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold: {
        unitName: "npc_dota_workshop_mcp_dummy",
        abilityName: "ability_dota_workshop_mcp_dummy"
      }
    } as Parameters<typeof createAddon>[0]);

    const result = await inspectAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("ability support file exists");
    expect(result.evidence).toContain("unit ability scaffold exists");
  });

  test("does not report scaffold evidence when unit ability link is missing", async () => {
    await createAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon",
      unitAbilityScaffold: {
        unitName: "npc_dota_workshop_mcp_dummy",
        abilityName: "ability_dota_workshop_mcp_dummy"
      }
    } as Parameters<typeof createAddon>[0]);

    await writeFile(
      join(root, "game/dota_addons/demo_addon/scripts/npc/npc_abilities_custom.txt"),
      `"DOTAAbilities"\n{\n  "ability_unlinked_dummy"\n  {\n    "AbilityBehavior" "DOTA_ABILITY_BEHAVIOR_PASSIVE"\n  }\n}\n`
    );

    const result = await inspectAddon({
      target: { kind: "fixture", root },
      addonName: "demo_addon"
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("unit ability scaffold missing");
  });
});

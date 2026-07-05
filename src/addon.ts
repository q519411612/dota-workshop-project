import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { Target, ToolResult } from "./types.js";

export type AddonNameValidation = {
  ok: boolean;
  error?: string;
};

export type AddonTemplateKind = "minimal" | "playable";
export type RuntimePlacementTeam = "goodguys" | "badguys" | "neutral";

export type RuntimePlacement = {
  unitName: string;
  team: RuntimePlacementTeam;
  origin: {
    x: number;
    y: number;
    z: number;
  };
};

export type GameplayObjective = {
  type: "score";
  targetScore?: number;
  tickIntervalSeconds?: number;
};

export type CreateAddonInput = {
  target: Target;
  addonName: string;
  mapName?: string;
  template?: AddonTemplateKind;
  placement?: RuntimePlacement;
  objective?: GameplayObjective;
  replace?: boolean;
};

export type InspectAddonInput = {
  target: Target;
  addonName: string;
};

export function validateAddonName(addonName: string): AddonNameValidation {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(addonName)) {
    return {
      ok: false,
      error: "Addon names must start with a lowercase letter and contain only lowercase letters, digits, and underscores."
    };
  }

  return { ok: true };
}

export function validateMapName(mapName: string): AddonNameValidation {
  if (
    !/^[A-Za-z0-9_/-]{1,128}$/.test(mapName) ||
    mapName.startsWith("/") ||
    mapName.endsWith("/") ||
    mapName.includes("//") ||
    mapName.includes("..")
  ) {
    return {
      ok: false,
      error: "Map names must be 1-128 characters and contain only letters, digits, underscores, hyphens, and forward slashes."
    };
  }

  return { ok: true };
}

export function validateRuntimePlacement(placement: RuntimePlacement): AddonNameValidation {
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(placement.unitName)) {
    return {
      ok: false,
      error: `rejected placement unit name: ${placement.unitName}`
    };
  }

  if (!["goodguys", "badguys", "neutral"].includes(placement.team)) {
    return {
      ok: false,
      error: `rejected placement team: ${placement.team}`
    };
  }

  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isFinite(placement.origin[axis])) {
      return {
        ok: false,
        error: `rejected placement origin ${axis}: ${placement.origin[axis]}`
      };
    }
  }

  return { ok: true };
}

export function validateGameplayObjective(objective: GameplayObjective): AddonNameValidation {
  if (objective.type !== "score") {
    return {
      ok: false,
      error: `rejected objective type: ${objective.type}`
    };
  }

  if (
    objective.targetScore !== undefined &&
    (!Number.isInteger(objective.targetScore) || objective.targetScore < 1 || objective.targetScore > 99)
  ) {
    return {
      ok: false,
      error: `rejected objective target score: ${objective.targetScore}`
    };
  }

  if (
    objective.tickIntervalSeconds !== undefined &&
    (!Number.isFinite(objective.tickIntervalSeconds) || objective.tickIntervalSeconds <= 0 || objective.tickIntervalSeconds > 60)
  ) {
    return {
      ok: false,
      error: `rejected objective tick interval: ${objective.tickIntervalSeconds}`
    };
  }

  return { ok: true };
}

export async function createAddon(input: CreateAddonInput): Promise<ToolResult> {
  const operation = "create_addon";
  const nameValidation = validateAddonName(input.addonName);

  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      },
      evidence: [`rejected addon name: ${input.addonName}`]
    });
  }

  const mapName = input.mapName ?? "dota";
  const template = input.template ?? "playable";
  const mapValidation = validateMapName(mapName);
  if (!mapValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_MAP_NAME",
        message: mapValidation.error ?? "Invalid map name."
      },
      evidence: [`rejected map name: ${mapName}`]
    });
  }

  if (input.placement) {
    if (template !== "playable") {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "INVALID_PLACEMENT",
          message: "Runtime placement requires the playable template."
        },
        evidence: ["runtime placement requires the playable template"]
      });
    }

    const placementValidation = validateRuntimePlacement(input.placement);
    if (!placementValidation.ok) {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "INVALID_PLACEMENT",
          message: placementValidation.error ?? "Invalid runtime placement."
        },
        evidence: [placementValidation.error ?? "rejected runtime placement"]
      });
    }
  }

  if (input.objective) {
    if (template !== "playable") {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "INVALID_OBJECTIVE",
          message: "Score objective requires the playable template."
        },
        evidence: ["score objective requires the playable template"]
      });
    }

    const objectiveValidation = validateGameplayObjective(input.objective);
    if (!objectiveValidation.ok) {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "INVALID_OBJECTIVE",
          message: objectiveValidation.error ?? "Invalid gameplay objective."
        },
        evidence: [objectiveValidation.error ?? "rejected gameplay objective"]
      });
    }
  }

  const root = targetRoot(input.target);
  if (!root) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "TARGET_ROOT_REQUIRED",
        message: "Addon generation requires a fixture root or target Dota root."
      }
    });
  }

  const paths = addonPaths(root, input.addonName);
  const existing = await existingAddonEvidence(paths);

  if (existing.length > 0 && !input.replace) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "ADDON_ALREADY_EXISTS",
        message: "Addon roots already exist. Explicit replacement is required before overwriting."
      },
      evidence: existing,
      paths
    });
  }

  if (input.replace) {
    await rm(paths.gameAddon, { recursive: true, force: true });
    await rm(paths.contentAddon, { recursive: true, force: true });
  }

  await writeAddon(paths, input.addonName, mapName, template, input.placement, input.objective);

  return createSuccessResult({
    target: input.target,
    operation,
    evidence: [
      `created game addon root for ${input.addonName}`,
      `created content addon root for ${input.addonName}`,
      `created Lua validation marker for ${input.addonName}`,
      `created addon metadata with default map ${mapName}`,
      template === "playable"
        ? `created playable gameplay loop for ${input.addonName}`
        : `created minimal runtime marker template for ${input.addonName}`,
      ...(input.placement ? [`created runtime placement config for ${input.addonName}`] : []),
      ...(input.objective ? [`created score objective config for ${input.addonName}`] : [])
    ],
    paths
  });
}

export async function inspectAddon(input: InspectAddonInput): Promise<ToolResult> {
  const operation = "inspect_addon";
  const nameValidation = validateAddonName(input.addonName);

  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      },
      evidence: [`rejected addon name: ${input.addonName}`]
    });
  }

  const root = targetRoot(input.target);
  if (!root) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "TARGET_ROOT_REQUIRED",
        message: "Addon inspection requires a fixture root or target Dota root."
      }
    });
  }

  const paths = addonPaths(root, input.addonName);
  const evidence: string[] = [];
  evidence.push(await pathExists(paths.gameAddon) ? "game addon root exists" : "game addon root missing");
  evidence.push(await pathExists(paths.contentAddon) ? "content addon root exists" : "content addon root missing");

  const luaPath = join(paths.gameAddon, "scripts/vscripts/addon_game_mode.lua");
  if (await pathExists(luaPath)) {
    const lua = await readFile(luaPath, "utf8");
    evidence.push(lua.includes(`[DOTA_WORKSHOP_MCP] addon loaded: ${input.addonName}`)
      ? "Lua validation marker exists"
      : "Lua validation marker missing");
    evidence.push(playableMarkers(input.addonName).every((marker) => lua.includes(marker))
      ? "playable gameplay markers exist"
      : "playable gameplay markers missing");
    evidence.push(lua.includes("self.placementOrigin = Vector(") && lua.includes("self.placementUnitName = ")
      ? "runtime placement config exists"
      : "runtime placement config missing");
    evidence.push(lua.includes(`[DOTA_WORKSHOP_MCP] placement configured: ${input.addonName}`) &&
      lua.includes(`[DOTA_WORKSHOP_MCP] placement spawned: ${input.addonName}`)
      ? "runtime placement markers exist"
      : "runtime placement markers missing");
    evidence.push(lua.includes("self.objectiveType = \"score\"")
      ? "score objective config exists"
      : "score objective config missing");
    evidence.push(lua.includes(`[DOTA_WORKSHOP_MCP] objective configured: ${input.addonName}`) &&
      lua.includes(`[DOTA_WORKSHOP_MCP] objective complete: ${input.addonName}`)
      ? "score objective markers exist"
      : "score objective markers missing");
  }

  evidence.push(await pathExists(paths.unitData) ? "unit support file exists" : "unit support file missing");

  return createSuccessResult({
    target: input.target,
    operation,
    evidence,
    paths: { ...paths, luaEntry: luaPath }
  });
}

function targetRoot(target: Target): string | undefined {
  if (target.kind === "fixture") {
    return target.root;
  }

  if (target.kind === "local" || target.kind === "remote") {
    return target.dotaRoot;
  }

  return undefined;
}

function addonPaths(root: string, addonName: string): Record<string, string> {
  const gameAddon = join(root, "game/dota_addons", addonName);
  const contentAddon = join(root, "content/dota_addons", addonName);

  return {
    dotaRoot: root,
    gameAddon,
    contentAddon,
    luaEntry: join(gameAddon, "scripts/vscripts/addon_game_mode.lua"),
    addonInfo: join(gameAddon, "addoninfo.txt"),
    heroList: join(gameAddon, "scripts/npc/herolist.txt"),
    heroData: join(gameAddon, "scripts/npc/npc_heroes_custom.txt"),
    unitData: join(gameAddon, "scripts/npc/npc_units_custom.txt"),
    localization: join(gameAddon, `resource/addon_${addonName}_english.txt`),
    mapDirectory: join(contentAddon, "maps")
  };
}

async function existingAddonEvidence(paths: Record<string, string>): Promise<string[]> {
  const evidence: string[] = [];

  if (await pathExists(paths.gameAddon)) {
    evidence.push("game addon root exists");
  }

  if (await pathExists(paths.contentAddon)) {
    evidence.push("content addon root exists");
  }

  return evidence;
}

async function writeAddon(
  paths: Record<string, string>,
  addonName: string,
  mapName: string,
  template: AddonTemplateKind,
  placement?: RuntimePlacement,
  objective?: GameplayObjective
): Promise<void> {
  const files = renderAddonFiles(addonName, mapName, template, placement, objective);

  await mkdir(join(paths.gameAddon, "scripts/vscripts"), { recursive: true });
  await mkdir(join(paths.gameAddon, "scripts/npc"), { recursive: true });
  await mkdir(join(paths.gameAddon, "resource"), { recursive: true });
  await mkdir(paths.mapDirectory, { recursive: true });

  await writeFile(paths.addonInfo, files.addonInfo);
  await writeFile(paths.luaEntry, files.luaEntry);
  await writeFile(paths.heroList, files.heroList);
  await writeFile(paths.heroData, files.heroData);
  await writeFile(paths.unitData, files.unitData);
  await writeFile(paths.localization, files.localization);
}

export type RenderedAddonFiles = {
  addonInfo: string;
  luaEntry: string;
  heroList: string;
  heroData: string;
  unitData: string;
  localization: string;
};

export function renderAddonFiles(
  addonName: string,
  mapName: string,
  template: AddonTemplateKind = "playable",
  placement?: RuntimePlacement,
  objective?: GameplayObjective
): RenderedAddonFiles {
  return {
    addonInfo: addonInfo(addonName, mapName),
    luaEntry: template === "playable" ? playableLuaEntry(addonName, placement, objective) : minimalLuaEntry(addonName),
    heroList: heroList(),
    heroData: heroData(),
    unitData: unitData(),
    localization: localization(addonName)
  };
}

export function playableMarkers(addonName: string): string[] {
  return [
    `[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] gamemode initialized: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] round started: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] score updated: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] win condition reached: ${addonName}`
  ];
}

export function objectiveMarkers(addonName: string, objective: GameplayObjective): string[] {
  const normalized = normalizeObjective(objective);
  return [
    `[DOTA_WORKSHOP_MCP] objective configured: ${addonName} type=score target=${normalized.targetScore}`,
    `[DOTA_WORKSHOP_MCP] objective progress: ${addonName} 1/${normalized.targetScore} source=think`,
    `[DOTA_WORKSHOP_MCP] objective complete: ${addonName} type=score`
  ];
}

export function placementMarkers(addonName: string, placement: RuntimePlacement): string[] {
  return [
    `[DOTA_WORKSHOP_MCP] placement configured: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] placement origin: ${addonName} x=${formatLuaNumber(placement.origin.x)} y=${formatLuaNumber(placement.origin.y)} z=${formatLuaNumber(placement.origin.z)}`,
    `[DOTA_WORKSHOP_MCP] placement unit: ${addonName} ${placement.unitName} team=${placement.team}`,
    `[DOTA_WORKSHOP_MCP] placement spawned: ${addonName} ${placement.unitName}`
  ];
}

function addonInfo(addonName: string, mapName: string): string {
  return `"AddonInfo"\n{\n  "AddonName" "${addonName}"\n  "IsPlayable" "1"\n  "DefaultMap" "${mapName}"\n  "maps" "${mapName}"\n  "MinPlayers" "1"\n  "MaxPlayers" "10"\n}\n`;
}

function minimalLuaEntry(addonName: string): string {
  return `function Precache(context)\nend\n\nfunction Activate()\n  print("[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}")\nend\n`;
}

function playableLuaEntry(addonName: string, placement?: RuntimePlacement, objective?: GameplayObjective): string {
  const spawn = placement ?? {
    unitName: "npc_dota_creep_badguys_melee",
    team: "badguys" as const,
    origin: { x: 0, y: 0, z: 256 }
  };
  const scoreObjective = objective ? normalizeObjective(objective) : undefined;
  const targetScore = scoreObjective?.targetScore ?? 3;
  const tickIntervalSeconds = scoreObjective?.tickIntervalSeconds ?? 3;
  const teamConstant = placementTeamConstant(spawn.team);
  const placementInit = placement ? `
  self.placementOrigin = Vector(${formatLuaNumber(spawn.origin.x)}, ${formatLuaNumber(spawn.origin.y)}, ${formatLuaNumber(spawn.origin.z)})
  self.placementUnitName = "${spawn.unitName}"
  self.placementTeam = ${teamConstant}
  print("[DOTA_WORKSHOP_MCP] placement configured: ${addonName}")
  print("[DOTA_WORKSHOP_MCP] placement origin: ${addonName} x=${formatLuaNumber(spawn.origin.x)} y=${formatLuaNumber(spawn.origin.y)} z=${formatLuaNumber(spawn.origin.z)}")
  print("[DOTA_WORKSHOP_MCP] placement unit: ${addonName} ${spawn.unitName} team=${spawn.team}")
` : "";
  const objectiveInit = scoreObjective ? `
  self.objectiveType = "score"
  print("[DOTA_WORKSHOP_MCP] objective configured: ${addonName} type=score target=${formatLuaNumber(scoreObjective.targetScore)}")
` : "";
  const objectiveProgress = scoreObjective
    ? `  print("[DOTA_WORKSHOP_MCP] objective progress: ${addonName} " .. tostring(self.score) .. "/" .. tostring(self.targetScore) .. " source=" .. source)`
    : "";
  const objectiveComplete = scoreObjective
    ? `  print("[DOTA_WORKSHOP_MCP] objective complete: ${addonName} type=score")`
    : "";
  const spawnBody = placement
    ? `  local unit = CreateUnitByName(self.placementUnitName, self.placementOrigin, true, nil, nil, self.placementTeam)
  print("[DOTA_WORKSHOP_MCP] placement spawned: ${addonName} " .. unit:GetUnitName())`
    : `  local unit = CreateUnitByName("npc_dota_creep_badguys_melee", Vector(0, 0, 256), true, nil, nil, DOTA_TEAM_BADGUYS)
  print("[DOTA_WORKSHOP_MCP] target spawned: ${addonName} " .. unit:GetUnitName())`;
  const extraPrecache = spawn.unitName === "npc_dota_creep_badguys_melee"
    ? ""
    : `  PrecacheUnitByNameSync("${spawn.unitName}", context)\n`;

  return `if DotaWorkshopMcpGameMode == nil then
  DotaWorkshopMcpGameMode = class({})
end

function Precache(context)
  PrecacheUnitByNameSync("npc_dota_creep_badguys_melee", context)
${extraPrecache}
  PrecacheUnitByNameSync("npc_dota_hero_lina", context)
end

function Activate()
  GameRules.DotaWorkshopMcpGameMode = DotaWorkshopMcpGameMode()
  GameRules.DotaWorkshopMcpGameMode:InitGameMode()
end

function DotaWorkshopMcpGameMode:InitGameMode()
  self.score = 0
  self.targetScore = ${formatLuaNumber(targetScore)}
  self.roundStarted = false
  self.winReached = false

  print("[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}")
  print("[DOTA_WORKSHOP_MCP] gamemode initialized: ${addonName}")
${placementInit}
${objectiveInit}

  GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_GOODGUYS, 1)
  GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_BADGUYS, 0)
  GameRules:EnableCustomGameSetupAutoLaunch(true)
  GameRules:SetCustomGameSetupAutoLaunchDelay(0)
  GameRules:LockCustomGameSetupTeamAssignment(true)
  GameRules:SetHeroSelectionTime(0)
  GameRules:SetStrategyTime(0)
  GameRules:SetShowcaseTime(0)
  GameRules:SetPreGameTime(0)

  ListenToGameEvent("game_rules_state_change", Dynamic_Wrap(DotaWorkshopMcpGameMode, "OnGameRulesStateChange"), self)
  ListenToGameEvent("entity_killed", Dynamic_Wrap(DotaWorkshopMcpGameMode, "OnEntityKilled"), self)

  GameRules:GetGameModeEntity():SetContextThink("DotaWorkshopMcpThink", function()
    return self:OnThink()
  end, 1.0)
end

function DotaWorkshopMcpGameMode:OnGameRulesStateChange()
  if GameRules:State_Get() == DOTA_GAMERULES_STATE_GAME_IN_PROGRESS then
    self:StartRound()
  end
end

function DotaWorkshopMcpGameMode:OnEntityKilled(keys)
  self:AddScore("entity_killed")
end

function DotaWorkshopMcpGameMode:OnThink()
  if GameRules:State_Get() ~= DOTA_GAMERULES_STATE_GAME_IN_PROGRESS then
    return 1.0
  end

  if not self.roundStarted then
    self:StartRound()
  end

  if self.score < self.targetScore then
    self:AddScore("think")
    return ${formatLuaNumber(tickIntervalSeconds)}
  end

  if not self.winReached then
    self:FinishRound()
  end

  return nil
end

function DotaWorkshopMcpGameMode:StartRound()
  if self.roundStarted then
    return
  end

  self.roundStarted = true
  print("[DOTA_WORKSHOP_MCP] round started: ${addonName}")
  self:SpawnTarget()
end

function DotaWorkshopMcpGameMode:SpawnTarget()
${spawnBody}
end

function DotaWorkshopMcpGameMode:AddScore(source)
  if self.winReached then
    return
  end

  self.score = self.score + 1
  print("[DOTA_WORKSHOP_MCP] score updated: ${addonName} " .. tostring(self.score) .. "/" .. tostring(self.targetScore) .. " source=" .. source)
${objectiveProgress}

  if self.score >= self.targetScore then
    self:FinishRound()
  end
end

function DotaWorkshopMcpGameMode:FinishRound()
  if self.winReached then
    return
  end

  self.winReached = true
${objectiveComplete}
  print("[DOTA_WORKSHOP_MCP] win condition reached: ${addonName}")
  GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)
end
`;
}

function placementTeamConstant(team: RuntimePlacementTeam): string {
  if (team === "goodguys") {
    return "DOTA_TEAM_GOODGUYS";
  }

  if (team === "neutral") {
    return "DOTA_TEAM_NEUTRALS";
  }

  return "DOTA_TEAM_BADGUYS";
}

function formatLuaNumber(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

function normalizeObjective(objective: GameplayObjective): Required<GameplayObjective> {
  return {
    type: "score",
    targetScore: objective.targetScore ?? 3,
    tickIntervalSeconds: objective.tickIntervalSeconds ?? 3
  };
}

function heroList(): string {
  return `"CustomHeroList"\n{\n  "npc_dota_hero_lina" "1"\n}\n`;
}

function heroData(): string {
  return `"DOTAHeroes"\n{\n}\n`;
}

function unitData(): string {
  return `"DOTAUnits"\n{\n}\n`;
}

function localization(addonName: string): string {
  return `"lang"\n{\n  "Language" "english"\n  "Tokens"\n  {\n    "addon_game_name" "${addonName}"\n  }\n}\n`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

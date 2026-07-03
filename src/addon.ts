import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { Target, ToolResult } from "./types.js";

export type AddonNameValidation = {
  ok: boolean;
  error?: string;
};

export type CreateAddonInput = {
  target: Target;
  addonName: string;
  mapName?: string;
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

  await writeMinimalAddon(paths, input.addonName, mapName);

  return createSuccessResult({
    target: input.target,
    operation,
    evidence: [
      `created game addon root for ${input.addonName}`,
      `created content addon root for ${input.addonName}`,
      `created Lua validation marker for ${input.addonName}`,
      `created addon metadata with default map ${mapName}`
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
  }

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

async function writeMinimalAddon(paths: Record<string, string>, addonName: string, mapName: string): Promise<void> {
  await mkdir(join(paths.gameAddon, "scripts/vscripts"), { recursive: true });
  await mkdir(join(paths.gameAddon, "scripts/npc"), { recursive: true });
  await mkdir(join(paths.gameAddon, "resource"), { recursive: true });
  await mkdir(paths.mapDirectory, { recursive: true });

  await writeFile(paths.addonInfo, addonInfo(addonName, mapName));
  await writeFile(paths.luaEntry, luaEntry(addonName));
  await writeFile(paths.heroList, heroList());
  await writeFile(paths.heroData, heroData());
  await writeFile(paths.localization, localization(addonName));
}

function addonInfo(addonName: string, mapName: string): string {
  return `"AddonInfo"\n{\n  "AddonName" "${addonName}"\n  "IsPlayable" "1"\n  "DefaultMap" "${mapName}"\n  "maps" "${mapName}"\n  "MinPlayers" "1"\n  "MaxPlayers" "10"\n}\n`;
}

function luaEntry(addonName: string): string {
  return `function Precache(context)\nend\n\nfunction Activate()\n  print("[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}")\nend\n`;
}

function heroList(): string {
  return `"CustomHeroList"\n{\n}\n`;
}

function heroData(): string {
  return `"DOTAHeroes"\n{\n}\n`;
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

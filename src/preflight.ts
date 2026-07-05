import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { validateAddonName } from "./addon.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { Target, ToolResult } from "./types.js";

export type InspectWorkshopPreflightInput = {
  target: Target;
  addonName: string;
};

const TOOLCHAIN_MARKERS = [
  "package.json",
  "tsconfig.json",
  "tsconfig.tstl.json",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js"
];

const PANORAMA_EXTENSIONS = new Set([".xml", ".js", ".css"]);

export async function inspectWorkshopPreflight(input: InspectWorkshopPreflightInput): Promise<ToolResult> {
  const operation = "inspect_workshop_preflight";
  const nameValidation = validateAddonName(input.addonName);
  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      },
      evidence: [`rejected preflight addon name: ${input.addonName}`]
    });
  }

  const root = targetRoot(input.target);
  if (!root) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "TARGET_ROOT_REQUIRED",
        message: "Workshop preflight requires a fixture root or target Dota root."
      },
      evidence: ["target did not include a Dota root"]
    });
  }

  const paths = preflightPaths(root, input.addonName);
  const evidence = await preflightEvidence(paths);
  const warnings = await preflightWarnings(paths);

  return createSuccessResult({
    target: input.target,
    operation,
    evidence,
    warnings,
    paths
  });
}

function targetRoot(target: Target): string | undefined {
  if (target.kind === "fixture") return target.root;
  if (target.kind === "local") return target.dotaRoot;
  return undefined;
}

function preflightPaths(root: string, addonName: string): Record<string, string> {
  const gameAddon = join(root, "game/dota_addons", addonName);
  const contentAddon = join(root, "content/dota_addons", addonName);

  return {
    gameAddon,
    contentAddon,
    addonInfo: join(gameAddon, "addoninfo.txt"),
    luaEntry: join(gameAddon, "scripts/vscripts/addon_game_mode.lua"),
    localization: join(gameAddon, `resource/addon_${addonName}_english.txt`),
    heroList: join(gameAddon, "scripts/npc/herolist.txt"),
    heroData: join(gameAddon, "scripts/npc/npc_heroes_custom.txt"),
    unitData: join(gameAddon, "scripts/npc/npc_units_custom.txt"),
    abilityData: join(gameAddon, "scripts/npc/npc_abilities_custom.txt"),
    contentMaps: join(contentAddon, "maps"),
    panoramaSource: join(contentAddon, "panorama"),
    panoramaRuntime: join(gameAddon, "panorama"),
    packageJson: join(contentAddon, "package.json")
  };
}

async function preflightEvidence(paths: Record<string, string>): Promise<string[]> {
  const evidence: string[] = [];

  await pushExistsEvidence(evidence, paths.gameAddon, "game addon root");
  await pushExistsEvidence(evidence, paths.contentAddon, "content addon root");
  await pushExistsEvidence(evidence, paths.addonInfo, "addon metadata");
  await pushExistsEvidence(evidence, paths.luaEntry, "lua entry");
  await pushExistsEvidence(evidence, paths.localization, "localization file");
  await pushExistsEvidence(evidence, paths.heroList, "hero list");
  await pushExistsEvidence(evidence, paths.heroData, "hero data");
  await pushExistsEvidence(evidence, paths.unitData, "unit support file");
  await pushExistsEvidence(evidence, paths.abilityData, "ability support file");
  await pushExistsEvidence(evidence, paths.contentMaps, "content maps directory");
  await pushExistsEvidence(evidence, paths.panoramaSource, "panorama source directory");
  await pushExistsEvidence(evidence, paths.panoramaRuntime, "panorama runtime directory");

  if (await pathExists(paths.panoramaSource)) {
    for (const file of await collectPanoramaFiles(paths.contentAddon, paths.panoramaSource)) {
      evidence.push(`panorama source file exists: ${file}`);
    }
  }

  let sawToolchainMarker = false;
  for (const marker of TOOLCHAIN_MARKERS) {
    const markerPath = join(paths.contentAddon, marker);
    if (await pathExists(markerPath)) {
      sawToolchainMarker = true;
      evidence.push(`toolchain marker exists: ${marker}`);
    } else {
      evidence.push(`toolchain marker missing: ${marker}`);
    }
  }

  if (await packageMentionsReact(paths.packageJson)) {
    evidence.push("react panorama marker detected in package.json");
  }

  if (!sawToolchainMarker) {
    evidence.push("toolchain markers absent");
  }

  evidence.push("publishing preflight blockers reported");
  evidence.push("preflight is not runtime validation");

  return evidence;
}

async function preflightWarnings(paths: Record<string, string>): Promise<string[]> {
  const warnings = [
    "publishing credentials are not accepted or inspected",
    "Workshop upload is not supported by preflight",
    "content encryption is not supported by preflight",
    "preflight does not prove runtime validation"
  ];

  if (await hasAnyToolchainMarker(paths.contentAddon)) {
    warnings.push("toolchain markers are inspection-only; builds are not run");
  }

  return warnings;
}

async function pushExistsEvidence(evidence: string[], path: string, label: string): Promise<void> {
  evidence.push(await pathExists(path) ? `${label} exists` : `${label} missing`);
}

async function collectPanoramaFiles(contentAddon: string, root: string): Promise<string[]> {
  const files: string[] = [];
  await collectFiles(root, files);
  return files
    .filter((file) => PANORAMA_EXTENSIONS.has(extname(file)))
    .map((file) => normalizeRelativePath(relative(contentAddon, file)))
    .sort();
}

async function collectFiles(directory: string, files: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join("/");
}

async function hasAnyToolchainMarker(contentAddon: string): Promise<boolean> {
  for (const marker of TOOLCHAIN_MARKERS) {
    if (await pathExists(join(contentAddon, marker))) {
      return true;
    }
  }
  return false;
}

async function packageMentionsReact(path: string): Promise<boolean> {
  if (!(await pathExists(path))) {
    return false;
  }

  const content = await readFile(path, "utf8");
  return /"react"\s*:/.test(content) || /"@moddota\/panorama"/.test(content);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

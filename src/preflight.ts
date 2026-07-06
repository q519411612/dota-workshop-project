import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { validateAddonName } from "./addon.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { Target, ToolResult } from "./types.js";

export type InspectWorkshopPreflightInput = {
  target: Target;
  addonName: string;
};

export type DryRunReleaseReportInput = {
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
const RELEASE_METADATA_KEYS = [
  "addonSteamAppID",
  "addontitle",
  "addonAuthor",
  "addonDescription",
  "addonVersion",
  "DefaultMap",
  "maps"
] as const;
const TEXT_SCAN_EXTENSIONS = new Set([
  ".cfg",
  ".css",
  ".ini",
  ".js",
  ".json",
  ".kv",
  ".lua",
  ".md",
  ".ps1",
  ".ts",
  ".tsx",
  ".txt",
  ".vdf",
  ".xml",
  ".yaml",
  ".yml"
]);
const MAX_SECRET_SCAN_BYTES = 1024 * 1024;
const PLACEHOLDER_VALUES = new Set(["", "changeme", "change me", "placeholder", "tbd", "todo", "unknown", "your name"]);
const SECRET_PATTERNS = [
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { label: "github token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { label: "steam credential", pattern: /\bsteam_(?:password|token|secret|apikey|api_key)\b/i },
  { label: "password", pattern: /(?:\b|_)(?:password|passwd|pwd)\b\s*[:=]/i },
  { label: "token", pattern: /\b(?:token|api[_-]?key|secret)\b\s*[:=]/i },
  { label: "host credential", pattern: /\b(?:remote_|windows_)?(?:host|username)\b\s*[:=].*\b(?:password|token|secret|key)\b/i }
];

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

export async function dryRunReleaseReport(input: DryRunReleaseReportInput): Promise<ToolResult> {
  const operation = "dry_run_release_report";
  const nameValidation = validateAddonName(input.addonName);
  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      },
      evidence: [`rejected release report addon name: ${input.addonName}`]
    });
  }

  const root = targetRoot(input.target);
  if (!root) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "TARGET_ROOT_REQUIRED",
        message: "Release dry run requires a fixture root or target Dota root."
      },
      evidence: ["target did not include a Dota root"]
    });
  }

  const paths = preflightPaths(root, input.addonName);
  const blockers: string[] = [];
  const warnings = releaseBoundaryWarnings();
  const evidence: string[] = [];

  await appendPackageReadiness(evidence, blockers, paths);
  await appendMetadataReadiness(evidence, blockers, paths.addonInfo);
  await appendSecretScan(evidence, blockers, warnings, paths.gameAddon, paths.gameAddon);
  await appendSecretScan(evidence, blockers, warnings, paths.contentAddon, paths.contentAddon);

  evidence.push(`release blockers: ${blockers.length}`);
  evidence.push(`release warnings: ${warnings.length}`);
  evidence.push("dry-run release report generated");
  evidence.push("no package archive created");
  evidence.push("no content encryption performed");
  evidence.push("no Workshop upload attempted");
  evidence.push("release dry run is not runtime validation");
  evidence.push(...blockers);

  const base = {
    target: input.target,
    operation,
    evidence,
    warnings,
    paths
  };

  if (blockers.length > 0) {
    return createFailureResult({
      ...base,
      error: {
        code: "RELEASE_PREFLIGHT_BLOCKED",
        message: "Release dry run found blockers."
      }
    });
  }

  return createSuccessResult(base);
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

function releaseBoundaryWarnings(): string[] {
  return [
    "Steam login is manual and out of scope",
    "content encryption is manual and out of scope",
    "Workshop upload is not performed by dry run",
    "dry run does not prove runtime validation"
  ];
}

async function appendPackageReadiness(evidence: string[], blockers: string[], paths: Record<string, string>): Promise<void> {
  const requiredPaths = [
    ["game addon root", paths.gameAddon],
    ["content addon root", paths.contentAddon],
    ["addon metadata", paths.addonInfo],
    ["lua entry", paths.luaEntry],
    ["localization file", paths.localization],
    ["content maps directory", paths.contentMaps],
    ["hero list", paths.heroList],
    ["hero data", paths.heroData],
    ["unit support file", paths.unitData],
    ["ability support file", paths.abilityData]
  ] as const;

  for (const [label, path] of requiredPaths) {
    if (await pathExists(path)) {
      evidence.push(`package evidence: ${label} exists`);
    } else {
      blockers.push(`package blocker: ${label} missing`);
    }
  }
}

async function appendMetadataReadiness(evidence: string[], blockers: string[], addonInfoPath: string): Promise<void> {
  if (!(await pathExists(addonInfoPath))) {
    for (const key of RELEASE_METADATA_KEYS) {
      blockers.push(`metadata blocker: ${key} missing`);
    }
    return;
  }

  const metadata = parseAddonInfo(await readFile(addonInfoPath, "utf8"));
  for (const key of RELEASE_METADATA_KEYS) {
    const value = metadata.get(key.toLowerCase());
    if (value === undefined) {
      blockers.push(`metadata blocker: ${key} missing`);
    } else if (PLACEHOLDER_VALUES.has(value.trim().toLowerCase())) {
      blockers.push(`metadata blocker: ${key} placeholder`);
    } else {
      evidence.push(`metadata evidence: ${key} present`);
    }
  }
}

function parseAddonInfo(content: string): Map<string, string> {
  const values = new Map<string, string>();
  const keyValuePattern = /^\s*"([^"]+)"\s+"([^"]*)"/gm;
  for (const match of content.matchAll(keyValuePattern)) {
    values.set(match[1].toLowerCase(), match[2]);
  }
  return values;
}

async function appendSecretScan(
  evidence: string[],
  blockers: string[],
  warnings: string[],
  root: string,
  relativeRoot: string
): Promise<void> {
  if (!(await pathExists(root))) {
    return;
  }

  const files: string[] = [];
  await collectFiles(root, files);
  for (const file of files) {
    const relativePath = normalizeRelativePath(relative(relativeRoot, file));
    const extension = extname(file).toLowerCase();
    if (!TEXT_SCAN_EXTENSIONS.has(extension)) {
      warnings.push(`secret scan skipped non-text file: ${relativePath}`);
      continue;
    }

    const info = await stat(file);
    if (info.size > MAX_SECRET_SCAN_BYTES) {
      warnings.push(`secret scan skipped oversized file: ${relativePath}`);
      continue;
    }

    const content = await readFile(file, "utf8");
    for (const { label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        blockers.push(`secret blocker: ${relativePath} matches ${label}`);
      }
    }
  }

  evidence.push(`secret scan completed: ${normalizeRelativePath(relativeRoot)}`);
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

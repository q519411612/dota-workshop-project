import { lstat, mkdtemp, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Stats } from "node:fs";
import { validateAddonName } from "./addon.js";

export type ReleaseCandidateInput = {
  addonName: string;
  dotaRoot: string;
  tempParent: string;
};

export type ReleaseCandidateInputField =
  | "addonName"
  | "dotaRoot"
  | "repositoryRoot"
  | "tempParent"
  | "gameAddonRoot"
  | "contentAddonRoot";

export type ReleaseCandidateInputBlocker = {
  code: string;
  field: ReleaseCandidateInputField;
  category: "invalid" | "required" | "missing" | "not-directory" | "unreadable" | "unsafe-isolation";
};

const validatedReleaseCandidateInputBrand: unique symbol = Symbol("validatedReleaseCandidateInput");

export type ValidatedReleaseCandidateInput = Readonly<{
  [validatedReleaseCandidateInputBrand]: true;
  addonName: string;
  dotaRoot: string;
  repositoryRoot: string;
  tempParent: string;
  gameAddonRoot: string;
  contentAddonRoot: string;
}>;

export type ReleaseCandidateInputResult =
  | { ok: true; value: ValidatedReleaseCandidateInput }
  | { ok: false; blockers: ReleaseCandidateInputBlocker[] };

export type ReleaseCandidateFilesystem = {
  lstat(path: string): Promise<Pick<Stats, "isDirectory">>;
  realpath(path: string): Promise<string>;
  createCandidateRoot(input: ValidatedReleaseCandidateInput): Promise<string>;
};

export type ReleaseCandidateDependencies = {
  repositoryRoot?: string;
  filesystem?: ReleaseCandidateFilesystem;
};

const defaultFilesystem: ReleaseCandidateFilesystem = {
  lstat,
  realpath,
  createCandidateRoot: async (input) => await mkdtemp(join(input.tempParent, "dota-release-candidate-"))
};

export type ReleaseCandidateContinuationResult<T> =
  | { ok: true; value: T }
  | { ok: false; blockers: ReleaseCandidateInputBlocker[] };

export async function continueReleaseCandidatePreparation<T>(
  input: ReleaseCandidateInput,
  dependencies: ReleaseCandidateDependencies,
  continuation: (validated: ValidatedReleaseCandidateInput) => Promise<T>
): Promise<ReleaseCandidateContinuationResult<T>> {
  const prepared = await prepareReleaseCandidateInput(input, dependencies);
  if (!prepared.ok) return prepared;
  return { ok: true, value: await continuation(prepared.value) };
}

export async function prepareReleaseCandidateInput(
  input: ReleaseCandidateInput,
  dependencies: ReleaseCandidateDependencies = {}
): Promise<ReleaseCandidateInputResult> {
  const addonValidation = validateAddonName(input?.addonName);
  if (!addonValidation.ok) {
    return blocked("INVALID_ADDON_NAME", "addonName", "invalid");
  }

  const filesystem = dependencies.filesystem ?? defaultFilesystem;
  const dotaRoot = await validateDirectory(input?.dotaRoot, "dotaRoot", "DOTA_ROOT", filesystem);
  if (!dotaRoot.ok) return dotaRoot.result;

  const repositoryRoot = await validateDirectory(
    dependencies.repositoryRoot ?? process.cwd(),
    "repositoryRoot",
    "REPOSITORY_ROOT",
    filesystem
  );
  if (!repositoryRoot.ok) return repositoryRoot.result;

  const tempParent = await validateDirectory(input?.tempParent, "tempParent", "TEMP_PARENT", filesystem);
  if (!tempParent.ok) return tempParent.result;

  const gameAddonRootPath = join(dotaRoot.path, "game", "dota_addons", input.addonName);
  const gameAddonRoot = await validateDirectory(gameAddonRootPath, "gameAddonRoot", "GAME_ADDON_ROOT", filesystem);
  if (!gameAddonRoot.ok) return gameAddonRoot.result;
  if (!isPathInside(gameAddonRoot.path, dotaRoot.path)) {
    return blocked("GAME_ADDON_ROOT_OUTSIDE_DOTA_ROOT", "gameAddonRoot", "unsafe-isolation");
  }

  const contentAddonRootPath = join(dotaRoot.path, "content", "dota_addons", input.addonName);
  const contentAddonRoot = await validateDirectory(
    contentAddonRootPath,
    "contentAddonRoot",
    "CONTENT_ADDON_ROOT",
    filesystem
  );
  if (!contentAddonRoot.ok) return contentAddonRoot.result;
  if (!isPathInside(contentAddonRoot.path, dotaRoot.path)) {
    return blocked("CONTENT_ADDON_ROOT_OUTSIDE_DOTA_ROOT", "contentAddonRoot", "unsafe-isolation");
  }

  const protectedRoots = [dotaRoot.path, repositoryRoot.path, gameAddonRoot.path, contentAddonRoot.path];
  if (protectedRoots.some((root) => isPathAtOrInside(tempParent.path, root))) {
    return blocked("TEMP_PARENT_NOT_ISOLATED", "tempParent", "unsafe-isolation");
  }

  return {
    ok: true,
    value: Object.freeze({
      [validatedReleaseCandidateInputBrand]: true as const,
      addonName: input.addonName,
      dotaRoot: dotaRoot.path,
      repositoryRoot: repositoryRoot.path,
      tempParent: tempParent.path,
      gameAddonRoot: gameAddonRoot.path,
      contentAddonRoot: contentAddonRoot.path
    })
  };
}

type ValidDirectory =
  | { ok: true; path: string }
  | { ok: false; result: ReleaseCandidateInputResult };

async function validateDirectory(
  value: string,
  field: Exclude<ReleaseCandidateInputField, "addonName">,
  codePrefix: string,
  filesystem: ReleaseCandidateFilesystem
): Promise<ValidDirectory> {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, result: blocked(`${codePrefix}_REQUIRED`, field, "required") };
  }

  const path = resolve(value);
  let stats: Pick<Stats, "isDirectory">;
  try {
    stats = await filesystem.lstat(path);
  } catch (error) {
    const category = errorCode(error) === "ENOENT" ? "missing" : "unreadable";
    const suffix = category === "missing" ? "MISSING" : "UNREADABLE";
    return { ok: false, result: blocked(`${codePrefix}_${suffix}`, field, category) };
  }

  if (!stats.isDirectory()) {
    return { ok: false, result: blocked(`${codePrefix}_NOT_DIRECTORY`, field, "not-directory") };
  }

  try {
    return { ok: true, path: await filesystem.realpath(path) };
  } catch {
    return { ok: false, result: blocked(`${codePrefix}_UNREADABLE`, field, "unreadable") };
  }
}

function blocked(
  code: string,
  field: ReleaseCandidateInputField,
  category: ReleaseCandidateInputBlocker["category"]
): ReleaseCandidateInputResult {
  return { ok: false, blockers: [{ code, field, category }] };
}

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isPathAtOrInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  return isPathInside(child, parent);
}

function isPathInside(child: string, parent: string): boolean {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

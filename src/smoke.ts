import {
  createAddon,
  inspectAddon,
  placementMarkers,
  validateAddonName,
  validateMapName,
  validateRuntimePlacement
} from "./addon.js";
import { launchCustomGame, validateAddon } from "./launch.js";
import {
  createRemoteAddon,
  inspectRemoteAddon,
  launchRemoteCustomGame,
  validateRemoteAddon
} from "./remote.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { CommandEvidence, Target, ToolResult } from "./types.js";
import type { RuntimePlacement } from "./addon.js";

export type SmokeCommandOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunPlayableSmokeInput = {
  target: Target;
  addonName?: string;
  addonPrefix?: string;
  mapName?: string;
  placement?: RuntimePlacement;
  expectedMarkers?: string[];
  replace?: boolean;
  dryRun?: boolean;
  launchMode?: "process" | "interactiveTask";
  taskName?: string;
  logPaths?: string[];
  validationTimeoutMs?: number;
  validationPollIntervalMs?: number;
  executor?: (command: CommandEvidence) => Promise<SmokeCommandOutput>;
};

const DEFAULT_VALIDATION_TIMEOUT_MS = 120000;
const DEFAULT_VALIDATION_POLL_INTERVAL_MS = 5000;

export function playableSmokeMarkers(addonName: string): string[] {
  return [
    `[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] gamemode initialized: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] round started: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] score updated: ${addonName}`,
    `[DOTA_WORKSHOP_MCP] win condition reached: ${addonName}`
  ];
}

export function generatePlayableSmokeAddonName(prefix = "playable_smoke"): string {
  const now = new Date();
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");
  const time = [
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
    String(now.getUTCMilliseconds()).padStart(3, "0")
  ].join("");
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, "0");

  return `${prefix}_${date}_${time}_${random}`;
}

export async function runPlayableSmoke(input: RunPlayableSmokeInput): Promise<ToolResult> {
  const operation = "run_playable_smoke";
  const mapName = input.mapName ?? "dota";
  const addonName = input.addonName ?? generatePlayableSmokeAddonName(input.addonPrefix);
  const expectedMarkers = input.expectedMarkers ?? playableSmokeMarkers(addonName).concat(
    input.placement ? placementMarkers(addonName, input.placement) : []
  );
  const validation = validateSmokeInput(addonName, mapName, input);

  if (validation) {
    return validation;
  }

  const transcript: ToolResult[] = [];

  if (input.target.kind === "remote") {
    const createResult = await createRemoteAddon({
      target: input.target,
      addonName,
      mapName,
      template: "playable",
      placement: input.placement,
      replace: input.replace,
      executor: input.executor
    });
    transcript.push(createResult);
    if (!createResult.ok) return smokeFailure(input.target, createResult, transcript, addonName);

    const inspectResult = await inspectRemoteAddon({
      target: input.target,
      addonName,
      executor: input.executor
    });
    transcript.push(inspectResult);
    if (!inspectResult.ok) return smokeFailure(input.target, inspectResult, transcript, addonName);

    const launchResult = await launchRemoteCustomGame({
      target: input.target,
      addonName,
      mapName,
      launchMode: input.launchMode,
      taskName: input.taskName,
      runtimeMode: "game",
      consoleLog: true,
      executor: input.executor
    });
    transcript.push(launchResult);
    if (!launchResult.ok) return smokeFailure(input.target, launchResult, transcript, addonName);

    const validateResults = await validateRemoteWithPolling(input, addonName, expectedMarkers);
    transcript.push(...validateResults);
    const validateResult = validateResults[validateResults.length - 1];
    if (!validateResult.ok) return smokeFailure(input.target, validateResult, transcript, addonName);

    return smokeSuccess(input.target, transcript, addonName);
  }

  const createResult = await createAddon({
    target: input.target,
    addonName,
    mapName,
    template: "playable",
    placement: input.placement,
    replace: input.replace
  });
  transcript.push(createResult);
  if (!createResult.ok) return smokeFailure(input.target, createResult, transcript, addonName);

  const inspectResult = await inspectAddon({
    target: input.target,
    addonName
  });
  transcript.push(inspectResult);
  if (!inspectResult.ok) return smokeFailure(input.target, inspectResult, transcript, addonName);

  const launchResult = await launchCustomGame({
    target: input.target,
    addonName,
    mapName,
    runtimeMode: "game",
    consoleLog: true,
    dryRun: input.dryRun,
    executor: input.executor
  });
  transcript.push(launchResult);
  if (!launchResult.ok) return smokeFailure(input.target, launchResult, transcript, addonName);

  const validateResults = await validateLocalWithPolling(input, addonName, expectedMarkers);
  transcript.push(...validateResults);
  const validateResult = validateResults[validateResults.length - 1];
  if (!validateResult.ok) return smokeFailure(input.target, validateResult, transcript, addonName);

  return smokeSuccess(input.target, transcript, addonName);
}

async function validateRemoteWithPolling(
  input: RunPlayableSmokeInput,
  addonName: string,
  expectedMarkers: string[]
): Promise<ToolResult[]> {
  return pollValidation(input, () => validateRemoteAddon({
    target: input.target as Extract<Target, { kind: "remote" }>,
    addonName,
    logPaths: input.logPaths,
    expectedMarkers,
    executor: input.executor
  }));
}

async function validateLocalWithPolling(
  input: RunPlayableSmokeInput,
  addonName: string,
  expectedMarkers: string[]
): Promise<ToolResult[]> {
  return pollValidation(input, () => validateAddon({
    target: input.target,
    addonName,
    logPaths: input.logPaths,
    expectedMarkers
  }));
}

async function pollValidation(
  input: RunPlayableSmokeInput,
  runValidation: () => Promise<ToolResult>
): Promise<ToolResult[]> {
  const timeoutMs = input.validationTimeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS;
  const intervalMs = input.validationPollIntervalMs ?? DEFAULT_VALIDATION_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  const results: ToolResult[] = [];

  while (true) {
    const result = await runValidation();
    results.push(result);

    if (result.ok || !isRetryableValidationMiss(result) || Date.now() >= deadline) {
      return results;
    }

    await sleep(intervalMs);
  }
}

function isRetryableValidationMiss(result: ToolResult): boolean {
  return result.error?.code === "VALIDATION_MARKER_NOT_FOUND" ||
    result.error?.code === "LOG_EVIDENCE_NOT_FOUND";
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

function validateSmokeInput(
  addonName: string,
  mapName: string,
  input: RunPlayableSmokeInput
): ToolResult | undefined {
  const nameValidation = validateAddonName(addonName);
  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation: "run_playable_smoke",
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      },
      evidence: [`rejected smoke addon name: ${addonName}`]
    });
  }

  const mapValidation = validateMapName(mapName);
  if (!mapValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation: "run_playable_smoke",
      error: {
        code: "INVALID_MAP_NAME",
        message: mapValidation.error ?? "Invalid map name."
      },
      evidence: [`rejected smoke map name: ${mapName}`]
    });
  }

  if (input.placement) {
    const placementValidation = validateRuntimePlacement(input.placement);
    if (!placementValidation.ok) {
      return createFailureResult({
        target: input.target,
        operation: "run_playable_smoke",
        error: {
          code: "INVALID_PLACEMENT",
          message: placementValidation.error ?? "Invalid runtime placement."
        },
        evidence: [placementValidation.error ?? "rejected runtime placement"]
      });
    }
  }

  if (input.target.kind === "remote" && input.dryRun) {
    return createFailureResult({
      target: input.target,
      operation: "run_playable_smoke",
      error: {
        code: "REMOTE_DRY_RUN_UNSUPPORTED",
        message: "Remote playable smoke does not support dryRun because validation requires target runtime evidence."
      },
      evidence: ["remote smoke received dryRun: true"]
    });
  }

  return undefined;
}

function smokeSuccess(target: Target, results: ToolResult[], addonName: string): ToolResult {
  const compacted = compactTranscriptResults(results);

  return createSuccessResult({
    target,
    operation: "run_playable_smoke",
    evidence: smokeEvidence(results, addonName),
    warnings: smokeWarnings(compacted),
    paths: smokePaths(compacted, addonName),
    commands: compacted.flatMap((result) => result.commands),
    logs: compacted.flatMap((result) => result.logs)
  });
}

function smokeFailure(
  target: Target,
  failedResult: ToolResult,
  results: ToolResult[],
  addonName: string
): ToolResult {
  const previousResults = results.slice(0, -1);
  const compacted = compactTranscriptResults(results);

  return createFailureResult({
    target,
    operation: "run_playable_smoke",
    error: {
      code: "SMOKE_WORKFLOW_FAILED",
      message: `Playable smoke workflow failed during ${failedResult.operation}: ${failedResult.error?.message ?? "operation failed"}.`
    },
    evidence: [
      `smoke addon name: ${addonName}`,
      `failed smoke operation: ${failedResult.operation}`,
      ...smokeEvidence(previousResults, addonName),
      ...failedResult.evidence
    ],
    warnings: smokeWarnings(compacted),
    paths: smokePaths(compacted, addonName),
    commands: compacted.flatMap((result) => result.commands),
    logs: compacted.flatMap((result) => result.logs)
  });
}

function compactTranscriptResults(results: ToolResult[]): ToolResult[] {
  return results.filter((result, index) => {
    const isFinalResult = index === results.length - 1;
    return isFinalResult || !isRetryableValidationMiss(result);
  });
}

function smokeEvidence(results: ToolResult[], addonName: string): string[] {
  const evidence = [`smoke addon name: ${addonName}`];
  let validationRetries = 0;

  for (const result of results) {
    if (result.ok) {
      evidence.push(`smoke operation ${result.operation} succeeded`);
      evidence.push(...result.evidence);
      continue;
    }

    if (isRetryableValidationMiss(result)) {
      validationRetries += 1;
      continue;
    }

    evidence.push(...result.evidence);
  }

  if (validationRetries > 0) {
    evidence.push(`smoke validation retries before final result: ${validationRetries}`);
  }

  return evidence;
}

function smokeWarnings(results: ToolResult[]): string[] {
  return [
    "generated smoke addon files are left on the target for inspection",
    ...results.flatMap((result) => result.warnings)
  ];
}

function smokePaths(results: ToolResult[], addonName: string): Record<string, string> {
  return {
    smokeAddonName: addonName,
    ...Object.assign({}, ...results.map((result) => result.paths))
  };
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { renderAddonFiles, validateAddonName, validateGameplayObjective, validateMapName, validateRuntimePlacement, validateUnitAbilityScaffold } from "./addon.js";
import { expectedMarkerList, findLuaStartupError, markerFoundEvidence, missingMarkers } from "./markers.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { GameplayObjective, RuntimePlacement, UnitAbilityScaffold } from "./addon.js";
import type { CommandEvidence, RemoteTarget, ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);
const REMOTE_LOG_TAIL_LINES = 2000;
const REMOTE_AUXILIARY_LOG_TAIL_LINES = 200;

export type RemoteCommandOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RemoteCommandInput = {
  target: RemoteTarget;
  command: string;
  executor?: (command: CommandEvidence) => Promise<RemoteCommandOutput>;
};

export type RemoteEnvironmentInput = {
  target: RemoteTarget;
  executor?: (command: CommandEvidence) => Promise<RemoteCommandOutput>;
};

export type RemoteLaunchInput = RemoteEnvironmentInput & {
  addonName: string;
  launchMode?: "process" | "interactiveTask";
  taskName?: string;
};

export type RemoteCustomGameInput = RemoteLaunchInput & {
  mapName: string;
  runtimeMode?: "tools" | "game";
  consoleLog?: boolean;
};

export type RemoteAddonInput = RemoteEnvironmentInput & {
  addonName: string;
  mapName?: string;
  template?: "minimal" | "playable";
  placement?: RuntimePlacement;
  objective?: GameplayObjective;
  unitAbilityScaffold?: UnitAbilityScaffold;
  replace?: boolean;
};

export type RemoteLogsInput = RemoteEnvironmentInput & {
  addonName: string;
  logPaths?: string[];
  expectedMarker?: string;
  expectedMarkers?: string[];
};

export async function runRemoteCommand(input: RemoteCommandInput): Promise<ToolResult> {
  const operation = "remote_command";
  const command = buildRemoteCommand(input.target, input.command);
  const output = await (input.executor ?? defaultExecutor)(command);
  const commandEvidence: CommandEvidence = {
    ...command,
    exitCode: output.exitCode,
    stdout: output.stdout,
    stderr: output.stderr
  };

  if (output.exitCode !== 0) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_COMMAND_FAILED",
        message: "Remote Windows command failed."
      },
      evidence: [`remote command failed with exit code ${output.exitCode}`],
      commands: [commandEvidence],
      logs: [{
        source: `${input.target.name}:stderr`,
        lines: splitLines(output.stderr)
      }]
    });
  }

  return createSuccessResult({
    target: input.target,
    operation,
    evidence: ["remote command completed"],
    commands: [commandEvidence],
    logs: [{
      source: `${input.target.name}:stdout`,
      lines: splitLines(output.stdout)
    }]
  });
}

export async function discoverRemoteEnvironment(input: RemoteEnvironmentInput): Promise<ToolResult> {
  const operation = "discover_environment";

  if (!input.target.dotaRoot) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_DOTA_ROOT_REQUIRED",
        message: "Remote discovery requires a Dota install root until automatic remote Steam discovery is configured."
      },
      evidence: ["remote target did not include dotaRoot"]
    });
  }

  const output = await runRemoteCommand({
    target: input.target,
    command: remoteDiscoveryScript(input.target.dotaRoot),
    executor: input.executor
  });

  if (!output.ok) {
    return { ...output, operation };
  }

  const stdout = output.commands[0]?.stdout ?? "";
  let parsed: RemoteDiscoveryPayload;
  try {
    parsed = JSON.parse(stdout) as RemoteDiscoveryPayload;
  } catch {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_DISCOVERY_PARSE_FAILED",
        message: "Remote discovery did not return valid JSON."
      },
      evidence: ["remote stdout was not valid JSON"],
      commands: output.commands,
      logs: output.logs
    });
  }

  const paths = {
    dotaRoot: parsed.dotaRoot,
    ...parsed.paths
  };

  if (parsed.missing.length > 0) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_WORKSHOP_TOOLS_PATH_MISSING",
        message: "Remote Dota install root is missing required Workshop Tools paths."
      },
      evidence: parsed.missing.map((item) => `remote missing ${item}`),
      paths,
      commands: output.commands,
      logs: output.logs
    });
  }

  return createSuccessResult({
    target: input.target,
    operation,
    evidence: ["remote environment verified"],
    paths,
    commands: output.commands,
    logs: output.logs
  });
}

export async function launchRemoteTools(input: RemoteLaunchInput): Promise<ToolResult> {
  return launchRemoteDota({
    ...input,
    operation: "launch_tools",
    args: ["-novid", "-tools", "-addon", input.addonName]
  });
}

export async function launchRemoteCustomGame(input: RemoteCustomGameInput): Promise<ToolResult> {
  const mapValidation = validateMapName(input.mapName);
  if (!mapValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation: "launch_custom_game",
      error: {
        code: "INVALID_MAP_NAME",
        message: mapValidation.error ?? "Invalid map name."
      },
      evidence: [`rejected map name: ${input.mapName}`]
    });
  }

  return launchRemoteDota({
    ...input,
    operation: "launch_custom_game",
    args: remoteCustomGameArgs(input)
  });
}

export async function createRemoteAddon(input: RemoteAddonInput): Promise<ToolResult> {
  const operation = "create_addon";
  const validation = validateRemoteAddonInput(input, operation);
  if (validation) {
    return validation;
  }

  const result = await runRemoteCommand({
    target: input.target,
    command: remoteCreateAddonScript(
      input.target.dotaRoot!,
      input.addonName,
      input.mapName ?? "dota",
      input.template ?? "playable",
      input.placement,
      input.objective,
      input.unitAbilityScaffold,
      input.replace ?? false
    ),
    executor: input.executor
  });

  if (!result.ok) {
    return { ...result, operation };
  }

  return {
    ...result,
    operation,
    evidence: ["remote addon creation completed", ...result.evidence]
  };
}

export async function inspectRemoteAddon(input: RemoteAddonInput): Promise<ToolResult> {
  const operation = "inspect_addon";
  const validation = validateRemoteAddonInput(input, operation);
  if (validation) {
    return validation;
  }

  const result = await runRemoteCommand({
    target: input.target,
    command: remoteInspectAddonScript(input.target.dotaRoot!, input.addonName),
    executor: input.executor
  });

  if (!result.ok) {
    return { ...result, operation };
  }

  const stdout = result.commands[0]?.stdout ?? "";
  try {
    const parsed = JSON.parse(stdout) as { evidence?: string[]; paths?: Record<string, string> };
    return createSuccessResult({
      target: input.target,
      operation,
      evidence: parsed.evidence ?? ["remote addon inspected"],
      paths: parsed.paths ?? {},
      commands: result.commands,
      logs: result.logs
    });
  } catch {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_INSPECT_PARSE_FAILED",
        message: "Remote addon inspection did not return valid JSON."
      },
      evidence: ["remote inspect stdout was not valid JSON"],
      commands: result.commands,
      logs: result.logs
    });
  }
}

export async function inspectRemoteWorkshopPreflight(input: RemoteAddonInput): Promise<ToolResult> {
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

  if (!input.target.dotaRoot) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_DOTA_ROOT_REQUIRED",
        message: "Remote preflight requires a Dota install root."
      },
      evidence: ["remote target did not include dotaRoot"]
    });
  }

  const result = await runRemoteCommand({
    target: input.target,
    command: remoteWorkshopPreflightScript(input.target.dotaRoot, input.addonName),
    executor: input.executor
  });

  if (!result.ok) {
    return { ...result, operation };
  }

  const stdout = result.commands[0]?.stdout ?? "";
  try {
    const parsed = JSON.parse(stdout) as RemotePreflightPayload;
    if (parsed.ok === false || parsed.error) {
      return createFailureResult({
        target: input.target,
        operation,
        error: parsed.error ?? {
          code: "REMOTE_PREFLIGHT_FAILED",
          message: "Remote preflight returned a failure payload."
        },
        evidence: parsed.evidence ?? ["remote preflight failed"],
        warnings: parsed.warnings ?? [],
        paths: parsed.paths ?? {},
        commands: result.commands,
        logs: result.logs
      });
    }

    return createSuccessResult({
      target: input.target,
      operation,
      evidence: parsed.evidence ?? ["remote workshop preflight inspected"],
      warnings: parsed.warnings ?? [],
      paths: parsed.paths ?? {},
      commands: result.commands,
      logs: result.logs
    });
  } catch {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_PREFLIGHT_PARSE_FAILED",
        message: "Remote workshop preflight did not return valid JSON."
      },
      evidence: ["remote preflight stdout was not valid JSON"],
      commands: result.commands,
      logs: result.logs
    });
  }
}

export async function dryRunRemoteReleaseReport(input: RemoteAddonInput): Promise<ToolResult> {
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

  if (!input.target.dotaRoot) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_DOTA_ROOT_REQUIRED",
        message: "Remote release dry run requires a Dota install root."
      },
      evidence: ["remote target did not include dotaRoot"]
    });
  }

  const result = await runRemoteCommand({
    target: input.target,
    command: remoteDryRunReleaseReportScript(input.target.dotaRoot, input.addonName),
    executor: input.executor
  });

  if (!result.ok) {
    return { ...result, operation };
  }

  const stdout = result.commands[0]?.stdout ?? "";
  try {
    const parsed = JSON.parse(stdout) as RemotePreflightPayload;
    if (parsed.ok === false || parsed.error) {
      return createFailureResult({
        target: input.target,
        operation,
        error: parsed.error ?? {
          code: "RELEASE_PREFLIGHT_BLOCKED",
          message: "Release dry run found blockers."
        },
        evidence: parsed.evidence ?? ["remote release dry run blocked"],
        warnings: parsed.warnings ?? [],
        paths: parsed.paths ?? {},
        commands: result.commands,
        logs: result.logs
      });
    }

    return createSuccessResult({
      target: input.target,
      operation,
      evidence: parsed.evidence ?? ["remote dry-run release report generated"],
      warnings: parsed.warnings ?? [],
      paths: parsed.paths ?? {},
      commands: result.commands,
      logs: result.logs
    });
  } catch {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_RELEASE_REPORT_PARSE_FAILED",
        message: "Remote release dry run did not return valid JSON."
      },
      evidence: ["remote release report stdout was not valid JSON"],
      commands: result.commands,
      logs: result.logs
    });
  }
}

export async function readRemoteConsoleOrLogs(input: RemoteLogsInput): Promise<ToolResult> {
  const operation = "read_console_or_logs";
  const nameValidation = validateAddonName(input.addonName);

  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      }
    });
  }

  if ((!input.logPaths || input.logPaths.length === 0) && !input.target.dotaRoot) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_DOTA_ROOT_REQUIRED",
        message: "Remote log discovery requires a Dota install root when log paths are omitted."
      },
      evidence: ["remote target did not include dotaRoot"]
    });
  }

  const result = await runRemoteCommand({
    target: input.target,
    command: input.logPaths && input.logPaths.length > 0
      ? remoteReadLogsScript(input.logPaths)
      : remoteDiscoverRecentLogsScript(input.target.dotaRoot!),
    executor: input.executor
  });

  if (!result.ok) {
    return { ...result, operation };
  }

  const stdout = result.commands[0]?.stdout ?? "";
  try {
    const logs = JSON.parse(stdout) as { source: string; lines: string[] }[];
    if (logs.length === 0) {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "LOG_EVIDENCE_NOT_FOUND",
          message: "No readable remote Workshop Tools logs were found."
        },
        evidence: ["remote command returned no log entries"],
        commands: result.commands,
        logs: result.logs
      });
    }

    return createSuccessResult({
      target: input.target,
      operation,
      evidence: logs.map((log) => `read remote log: ${log.source}`),
      paths: Object.fromEntries(logs.map((log, index) => [`log${index}`, log.source])),
      commands: result.commands,
      logs
    });
  } catch {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_LOG_PARSE_FAILED",
        message: "Remote log read did not return valid JSON."
      },
      evidence: ["remote log stdout was not valid JSON"],
      commands: result.commands,
      logs: result.logs
    });
  }
}

export async function validateRemoteAddon(input: RemoteLogsInput): Promise<ToolResult> {
  const operation = "validate_addon";
  const markers = expectedMarkerList(input);
  const readResult = await readRemoteConsoleOrLogs(input);

  if (!readResult.ok) {
    return { ...readResult, operation };
  }

  const lines = readResult.logs.flatMap((log) => log.lines);
  const errorLine = findLuaStartupError(lines);

  if (errorLine) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "LUA_STARTUP_ERROR",
        message: "Remote Workshop logs contain a Lua startup error."
      },
      evidence: [`detected Lua error: ${errorLine}`],
      paths: readResult.paths,
      commands: readResult.commands,
      logs: readResult.logs
    });
  }

  const missing = missingMarkers(lines, markers);
  if (missing.length === 0) {
    return createSuccessResult({
      target: input.target,
      operation,
      evidence: markerFoundEvidence(input.addonName, markers),
      paths: readResult.paths,
      commands: readResult.commands,
      logs: readResult.logs
    });
  }

  return createFailureResult({
    target: input.target,
    operation,
    error: {
      code: "VALIDATION_MARKER_NOT_FOUND",
      message: "Validation marker was not found in remote Workshop Tools logs."
    },
    evidence: missing.map((marker) => `missing marker: ${marker}`),
    paths: readResult.paths,
    commands: readResult.commands,
    logs: readResult.logs
  });
}

function buildRemoteCommand(target: RemoteTarget, command: string): CommandEvidence {
  if (target.transport === "ssh") {
    const destination = target.username ? `${target.username}@${target.host}` : target.host;
    return {
      // 远程脚本必须作为一个参数传给 ssh，避免本地 shell 提前解析 PowerShell 语法。
      command: `ssh ${quoteForPosixShell(destination)} ${quoteForPosixShell(command)}`
    };
  }

  const credential = target.username ? ` -Credential ${target.username}` : "";
  return {
    command: `Invoke-Command -ComputerName ${target.host}${credential} -ScriptBlock { ${command} }`
  };
}

function quoteForPosixShell(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quoteForPowerShellSingleQuotedString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

type RemoteDiscoveryPayload = {
  dotaRoot: string;
  missing: string[];
  paths: Record<string, string>;
};

type RemotePreflightPayload = {
  ok?: boolean;
  evidence?: string[];
  warnings?: string[];
  paths?: Record<string, string>;
  error?: {
    code: string;
    message: string;
  };
};

type LaunchRemoteDotaInput = RemoteLaunchInput & {
  operation: "launch_tools" | "launch_custom_game";
  args: string[];
};

function remoteCustomGameArgs(input: RemoteCustomGameInput): string[] {
  const args = ["-novid"];

  if ((input.runtimeMode ?? "tools") === "tools") {
    args.push("-tools");
  }

  args.push("-addon", input.addonName, "+dota_launch_custom_game", input.addonName, input.mapName);

  if (input.consoleLog) {
    args.push("-console", "-condebug");
  }

  return args;
}

async function launchRemoteDota(input: LaunchRemoteDotaInput): Promise<ToolResult> {
  const nameValidation = validateAddonName(input.addonName);

  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation: input.operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      }
    });
  }

  if (!input.target.dotaRoot) {
    return createFailureResult({
      target: input.target,
      operation: input.operation,
      error: {
        code: "REMOTE_DOTA_ROOT_REQUIRED",
        message: "Remote launch requires a Dota install root."
      },
      evidence: ["remote target did not include dotaRoot"]
    });
  }

  if (input.launchMode === "interactiveTask") {
    return launchRemoteDotaInteractiveTask(input);
  }

  const executable = `${input.target.dotaRoot}/game/bin/win64/dota2.exe`;
  const argumentList = input.args.map(quoteForPowerShellSingleQuotedString).join(", ");
  const command = `$exe = ${quoteForPowerShellSingleQuotedString(executable)}; $args = @(${argumentList}); $process = Start-Process -FilePath $exe -ArgumentList $args -PassThru; @{ processId = $process.Id; processName = $process.ProcessName; hasExited = $process.HasExited } | ConvertTo-Json -Compress`;
  const result = await runRemoteCommand({
    target: input.target,
    command,
    executor: input.executor
  });

  return {
    ...result,
    operation: input.operation,
    warnings: result.ok
      ? ["launch command completed; validation still requires log evidence", ...result.warnings]
      : result.warnings
  };
}

async function launchRemoteDotaInteractiveTask(input: LaunchRemoteDotaInput): Promise<ToolResult> {
  const taskName = input.taskName ?? `DotaWorkshopMcp_${input.addonName}`;
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(taskName)) {
    return createFailureResult({
      target: input.target,
      operation: input.operation,
      error: {
        code: "INVALID_REMOTE_TASK_NAME",
        message: "Remote interactive task name must be 1-64 characters of letters, numbers, dot, underscore, or dash."
      },
      evidence: [`invalid task name: ${taskName}`]
    });
  }

  const argumentText = `-applaunch 570 ${input.args.join(" ")}`;
  const userId = input.target.username ?? "";
  const command = remoteInteractiveLaunchScript(input.target.dotaRoot!, input.addonName, taskName, argumentText, userId);
  const result = await runRemoteCommand({
    target: input.target,
    command,
    executor: input.executor
  });

  return {
    ...result,
    operation: input.operation,
    evidence: result.ok
      ? ["remote interactive launch task completed", ...result.evidence]
      : result.evidence,
    warnings: result.ok
      ? ["interactive launch completed; validation still requires log evidence", ...result.warnings]
      : result.warnings
  };
}

function validateRemoteAddonInput(input: RemoteAddonInput, operation: string): ToolResult | undefined {
  const nameValidation = validateAddonName(input.addonName);

  if (!nameValidation.ok) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "INVALID_ADDON_NAME",
        message: nameValidation.error ?? "Invalid addon name."
      }
    });
  }

  if (input.mapName) {
    const mapValidation = validateMapName(input.mapName);
    if (!mapValidation.ok) {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "INVALID_MAP_NAME",
          message: mapValidation.error ?? "Invalid map name."
        },
        evidence: [`rejected map name: ${input.mapName}`]
      });
    }
  }

  if (input.placement) {
    if (input.template && input.template !== "playable") {
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
    if (input.template && input.template !== "playable") {
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

  if (input.unitAbilityScaffold) {
    const scaffoldValidation = validateUnitAbilityScaffold(input.unitAbilityScaffold);
    if (!scaffoldValidation.ok) {
      return createFailureResult({
        target: input.target,
        operation,
        error: {
          code: "INVALID_SCAFFOLD",
          message: scaffoldValidation.error ?? "Invalid unit ability scaffold."
        },
        evidence: [scaffoldValidation.error ?? "rejected unit ability scaffold"]
      });
    }
  }

  if (!input.target.dotaRoot) {
    return createFailureResult({
      target: input.target,
      operation,
      error: {
        code: "REMOTE_DOTA_ROOT_REQUIRED",
        message: "Remote addon operation requires a Dota install root."
      },
      evidence: ["remote target did not include dotaRoot"]
    });
  }

  return undefined;
}

function remoteDiscoveryScript(dotaRoot: string): string {
  return `$root = '${dotaRoot}'; $paths = @{ dotaExecutable = (Join-Path $root 'game/bin/win64/dota2.exe'); vconsoleExecutable = (Join-Path $root 'game/bin/win64/vconsole2.exe'); gameAddonsRoot = (Join-Path $root 'game/dota_addons'); contentAddonsRoot = (Join-Path $root 'content/dota_addons') }; $missing = @(); foreach ($key in $paths.Keys) { if (-not (Test-Path -LiteralPath $paths[$key])) { $missing += $key } }; @{ dotaRoot = $root; paths = $paths; missing = $missing } | ConvertTo-Json -Compress`;
}

function remoteCreateAddonScript(
  dotaRoot: string,
  addonName: string,
  mapName: string,
  template: "minimal" | "playable",
  placement: RuntimePlacement | undefined,
  objective: GameplayObjective | undefined,
  scaffold: UnitAbilityScaffold | undefined,
  replace: boolean
): string {
  const gameAddon = `${dotaRoot}/game/dota_addons/${addonName}`;
  const contentAddon = `${dotaRoot}/content/dota_addons/${addonName}`;
  const files = renderAddonFiles(addonName, mapName, template, placement, objective, scaffold);
  const replaceScript = replace
    ? `Remove-Item -LiteralPath ${quoteForPowerShellSingleQuotedString(gameAddon)}, ${quoteForPowerShellSingleQuotedString(contentAddon)} -Recurse -Force -ErrorAction SilentlyContinue;`
    : `if ((Test-Path -LiteralPath ${quoteForPowerShellSingleQuotedString(gameAddon)}) -or (Test-Path -LiteralPath ${quoteForPowerShellSingleQuotedString(contentAddon)})) { throw 'ADDON_ALREADY_EXISTS' };`;
  const directories = [
    `${gameAddon}/scripts/vscripts`,
    `${gameAddon}/scripts/npc`,
    `${gameAddon}/resource`,
    `${contentAddon}/maps`
  ].map(quoteForPowerShellSingleQuotedString).join(", ");
  const writes = [
    [`${gameAddon}/addoninfo.txt`, files.addonInfo],
    [`${gameAddon}/scripts/vscripts/addon_game_mode.lua`, files.luaEntry],
    [`${gameAddon}/scripts/npc/herolist.txt`, files.heroList],
    [`${gameAddon}/scripts/npc/npc_heroes_custom.txt`, files.heroData],
    [`${gameAddon}/scripts/npc/npc_units_custom.txt`, files.unitData],
    [`${gameAddon}/scripts/npc/npc_abilities_custom.txt`, files.abilityData],
    [`${gameAddon}/resource/addon_${addonName}_english.txt`, files.localization]
  ].map(([path, value]) => `Set-Content -LiteralPath ${quoteForPowerShellSingleQuotedString(path)} -Value ${quoteForPowerShellSingleQuotedString(value)}`).join("; ");

  return `${replaceScript} New-Item -ItemType Directory -Force -Path ${directories} | Out-Null; ${writes}`;
}

function remoteInspectAddonScript(dotaRoot: string, addonName: string): string {
  return `$gameAddon = '${dotaRoot}/game/dota_addons/${addonName}'; $contentAddon = '${dotaRoot}/content/dota_addons/${addonName}'; $evidence = @(); if (Test-Path -LiteralPath $gameAddon) { $evidence += 'game addon root exists' } else { $evidence += 'game addon root missing' }; if (Test-Path -LiteralPath $contentAddon) { $evidence += 'content addon root exists' } else { $evidence += 'content addon root missing' }; @{ evidence = $evidence; paths = @{ gameAddon = $gameAddon; contentAddon = $contentAddon } } | ConvertTo-Json -Compress`;
}

function remoteWorkshopPreflightScript(dotaRoot: string, addonName: string): string {
  const root = quoteForPowerShellSingleQuotedString(dotaRoot);
  const addon = quoteForPowerShellSingleQuotedString(addonName);
  const localization = quoteForPowerShellSingleQuotedString(`resource/addon_${addonName}_english.txt`);

  return [
    "$ErrorActionPreference = 'Stop'",
    `$root = ${root}`,
    `$addonName = ${addon}`,
    "$gameAddon = Join-Path $root (Join-Path 'game/dota_addons' $addonName)",
    "$contentAddon = Join-Path $root (Join-Path 'content/dota_addons' $addonName)",
    `$paths = @{ gameAddon = $gameAddon; contentAddon = $contentAddon; addonInfo = (Join-Path $gameAddon 'addoninfo.txt'); luaEntry = (Join-Path $gameAddon 'scripts/vscripts/addon_game_mode.lua'); localization = (Join-Path $gameAddon ${localization}); heroList = (Join-Path $gameAddon 'scripts/npc/herolist.txt'); heroData = (Join-Path $gameAddon 'scripts/npc/npc_heroes_custom.txt'); unitData = (Join-Path $gameAddon 'scripts/npc/npc_units_custom.txt'); abilityData = (Join-Path $gameAddon 'scripts/npc/npc_abilities_custom.txt'); contentMaps = (Join-Path $contentAddon 'maps'); panoramaSource = (Join-Path $contentAddon 'panorama'); panoramaRuntime = (Join-Path $gameAddon 'panorama'); packageJson = (Join-Path $contentAddon 'package.json') }`,
    "$evidence = @()",
    "function AddPathEvidence($path, $label) { if (Test-Path -LiteralPath $path) { $script:evidence += \"$label exists\" } else { $script:evidence += \"$label missing\" } }",
    "AddPathEvidence $paths.gameAddon 'game addon root'",
    "AddPathEvidence $paths.contentAddon 'content addon root'",
    "AddPathEvidence $paths.addonInfo 'addon metadata'",
    "AddPathEvidence $paths.luaEntry 'lua entry'",
    "AddPathEvidence $paths.localization 'localization file'",
    "AddPathEvidence $paths.heroList 'hero list'",
    "AddPathEvidence $paths.heroData 'hero data'",
    "AddPathEvidence $paths.unitData 'unit support file'",
    "AddPathEvidence $paths.abilityData 'ability support file'",
    "AddPathEvidence $paths.contentMaps 'content maps directory'",
    "AddPathEvidence $paths.panoramaSource 'panorama source directory'",
    "AddPathEvidence $paths.panoramaRuntime 'panorama runtime directory'",
    "if (Test-Path -LiteralPath $paths.panoramaSource) { Get-ChildItem -LiteralPath $paths.panoramaSource -Recurse -File -ErrorAction SilentlyContinue | Where-Object { @('.xml', '.js', '.css') -contains $_.Extension } | Sort-Object FullName | ForEach-Object { $relative = $_.FullName.Substring($contentAddon.Length).TrimStart('\\', '/').Replace('\\', '/'); $evidence += \"panorama source file exists: $relative\" } }",
    "$sawToolchainMarker = $false",
    "foreach ($marker in @('package.json', 'tsconfig.json', 'tsconfig.tstl.json', 'vite.config.ts', 'vite.config.js', 'webpack.config.js')) { $markerPath = Join-Path $contentAddon $marker; if (Test-Path -LiteralPath $markerPath) { $sawToolchainMarker = $true; $evidence += \"toolchain marker exists: $marker\" } else { $evidence += \"toolchain marker missing: $marker\" } }",
    "if ((Test-Path -LiteralPath $paths.packageJson) -and ((Get-Content -LiteralPath $paths.packageJson -Raw) -match '\"react\"\\s*:' -or (Get-Content -LiteralPath $paths.packageJson -Raw) -match '\"@moddota/panorama\"')) { $evidence += 'react panorama marker detected in package.json' }",
    "if (-not $sawToolchainMarker) { $evidence += 'toolchain markers absent' }",
    "$evidence += 'publishing preflight blockers reported'",
    "$evidence += 'preflight is not runtime validation'",
    "$warnings = @('publishing credentials are not accepted or inspected', 'Workshop upload is not supported by preflight', 'content encryption is not supported by preflight', 'preflight does not prove runtime validation')",
    "if ($sawToolchainMarker) { $warnings += 'toolchain markers are inspection-only; builds are not run' }",
    "@{ ok = $true; evidence = $evidence; warnings = $warnings; paths = $paths } | ConvertTo-Json -Depth 6 -Compress"
  ].join("; ");
}

function remoteDryRunReleaseReportScript(dotaRoot: string, addonName: string): string {
  const root = quoteForPowerShellSingleQuotedString(dotaRoot);
  const addon = quoteForPowerShellSingleQuotedString(addonName);
  const localization = quoteForPowerShellSingleQuotedString(`resource/addon_${addonName}_english.txt`);

  return [
    "$ErrorActionPreference = 'Stop'",
    `$root = ${root}`,
    `$addonName = ${addon}`,
    "$gameAddon = Join-Path $root (Join-Path 'game/dota_addons' $addonName)",
    "$contentAddon = Join-Path $root (Join-Path 'content/dota_addons' $addonName)",
    `$paths = @{ gameAddon = $gameAddon; contentAddon = $contentAddon; addonInfo = (Join-Path $gameAddon 'addoninfo.txt'); luaEntry = (Join-Path $gameAddon 'scripts/vscripts/addon_game_mode.lua'); localization = (Join-Path $gameAddon ${localization}); heroList = (Join-Path $gameAddon 'scripts/npc/herolist.txt'); heroData = (Join-Path $gameAddon 'scripts/npc/npc_heroes_custom.txt'); unitData = (Join-Path $gameAddon 'scripts/npc/npc_units_custom.txt'); abilityData = (Join-Path $gameAddon 'scripts/npc/npc_abilities_custom.txt'); contentMaps = (Join-Path $contentAddon 'maps') }`,
    "$evidence = @()",
    "$blockers = @()",
    "$warnings = @('Steam login is manual and out of scope', 'content encryption is manual and out of scope', 'Workshop upload is not performed by dry run', 'dry run does not prove runtime validation')",
    "function AddReleasePath($path, $label) { if (Test-Path -LiteralPath $path) { $script:evidence += \"package evidence: $label exists\" } else { $script:blockers += \"package blocker: $label missing\" } }",
    "AddReleasePath $paths.gameAddon 'game addon root'",
    "AddReleasePath $paths.contentAddon 'content addon root'",
    "AddReleasePath $paths.addonInfo 'addon metadata'",
    "AddReleasePath $paths.luaEntry 'lua entry'",
    "AddReleasePath $paths.localization 'localization file'",
    "AddReleasePath $paths.contentMaps 'content maps directory'",
    "AddReleasePath $paths.heroList 'hero list'",
    "AddReleasePath $paths.heroData 'hero data'",
    "AddReleasePath $paths.unitData 'unit support file'",
    "AddReleasePath $paths.abilityData 'ability support file'",
    "$metadataKeys = @('addonSteamAppID', 'addontitle', 'addonAuthor', 'addonDescription')",
    "$placeholderValues = @('', 'changeme', 'change me', 'placeholder', 'tbd', 'todo', 'unknown', 'your name')",
    "if (Test-Path -LiteralPath $paths.addonInfo) { $addonInfo = Get-Content -LiteralPath $paths.addonInfo -Raw; foreach ($key in $metadataKeys) { $match = [regex]::Match($addonInfo, '\"' + [regex]::Escape($key) + '\"\\s+\"([^\"]*)\"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase); if (-not $match.Success) { $blockers += \"metadata blocker: $key missing\" } elseif ($placeholderValues -contains $match.Groups[1].Value.Trim().ToLowerInvariant()) { $blockers += \"metadata blocker: $key placeholder\" } else { $evidence += \"metadata evidence: $key present\" } } } else { foreach ($key in $metadataKeys) { $blockers += \"metadata blocker: $key missing\" } }",
    "$textExts = @('.cfg', '.css', '.ini', '.js', '.json', '.kv', '.lua', '.md', '.ps1', '.ts', '.tsx', '.txt', '.vdf', '.xml', '.yaml', '.yml')",
    "$secretPatterns = @(@{ label = 'private key'; pattern = '-----BEGIN [A-Z ]*PRIVATE KEY-----' }, @{ label = 'github token'; pattern = 'gh[pousr]_[A-Za-z0-9_]{20,}' }, @{ label = 'steam credential'; pattern = '\\bsteam_(?:password|token|secret|apikey|api_key)\\b' }, @{ label = 'password'; pattern = '(?:\\b|_)(?:password|passwd|pwd)\\b\\s*[:=]' }, @{ label = 'token'; pattern = '\\b(?:token|api[_-]?key|secret)\\b\\s*[:=]' }, @{ label = 'host credential'; pattern = '\\b(?:remote_|windows_)?(?:host|username)\\b\\s*[:=].*\\b(?:password|token|secret|key)\\b' })",
    "foreach ($scanRoot in @($gameAddon, $contentAddon)) { if (Test-Path -LiteralPath $scanRoot) { Get-ChildItem -LiteralPath $scanRoot -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $relative = $_.FullName.Substring($scanRoot.Length).TrimStart('\\', '/').Replace('\\', '/'); if ($textExts -notcontains $_.Extension.ToLowerInvariant()) { $warnings += \"secret scan skipped non-text file: $relative\"; return }; if ($_.Length -gt 1048576) { $warnings += \"secret scan skipped oversized file: $relative\"; return }; $content = Get-Content -LiteralPath $_.FullName -Raw; foreach ($rule in $secretPatterns) { if ($content -match $rule.pattern) { $blockers += \"secret blocker: $relative matches $($rule.label)\" } } }; $evidence += \"secret scan completed: $scanRoot\" } }",
    "$evidence += \"release blockers: $($blockers.Count)\"",
    "$evidence += \"release warnings: $($warnings.Count)\"",
    "$evidence += 'dry-run release report generated'",
    "$evidence += 'no package archive created'",
    "$evidence += 'no content encryption performed'",
    "$evidence += 'no Workshop upload attempted'",
    "$evidence += 'release dry run is not runtime validation'",
    "$evidence += $blockers",
    "$ok = $blockers.Count -eq 0",
    "$errorPayload = if ($ok) { $null } else { @{ code = 'RELEASE_PREFLIGHT_BLOCKED'; message = 'Release dry run found blockers.' } }",
    "@{ ok = $ok; error = $errorPayload; evidence = $evidence; warnings = $warnings; paths = $paths } | ConvertTo-Json -Depth 6 -Compress"
  ].join("; ");
}

function remoteReadLogsScript(logPaths: string[]): string {
  const paths = logPaths.map((path) => `'${path}'`).join(", ");
  return `$logs = @(); foreach ($path in @(${paths})) { if (Test-Path -LiteralPath $path) { $lines = @(Get-Content -LiteralPath $path -Tail ${REMOTE_LOG_TAIL_LINES} | ForEach-Object { [string]$_ }); $logs += @{ source = $path; lines = $lines } } }; $logs | ConvertTo-Json -Compress`;
}

function remoteInteractiveLaunchScript(dotaRoot: string, addonName: string, taskName: string, argumentText: string, userId: string): string {
  return `$ErrorActionPreference = 'Stop'; $taskName = ${quoteForPowerShellSingleQuotedString(taskName)}; $root = ${quoteForPowerShellSingleQuotedString(dotaRoot)}; $steamRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $root)); $steamExe = Join-Path $steamRoot 'steam.exe'; if (-not (Test-Path -LiteralPath $steamExe)) { throw "STEAM_EXE_MISSING:$steamExe" }; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue; $registeredTask = $false; try { $action = New-ScheduledTaskAction -Execute $steamExe -Argument ${quoteForPowerShellSingleQuotedString(argumentText)}; $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5); $userId = ${quoteForPowerShellSingleQuotedString(userId)}; if ([string]::IsNullOrWhiteSpace($userId)) { $userId = $env:USERNAME }; $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null; $registeredTask = $true; $launchStart = (Get-Date); Start-ScheduledTask -TaskName $taskName; $deadline = (Get-Date).AddSeconds(30); do { Start-Sleep -Seconds 2; $processes = @(Get-CimInstance Win32_Process -Filter "name = 'dota2.exe' or name = 'dota2cfg.exe' or name = 'vconsole2.exe'" | Where-Object { $_.CreationDate -ge $launchStart.AddSeconds(-2) -and $_.CommandLine -match ${quoteForPowerShellSingleQuotedString(`-addon\\s+${addonName}`)} } | Select-Object ProcessId, Name, CommandLine, SessionId, CreationDate) } until ($processes.Count -gt 0 -or (Get-Date) -gt $deadline); $info = Get-ScheduledTaskInfo -TaskName $taskName; if ($processes.Count -eq 0) { throw 'INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND' }; @{ taskName = $taskName; steamExecutable = $steamExe; lastTaskResult = $info.LastTaskResult; processes = $processes } | ConvertTo-Json -Depth 5 -Compress } finally { if ($registeredTask) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue } }`;
}

function remoteDiscoverRecentLogsScript(dotaRoot: string): string {
  return `$root = ${quoteForPowerShellSingleQuotedString(dotaRoot)}; $steamRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $root)); $runtimeConsole = Join-Path $root 'game/dota/console.log'; $candidateRoots = @((Join-Path $root 'game/dota'), (Join-Path $root 'game/bin/win64'), (Join-Path $steamRoot 'logs')) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }; $namePattern = 'console|vconsole|dota|workshop|stderr|stdout|webhelper|overlay|content|controller|duration'; $files = @(); foreach ($candidateRoot in $candidateRoots) { $files += Get-ChildItem -LiteralPath $candidateRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-30) -and $_.Length -lt 20971520 -and ($_.Extension -eq '.log' -or $_.Name -match $namePattern) } }; $ordered = @(); $recentLimit = 10; if (Test-Path -LiteralPath $runtimeConsole) { $ordered += Get-Item -LiteralPath $runtimeConsole; $recentLimit = 9 }; $ordered += $files | Where-Object { $_.FullName -ne $runtimeConsole } | Sort-Object LastWriteTime -Descending | Select-Object -First $recentLimit; $logs = @(); foreach ($file in $ordered) { $tailLines = if ($file.FullName -eq $runtimeConsole) { ${REMOTE_LOG_TAIL_LINES} } else { ${REMOTE_AUXILIARY_LOG_TAIL_LINES} }; $lines = @(Get-Content -LiteralPath $file.FullName -Tail $tailLines | ForEach-Object { [string]$_ }); $logs += @{ source = $file.FullName; lines = $lines } }; $logs | ConvertTo-Json -Compress`;
}

async function defaultExecutor(command: CommandEvidence): Promise<RemoteCommandOutput> {
  try {
    const { stdout, stderr } = await execFileAsync(command.command, { shell: true });
    return {
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error) {
    const maybe = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: typeof maybe.code === "number" ? maybe.code : 1,
      stdout: maybe.stdout ?? "",
      stderr: maybe.stderr ?? String(error)
    };
  }
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).filter(Boolean);
}

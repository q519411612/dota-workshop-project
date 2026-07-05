import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { renderAddonFiles, validateAddonName, validateGameplayObjective, validateMapName, validateRuntimePlacement } from "./addon.js";
import { expectedMarkerList, findLuaStartupError, markerFoundEvidence, missingMarkers } from "./markers.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { GameplayObjective, RuntimePlacement } from "./addon.js";
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
  replace: boolean
): string {
  const gameAddon = `${dotaRoot}/game/dota_addons/${addonName}`;
  const contentAddon = `${dotaRoot}/content/dota_addons/${addonName}`;
  const files = renderAddonFiles(addonName, mapName, template, placement, objective);
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
    [`${gameAddon}/resource/addon_${addonName}_english.txt`, files.localization]
  ].map(([path, value]) => `Set-Content -LiteralPath ${quoteForPowerShellSingleQuotedString(path)} -Value ${quoteForPowerShellSingleQuotedString(value)}`).join("; ");

  return `${replaceScript} New-Item -ItemType Directory -Force -Path ${directories} | Out-Null; ${writes}`;
}

function remoteInspectAddonScript(dotaRoot: string, addonName: string): string {
  return `$gameAddon = '${dotaRoot}/game/dota_addons/${addonName}'; $contentAddon = '${dotaRoot}/content/dota_addons/${addonName}'; $evidence = @(); if (Test-Path -LiteralPath $gameAddon) { $evidence += 'game addon root exists' } else { $evidence += 'game addon root missing' }; if (Test-Path -LiteralPath $contentAddon) { $evidence += 'content addon root exists' } else { $evidence += 'content addon root missing' }; @{ evidence = $evidence; paths = @{ gameAddon = $gameAddon; contentAddon = $contentAddon } } | ConvertTo-Json -Compress`;
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

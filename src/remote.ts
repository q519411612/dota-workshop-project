import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateAddonName } from "./addon.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { CommandEvidence, RemoteTarget, ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);

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
};

export type RemoteCustomGameInput = RemoteLaunchInput & {
  mapName: string;
};

export type RemoteAddonInput = RemoteEnvironmentInput & {
  addonName: string;
  mapName?: string;
  replace?: boolean;
};

export type RemoteLogsInput = RemoteEnvironmentInput & {
  addonName: string;
  logPaths: string[];
  expectedMarker?: string;
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
  return launchRemoteDota({
    ...input,
    operation: "launch_custom_game",
    args: ["-novid", "-tools", "-addon", input.addonName, "+dota_launch_custom_game", input.addonName, input.mapName]
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
    command: remoteCreateAddonScript(input.target.dotaRoot!, input.addonName, input.mapName ?? "dota", input.replace ?? false),
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

  const result = await runRemoteCommand({
    target: input.target,
    command: remoteReadLogsScript(input.logPaths),
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
  const marker = input.expectedMarker ?? `[DOTA_WORKSHOP_MCP] addon loaded: ${input.addonName}`;
  const readResult = await readRemoteConsoleOrLogs(input);

  if (!readResult.ok) {
    return { ...readResult, operation };
  }

  const lines = readResult.logs.flatMap((log) => log.lines);
  const errorLine = lines.find((line) => /script runtime error|syntax error|lua/i.test(line) && /error/i.test(line));

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

  if (lines.includes(marker)) {
    return createSuccessResult({
      target: input.target,
      operation,
      evidence: [`found validation marker for ${input.addonName}`],
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
    evidence: [`expected marker: ${marker}`],
    paths: readResult.paths,
    commands: readResult.commands,
    logs: readResult.logs
  });
}

function buildRemoteCommand(target: RemoteTarget, command: string): CommandEvidence {
  if (target.transport === "ssh") {
    const destination = target.username ? `${target.username}@${target.host}` : target.host;
    return {
      command: `ssh ${destination} ${command}`
    };
  }

  const credential = target.username ? ` -Credential ${target.username}` : "";
  return {
    command: `Invoke-Command -ComputerName ${target.host}${credential} -ScriptBlock { ${command} }`
  };
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

  const executable = `${input.target.dotaRoot}/game/bin/win64/dota2.exe`;
  const command = `& "${executable}" ${input.args.join(" ")}`;
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

function remoteCreateAddonScript(dotaRoot: string, addonName: string, mapName: string, replace: boolean): string {
  const gameAddon = `${dotaRoot}/game/dota_addons/${addonName}`;
  const contentAddon = `${dotaRoot}/content/dota_addons/${addonName}`;
  const marker = `[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}`;
  const replaceScript = replace
    ? `Remove-Item -LiteralPath '${gameAddon}', '${contentAddon}' -Recurse -Force -ErrorAction SilentlyContinue;`
    : `if ((Test-Path -LiteralPath '${gameAddon}') -or (Test-Path -LiteralPath '${contentAddon}')) { throw 'ADDON_ALREADY_EXISTS' };`;

  return `${replaceScript} New-Item -ItemType Directory -Force -Path '${gameAddon}/scripts/vscripts', '${gameAddon}/scripts/npc', '${gameAddon}/resource', '${contentAddon}/maps' | Out-Null; Set-Content -LiteralPath '${gameAddon}/addoninfo.txt' -Value '"AddonInfo"\n{\n  "AddonName" "${addonName}"\n  "IsPlayable" "1"\n  "DefaultMap" "${mapName}"\n  "maps" "${mapName}"\n}'; Set-Content -LiteralPath '${gameAddon}/scripts/vscripts/addon_game_mode.lua' -Value 'function Precache(context)\nend\n\nfunction Activate()\n  print("${marker}")\nend\n'; Set-Content -LiteralPath '${gameAddon}/scripts/npc/herolist.txt' -Value '"CustomHeroList"\n{\n}'; Set-Content -LiteralPath '${gameAddon}/scripts/npc/npc_heroes_custom.txt' -Value '"DOTAHeroes"\n{\n}'; Set-Content -LiteralPath '${gameAddon}/resource/addon_${addonName}_english.txt' -Value '"lang"\n{\n  "Language" "english"\n  "Tokens"\n  {\n    "addon_game_name" "${addonName}"\n  }\n}'`;
}

function remoteInspectAddonScript(dotaRoot: string, addonName: string): string {
  return `$gameAddon = '${dotaRoot}/game/dota_addons/${addonName}'; $contentAddon = '${dotaRoot}/content/dota_addons/${addonName}'; $evidence = @(); if (Test-Path -LiteralPath $gameAddon) { $evidence += 'game addon root exists' } else { $evidence += 'game addon root missing' }; if (Test-Path -LiteralPath $contentAddon) { $evidence += 'content addon root exists' } else { $evidence += 'content addon root missing' }; @{ evidence = $evidence; paths = @{ gameAddon = $gameAddon; contentAddon = $contentAddon } } | ConvertTo-Json -Compress`;
}

function remoteReadLogsScript(logPaths: string[]): string {
  const paths = logPaths.map((path) => `'${path}'`).join(", ");
  return `$logs = @(); foreach ($path in @(${paths})) { if (Test-Path -LiteralPath $path) { $logs += @{ source = $path; lines = @(Get-Content -LiteralPath $path -Tail 200) } } }; $logs | ConvertTo-Json -Compress`;
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

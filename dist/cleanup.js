import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateAddonName } from "./addon.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import { runRemoteCommand } from "./remote.js";
const execFileAsync = promisify(execFile);
export async function cleanupPlayableSmoke(input) {
    const operation = "cleanup_playable_smoke";
    const validation = validateCleanupInput(input, operation);
    if (validation) {
        return validation;
    }
    const dryRun = input.dryRun ?? true;
    const script = cleanupProcessScript(input.addonName, dryRun);
    const paths = cleanupPaths(input.target);
    if (input.target.kind === "fixture" && !input.executor) {
        return cleanupSuccessFromPayload({
            target: input.target,
            payload: {
                addonName: input.addonName,
                dryRun,
                matchedCount: 0,
                stoppedProcessIds: [],
                processes: []
            },
            paths,
            commands: [{ command: localCleanupCommand(script).command }],
            logs: [],
            fixture: true
        });
    }
    if (input.target.kind === "remote") {
        const remoteResult = await runRemoteCommand({
            target: input.target,
            command: script,
            executor: input.executor
        });
        if (!remoteResult.ok) {
            return {
                ...remoteResult,
                operation,
                paths,
                warnings: cleanupWarnings(remoteResult.warnings)
            };
        }
        return cleanupFromStdout({
            target: input.target,
            stdout: remoteResult.commands[0]?.stdout ?? "",
            paths,
            commands: remoteResult.commands,
            logs: remoteResult.logs
        });
    }
    const command = localCleanupCommand(script);
    const output = await (input.executor ?? defaultExecutor)(command);
    const commandEvidence = {
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
                code: "CLEANUP_COMMAND_FAILED",
                message: "Playable smoke cleanup command failed."
            },
            evidence: [`cleanup command failed with exit code ${output.exitCode}`],
            warnings: cleanupWarnings(),
            paths,
            commands: [commandEvidence],
            logs: [{ source: "cleanup:stderr", lines: splitLines(output.stderr) }]
        });
    }
    return cleanupFromStdout({
        target: input.target,
        stdout: output.stdout,
        paths,
        commands: [commandEvidence],
        logs: [{ source: "cleanup:stdout", lines: splitLines(output.stdout) }]
    });
}
function validateCleanupInput(input, operation) {
    const nameValidation = validateAddonName(input.addonName);
    if (!nameValidation.ok) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "INVALID_ADDON_NAME",
                message: nameValidation.error ?? "Invalid addon name."
            },
            evidence: [`rejected cleanup addon name: ${input.addonName}`]
        });
    }
    if (input.target.kind === "local" && !input.target.dotaRoot) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "TARGET_ROOT_REQUIRED",
                message: "Local playable smoke cleanup requires a Dota install root."
            },
            evidence: ["local target did not include dotaRoot"]
        });
    }
    if (input.target.kind === "local" && !input.executor && process.platform !== "win32") {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "UNSUPPORTED_HOST_PLATFORM",
                message: "Local playable smoke cleanup requires a Windows host or an injected executor."
            },
            evidence: [`local cleanup host platform: ${process.platform}`]
        });
    }
    if (input.target.kind === "remote" && !input.target.dotaRoot) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "REMOTE_DOTA_ROOT_REQUIRED",
                message: "Remote playable smoke cleanup requires a Dota install root."
            },
            evidence: ["remote target did not include dotaRoot"]
        });
    }
    return undefined;
}
function cleanupFromStdout(input) {
    try {
        const payload = JSON.parse(input.stdout || "{}");
        return cleanupSuccessFromPayload({ ...input, payload });
    }
    catch {
        return createFailureResult({
            target: input.target,
            operation: "cleanup_playable_smoke",
            error: {
                code: "CLEANUP_RESULT_PARSE_FAILED",
                message: "Playable smoke cleanup did not return valid JSON."
            },
            evidence: ["cleanup stdout was not valid JSON"],
            warnings: cleanupWarnings(),
            paths: input.paths,
            commands: input.commands,
            logs: input.logs
        });
    }
}
function cleanupSuccessFromPayload(input) {
    const dryRun = input.payload.dryRun ?? true;
    const processes = normalizeProcesses(input.payload.processes);
    const stoppedProcessIds = normalizeNumbers(input.payload.stoppedProcessIds);
    const matchedCount = input.payload.matchedCount ?? processes.length;
    const addonName = input.payload.addonName ?? "unknown";
    const evidence = [`cleanup addon name: ${addonName}`, `cleanup mode: ${dryRun ? "dry-run" : "execute"}`];
    if (input.fixture) {
        evidence.push("fixture target does not execute process cleanup commands");
    }
    if (matchedCount === 0 || processes.length === 0) {
        evidence.push(`no matching Dota smoke process found for ${addonName}`);
    }
    else {
        for (const process of processes) {
            const processId = process.ProcessId ?? process.processId;
            const processName = process.Name ?? process.name ?? "unknown";
            evidence.push(`matched Dota smoke process ${processId ?? "unknown"}: ${processName}`);
        }
    }
    if (dryRun && matchedCount > 0) {
        evidence.push("dry-run did not stop matching processes");
    }
    if (!dryRun) {
        for (const processId of stoppedProcessIds) {
            evidence.push(`stopped Dota smoke process ${processId}`);
        }
    }
    return createSuccessResult({
        target: input.target,
        operation: "cleanup_playable_smoke",
        evidence,
        warnings: cleanupWarnings(),
        paths: input.paths,
        commands: input.commands,
        logs: input.logs
    });
}
function cleanupProcessScript(addonName, dryRun) {
    const dryRunValue = dryRun ? "$true" : "$false";
    const quotedAddonName = quoteForPowerShellSingleQuotedString(addonName);
    const stopBlock = dryRun
        ? ""
        : "if (-not $dryRun) { foreach ($process in $matches) { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop; $stopped += [int]$process.ProcessId } }; ";
    return [
        "$ErrorActionPreference = 'Stop'",
        `$addonName = ${quotedAddonName}`,
        `$dryRun = ${dryRunValue}`,
        "$names = @('dota2.exe', 'dota2cfg.exe', 'vconsole2.exe')",
        "$matches = @(Get-CimInstance Win32_Process | Where-Object { $names -contains $_.Name -and $_.CommandLine -and $_.CommandLine -match [regex]::Escape($addonName) } | Select-Object ProcessId, Name, CommandLine, SessionId)",
        "$stopped = @()",
        `${stopBlock}@{ addonName = $addonName; dryRun = $dryRun; matchedCount = $matches.Count; stoppedProcessIds = $stopped; processes = $matches } | ConvertTo-Json -Depth 5 -Compress`
    ].join("; ");
}
function localCleanupCommand(script) {
    return {
        command: `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script}"`
    };
}
function cleanupPaths(target) {
    if (target.kind === "fixture") {
        return { dotaRoot: target.root };
    }
    if (target.kind === "local" || target.kind === "remote") {
        return target.dotaRoot ? { dotaRoot: target.dotaRoot } : {};
    }
    return {};
}
function cleanupWarnings(extra = []) {
    return [
        "cleanup only targets Dota processes whose command line contains the requested addon name",
        "cleanup does not stop Steam processes",
        "cleanup does not delete generated smoke addon files",
        ...extra
    ];
}
function quoteForPowerShellSingleQuotedString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
function normalizeProcesses(value) {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}
function normalizeNumbers(value) {
    if (value === undefined) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}
function splitLines(value) {
    return value.split(/\r?\n/).filter(Boolean);
}
async function defaultExecutor(command) {
    try {
        const { stdout, stderr } = await execFileAsync(command.command, { shell: true });
        return { exitCode: 0, stdout, stderr };
    }
    catch (error) {
        const maybe = error;
        return {
            exitCode: typeof maybe.code === "number" ? maybe.code : 1,
            stdout: maybe.stdout ?? "",
            stderr: maybe.stderr ?? String(error)
        };
    }
}

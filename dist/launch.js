import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { validateAddonName, validateMapName } from "./addon.js";
import { validateInstallRoot } from "./environment.js";
import { createFailureResult, createSuccessResult } from "./result.js";
const execFileAsync = promisify(execFile);
export async function launchTools(input) {
    return launchDota({
        ...input,
        operation: "launch_tools",
        args: ["-novid", "-tools", "-addon", input.addonName]
    });
}
export async function launchCustomGame(input) {
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
    return launchDota({
        ...input,
        operation: "launch_custom_game",
        args: customGameArgs(input)
    });
}
export async function readConsoleOrLogs(input) {
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
    const logs = [];
    const evidence = [];
    const paths = {};
    const logPaths = input.logPaths && input.logPaths.length > 0
        ? input.logPaths
        : defaultLogPaths(input.target);
    for (const [index, logPath] of logPaths.entries()) {
        paths[`log${index}`] = logPath;
        try {
            const content = await readFile(logPath, "utf8");
            const lines = content.split(/\r?\n/).filter(Boolean);
            logs.push({ source: logPath, lines });
            evidence.push(`read log: ${logPath}`);
        }
        catch {
            evidence.push(`missing log: ${logPath}`);
        }
    }
    if (logs.length === 0) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "LOG_EVIDENCE_NOT_FOUND",
                message: "No readable Workshop Tools log or console evidence was found."
            },
            evidence,
            paths
        });
    }
    return createSuccessResult({
        target: input.target,
        operation,
        evidence,
        paths,
        logs
    });
}
export async function validateAddon(input) {
    const operation = "validate_addon";
    const marker = input.expectedMarker ?? `[DOTA_WORKSHOP_MCP] addon loaded: ${input.addonName}`;
    const readResult = await readConsoleOrLogs(input);
    if (!readResult.ok) {
        return { ...readResult, operation };
    }
    const allLines = readResult.logs.flatMap((log) => log.lines);
    const errorLine = allLines.find((line) => /script runtime error|syntax error|lua/i.test(line) && /error/i.test(line));
    if (errorLine) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "LUA_STARTUP_ERROR",
                message: "Workshop logs contain a Lua startup error."
            },
            evidence: [`detected Lua error: ${errorLine}`],
            paths: readResult.paths,
            logs: readResult.logs
        });
    }
    if (allLines.some((line) => line.includes(marker))) {
        return createSuccessResult({
            target: input.target,
            operation,
            evidence: [`found validation marker for ${input.addonName}`],
            paths: readResult.paths,
            logs: readResult.logs
        });
    }
    return createFailureResult({
        target: input.target,
        operation,
        error: {
            code: "VALIDATION_MARKER_NOT_FOUND",
            message: "Validation marker was not found in Workshop Tools logs."
        },
        evidence: [`expected marker: ${marker}`],
        paths: readResult.paths,
        logs: readResult.logs
    });
}
function customGameArgs(input) {
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
function defaultLogPaths(target) {
    const root = targetRoot(target);
    return root ? [join(root, "game/dota/console.log")] : [];
}
async function launchDota(input) {
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
    const root = targetRoot(input.target);
    if (!root) {
        return createFailureResult({
            target: input.target,
            operation: input.operation,
            error: {
                code: "TARGET_ROOT_REQUIRED",
                message: "Launch requires a target Dota root."
            }
        });
    }
    const validation = await validateInstallRoot({ target: input.target, dotaRoot: root });
    if (!validation.ok) {
        return { ...validation, operation: input.operation };
    }
    const executable = join(root, "game/bin/win64/dota2.exe");
    const command = `"${executable}" ${input.args.join(" ")}`;
    const commandEvidence = {
        command,
        cwd: join(root, "game/bin/win64")
    };
    if (input.dryRun) {
        return createSuccessResult({
            target: input.target,
            operation: input.operation,
            evidence: ["launch command constructed"],
            warnings: ["launch started or dry-run completed; validation still requires log evidence"],
            paths: validation.paths,
            commands: [commandEvidence]
        });
    }
    const output = await (input.executor ?? defaultExecutor)(commandEvidence);
    const completedCommand = {
        ...commandEvidence,
        exitCode: output.exitCode,
        stdout: output.stdout,
        stderr: output.stderr
    };
    if (output.exitCode !== 0) {
        return createFailureResult({
            target: input.target,
            operation: input.operation,
            error: {
                code: "LAUNCH_COMMAND_FAILED",
                message: "Dota launch command failed."
            },
            evidence: [`launch command failed with exit code ${output.exitCode}`],
            paths: validation.paths,
            commands: [completedCommand],
            logs: [{ source: "stderr", lines: output.stderr.split(/\r?\n/).filter(Boolean) }]
        });
    }
    return createSuccessResult({
        target: input.target,
        operation: input.operation,
        evidence: ["launch command completed"],
        warnings: ["launch command completed; validation still requires log evidence"],
        paths: validation.paths,
        commands: [completedCommand],
        logs: [{ source: "stdout", lines: output.stdout.split(/\r?\n/).filter(Boolean) }]
    });
}
function targetRoot(target) {
    if (target.kind === "fixture") {
        return target.root;
    }
    if (target.kind === "local" || target.kind === "remote") {
        return target.dotaRoot;
    }
    return undefined;
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

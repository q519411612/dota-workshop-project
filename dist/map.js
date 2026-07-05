import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { validateAddonName, validateMapName } from "./addon.js";
import { runRemoteCommand } from "./remote.js";
import { createFailureResult, createSuccessResult } from "./result.js";
const REQUIRED_SPAWN_MARKERS = [
    "info_player_start_goodguys",
    "info_player_start_badguys"
];
const execFileAsync = promisify(execFile);
export async function prepareCustomMap(input) {
    const operation = "prepare_custom_map";
    const validation = validatePrepareInput(input, operation);
    if (validation) {
        return validation;
    }
    if (input.target.kind === "remote") {
        return prepareRemoteCustomMap(input);
    }
    return prepareLocalCustomMap(input);
}
async function prepareLocalCustomMap(input) {
    const operation = "prepare_custom_map";
    const root = targetRoot(input.target);
    if (!root) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "TARGET_ROOT_REQUIRED",
                message: "Custom map preparation requires a fixture root or target Dota root."
            },
            evidence: ["target did not include a Dota root"]
        });
    }
    const paths = mapPaths(root, input);
    const missingPathFailure = await validateLocalPaths(input, paths);
    if (missingPathFailure) {
        return missingPathFailure;
    }
    await mkdir(dirname(paths.contentMap), { recursive: true });
    await copyFile(paths.templateMap, paths.contentMap);
    const markerEvidence = await inspectSpawnMarkers(paths.contentMap);
    if (!markerEvidence.ok) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "CUSTOM_MAP_SPAWN_MARKER_MISSING",
                message: "Copied custom map source is missing required spawn entity markers."
            },
            evidence: markerEvidence.evidence,
            paths
        });
    }
    const command = compileCommand(paths);
    const output = await executeLocalCompile(input, command);
    if (!output.ok) {
        return output.result;
    }
    if (!(await pathExists(paths.compiledMap))) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "CUSTOM_MAP_OUTPUT_MISSING",
                message: "resourcecompiler.exe completed but the expected compiled map output was not found."
            },
            evidence: [`missing compiled map output: ${input.mapName}`],
            paths,
            commands: [output.command]
        });
    }
    return createSuccessResult({
        target: input.target,
        operation,
        evidence: [
            `prepared custom map source for ${input.addonName}/${input.mapName}`,
            ...markerEvidence.evidence,
            "compiled custom map with resourcecompiler"
        ],
        paths,
        commands: [output.command],
        logs: compileLogs(output.command)
    });
}
async function prepareRemoteCustomMap(input) {
    const operation = "prepare_custom_map";
    if (!input.target.dotaRoot) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "REMOTE_DOTA_ROOT_REQUIRED",
                message: "Remote custom map preparation requires a Dota install root."
            },
            evidence: ["remote target did not include dotaRoot"]
        });
    }
    const commandResult = await runRemoteCommand({
        target: input.target,
        command: remotePrepareCustomMapScript(input),
        executor: input.executor
    });
    if (!commandResult.ok) {
        return { ...commandResult, operation };
    }
    const stdout = commandResult.commands[0]?.stdout ?? "";
    let payload;
    try {
        payload = JSON.parse(stdout);
    }
    catch {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "REMOTE_CUSTOM_MAP_PARSE_FAILED",
                message: "Remote custom map preparation did not return valid JSON."
            },
            evidence: ["remote stdout was not valid JSON"],
            commands: commandResult.commands,
            logs: commandResult.logs
        });
    }
    const logs = [
        ...commandResult.logs,
        ...compilePayloadLogs(payload)
    ];
    if (!payload.ok) {
        return createFailureResult({
            target: input.target,
            operation,
            error: payload.error ?? {
                code: "REMOTE_CUSTOM_MAP_FAILED",
                message: "Remote custom map preparation failed."
            },
            evidence: payload.evidence ?? [],
            warnings: payload.warnings ?? [],
            paths: payload.paths ?? {},
            commands: commandResult.commands,
            logs
        });
    }
    return createSuccessResult({
        target: input.target,
        operation,
        evidence: payload.evidence ?? [`prepared custom map source for ${input.addonName}/${input.mapName}`],
        warnings: payload.warnings ?? [],
        paths: payload.paths ?? {},
        commands: commandResult.commands,
        logs
    });
}
function validatePrepareInput(input, operation) {
    const addonValidation = validateAddonName(input.addonName);
    if (!addonValidation.ok) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "INVALID_ADDON_NAME",
                message: addonValidation.error ?? "Invalid addon name."
            },
            evidence: [`rejected addon name: ${input.addonName}`]
        });
    }
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
    const templateAddonName = input.templateAddonName ?? "addon_template";
    const templateAddonValidation = validateAddonName(templateAddonName);
    if (!templateAddonValidation.ok) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "INVALID_TEMPLATE_ADDON_NAME",
                message: templateAddonValidation.error ?? "Invalid template addon name."
            },
            evidence: [`rejected template addon name: ${templateAddonName}`]
        });
    }
    const templateMapName = input.templateMapName ?? "template_map";
    const templateMapValidation = validateMapName(templateMapName);
    if (!templateMapValidation.ok) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "INVALID_TEMPLATE_MAP_NAME",
                message: templateMapValidation.error ?? "Invalid template map name."
            },
            evidence: [`rejected template map name: ${templateMapName}`]
        });
    }
    return undefined;
}
async function validateLocalPaths(input, paths) {
    const operation = "prepare_custom_map";
    if (!(await pathExists(paths.templateMap))) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "CUSTOM_MAP_TEMPLATE_MISSING",
                message: "Template map source was not found."
            },
            evidence: ["missing template map source"],
            paths
        });
    }
    if (await pathExists(paths.contentMap) && !input.replace) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "CUSTOM_MAP_ALREADY_EXISTS",
                message: "Custom map source already exists. Explicit replacement is required before overwriting."
            },
            evidence: [`custom map source already exists: ${input.mapName}`],
            paths
        });
    }
    if (!(await pathExists(paths.resourceCompiler))) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "CUSTOM_MAP_COMPILER_MISSING",
                message: "resourcecompiler.exe was not found under the target Dota root."
            },
            evidence: ["missing resourcecompiler.exe"],
            paths
        });
    }
    if (!(await pathExists(paths.gameInfo))) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "CUSTOM_MAP_GAMEINFO_MISSING",
                message: "Dota gameinfo.gi was not found under the target Dota root."
            },
            evidence: ["missing gameinfo.gi"],
            paths
        });
    }
    return undefined;
}
async function inspectSpawnMarkers(contentMap) {
    const content = await readFile(contentMap);
    const text = content.toString("latin1");
    const evidence = [];
    for (const marker of REQUIRED_SPAWN_MARKERS) {
        if (text.includes(marker)) {
            evidence.push(`found spawn entity marker: ${marker}`);
        }
        else {
            evidence.push(`missing spawn entity marker: ${marker}`);
        }
    }
    return {
        ok: evidence.every((item) => item.startsWith("found")),
        evidence
    };
}
async function executeLocalCompile(input, command) {
    if (!input.executor && input.target.kind === "local" && process.platform !== "win32") {
        return {
            ok: false,
            result: createFailureResult({
                target: input.target,
                operation: "prepare_custom_map",
                error: {
                    code: "UNSUPPORTED_HOST_PLATFORM",
                    message: "Local custom map compilation requires Windows or an injected executor."
                },
                evidence: [`local map compile host platform: ${process.platform}`],
                commands: []
            })
        };
    }
    if (!input.executor && input.target.kind === "fixture") {
        return {
            ok: false,
            result: createFailureResult({
                target: input.target,
                operation: "prepare_custom_map",
                error: {
                    code: "CUSTOM_MAP_EXECUTOR_REQUIRED",
                    message: "Fixture custom map compilation requires an injected executor."
                },
                evidence: ["fixture map compile requires an injected executor"],
                commands: []
            })
        };
    }
    const output = await (input.executor ?? defaultExecutor)(command);
    const completedCommand = {
        ...command,
        exitCode: output.exitCode,
        stdout: output.stdout,
        stderr: output.stderr
    };
    if (output.exitCode !== 0) {
        return {
            ok: false,
            result: createFailureResult({
                target: input.target,
                operation: "prepare_custom_map",
                error: {
                    code: "CUSTOM_MAP_COMPILE_FAILED",
                    message: "resourcecompiler.exe failed while compiling the custom map."
                },
                evidence: [`resourcecompiler.exe failed with exit code ${output.exitCode}`],
                paths: mapPaths(targetRoot(input.target), input),
                commands: [completedCommand],
                logs: compileLogs(completedCommand)
            })
        };
    }
    return { ok: true, command: completedCommand };
}
function mapPaths(root, input) {
    const templateAddonName = input.templateAddonName ?? "addon_template";
    const templateMapName = input.templateMapName ?? "template_map";
    return {
        dotaRoot: root,
        templateMap: join(root, "content/dota_addons", templateAddonName, "maps", `${templateMapName}.vmap`),
        contentMap: join(root, "content/dota_addons", input.addonName, "maps", `${input.mapName}.vmap`),
        compiledMap: join(root, "game/dota_addons", input.addonName, "maps", `${input.mapName}.vpk`),
        resourceCompiler: join(root, "game/bin/win64/resourcecompiler.exe"),
        gameDir: join(root, "game/dota"),
        gameInfo: join(root, "game/dota/gameinfo.gi")
    };
}
function compileCommand(paths) {
    return {
        command: `"${paths.resourceCompiler}" -i "${paths.contentMap}" -game "${paths.gameDir}" -f`,
        cwd: dirname(paths.resourceCompiler)
    };
}
function remotePrepareCustomMapScript(input) {
    const root = input.target.dotaRoot;
    const templateAddonName = input.templateAddonName ?? "addon_template";
    const templateMapName = input.templateMapName ?? "template_map";
    const replace = input.replace ? "$true" : "$false";
    const templateRelative = `content/dota_addons/${templateAddonName}/maps/${templateMapName}.vmap`;
    const contentRelative = `content/dota_addons/${input.addonName}/maps/${input.mapName}.vmap`;
    const compiledRelative = `game/dota_addons/${input.addonName}/maps/${input.mapName}.vpk`;
    const gameDirRelative = "game/dota";
    return [
        "$ErrorActionPreference = 'Stop'",
        `$root = ${quoteForPowerShellSingleQuotedString(root)}`,
        `$addonName = ${quoteForPowerShellSingleQuotedString(input.addonName)}`,
        `$mapName = ${quoteForPowerShellSingleQuotedString(input.mapName)}`,
        `$templateAddonName = ${quoteForPowerShellSingleQuotedString(templateAddonName)}`,
        `$templateMapName = ${quoteForPowerShellSingleQuotedString(templateMapName)}`,
        `$replace = ${replace}`,
        `$paths = @{ templateMap = (Join-Path $root ${quoteForPowerShellSingleQuotedString(templateRelative)}); contentMap = (Join-Path $root ${quoteForPowerShellSingleQuotedString(contentRelative)}); compiledMap = (Join-Path $root ${quoteForPowerShellSingleQuotedString(compiledRelative)}); resourceCompiler = (Join-Path $root 'game/bin/win64/resourcecompiler.exe'); gameDir = (Join-Path $root ${quoteForPowerShellSingleQuotedString(gameDirRelative)}); gameInfo = (Join-Path $root 'game/dota/gameinfo.gi') }`,
        "function Complete($payload) { $payload | ConvertTo-Json -Depth 6 -Compress }",
        "function Fail($code, $message, $evidence) { Complete @{ ok = $false; error = @{ code = $code; message = $message }; evidence = @($evidence); paths = $paths } }",
        "try {",
        "  if (-not (Test-Path -LiteralPath $paths.templateMap)) { Fail 'CUSTOM_MAP_TEMPLATE_MISSING' 'Template map source was not found.' @('missing template map source'); exit 0 }",
        "  if ((Test-Path -LiteralPath $paths.contentMap) -and -not $replace) { Fail 'CUSTOM_MAP_ALREADY_EXISTS' 'Custom map source already exists. Explicit replacement is required before overwriting.' @(\"custom map source already exists: $mapName\"); exit 0 }",
        "  if (-not (Test-Path -LiteralPath $paths.resourceCompiler)) { Fail 'CUSTOM_MAP_COMPILER_MISSING' 'resourcecompiler.exe was not found under the target Dota root.' @('missing resourcecompiler.exe'); exit 0 }",
        "  if (-not (Test-Path -LiteralPath $paths.gameInfo)) { Fail 'CUSTOM_MAP_GAMEINFO_MISSING' 'Dota gameinfo.gi was not found under the target Dota root.' @('missing gameinfo.gi'); exit 0 }",
        "  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $paths.contentMap) | Out-Null",
        "  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $paths.compiledMap) | Out-Null",
        "  Copy-Item -LiteralPath $paths.templateMap -Destination $paths.contentMap -Force:$replace",
        "  $mapBytes = [System.IO.File]::ReadAllBytes($paths.contentMap)",
        "  $mapText = [System.Text.Encoding]::ASCII.GetString($mapBytes)",
        "  $markerEvidence = @()",
        "  foreach ($marker in @('info_player_start_goodguys', 'info_player_start_badguys')) {",
        "    if ($mapText.Contains($marker)) { $markerEvidence += \"found spawn entity marker: $marker\" } else { Fail 'CUSTOM_MAP_SPAWN_MARKER_MISSING' 'Copied custom map source is missing required spawn entity markers.' @(\"missing spawn entity marker: $marker\"); exit 0 }",
        "  }",
        "  $compileLines = @(& $paths.resourceCompiler -i $paths.contentMap -game $paths.gameDir -f 2>&1 | ForEach-Object { [string]$_ })",
        "  $compileExitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }",
        "  $compileStdout = ($compileLines -join \"`n\")",
        "  $compile = @{ exitCode = $compileExitCode; stdout = $compileStdout; stderr = '' }",
        "  if ($compileExitCode -ne 0) { Complete @{ ok = $false; error = @{ code = 'CUSTOM_MAP_COMPILE_FAILED'; message = 'resourcecompiler.exe failed while compiling the custom map.' }; evidence = @(\"resourcecompiler.exe failed with exit code $compileExitCode\"); paths = $paths; compile = $compile }; exit 0 }",
        "  if (-not (Test-Path -LiteralPath $paths.compiledMap)) { Complete @{ ok = $false; error = @{ code = 'CUSTOM_MAP_OUTPUT_MISSING'; message = 'resourcecompiler.exe completed but the expected compiled map output was not found.' }; evidence = @(\"missing compiled map output: $mapName\"); paths = $paths; compile = $compile }; exit 0 }",
        "  Complete @{ ok = $true; evidence = @(\"prepared custom map source for $addonName/$mapName\") + $markerEvidence + @('compiled custom map with resourcecompiler'); paths = $paths; compile = $compile }",
        "} catch {",
        "  Complete @{ ok = $false; error = @{ code = 'REMOTE_CUSTOM_MAP_EXCEPTION'; message = [string]$_.Exception.Message }; evidence = @([string]$_.Exception.Message); paths = $paths }",
        "}"
    ].join("; ");
}
function compileLogs(command) {
    return [
        { source: "resourcecompiler:stdout", lines: splitLines(command.stdout ?? "") },
        { source: "resourcecompiler:stderr", lines: splitLines(command.stderr ?? "") }
    ].filter((log) => log.lines.length > 0);
}
function compilePayloadLogs(payload) {
    if (!payload.compile) {
        return [];
    }
    return [
        { source: "resourcecompiler:stdout", lines: splitLines(payload.compile.stdout) },
        { source: "resourcecompiler:stderr", lines: splitLines(payload.compile.stderr) }
    ].filter((log) => log.lines.length > 0);
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
async function pathExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
function quoteForPowerShellSingleQuotedString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
function splitLines(value) {
    return value.split(/\r?\n/).filter(Boolean);
}
async function defaultExecutor(command) {
    try {
        const { stdout, stderr } = await execFileAsync(command.command, {
            cwd: command.cwd,
            shell: true
        });
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

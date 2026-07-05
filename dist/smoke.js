import { createAddon, inspectAddon, objectiveMarkers, placementMarkers, validateAddonName, validateGameplayObjective, validateMapName, validateRuntimePlacement } from "./addon.js";
import { launchCustomGame, validateAddon } from "./launch.js";
import { prepareCustomMap } from "./map.js";
import { createRemoteAddon, inspectRemoteAddon, launchRemoteCustomGame, validateRemoteAddon } from "./remote.js";
import { createFailureResult, createSuccessResult } from "./result.js";
const DEFAULT_VALIDATION_TIMEOUT_MS = 120000;
const DEFAULT_VALIDATION_POLL_INTERVAL_MS = 5000;
export function playableSmokeMarkers(addonName) {
    return [
        `[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}`,
        `[DOTA_WORKSHOP_MCP] gamemode initialized: ${addonName}`,
        `[DOTA_WORKSHOP_MCP] round started: ${addonName}`,
        `[DOTA_WORKSHOP_MCP] score updated: ${addonName}`,
        `[DOTA_WORKSHOP_MCP] win condition reached: ${addonName}`
    ];
}
export function generatePlayableSmokeAddonName(prefix = "playable_smoke") {
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
export async function runPlayableSmoke(input) {
    const operation = "run_playable_smoke";
    const mapName = input.customMap?.mapName ?? input.mapName ?? "dota";
    const addonName = input.addonName ?? generatePlayableSmokeAddonName(input.addonPrefix);
    const expectedMarkers = input.expectedMarkers ?? playableSmokeMarkers(addonName).concat(input.placement ? placementMarkers(addonName, input.placement) : [], input.objective ? objectiveMarkers(addonName, input.objective) : []);
    const validation = validateSmokeInput(addonName, mapName, input);
    if (validation) {
        return validation;
    }
    const transcript = [];
    if (input.target.kind === "remote") {
        const createResult = await createRemoteAddon({
            target: input.target,
            addonName,
            mapName,
            template: "playable",
            placement: input.placement,
            objective: input.objective,
            replace: input.replace,
            executor: input.executor
        });
        transcript.push(createResult);
        if (!createResult.ok)
            return smokeFailure(input.target, createResult, transcript, addonName);
        const prepareResult = await prepareCustomMapForSmoke(input, addonName);
        if (prepareResult) {
            transcript.push(prepareResult);
            if (!prepareResult.ok)
                return smokeFailure(input.target, prepareResult, transcript, addonName);
        }
        const inspectResult = await inspectRemoteAddon({
            target: input.target,
            addonName,
            executor: input.executor
        });
        transcript.push(inspectResult);
        if (!inspectResult.ok)
            return smokeFailure(input.target, inspectResult, transcript, addonName);
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
        if (!launchResult.ok)
            return smokeFailure(input.target, launchResult, transcript, addonName);
        const validateResults = await validateRemoteWithPolling(input, addonName, expectedMarkers);
        transcript.push(...validateResults);
        const validateResult = validateResults[validateResults.length - 1];
        if (!validateResult.ok)
            return smokeFailure(input.target, validateResult, transcript, addonName);
        return smokeSuccess(input.target, transcript, addonName);
    }
    const createResult = await createAddon({
        target: input.target,
        addonName,
        mapName,
        template: "playable",
        placement: input.placement,
        objective: input.objective,
        replace: input.replace
    });
    transcript.push(createResult);
    if (!createResult.ok)
        return smokeFailure(input.target, createResult, transcript, addonName);
    const prepareResult = await prepareCustomMapForSmoke(input, addonName);
    if (prepareResult) {
        transcript.push(prepareResult);
        if (!prepareResult.ok)
            return smokeFailure(input.target, prepareResult, transcript, addonName);
    }
    const inspectResult = await inspectAddon({
        target: input.target,
        addonName
    });
    transcript.push(inspectResult);
    if (!inspectResult.ok)
        return smokeFailure(input.target, inspectResult, transcript, addonName);
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
    if (!launchResult.ok)
        return smokeFailure(input.target, launchResult, transcript, addonName);
    const validateResults = await validateLocalWithPolling(input, addonName, expectedMarkers);
    transcript.push(...validateResults);
    const validateResult = validateResults[validateResults.length - 1];
    if (!validateResult.ok)
        return smokeFailure(input.target, validateResult, transcript, addonName);
    return smokeSuccess(input.target, transcript, addonName);
}
async function validateRemoteWithPolling(input, addonName, expectedMarkers) {
    return pollValidation(input, () => validateRemoteAddon({
        target: input.target,
        addonName,
        logPaths: input.logPaths,
        expectedMarkers,
        executor: input.executor
    }));
}
async function validateLocalWithPolling(input, addonName, expectedMarkers) {
    return pollValidation(input, () => validateAddon({
        target: input.target,
        addonName,
        logPaths: input.logPaths,
        expectedMarkers
    }));
}
async function pollValidation(input, runValidation) {
    const timeoutMs = input.validationTimeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS;
    const intervalMs = input.validationPollIntervalMs ?? DEFAULT_VALIDATION_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    const results = [];
    while (true) {
        const result = await runValidation();
        results.push(result);
        if (result.ok || !isRetryableValidationMiss(result) || Date.now() >= deadline) {
            return results;
        }
        await sleep(intervalMs);
    }
}
function isRetryableValidationMiss(result) {
    return result.error?.code === "VALIDATION_MARKER_NOT_FOUND" ||
        result.error?.code === "LOG_EVIDENCE_NOT_FOUND";
}
async function sleep(ms) {
    if (ms <= 0) {
        return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
}
function validateSmokeInput(addonName, mapName, input) {
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
    if (input.customMap && input.mapName && input.mapName !== input.customMap.mapName) {
        return createFailureResult({
            target: input.target,
            operation: "run_playable_smoke",
            error: {
                code: "CUSTOM_MAP_NAME_CONFLICT",
                message: "customMap.mapName must match mapName when both are provided."
            },
            evidence: [`mapName ${input.mapName} conflicts with customMap.mapName ${input.customMap.mapName}`]
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
    if (input.objective) {
        const objectiveValidation = validateGameplayObjective(input.objective);
        if (!objectiveValidation.ok) {
            return createFailureResult({
                target: input.target,
                operation: "run_playable_smoke",
                error: {
                    code: "INVALID_OBJECTIVE",
                    message: objectiveValidation.error ?? "Invalid gameplay objective."
                },
                evidence: [objectiveValidation.error ?? "rejected gameplay objective"]
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
async function prepareCustomMapForSmoke(input, addonName) {
    if (!input.customMap) {
        return undefined;
    }
    return prepareCustomMap({
        target: input.target,
        addonName,
        mapName: input.customMap.mapName,
        templateAddonName: input.customMap.templateAddonName,
        templateMapName: input.customMap.templateMapName,
        replace: input.customMap.replace ?? input.replace,
        executor: input.executor
    });
}
function smokeSuccess(target, results, addonName) {
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
function smokeFailure(target, failedResult, results, addonName) {
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
function compactTranscriptResults(results) {
    return results.filter((result, index) => {
        const isFinalResult = index === results.length - 1;
        return isFinalResult || !isRetryableValidationMiss(result);
    });
}
function smokeEvidence(results, addonName) {
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
function smokeWarnings(results) {
    return [
        "generated smoke addon files are left on the target for inspection",
        ...results.flatMap((result) => result.warnings)
    ];
}
function smokePaths(results, addonName) {
    return {
        smokeAddonName: addonName,
        ...Object.assign({}, ...results.map((result) => result.paths))
    };
}

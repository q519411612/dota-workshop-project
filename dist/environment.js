import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFailureResult, createSuccessResult } from "./result.js";
export async function validateInstallRoot(input) {
    const operation = "validate_target";
    const paths = installPaths(input.dotaRoot);
    const evidence = [];
    const missing = [];
    await checkRequiredPath(paths.dotaExecutable, "verified dota2.exe", "missing dota2.exe", evidence, missing);
    await checkRequiredPath(paths.vconsoleExecutable, "verified vconsole2.exe", "missing vconsole2.exe", evidence, missing);
    await checkRequiredPath(paths.gameAddonsRoot, "verified game addon root", "missing game addon root", evidence, missing);
    await checkRequiredPath(paths.contentAddonsRoot, "verified content addon root", "missing content addon root", evidence, missing);
    if (missing.length > 0) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "WORKSHOP_TOOLS_PATH_MISSING",
                message: "The Dota install root is missing required Workshop Tools paths."
            },
            evidence,
            paths
        });
    }
    return createSuccessResult({
        target: input.target,
        operation,
        evidence,
        paths
    });
}
export async function discoverEnvironment(input) {
    const operation = "discover_environment";
    const platform = input.platform ?? process.platform;
    if (input.target.kind === "fixture") {
        const result = await validateInstallRoot({
            target: input.target,
            dotaRoot: input.target.root
        });
        return { ...result, operation };
    }
    if (input.target.kind === "local") {
        if (platform !== "win32") {
            return createFailureResult({
                target: input.target,
                operation,
                error: {
                    code: "UNSUPPORTED_OS",
                    message: "Local Dota 2 Workshop Tools discovery requires Windows."
                },
                evidence: [`detected platform: ${platform}`]
            });
        }
        if (input.target.dotaRoot) {
            const result = await validateInstallRoot({
                target: input.target,
                dotaRoot: input.target.dotaRoot
            });
            return { ...result, operation };
        }
        const candidates = await discoverCandidateRoots(input.environment ?? process.env);
        for (const candidate of candidates) {
            const result = await validateInstallRoot({
                target: input.target,
                dotaRoot: candidate
            });
            if (result.ok) {
                return {
                    ...result,
                    operation,
                    evidence: [`discovered Dota install root: ${candidate}`, ...result.evidence]
                };
            }
        }
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "DOTA_INSTALL_NOT_FOUND",
                message: "Dota 2 install root was not provided or discovered."
            },
            evidence: candidates.length > 0
                ? candidates.map((candidate) => `checked candidate: ${candidate}`)
                : ["no Dota install candidates discovered from environment"]
        });
    }
    if (input.target.kind === "remote") {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "REMOTE_DISCOVERY_REQUIRES_EXECUTION",
                message: "Remote discovery must run through the remote command adapter."
            },
            evidence: [`remote transport selected: ${input.target.transport}`]
        });
    }
    return createFailureResult({
        target: input.target,
        operation,
        error: {
            code: "UNSUPPORTED_TARGET",
            message: "Unsupported target kind."
        }
    });
}
async function discoverCandidateRoots(environment) {
    const candidates = new Set();
    if (environment.DOTA_INSTALL_ROOT) {
        candidates.add(environment.DOTA_INSTALL_ROOT);
    }
    const steamRoots = new Set();
    if (environment.STEAM_ROOT) {
        steamRoots.add(environment.STEAM_ROOT);
    }
    if (environment.STEAM_LIBRARY_ROOTS) {
        for (const entry of environment.STEAM_LIBRARY_ROOTS.split(";")) {
            const trimmed = entry.trim();
            if (trimmed.length > 0) {
                steamRoots.add(trimmed);
            }
        }
    }
    for (const steamRoot of steamRoots) {
        candidates.add(join(steamRoot, "steamapps/common/dota 2 beta"));
        for (const libraryRoot of await readSteamLibraryRoots(steamRoot)) {
            candidates.add(join(libraryRoot, "steamapps/common/dota 2 beta"));
        }
    }
    return [...candidates];
}
async function readSteamLibraryRoots(steamRoot) {
    try {
        const content = await readFile(join(steamRoot, "config/libraryfolders.vdf"), "utf8");
        const roots = [];
        const pattern = /"path"\s+"([^"]+)"/g;
        let match;
        while ((match = pattern.exec(content)) !== null) {
            roots.push(match[1].replace(/\\\\/g, "\\"));
        }
        return roots;
    }
    catch {
        return [];
    }
}
function installPaths(dotaRoot) {
    return {
        dotaRoot,
        dotaExecutable: join(dotaRoot, "game/bin/win64/dota2.exe"),
        vconsoleExecutable: join(dotaRoot, "game/bin/win64/vconsole2.exe"),
        gameAddonsRoot: join(dotaRoot, "game/dota_addons"),
        contentAddonsRoot: join(dotaRoot, "content/dota_addons")
    };
}
async function checkRequiredPath(path, presentText, missingText, evidence, missing) {
    try {
        await access(path);
        evidence.push(presentText);
    }
    catch {
        evidence.push(`${missingText}: ${path}`);
        missing.push(path);
    }
}

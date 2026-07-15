import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { validateAddonName } from "./addon.js";
import { evaluateReleaseReadiness, isReleaseTextPath, MAX_SECRET_SCAN_BYTES } from "./release-readiness.js";
import { createFailureResult, createSuccessResult } from "./result.js";
const DEFAULT_RELEASE_READINESS_FILE_SYSTEM = {
    readFile: (path) => readFile(path, "utf8"),
    stat
};
const TOOLCHAIN_MARKERS = [
    "package.json",
    "tsconfig.json",
    "tsconfig.tstl.json",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js"
];
const PANORAMA_EXTENSIONS = new Set([".xml", ".js", ".css"]);
export async function inspectWorkshopPreflight(input) {
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
    const root = targetRoot(input.target);
    if (!root) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "TARGET_ROOT_REQUIRED",
                message: "Workshop preflight requires a fixture root or target Dota root."
            },
            evidence: ["target did not include a Dota root"]
        });
    }
    const paths = preflightPaths(root, input.addonName);
    const evidence = await preflightEvidence(paths);
    const warnings = await preflightWarnings(paths);
    return createSuccessResult({
        target: input.target,
        operation,
        evidence,
        warnings,
        paths
    });
}
export async function dryRunReleaseReport(input, fileSystem = DEFAULT_RELEASE_READINESS_FILE_SYSTEM) {
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
    const root = targetRoot(input.target);
    if (!root) {
        return createFailureResult({
            target: input.target,
            operation,
            error: {
                code: "TARGET_ROOT_REQUIRED",
                message: "Release dry run requires a fixture root or target Dota root."
            },
            evidence: ["target did not include a Dota root"]
        });
    }
    const paths = preflightPaths(root, input.addonName);
    const observations = await collectReleaseReadinessObservations(paths, fileSystem);
    const findings = evaluateReleaseReadiness(observations);
    const { evidence, blockers, warnings } = renderDryRunReadiness(findings, paths);
    evidence.push(`release blockers: ${blockers.length}`);
    evidence.push(`release warnings: ${warnings.length}`);
    evidence.push("dry-run release report generated");
    evidence.push("no package archive created");
    evidence.push("no content encryption performed");
    evidence.push("no Workshop upload attempted");
    evidence.push("release dry run is not runtime validation");
    evidence.push(...blockers);
    const base = {
        target: input.target,
        operation,
        evidence,
        warnings,
        paths
    };
    if (blockers.length > 0) {
        return createFailureResult({
            ...base,
            error: {
                code: "RELEASE_PREFLIGHT_BLOCKED",
                message: "Release dry run found blockers."
            }
        });
    }
    return createSuccessResult(base);
}
function targetRoot(target) {
    if (target.kind === "fixture")
        return target.root;
    if (target.kind === "local")
        return target.dotaRoot;
    return undefined;
}
function preflightPaths(root, addonName) {
    const gameAddon = join(root, "game/dota_addons", addonName);
    const contentAddon = join(root, "content/dota_addons", addonName);
    return {
        gameAddon,
        contentAddon,
        addonInfo: join(gameAddon, "addoninfo.txt"),
        luaEntry: join(gameAddon, "scripts/vscripts/addon_game_mode.lua"),
        localization: join(gameAddon, `resource/addon_${addonName}_english.txt`),
        heroList: join(gameAddon, "scripts/npc/herolist.txt"),
        heroData: join(gameAddon, "scripts/npc/npc_heroes_custom.txt"),
        unitData: join(gameAddon, "scripts/npc/npc_units_custom.txt"),
        abilityData: join(gameAddon, "scripts/npc/npc_abilities_custom.txt"),
        contentMaps: join(contentAddon, "maps"),
        panoramaSource: join(contentAddon, "panorama"),
        panoramaRuntime: join(gameAddon, "panorama"),
        packageJson: join(contentAddon, "package.json")
    };
}
async function preflightEvidence(paths) {
    const evidence = [];
    await pushExistsEvidence(evidence, paths.gameAddon, "game addon root");
    await pushExistsEvidence(evidence, paths.contentAddon, "content addon root");
    await pushExistsEvidence(evidence, paths.addonInfo, "addon metadata");
    await pushExistsEvidence(evidence, paths.luaEntry, "lua entry");
    await pushExistsEvidence(evidence, paths.localization, "localization file");
    await pushExistsEvidence(evidence, paths.heroList, "hero list");
    await pushExistsEvidence(evidence, paths.heroData, "hero data");
    await pushExistsEvidence(evidence, paths.unitData, "unit support file");
    await pushExistsEvidence(evidence, paths.abilityData, "ability support file");
    await pushExistsEvidence(evidence, paths.contentMaps, "content maps directory");
    await pushExistsEvidence(evidence, paths.panoramaSource, "panorama source directory");
    await pushExistsEvidence(evidence, paths.panoramaRuntime, "panorama runtime directory");
    if (await pathExists(paths.panoramaSource)) {
        for (const file of await collectPanoramaFiles(paths.contentAddon, paths.panoramaSource)) {
            evidence.push(`panorama source file exists: ${file}`);
        }
    }
    let sawToolchainMarker = false;
    for (const marker of TOOLCHAIN_MARKERS) {
        const markerPath = join(paths.contentAddon, marker);
        if (await pathExists(markerPath)) {
            sawToolchainMarker = true;
            evidence.push(`toolchain marker exists: ${marker}`);
        }
        else {
            evidence.push(`toolchain marker missing: ${marker}`);
        }
    }
    if (await packageMentionsReact(paths.packageJson)) {
        evidence.push("react panorama marker detected in package.json");
    }
    if (!sawToolchainMarker) {
        evidence.push("toolchain markers absent");
    }
    evidence.push("publishing preflight blockers reported");
    evidence.push("preflight is not runtime validation");
    return evidence;
}
async function preflightWarnings(paths) {
    const warnings = [
        "publishing credentials are not accepted or inspected",
        "Workshop upload is not supported by preflight",
        "content encryption is not supported by preflight",
        "preflight does not prove runtime validation"
    ];
    if (await hasAnyToolchainMarker(paths.contentAddon)) {
        warnings.push("toolchain markers are inspection-only; builds are not run");
    }
    return warnings;
}
function releaseBoundaryWarnings() {
    return [
        "Steam login is manual and out of scope",
        "content encryption is manual and out of scope",
        "Workshop upload is not performed by dry run",
        "dry run does not prove runtime validation"
    ];
}
async function collectReleaseReadinessObservations(paths, fileSystem) {
    const requiredPaths = [
        ["game addon root", paths.gameAddon],
        ["content addon root", paths.contentAddon],
        ["addon metadata", paths.addonInfo],
        ["lua entry", paths.luaEntry],
        ["localization file", paths.localization],
        ["content maps directory", paths.contentMaps],
        ["hero list", paths.heroList],
        ["hero data", paths.heroData],
        ["unit support file", paths.unitData],
        ["ability support file", paths.abilityData]
    ];
    const requiredPathObservations = [];
    for (const [label, path] of requiredPaths) {
        requiredPathObservations.push({ label, present: await pathExists(path) });
    }
    let metadata = { state: "missing" };
    if (await pathExists(paths.addonInfo)) {
        try {
            metadata = { state: "readable", content: await fileSystem.readFile(paths.addonInfo) };
        }
        catch {
            metadata = { state: "unreadable", path: "addoninfo.txt" };
        }
    }
    const requiredTextPaths = new Set([
        paths.addonInfo,
        paths.luaEntry,
        paths.localization,
        paths.heroList,
        paths.heroData,
        paths.unitData,
        paths.abilityData
    ]);
    const scanRoots = [];
    for (const [rootName, rootPath] of [
        ["game", paths.gameAddon],
        ["content", paths.contentAddon]
    ]) {
        if (!(await pathExists(rootPath)))
            continue;
        const files = [];
        await collectFiles(rootPath, files);
        const observations = [];
        for (const file of files) {
            const relativePath = normalizeRelativePath(relative(rootPath, file));
            if (!isReleaseTextPath(file)) {
                observations.push({ relativePath, state: "non-text" });
                continue;
            }
            let info;
            try {
                info = await fileSystem.stat(file);
            }
            catch {
                observations.push({ relativePath, state: "unreadable", requiredText: requiredTextPaths.has(file) });
                continue;
            }
            if (info.size > MAX_SECRET_SCAN_BYTES) {
                observations.push({ relativePath, state: "oversized", requiredText: requiredTextPaths.has(file) });
                continue;
            }
            try {
                observations.push({
                    relativePath,
                    state: "text",
                    content: await fileSystem.readFile(file),
                    requiredText: requiredTextPaths.has(file)
                });
            }
            catch {
                observations.push({ relativePath, state: "unreadable", requiredText: requiredTextPaths.has(file) });
            }
        }
        scanRoots.push({ root: rootName, files: observations });
    }
    return { requiredPaths: requiredPathObservations, metadata, scanRoots };
}
function renderDryRunReadiness(findings, paths) {
    const evidence = [];
    const blockers = [];
    const warnings = releaseBoundaryWarnings();
    for (const finding of findings) {
        switch (finding.code) {
            case "REQUIRED_PATH_PRESENT":
                evidence.push(`package evidence: ${finding.field} exists`);
                break;
            case "REQUIRED_PATH_MISSING":
                blockers.push(`package blocker: ${finding.field} missing`);
                break;
            case "METADATA_PRESENT":
                evidence.push(`metadata evidence: ${finding.field} present`);
                break;
            case "METADATA_MISSING":
                blockers.push(`metadata blocker: ${finding.field} missing`);
                break;
            case "METADATA_PLACEHOLDER":
                blockers.push(`metadata blocker: ${finding.field} placeholder`);
                break;
            case "SENSITIVE_MATERIAL":
                blockers.push(`secret blocker: ${finding.path} matches ${finding.category}`);
                break;
            case "NON_TEXT_INCLUDED":
                warnings.push(`secret scan skipped non-text file: ${finding.path}`);
                break;
            case "TEXT_OVERSIZED":
            case "REQUIRED_TEXT_OVERSIZED":
                warnings.push(`secret scan skipped oversized file: ${finding.path}`);
                break;
            case "TEXT_UNREADABLE":
                warnings.push(`secret scan skipped unreadable file: ${finding.path}`);
                break;
            case "REQUIRED_TEXT_UNREADABLE":
                blockers.push(`required text blocker: ${finding.path} unreadable`);
                break;
            case "SECRET_SCAN_COMPLETED":
                evidence.push(`secret scan completed: ${{ game: paths.gameAddon, content: paths.contentAddon }[finding.field]}`);
                break;
            case "POLICY_INPUT_INVALID":
                blockers.push(`release policy blocker: ${finding.category} invalid`);
                break;
        }
    }
    return { evidence, blockers, warnings };
}
async function pushExistsEvidence(evidence, path, label) {
    evidence.push(await pathExists(path) ? `${label} exists` : `${label} missing`);
}
async function collectPanoramaFiles(contentAddon, root) {
    const files = [];
    await collectFiles(root, files);
    return files
        .filter((file) => PANORAMA_EXTENSIONS.has(extname(file)))
        .map((file) => normalizeRelativePath(relative(contentAddon, file)))
        .sort();
}
async function collectFiles(directory, files) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            await collectFiles(fullPath, files);
        }
        else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
}
function normalizeRelativePath(path) {
    return path.split(sep).join("/");
}
async function hasAnyToolchainMarker(contentAddon) {
    for (const marker of TOOLCHAIN_MARKERS) {
        if (await pathExists(join(contentAddon, marker))) {
            return true;
        }
    }
    return false;
}
async function packageMentionsReact(path) {
    if (!(await pathExists(path))) {
        return false;
    }
    const content = await readFile(path, "utf8");
    return /"react"\s*:/.test(content) || /"@moddota\/panorama"/.test(content);
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

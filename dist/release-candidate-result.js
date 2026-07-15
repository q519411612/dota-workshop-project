import { computeReleaseCandidateCombinedDigest as computeCanonicalCombinedDigest } from "./release-candidate.js";
import { sanitizeRelativeEvidenceIdentity } from "./release-readiness.js";
import { createFailureResult, createSuccessResult } from "./result.js";
const BLOCKER_CODES = new Set([
    "CANDIDATE_ACQUISITION_RESULT_INVALID",
    "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE",
    "CANDIDATE_CLEANUP_RESULT_INVALID",
    "CANDIDATE_CREATION_CONTRACT_FAILED",
    "CANDIDATE_CREATION_FAILED",
    "CANDIDATE_DESTINATION_IDENTITY_MISMATCH",
    "CANDIDATE_DESTINATION_UNEXPECTED",
    "CANDIDATE_IDENTITY_MISMATCH",
    "CANDIDATE_INTEGRITY_IDENTITY_CHANGED",
    "CANDIDATE_INTEGRITY_OBSERVATION_FAILED",
    "CANDIDATE_INTEGRITY_RESULT_INVALID",
    "CANDIDATE_INSPECTION_FAILED",
    "CANDIDATE_INSPECTION_VALUE_UNSAFE",
    "CANDIDATE_LEASE_INVALID",
    "CANDIDATE_LEDGER_DUPLICATE",
    "CANDIDATE_LEDGER_MISSING",
    "CANDIDATE_LEDGER_UNEXPECTED",
    "CANDIDATE_LEDGER_UNOBSERVED",
    "CANDIDATE_LEDGER_WRONG_KIND",
    "CANDIDATE_LEDGER_WRONG_ROOT",
    "CANDIDATE_MANIFEST_PROJECTION_FAILED",
    "CANDIDATE_MATERIALIZATION_FAILED",
    "CANDIDATE_MATERIALIZATION_RESULT_INVALID",
    "CANDIDATE_REMOVAL_FAILED",
    "CANDIDATE_ROOT_IDENTITY_MISMATCH",
    "CANDIDATE_ROOT_INSPECTION_FAILED",
    "CANDIDATE_ROOT_INSPECTION_RESULT_INVALID",
    "CANDIDATE_ROOT_NOT_EMPTY",
    "CANDIDATE_ROOT_NOT_ISOLATED",
    "CANDIDATE_ROOT_NOT_OWNED",
    "CANDIDATE_ROOT_UNREADABLE",
    "CANDIDATE_TREE_IDENTITY_INVALID",
    "CANDIDATE_TREE_MISMATCH",
    "CANDIDATE_TREE_MISSING",
    "CANDIDATE_TREE_RECONCILIATION_FAILED",
    "CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID",
    "CANDIDATE_TREE_UNEXPECTED",
    "CANDIDATE_TREE_WRONG_KIND",
    "CONTENT_ADDON_ROOT_OUTSIDE_DOTA_ROOT",
    "GAME_ADDON_ROOT_OUTSIDE_DOTA_ROOT",
    "IDENTITY_BOUND_ASSEMBLY_REQUIRED",
    "IDENTITY_BOUND_CLEANUP_REQUIRED",
    "INTEGRITY_STREAM_RESULT_INVALID",
    "INVALID_ADDON_NAME",
    "METADATA_MISSING",
    "METADATA_PLACEHOLDER",
    "POLICY_INPUT_INVALID",
    "RELEASE_CANDIDATE_INTEGRITY_MISMATCH",
    "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN",
    "REMOTE_DOTA_ROOT_INVALID",
    "REMOTE_DOTA_ROOT_REQUIRED",
    "REMOTE_DESTINATION_INVALID",
    "REMOTE_LIFECYCLE_INTERNAL_FAILURE",
    "REPOSITORY_ROOT",
    "REQUIRED_PATH_MISSING",
    "REQUIRED_PATH_WRONG_KIND",
    "REQUIRED_TEXT_OVERSIZED",
    "REQUIRED_TEXT_UNREADABLE",
    "SENSITIVE_MATERIAL",
    "SOURCE_CHANGED_DURING_ASSEMBLY",
    "SOURCE_ENTRY_CHANGED",
    "SOURCE_ENTRY_OUTSIDE_ROOT",
    "SOURCE_ENTRY_UNREADABLE",
    "SOURCE_ENTRY_UNSAFE",
    "SOURCE_FILE_IDENTITY_CHANGED",
    "SOURCE_FILE_READ_FAILED",
    "SOURCE_IDENTITY_COLLISION",
    "SOURCE_IDENTITY_INVALID",
    "SOURCE_IDENTITY_SENSITIVE",
    "SOURCE_INTEGRITY_IDENTITY_CHANGED",
    "SOURCE_INTEGRITY_OBSERVATION_FAILED",
    "SOURCE_INTEGRITY_RESULT_INVALID",
    "SOURCE_OBSERVATION_FAILED",
    "SOURCE_OBSERVATION_RESULT_INVALID",
    "SOURCE_READ_RESULT_INVALID",
    "TEMP_PARENT_NOT_ISOLATED",
    "WINDOWS_FILE_IDENTITY_REQUIRED",
    "WINDOWS_REPARSE_CLASSIFIER_REQUIRED"
]);
const CLEANUP_FAILURE_CODES = new Set([
    "CANDIDATE_IDENTITY_MISMATCH",
    "CANDIDATE_REMOVAL_FAILED",
    "CANDIDATE_ABSENCE_UNVERIFIED",
    "CANDIDATE_LEASE_INVALID",
    "CANDIDATE_CLEANUP_RESULT_INVALID",
    "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE"
]);
const BOUNDARY_KEYS = [
    "steamLogin",
    "workshopCreate",
    "workshopMutation",
    "upload",
    "archive",
    "signing",
    "encryption",
    "gameLaunch",
    "runtimeValidation",
    "compilation",
    "sourceConversion",
    "metadataRepair",
    "persistentCandidate",
    "fileTransfer",
    "temporaryCandidate",
    "sourceTreesModified",
    "evidenceOnly",
    "realWindowsRuntimeProven"
];
export const RELEASE_CANDIDATE_CONTRACT_WARNING = "contract evidence only; real Windows runtime behavior is not proven";
export const RELEASE_CANDIDATE_BOUNDARIES = Object.freeze({
    steamLogin: false,
    workshopCreate: false,
    workshopMutation: false,
    upload: false,
    archive: false,
    signing: false,
    encryption: false,
    gameLaunch: false,
    runtimeValidation: false,
    compilation: false,
    sourceConversion: false,
    metadataRepair: false,
    persistentCandidate: false,
    fileTransfer: false,
    temporaryCandidate: true,
    sourceTreesModified: false,
    evidenceOnly: true,
    realWindowsRuntimeProven: false
});
const MAX_PUBLIC_COLLECTION_ITEMS = 100_000;
export const computeReleaseCandidateCombinedDigest = computeCanonicalCombinedDigest;
export function normalizeReleaseCandidateDetail(input, options = {}) {
    try {
        return normalizeValidDetail(input, options) ?? normalizationFailure();
    }
    catch {
        return normalizationFailure();
    }
}
export function createReleaseCandidateToolResult(input) {
    const releaseCandidate = normalizeReleaseCandidateDetail(projectNormalizedDetailForValidation(input.releaseCandidate));
    const common = {
        target: input.target,
        operation: input.operation,
        evidence: input.evidence,
        warnings: input.warnings,
        paths: input.paths,
        releaseCandidate
    };
    if (releaseCandidate.ok)
        return createSuccessResult(common);
    const code = releaseCandidate.normalization.status === "failed"
        ? releaseCandidate.normalization.code
        : "RELEASE_CANDIDATE_PREFLIGHT_FAILED";
    return createFailureResult({
        ...common,
        error: { code, message: "Release candidate preflight did not satisfy the required invariants." }
    });
}
function projectNormalizedDetailForValidation(input) {
    if (!isObject(input) || !Object.isFrozen(input))
        return input;
    const normalization = get(input, "normalization");
    if (!isObject(normalization) || get(normalization, "status") !== "valid")
        return input;
    const projected = {};
    for (const key of Reflect.ownKeys(input)) {
        if (key === "normalization")
            continue;
        if (typeof key !== "string")
            return input;
        projected[key] = get(input, key);
    }
    return projected;
}
function normalizeValidDetail(input, options) {
    if (!isObject(input)
        || !hasOnlyOwnKeys(input, [
            "schemaVersion", "ok", "operation", "artifactValidation", "manifest", "inclusionLedger",
            "scanCoverage", "blockers", "cleanup", "paths", "execution", "warnings", "commands", "logs",
            "boundaries"
        ])
        || get(input, "schemaVersion") !== "1.0")
        return undefined;
    const declaredOk = get(input, "ok");
    if (declaredOk !== undefined && typeof declaredOk !== "boolean")
        return undefined;
    const operation = normalizeOperation(get(input, "operation"));
    const manifest = normalizeOptionalManifest(get(input, "manifest"));
    const inclusionLedger = normalizeOptionalLedger(get(input, "inclusionLedger"));
    const scanCoverage = normalizeOptionalCoverage(get(input, "scanCoverage"));
    const blockers = normalizeBlockers(get(input, "blockers"));
    const cleanup = normalizeCleanup(get(input, "cleanup"));
    const paths = normalizePaths(get(input, "paths"), options.expectedAddonName);
    const execution = normalizeExecution(get(input, "execution"));
    const warnings = normalizeStringArray(get(input, "warnings"));
    const commands = normalizeCommands(get(input, "commands"));
    const logs = normalizeLogs(get(input, "logs"));
    const boundaries = normalizeBoundaries(get(input, "boundaries"));
    if (operation === undefined
        || manifest === false
        || inclusionLedger === false
        || scanCoverage === false
        || blockers === undefined
        || cleanup === undefined
        || paths === undefined
        || execution === undefined
        || warnings === undefined
        || commands === undefined
        || logs === undefined
        || boundaries === undefined)
        return undefined;
    const artifactValidation = normalizeArtifact(get(input, "artifactValidation"));
    if (artifactValidation === undefined)
        return undefined;
    if (!validateAddonIdentity(paths, manifest, scanCoverage, artifactValidation))
        return undefined;
    if (!validateDomainConsistency({
        operation,
        artifactValidation,
        manifest,
        inclusionLedger,
        scanCoverage,
        blockers,
        cleanup,
        execution
    })) {
        return undefined;
    }
    const ok = operation.status === "completed"
        && artifactValidation.status === "passed"
        && blockers.length === 0
        && cleanup.status === "verified"
        && execution.outcome === "completed";
    return deepFreeze({
        schemaVersion: "1.0",
        ok,
        normalization: { status: "valid" },
        operation,
        artifactValidation,
        ...(manifest === undefined ? {} : { manifest }),
        ...(inclusionLedger === undefined ? {} : { inclusionLedger }),
        ...(scanCoverage === undefined ? {} : { scanCoverage }),
        blockers,
        cleanup,
        paths: { gameAddon: paths.gameAddon, contentAddon: paths.contentAddon },
        execution,
        warnings,
        commands,
        logs,
        boundaries
    });
}
function normalizeOperation(input) {
    if (!isObject(input))
        return undefined;
    const status = get(input, "status");
    if ((status === "not-reached" || status === "completed")
        && hasOnlyOwnKeys(input, ["status"]))
        return { status };
    const code = get(input, "code");
    if (status === "failed"
        && (code === "CANDIDATE_INSPECTION_FAILED" || code === "CANDIDATE_INSPECTION_VALUE_UNSAFE")
        && hasOnlyOwnKeys(input, ["status", "code"]))
        return { status, code };
    return undefined;
}
function normalizeArtifact(input) {
    if (!isObject(input))
        return undefined;
    const status = get(input, "status");
    if (status === "not-reached" && hasOnlyOwnKeys(input, ["status"]))
        return { status };
    if (status === "blocked") {
        if (!hasOnlyOwnKeys(input, ["status", "blockers", "inclusionLedger", "scanCoverage"]))
            return undefined;
        const blockers = normalizeBlockers(get(input, "blockers"));
        const inclusionLedger = normalizeOptionalLedger(get(input, "inclusionLedger"));
        const scanCoverage = normalizeOptionalCoverage(get(input, "scanCoverage"));
        if (blockers === undefined
            || blockers.length === 0
            || inclusionLedger === false
            || scanCoverage === false)
            return undefined;
        return {
            status,
            blockers,
            ...(inclusionLedger === undefined ? {} : { inclusionLedger }),
            ...(scanCoverage === undefined ? {} : { scanCoverage })
        };
    }
    if (status === "passed") {
        if (!hasOnlyOwnKeys(input, ["status", "manifest", "inclusionLedger", "scanCoverage"]))
            return undefined;
        const manifest = normalizeManifest(get(input, "manifest"));
        const inclusionLedger = normalizeLedger(get(input, "inclusionLedger"));
        const scanCoverage = normalizeCoverage(get(input, "scanCoverage"));
        if (manifest === undefined || inclusionLedger === undefined || scanCoverage === undefined)
            return undefined;
        if (!validatePassedEvidence(manifest, inclusionLedger, scanCoverage))
            return undefined;
        return { status, manifest, inclusionLedger, scanCoverage };
    }
    return undefined;
}
function normalizeOptionalManifest(input) {
    return input === undefined ? undefined : normalizeManifest(input) ?? false;
}
function normalizeManifest(input) {
    if (!isObject(input)
        || !hasOnlyOwnKeys(input, ["schemaVersion", "entries", "combinedSha256"])
        || get(input, "schemaVersion") !== "1.0")
        return undefined;
    const rawEntries = snapshotArray(get(input, "entries"));
    const combinedSha256 = get(input, "combinedSha256");
    if (rawEntries === undefined || !isDigest(combinedSha256))
        return undefined;
    const entries = [];
    const seen = new Set();
    for (let index = 0; index < rawEntries.length; index += 1) {
        const raw = rawEntries[index];
        if (!isObject(raw)
            || !hasOnlyOwnKeys(raw, ["schemaVersion", "root", "path", "bytes", "sha256"])
            || get(raw, "schemaVersion") !== "1.0")
            return undefined;
        const root = get(raw, "root");
        const path = get(raw, "path");
        const bytes = get(raw, "bytes");
        const sha256 = get(raw, "sha256");
        if ((root !== "game" && root !== "content")
            || typeof path !== "string"
            || !isManifestPath(root, path)
            || !isCount(bytes)
            || !isDigest(sha256)
            || seen.has(path))
            return undefined;
        seen.add(path);
        entries.push({ schemaVersion: "1.0", root, path, bytes, sha256 });
    }
    for (let index = 1; index < entries.length; index += 1) {
        if (compareManifestEntry(entries[index - 1], entries[index]) >= 0)
            return undefined;
    }
    if (computeReleaseCandidateCombinedDigest(entries) !== combinedSha256)
        return undefined;
    return { schemaVersion: "1.0", entries, combinedSha256 };
}
function normalizeOptionalLedger(input) {
    return input === undefined ? undefined : normalizeLedger(input) ?? false;
}
function normalizeLedger(input) {
    if (!isObject(input)
        || !hasOnlyOwnKeys(input, ["schemaVersion", "expectedFileCount", "observedFileCount", "matchedFileCount"])
        || get(input, "schemaVersion") !== "1.0")
        return undefined;
    const expectedFileCount = get(input, "expectedFileCount");
    const observedFileCount = get(input, "observedFileCount");
    const matchedFileCount = get(input, "matchedFileCount");
    if (!isCount(expectedFileCount) || !isCount(observedFileCount) || !isCount(matchedFileCount))
        return undefined;
    if (matchedFileCount > expectedFileCount || matchedFileCount > observedFileCount)
        return undefined;
    return { schemaVersion: "1.0", expectedFileCount, observedFileCount, matchedFileCount };
}
function normalizeOptionalCoverage(input) {
    return input === undefined ? undefined : normalizeCoverage(input) ?? false;
}
function normalizeCoverage(input) {
    if (!isObject(input)
        || !hasOnlyOwnKeys(input, ["schemaVersion", "totalFileCount", "text", "binary", "unreadable", "oversized"])
        || get(input, "schemaVersion") !== "1.0")
        return undefined;
    const totalFileCount = get(input, "totalFileCount");
    if (!isCount(totalFileCount))
        return undefined;
    const text = normalizeCoverageCategory(get(input, "text"));
    const binary = normalizeCoverageCategory(get(input, "binary"));
    const unreadable = normalizeCoverageCategory(get(input, "unreadable"));
    const oversized = normalizeCoverageCategory(get(input, "oversized"));
    if (text === undefined || binary === undefined || unreadable === undefined || oversized === undefined)
        return undefined;
    const allPaths = [...text.paths, ...binary.paths, ...unreadable.paths, ...oversized.paths];
    if (new Set(allPaths).size !== allPaths.length || totalFileCount !== allPaths.length)
        return undefined;
    return { schemaVersion: "1.0", totalFileCount, text, binary, unreadable, oversized };
}
function normalizeCoverageCategory(input) {
    if (!isObject(input) || !hasOnlyOwnKeys(input, ["count", "paths"]))
        return undefined;
    const count = get(input, "count");
    const paths = normalizePathArray(get(input, "paths"));
    if (!isCount(count) || paths === undefined || count !== paths.length)
        return undefined;
    return { count, paths };
}
function normalizePathArray(input) {
    const snapshot = snapshotArray(input);
    if (snapshot === undefined)
        return undefined;
    const paths = [];
    for (let index = 0; index < snapshot.length; index += 1) {
        const path = snapshot[index];
        if (typeof path !== "string" || !isSafeRelativePath(path))
            return undefined;
        if (index > 0 && paths[index - 1] >= path)
            return undefined;
        paths.push(path);
    }
    return paths;
}
function normalizeBlockers(input) {
    const snapshot = snapshotArray(input);
    if (snapshot === undefined)
        return undefined;
    const blockers = [];
    for (let index = 0; index < snapshot.length; index += 1) {
        const raw = snapshot[index];
        if (!isObject(raw) || !hasOnlyOwnKeys(raw, ["code", "category", "field", "path", "count", "disposition"])) {
            return undefined;
        }
        const code = get(raw, "code");
        const category = get(raw, "category");
        const field = get(raw, "field");
        const path = get(raw, "path");
        const count = get(raw, "count");
        const disposition = get(raw, "disposition");
        if (typeof code !== "string"
            || !BLOCKER_CODES.has(code)
            || typeof category !== "string"
            || !isSafeText(category)
            || (field !== undefined && (typeof field !== "string" || !isSafeText(field)))
            || (path !== undefined && (typeof path !== "string" || !isSafeRelativePath(path)))
            || (count !== undefined && !isCount(count))
            || (disposition !== undefined && disposition !== "blocker" && disposition !== "warning" && disposition !== "evidence"))
            return undefined;
        blockers.push({
            code,
            category,
            ...(field === undefined ? {} : { field }),
            ...(path === undefined ? {} : { path }),
            ...(count === undefined ? {} : { count }),
            ...(disposition === undefined ? {} : { disposition })
        });
    }
    return blockers;
}
function normalizeCleanup(input) {
    if (!isObject(input) || get(input, "schemaVersion") !== "1.0")
        return undefined;
    const attempted = get(input, "attempted");
    const attempts = get(input, "attempts");
    const status = get(input, "status");
    const verified = get(input, "verified");
    if (status === "not-reached" && attempted === false && attempts === 0 && verified === false) {
        if (!hasOnlyOwnKeys(input, ["schemaVersion", "attempted", "attempts", "status", "verified"]))
            return undefined;
        return { schemaVersion: "1.0", attempted, attempts, status, verified };
    }
    const identityMatched = get(input, "identityMatched");
    const removed = get(input, "removed");
    const absent = get(input, "absent");
    if (status === "verified"
        && attempted === true
        && attempts === 1
        && verified === true
        && identityMatched === true
        && removed === true
        && absent === true) {
        if (!hasOnlyOwnKeys(input, [
            "schemaVersion", "attempted", "attempts", "status", "verified", "identityMatched", "removed", "absent"
        ]))
            return undefined;
        return { schemaVersion: "1.0", attempted, attempts, status, verified, identityMatched, removed, absent };
    }
    const code = get(input, "code");
    if (status === "failed"
        && verified === false
        && typeof attempted === "boolean"
        && (attempts === 0 || attempts === 1)
        && attempts === (attempted ? 1 : 0)
        && typeof code === "string"
        && CLEANUP_FAILURE_CODES.has(code)
        && (identityMatched === undefined || typeof identityMatched === "boolean")
        && (removed === undefined || typeof removed === "boolean")
        && (absent === undefined || typeof absent === "boolean")) {
        if (!hasOnlyOwnKeys(input, [
            "schemaVersion", "attempted", "attempts", "status", "verified", "code", "identityMatched", "removed", "absent"
        ]))
            return undefined;
        if (attempted === false
            && code === "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE"
            && identityMatched === undefined
            && removed === undefined
            && absent === undefined)
            return { schemaVersion: "1.0", attempted, attempts, status, verified, code };
        if (attempted === true
            && code === "CANDIDATE_CLEANUP_RESULT_INVALID"
            && identityMatched === undefined
            && removed === undefined
            && absent === undefined)
            return { schemaVersion: "1.0", attempted, attempts, status, verified, code };
        if (attempted === true
            && typeof identityMatched === "boolean"
            && typeof removed === "boolean"
            && typeof absent === "boolean"
            && cleanupFailureFactsAgree(code, identityMatched, removed, absent))
            return {
                schemaVersion: "1.0",
                attempted,
                attempts,
                status,
                verified,
                code: code,
                identityMatched,
                removed,
                absent
            };
        return undefined;
    }
    if (status === "unknown"
        && verified === false
        && typeof attempted === "boolean"
        && (attempts === 0 || attempts === 1)
        && attempts === (attempted ? 1 : 0)
        && code === "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN") {
        if (!hasOnlyOwnKeys(input, ["schemaVersion", "attempted", "attempts", "status", "verified", "code"])) {
            return undefined;
        }
        return { schemaVersion: "1.0", attempted, attempts, status, verified, code };
    }
    return undefined;
}
function normalizePaths(input, expectedAddonName) {
    if (!isObject(input) || !hasOnlyOwnKeys(input, ["gameAddon", "contentAddon"]))
        return undefined;
    const gameAddon = get(input, "gameAddon");
    const contentAddon = get(input, "contentAddon");
    if (typeof gameAddon !== "string"
        || typeof contentAddon !== "string"
        || !isSafeRelativePath(gameAddon)
        || !isSafeRelativePath(contentAddon)
        || !/^game\/dota_addons\/[a-z][a-z0-9_]{0,63}$/.test(gameAddon)
        || !/^content\/dota_addons\/[a-z][a-z0-9_]{0,63}$/.test(contentAddon))
        return undefined;
    const addonName = gameAddon.slice("game/dota_addons/".length);
    if (contentAddon !== `content/dota_addons/${addonName}`
        || (expectedAddonName !== undefined && addonName !== expectedAddonName))
        return undefined;
    return { gameAddon, contentAddon, addonName };
}
function normalizeExecution(input) {
    if (!isObject(input) || !hasOnlyOwnKeys(input, ["kind", "outcome", "exitCode"]))
        return undefined;
    const kind = get(input, "kind");
    const outcome = get(input, "outcome");
    const exitCode = get(input, "exitCode");
    if (kind !== "fixture" && kind !== "local" && kind !== "ssh" && kind !== "powershell")
        return undefined;
    if (outcome !== "completed" && outcome !== "failed" && outcome !== "uncertain")
        return undefined;
    if (exitCode !== undefined && !Number.isSafeInteger(exitCode))
        return undefined;
    return { kind, outcome, ...(exitCode === undefined ? {} : { exitCode: exitCode }) };
}
function normalizeCommands(input) {
    const snapshot = snapshotArray(input);
    if (snapshot === undefined)
        return undefined;
    const commands = [];
    for (let index = 0; index < snapshot.length; index += 1) {
        const raw = snapshot[index];
        if (!isObject(raw) || !hasOnlyOwnKeys(raw, ["description", "outcome", "exitCode"]))
            return undefined;
        const description = get(raw, "description");
        const outcome = get(raw, "outcome");
        const exitCode = get(raw, "exitCode");
        if (typeof description !== "string"
            || !isSafeText(description)
            || (outcome !== "completed" && outcome !== "failed" && outcome !== "uncertain")
            || (exitCode !== undefined && !Number.isSafeInteger(exitCode)))
            return undefined;
        commands.push({ description, outcome, ...(exitCode === undefined ? {} : { exitCode: exitCode }) });
    }
    return commands;
}
function normalizeLogs(input) {
    const snapshot = snapshotArray(input);
    if (snapshot === undefined)
        return undefined;
    const logs = [];
    for (let index = 0; index < snapshot.length; index += 1) {
        const raw = snapshot[index];
        if (!isObject(raw) || !hasOnlyOwnKeys(raw, ["source", "lines"]))
            return undefined;
        const source = get(raw, "source");
        const lines = normalizeStringArray(get(raw, "lines"));
        if (typeof source !== "string" || !isSafeText(source) || lines === undefined)
            return undefined;
        logs.push({ source, lines });
    }
    return logs;
}
function normalizeStringArray(input) {
    const snapshot = snapshotArray(input);
    if (snapshot === undefined)
        return undefined;
    const values = [];
    for (let index = 0; index < snapshot.length; index += 1) {
        const value = snapshot[index];
        if (typeof value !== "string" || !isSafeText(value))
            return undefined;
        values.push(value);
    }
    return values;
}
function normalizeBoundaries(input) {
    if (!isObject(input))
        return undefined;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== BOUNDARY_KEYS.length
        || keys.some((key) => typeof key !== "string" || !BOUNDARY_KEYS.includes(key)))
        return undefined;
    const output = {};
    for (const key of BOUNDARY_KEYS) {
        const value = get(input, key);
        if (value !== RELEASE_CANDIDATE_BOUNDARIES[key])
            return undefined;
        output[key] = value;
    }
    return output;
}
function validateDomainConsistency(input) {
    const { operation, artifactValidation, manifest, inclusionLedger, scanCoverage, blockers, cleanup, execution } = input;
    if (artifactValidation.status === "passed") {
        if (manifest === undefined
            || inclusionLedger === undefined
            || scanCoverage === undefined
            || blockers.some((blocker) => (blocker.category !== "removal"
                && blocker.category !== "transport"
                && !(blocker.category === "inspection"
                    && operation.status === "failed"
                    && blocker.code === operation.code)))
            || !sameValue(manifest, artifactValidation.manifest)
            || !sameValue(inclusionLedger, artifactValidation.inclusionLedger)
            || !sameValue(scanCoverage, artifactValidation.scanCoverage)
            || !validatePassedEvidence(manifest, inclusionLedger, scanCoverage))
            return false;
    }
    else if (manifest !== undefined) {
        return false;
    }
    if (artifactValidation.status === "passed" && operation.status === "not-reached")
        return false;
    if (operation.status === "failed"
        && !blockers.some((blocker) => blocker.category === "inspection" && blocker.code === operation.code))
        return false;
    if (artifactValidation.status === "blocked") {
        const artifactBlockers = blockers.filter((blocker) => (blocker.category !== "removal" && blocker.category !== "transport"));
        if (!sameValue(artifactBlockers, artifactValidation.blockers))
            return false;
        if (!sameValue(inclusionLedger, artifactValidation.inclusionLedger))
            return false;
        if (!sameValue(scanCoverage, artifactValidation.scanCoverage))
            return false;
    }
    if (artifactValidation.status === "not-reached" && blockers.length === 0)
        return false;
    if (artifactValidation.status === "not-reached" && operation.status !== "not-reached")
        return false;
    if (cleanup.status === "failed") {
        if (!blockers.some((blocker) => blocker.code === cleanup.code && blocker.category === "removal"))
            return false;
    }
    if (cleanup.status === "unknown") {
        if (!blockers.some((blocker) => blocker.code === cleanup.code && blocker.category === "transport"))
            return false;
    }
    if ((execution.outcome === "uncertain") !== (cleanup.status === "unknown"))
        return false;
    return true;
}
function cleanupFailureFactsAgree(code, identityMatched, removed, absent) {
    if (code === "CANDIDATE_IDENTITY_MISMATCH")
        return identityMatched === false;
    if (code === "CANDIDATE_REMOVAL_FAILED")
        return identityMatched === true && removed === false;
    if (code === "CANDIDATE_ABSENCE_UNVERIFIED") {
        return identityMatched === true && removed === true && absent === false;
    }
    return code === "CANDIDATE_LEASE_INVALID";
}
function validatePassedEvidence(manifest, inclusionLedger, scanCoverage) {
    const count = manifest.entries.length;
    if (inclusionLedger.expectedFileCount !== count
        || inclusionLedger.observedFileCount !== count
        || inclusionLedger.matchedFileCount !== count)
        return false;
    const covered = [
        ...scanCoverage.text.paths,
        ...scanCoverage.binary.paths,
        ...scanCoverage.unreadable.paths,
        ...scanCoverage.oversized.paths
    ].sort(compareOrdinal);
    const manifestPaths = manifest.entries.map((entry) => entry.path).sort(compareOrdinal);
    return sameValue(covered, manifestPaths);
}
function validateAddonIdentity(paths, manifest, scanCoverage, artifactValidation) {
    const expectedPrefix = (root) => (`${root === "game" ? paths.gameAddon : paths.contentAddon}/`);
    const manifestMatches = (value) => (value === undefined
        || value.entries.every((entry) => entry.path.startsWith(expectedPrefix(entry.root))));
    const coverageMatches = (value) => {
        if (value === undefined)
            return true;
        return [value.text, value.binary, value.unreadable, value.oversized]
            .flatMap((category) => category.paths)
            .every((path) => path.startsWith(expectedPrefix(path.startsWith("game/") ? "game" : "content")));
    };
    if (!manifestMatches(manifest) || !coverageMatches(scanCoverage))
        return false;
    if (artifactValidation.status === "passed") {
        return manifestMatches(artifactValidation.manifest) && coverageMatches(artifactValidation.scanCoverage);
    }
    return artifactValidation.status !== "blocked" || coverageMatches(artifactValidation.scanCoverage);
}
function normalizationFailure() {
    return deepFreeze({
        schemaVersion: "1.0",
        ok: false,
        normalization: { status: "failed", code: "RELEASE_CANDIDATE_DETAIL_INVALID" },
        blockers: [{ code: "RELEASE_CANDIDATE_DETAIL_INVALID", category: "normalization" }]
    });
}
function isObject(value) {
    return value !== null && typeof value === "object";
}
function get(input, key) {
    return Reflect.get(input, key);
}
function snapshotArray(input) {
    if (!Array.isArray(input))
        return undefined;
    const length = Reflect.get(input, "length");
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PUBLIC_COLLECTION_ITEMS) {
        return undefined;
    }
    const keys = Reflect.ownKeys(input);
    if (keys.length !== length + 1
        || keys.some((key) => {
            if (key === "length")
                return false;
            if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(key))
                return true;
            const index = Number(key);
            return !Number.isSafeInteger(index) || index < 0 || index >= length;
        }))
        return undefined;
    const snapshot = [];
    for (let index = 0; index < length; index += 1) {
        snapshot.push(Reflect.get(input, index));
    }
    return snapshot;
}
function hasOnlyOwnKeys(input, allowed) {
    const allowedSet = new Set(allowed);
    return Reflect.ownKeys(input).every((key) => typeof key === "string" && allowedSet.has(key));
}
function isCount(value) {
    return Number.isSafeInteger(value) && value >= 0;
}
function isDigest(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
function isManifestPath(root, path) {
    return isSafeRelativePath(path) && path.startsWith(`${root}/dota_addons/`);
}
function isSafeRelativePath(path) {
    return path.length > 0
        && !path.startsWith("/")
        && !path.startsWith("\\")
        && !/^[A-Za-z]:[\\/]/.test(path)
        && !path.includes("\\")
        && path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
        && sanitizeRelativeEvidenceIdentity(path) === path;
}
function isSafeText(value) {
    return value.length <= 4096
        && !value.includes("\0")
        && !/(?:^|\s)(?:[A-Za-z]:[\\/]|\\\\|\/Users\/|\/home\/|\/var\/|\/tmp\/)/.test(value)
        && sanitizeRelativeEvidenceIdentity(value) === value;
}
function compareManifestEntry(left, right) {
    return compareOrdinal(left.root, right.root) || compareOrdinal(left.path, right.path);
}
function compareOrdinal(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function deepFreeze(value) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        for (const key of Reflect.ownKeys(value)) {
            deepFreeze(Reflect.get(value, key));
        }
        Object.freeze(value);
    }
    return value;
}

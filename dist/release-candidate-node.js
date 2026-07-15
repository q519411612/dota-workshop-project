import { constants as filesystemConstants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createIdentityBoundCandidateLifecycle, observeIdentityBoundIntegrityStream, withAssembledReleaseCandidate } from "./release-candidate.js";
import { normalizeReleaseCandidateDetail, RELEASE_CANDIDATE_BOUNDARIES } from "./release-candidate-result.js";
import { isReleaseTextPath } from "./release-readiness.js";
const DEFAULT_OPERATIONS = Object.freeze({
    lstat,
    realpath,
    readDirectory: async (path) => await readdir(path),
    createTemporaryDirectory: async (prefix) => await mkdtemp(prefix),
    makeDirectory: async (path) => { await mkdir(path); },
    openFile: async (path, flags) => await open(path, flags),
    removeTree: async (path) => { await rm(path, { recursive: true }); }
});
export function createNodeReleaseCandidateFilesystem(options = {}) {
    const platform = options.platform ?? process.platform;
    const operations = Object.freeze({ ...DEFAULT_OPERATIONS, ...options.operations });
    const windowsClassifier = options.windowsClassifySourceEntry;
    const classify = platform === "win32"
        ? windowsClassifier ?? (async () => "unknown")
        : async (path) => await classifyNodeEntry(path, operations);
    const lifecycle = createIdentityBoundCandidateLifecycle({
        createCandidateState: async (input, registerCreatedCandidate) => {
            const root = resolve(await operations.createTemporaryDirectory(join(input.tempParent, "dota-release-candidate-")));
            if (!isInside(root, input.tempParent) || !basenameMatchesCandidateRoot(root)) {
                throw new Error("candidate root is outside the owned temporary namespace");
            }
            const identity = { root, canonicalRoot: "", device: -1, inode: -1 };
            const registration = registerCreatedCandidate(root, identity);
            try {
                Object.assign(identity, await captureCandidateIdentity(root, operations));
            }
            catch {
                return registration;
            }
            return registration;
        },
        acquireCandidateLease: async (_input, createRegisteredCandidate) => await createRegisteredCandidate(),
        cleanupCandidateLease: async (identity) => {
            options.onCleanupAttempt?.();
            return await cleanupCandidate(identity, operations);
        },
        readAcceptedSourceFile: async (input, entry, maxBytes) => (await readAcceptedSourceFile(input, entry, maxBytes, operations)),
        observeAcceptedSourceEntry: async (input, entry) => (await observeAcceptedSourceEntry(input, entry, operations)),
        observeAcceptedSource: async (input, entry) => (await observeSourceIntegrity(input, entry, operations)),
        observeCandidate: async (identity, expected) => (await observeCandidateIntegrity(identity, expected, operations)),
        inspectCandidateRoot: async (identity) => await inspectCandidateRoot(identity, operations),
        materializeCandidateEntry: async (identity, input, operation) => (await materializeCandidateEntry(identity, input, operation, operations)),
        reconcileCandidateTree: async (identity, expected) => (await reconcileCandidateTree(identity, expected, operations))
    });
    return Object.freeze({
        ...(platform === "win32" && windowsClassifier !== undefined ? { reparsePointAware: true } : {}),
        lstat: async (path) => await operations.lstat(path),
        realpath: async (path) => await operations.realpath(path),
        readDirectory: async (path) => await operations.readDirectory(path),
        classifySourceEntry: classify,
        createCandidateRoot: async (input) => await operations.createTemporaryDirectory(join(input.tempParent, "dota-release-candidate-")),
        candidateLifecycle: lifecycle
    });
}
export async function preflightNodeReleaseCandidate(input, dependencies = {}) {
    if (input.target.kind === "remote") {
        return normalizeReleaseCandidateDetail(undefined);
    }
    const fixtureOrLocalInput = {
        addonName: input.addonName,
        target: input.target
    };
    const platform = dependencies.platform ?? process.platform;
    const dotaRoot = input.target.kind === "fixture"
        ? input.target.root
        : input.target.dotaRoot ?? dependencies.environment?.DOTA_INSTALL_ROOT ?? "";
    const filesystem = dependencies.filesystem ?? createNodeReleaseCandidateFilesystem({
        platform,
        onCleanupAttempt: dependencies.onCleanupAttempt
    });
    const lifecycle = await withAssembledReleaseCandidate({
        addonName: input.addonName,
        dotaRoot,
        tempParent: dependencies.tempParent ?? tmpdir()
    }, dependencies.inspectCandidate ?? (async () => Object.freeze({ inspected: true })), {
        repositoryRoot: dependencies.repositoryRoot ?? process.cwd(),
        filesystem,
        platform
    });
    return projectLifecycleDetail(fixtureOrLocalInput, lifecycle);
}
function projectLifecycleDetail(input, lifecycle) {
    const artifact = lifecycle.artifactValidation;
    const scanCoverage = artifact.status === "passed" || artifact.status === "blocked"
        ? projectScanCoverage(artifact.scanCoverage, input.addonName)
        : undefined;
    const projectedArtifact = artifact.status === "passed"
        ? { ...artifact, scanCoverage }
        : artifact.status === "blocked"
            ? { ...artifact, ...(scanCoverage === undefined ? {} : { scanCoverage }) }
            : artifact;
    const executionKind = input.target.kind;
    const blockers = lifecycle.ok ? [] : [...lifecycle.blockers];
    const cleanup = lifecycle.cleanup;
    if (cleanup.status === "failed"
        && !blockers.some((blocker) => blocker.code === cleanup.code && blocker.category === "removal")) {
        blockers.push({ code: cleanup.code, category: "removal" });
    }
    const detail = {
        schemaVersion: "1.0",
        operation: lifecycle.operation,
        artifactValidation: projectedArtifact,
        ...(artifact.status === "passed" ? {
            manifest: artifact.manifest,
            inclusionLedger: artifact.inclusionLedger,
            scanCoverage
        } : artifact.status === "blocked" ? {
            ...(artifact.inclusionLedger === undefined ? {} : { inclusionLedger: artifact.inclusionLedger }),
            ...(scanCoverage === undefined ? {} : { scanCoverage })
        } : {
            ...(lifecycle.inclusionLedger === undefined ? {} : { inclusionLedger: lifecycle.inclusionLedger }),
            ...(lifecycle.scanCoverage === undefined
                ? {}
                : { scanCoverage: projectScanCoverage(lifecycle.scanCoverage, input.addonName) })
        }),
        blockers,
        cleanup: lifecycle.cleanup,
        paths: {
            gameAddon: `game/dota_addons/${input.addonName}`,
            contentAddon: `content/dota_addons/${input.addonName}`
        },
        execution: {
            kind: executionKind,
            outcome: lifecycle.ok ? "completed" : "failed"
        },
        warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
        commands: [{
                description: `${executionKind} release candidate preflight`,
                outcome: lifecycle.ok ? "completed" : "failed"
            }],
        logs: [{
                source: `${executionKind} release candidate preflight`,
                lines: [lifecycle.cleanup.status === "verified" ? "candidate cleanup verified" : "candidate cleanup not verified"]
            }],
        boundaries: RELEASE_CANDIDATE_BOUNDARIES
    };
    return normalizeReleaseCandidateDetail(detail);
}
function projectScanCoverage(coverage, addonName) {
    if (coverage === undefined)
        return undefined;
    const project = (path) => {
        const separator = path.indexOf("/");
        if (separator < 1)
            return path;
        const root = path.slice(0, separator);
        const suffix = path.slice(separator + 1);
        return `${root}/dota_addons/${addonName}/${suffix}`;
    };
    const category = (value) => ({
        count: value.count,
        paths: value.paths.map(project)
    });
    return {
        schemaVersion: "1.0",
        totalFileCount: coverage.totalFileCount,
        text: category(coverage.text),
        binary: category(coverage.binary),
        unreadable: category(coverage.unreadable),
        oversized: category(coverage.oversized)
    };
}
async function classifyNodeEntry(path, operations) {
    const stats = await operations.lstat(path);
    if (stats.isSymbolicLink())
        return "symbolic-link";
    if (stats.isFile())
        return "file";
    if (stats.isDirectory())
        return "directory";
    return "special";
}
async function captureCandidateIdentity(path, operations) {
    const stats = await operations.lstat(path);
    const canonicalRoot = await operations.realpath(path);
    if (!stats.isDirectory() || stats.isSymbolicLink() || resolve(canonicalRoot) !== resolve(path)) {
        throw new Error("candidate root identity is invalid");
    }
    return Object.freeze({ root: resolve(path), canonicalRoot: resolve(canonicalRoot), device: stats.dev, inode: stats.ino });
}
async function identityMatches(identity, operations) {
    try {
        const stats = await operations.lstat(identity.root);
        const canonical = await operations.realpath(identity.root);
        return stats.isDirectory()
            && !stats.isSymbolicLink()
            && stats.dev === identity.device
            && stats.ino === identity.inode
            && resolve(canonical) === identity.canonicalRoot;
    }
    catch {
        return false;
    }
}
async function cleanupCandidate(identity, operations) {
    if (!await identityMatches(identity, operations)) {
        return { ok: false, removed: false, absent: false, identityMatched: false, code: "CANDIDATE_IDENTITY_MISMATCH" };
    }
    try {
        await operations.removeTree(identity.root);
    }
    catch {
        return { ok: false, removed: false, absent: false, identityMatched: true, code: "CANDIDATE_REMOVAL_FAILED" };
    }
    try {
        await operations.lstat(identity.root);
        return { ok: false, removed: true, absent: false, identityMatched: true, code: "CANDIDATE_ABSENCE_UNVERIFIED" };
    }
    catch (error) {
        if (errorCode(error) === "ENOENT") {
            return { ok: true, removed: true, absent: true, identityMatched: true };
        }
        return { ok: false, removed: true, absent: false, identityMatched: true, code: "CANDIDATE_ABSENCE_UNVERIFIED" };
    }
}
function sourcePath(input, entry) {
    const base = `${entry.root}/dota_addons/${input.addonName}`;
    const root = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
    if (entry.path === base)
        return root;
    const prefix = `${base}/`;
    if (!entry.path.startsWith(prefix))
        return undefined;
    const suffix = entry.path.slice(prefix.length);
    if (!safeRelativeIdentity(suffix))
        return undefined;
    const path = resolve(root, ...suffix.split("/"));
    return isInside(path, root) ? path : undefined;
}
async function readAcceptedSourceFile(input, entry, maxBytes, operations) {
    const path = sourcePath(input, entry);
    if (path === undefined || entry.kind !== "file")
        return { ok: false, code: "SOURCE_FILE_IDENTITY_CHANGED" };
    try {
        const handle = await operations.openFile(path, filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
        try {
            const stats = await handle.stat();
            if (!stats.isFile())
                return { ok: false, code: "SOURCE_FILE_IDENTITY_CHANGED" };
            const facts = {
                ok: true,
                schemaVersion: "1.0",
                size: stats.size,
                identityMatched: true,
                kindMatched: true,
                contained: true
            };
            if (!isReleaseTextPath(entry.path))
                return { ...facts, state: "binary" };
            if (stats.size > maxBytes)
                return { ...facts, state: "oversized" };
            return { ...facts, state: "readable", bytes: await handle.readFile() };
        }
        finally {
            await handle.close();
        }
    }
    catch {
        return { ok: false, code: "SOURCE_FILE_READ_FAILED" };
    }
}
async function observeAcceptedSourceEntry(input, entry, operations) {
    const path = sourcePath(input, entry);
    if (path === undefined)
        return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
    try {
        const stats = await operations.lstat(path);
        const canonicalPath = await operations.realpath(path);
        const root = entry.root === "game" ? input.gameAddonRoot : input.contentAddonRoot;
        const kind = stats.isFile() ? "file" : stats.isDirectory() ? "directory" : undefined;
        if (stats.isSymbolicLink() || kind !== entry.kind || !isAtOrInside(canonicalPath, root)) {
            return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
        }
        return {
            ok: true,
            kind,
            canonicalPath,
            size: stats.size,
            mtimeMs: stats.mtimeMs,
            ctimeMs: stats.ctimeMs,
            mode: stats.mode,
            identityMatched: true,
            contained: true
        };
    }
    catch {
        return { ok: false, code: "SOURCE_OBSERVATION_FAILED" };
    }
}
async function observeSourceIntegrity(input, entry, operations) {
    const path = sourcePath(input, entry);
    if (path === undefined || entry.kind !== "file")
        return { ok: false, code: "SOURCE_INTEGRITY_IDENTITY_CHANGED" };
    return await streamIntegrity(path, entry.root, entry.path, operations);
}
async function streamIntegrity(path, root, identity, operations) {
    return await observeIdentityBoundIntegrityStream({
        root,
        path: identity,
        identityMatched: true,
        kindMatched: true,
        contained: true,
        openByteStream: async () => {
            const handle = await operations.openFile(path, filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
            return (async function* () {
                try {
                    for (;;) {
                        const buffer = Buffer.alloc(64 * 1024);
                        const result = await handle.read(buffer, 0, buffer.byteLength, null);
                        if (result.bytesRead === 0)
                            return;
                        yield buffer.subarray(0, result.bytesRead);
                    }
                }
                finally {
                    await handle.close();
                }
            })();
        }
    });
}
async function inspectCandidateRoot(identity, operations) {
    if (!await identityMatches(identity, operations)) {
        return { ok: false, code: "CANDIDATE_ROOT_IDENTITY_MISMATCH" };
    }
    try {
        const entries = await operations.readDirectory(identity.root);
        return entries.length === 0
            ? { ok: true, empty: true, identityMatched: true }
            : { ok: false, code: "CANDIDATE_ROOT_NOT_EMPTY", entries };
    }
    catch {
        return { ok: false, code: "CANDIDATE_ROOT_INSPECTION_FAILED" };
    }
}
async function materializeCandidateEntry(identity, input, operation, operations) {
    if (!await identityMatches(identity, operations) || !safeRelativeIdentity(operation.destination)) {
        return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
    }
    const destination = resolve(identity.root, ...operation.destination.split("/"));
    if (!isInside(destination, identity.root)) {
        return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
    }
    try {
        const canonicalParent = await operations.realpath(dirname(destination));
        if (!isAtOrInside(canonicalParent, identity.canonicalRoot)) {
            return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
        }
        if (operation.kind === "directory") {
            await operations.makeDirectory(destination);
        }
        else {
            const source = sourcePath(input, operation.source);
            if (source === undefined)
                return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
            const sourceHandle = await operations.openFile(source, filesystemConstants.O_RDONLY | filesystemConstants.O_NOFOLLOW);
            try {
                const sourceStats = await sourceHandle.stat();
                if (!sourceStats.isFile())
                    return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
                const destinationHandle = await operations.openFile(destination, filesystemConstants.O_WRONLY | filesystemConstants.O_CREAT | filesystemConstants.O_EXCL);
                try {
                    for (;;) {
                        const buffer = Buffer.alloc(64 * 1024);
                        const result = await sourceHandle.read(buffer, 0, buffer.byteLength, null);
                        if (result.bytesRead === 0)
                            break;
                        await destinationHandle.write(buffer.subarray(0, result.bytesRead));
                    }
                }
                finally {
                    await destinationHandle.close();
                }
            }
            finally {
                await sourceHandle.close();
            }
        }
        const created = await operations.lstat(destination);
        if (created.isSymbolicLink()
            || (operation.kind === "file" ? !created.isFile() : !created.isDirectory())
            || !await identityMatches(identity, operations))
            return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
        return { ok: true, created: true, identityMatched: true, kindMatched: true, contained: true };
    }
    catch {
        if (operation.kind === "file") {
            const source = sourcePath(input, operation.source);
            if (source === undefined || !await isRegularNonLink(source, operations)) {
                return { ok: false, code: "SOURCE_ENTRY_CHANGED" };
            }
        }
        return { ok: false, code: "CANDIDATE_MATERIALIZATION_FAILED" };
    }
}
async function reconcileCandidateTree(identity, expected, operations) {
    if (!await identityMatches(identity, operations)) {
        return { ok: false, code: "CANDIDATE_TREE_MISMATCH", issues: [{ code: "CANDIDATE_TREE_IDENTITY_INVALID", path: "candidate" }] };
    }
    try {
        const actual = await walkCandidate(identity, operations);
        const expectedMap = new Map(expected.map((entry) => [entry.path, entry.kind]));
        const actualMap = new Map(actual.map((entry) => [entry.path, entry.kind]));
        const issues = [];
        for (const entry of expected) {
            const actualKind = actualMap.get(entry.path);
            if (actualKind === undefined)
                issues.push({ code: "CANDIDATE_TREE_MISSING", path: entry.path });
            else if (actualKind !== entry.kind)
                issues.push({ code: "CANDIDATE_TREE_WRONG_KIND", path: entry.path, kind: actualKind });
        }
        for (const entry of actual) {
            if (!expectedMap.has(entry.path))
                issues.push({ code: "CANDIDATE_TREE_UNEXPECTED", path: entry.path, kind: entry.kind });
        }
        return issues.length === 0
            ? { ok: true, exact: true, identityMatched: true }
            : { ok: false, code: "CANDIDATE_TREE_MISMATCH", issues };
    }
    catch {
        return { ok: false, code: "CANDIDATE_TREE_RECONCILIATION_FAILED" };
    }
}
async function walkCandidate(identity, operations) {
    const output = [];
    const walk = async (directory) => {
        const names = [...await operations.readDirectory(directory)].sort(compareOrdinal);
        for (const name of names) {
            if (!safeName(name))
                throw new Error("invalid candidate identity");
            const path = join(directory, name);
            const stats = await operations.lstat(path);
            const relativePath = relative(identity.root, path).replaceAll("\\", "/");
            if (stats.isSymbolicLink() || (!stats.isFile() && !stats.isDirectory())) {
                throw new Error("unsafe candidate entry");
            }
            output.push({ path: relativePath, kind: stats.isDirectory() ? "directory" : "file" });
            if (stats.isDirectory())
                await walk(path);
        }
    };
    await walk(identity.root);
    return output;
}
async function observeCandidateIntegrity(identity, expected, operations) {
    if (!await identityMatches(identity, operations)) {
        return { ok: false, code: "CANDIDATE_INTEGRITY_IDENTITY_CHANGED" };
    }
    const observations = [];
    for (const entry of expected) {
        if (entry.kind !== "file" || !safeRelativeIdentity(entry.path))
            continue;
        const path = resolve(identity.root, ...entry.path.split("/"));
        if (!isInside(path, identity.root))
            return { ok: false, code: "CANDIDATE_INTEGRITY_IDENTITY_CHANGED" };
        const root = entry.path.split("/", 1)[0];
        if (root !== "game" && root !== "content") {
            return { ok: false, code: "CANDIDATE_INTEGRITY_IDENTITY_CHANGED" };
        }
        const observed = await streamIntegrity(path, root, entry.path, operations);
        if (observed === null || typeof observed !== "object" || Reflect.get(observed, "ok") !== true)
            return observed;
        observations.push(observed);
    }
    return { ok: true, schemaVersion: "1.0", observations };
}
async function isRegularNonLink(path, operations) {
    try {
        const stats = await operations.lstat(path);
        return stats.isFile() && !stats.isSymbolicLink();
    }
    catch {
        return false;
    }
}
function isAtOrInside(child, parent) {
    const relation = relative(resolve(parent), resolve(child));
    return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}
function isInside(child, parent) {
    const relation = relative(resolve(parent), resolve(child));
    return relation !== "" && !relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation);
}
function safeRelativeIdentity(value) {
    return value.length > 0
        && !value.startsWith("/")
        && !value.startsWith("\\")
        && !value.includes("\\")
        && value.split("/").every(safeName);
}
function safeName(value) {
    return value.length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\");
}
function basenameMatchesCandidateRoot(path) {
    const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
    return name.startsWith("dota-release-candidate-") && name.length > "dota-release-candidate-".length;
}
function errorCode(error) {
    if (error === null || (typeof error !== "object" && typeof error !== "function"))
        return undefined;
    try {
        const code = Reflect.get(error, "code");
        return typeof code === "string" ? code : undefined;
    }
    catch {
        return undefined;
    }
}
function compareOrdinal(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}

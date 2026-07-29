import { constants as fsConstants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { preflightNodeReleaseCandidate } from "./release-candidate-node.js";
import { computeReleaseCandidateCombinedDigest } from "./release-candidate-result.js";
export const EXPORTED_CANDIDATE_SCHEMA_VERSION = "1.0";
export const EXPORTED_CANDIDATE_HANDOFF_SUFFIX = ".dota-workshop-handoff.v1.json";
export const EXPORTED_CANDIDATE_BOUNDARIES = Object.freeze({
    steamLogin: false,
    workshopMutation: false,
    upload: false,
    archive: false,
    signing: false,
    encryption: false,
    crossHostTransfer: false,
    sourceTreesModified: false,
    persistentCandidate: true,
    realWindowsRuntimeProven: false
});
export async function exportNodeReleaseCandidate(input, dependencies = {}) {
    const operation = "export_release_candidate";
    if (input.target.kind === "remote") {
        return failure(input.target, operation, "REMOTE_EXPORT_SERVICE_REQUIRED", "Remote export requires target-native execution.");
    }
    const target = publicTarget(input.target);
    const paths = await validateExportPaths(input, dependencies.repositoryRoot ?? process.cwd());
    if (!paths.ok)
        return failure(target, operation, paths.code, paths.message, paths.paths);
    const staging = await mkdtemp(join(paths.exportRoot, ".dota-workshop-export-"));
    let stagingManifest;
    let promoted = false;
    const remove = dependencies.remove ?? rm;
    const renamePath = dependencies.rename ?? rename;
    const write = dependencies.write ?? writeFile;
    const removeFile = dependencies.unlink ?? unlink;
    try {
        const releaseCandidate = await preflightNodeReleaseCandidate({ target: input.target, addonName: input.addonName }, {
            ...dependencies,
            inspectCandidate: async (candidateRoot) => {
                await copyCandidateTree(candidateRoot, staging);
                stagingManifest = await computeManifest(staging);
                return Object.freeze({ inspected: true });
            }
        });
        if (!releaseCandidate.ok || releaseCandidate.manifest === undefined) {
            const cleanup = await cleanupStaging(staging, remove, "PREFLIGHT_FAILED");
            return failure(target, operation, "EXPORT_PREFLIGHT_FAILED", "Release candidate preflight did not pass.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, "warnings" in releaseCandidate ? [...releaseCandidate.warnings] : [], cleanup);
        }
        if (stagingManifest === undefined || !manifestEqual(releaseCandidate.manifest, stagingManifest)) {
            const cleanup = await cleanupStaging(staging, remove, "STAGING_MANIFEST_MISMATCH");
            return failure(target, operation, "STAGING_MANIFEST_MISMATCH", "Staging integrity did not match the validated candidate.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], cleanup);
        }
        if (await pathExists(paths.destination) || await pathExists(paths.handoff)) {
            const cleanup = await cleanupStaging(staging, remove, "DESTINATION_STATE_CHANGED");
            return failure(target, operation, "DESTINATION_STATE_CHANGED", "Destination state changed before promotion.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], cleanup);
        }
        await renamePath(staging, paths.destination);
        promoted = true;
        const finalManifest = await computeManifest(paths.destination);
        if (!manifestEqual(stagingManifest, finalManifest)) {
            return failure(target, operation, "PROMOTED_MANIFEST_MISMATCH", "Promoted candidate integrity could not be proven.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], retainedFailureCleanup("PROMOTED_MANIFEST_MISMATCH"));
        }
        const identity = await captureDirectoryIdentity(paths.destination);
        const ownership = Object.freeze({
            schemaVersion: EXPORTED_CANDIDATE_SCHEMA_VERSION,
            ownershipId: randomUUID(),
            candidateIdentity: Object.freeze({ kind: "node", device: identity.device, inode: identity.inode })
        });
        const handoff = deepFreeze({
            schemaVersion: EXPORTED_CANDIDATE_SCHEMA_VERSION,
            operation,
            addonName: input.addonName,
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            targetKind: input.target.kind,
            fileCount: finalManifest.entries.length,
            combinedSha256: finalManifest.combinedSha256,
            source: {
                gameAddon: `game/dota_addons/${input.addonName}`,
                contentAddon: `content/dota_addons/${input.addonName}`
            },
            manifest: finalManifest,
            ownership,
            boundaries: EXPORTED_CANDIDATE_BOUNDARIES
        });
        const temporaryManifest = await createTemporaryManifestPath(paths.exportRoot);
        try {
            await write(temporaryManifest, `${JSON.stringify(handoff, null, 2)}\n`, { flag: "wx" });
            await renamePath(temporaryManifest, paths.handoff);
        }
        catch {
            try {
                await removeFile(temporaryManifest);
            }
            catch { }
            return failure(target, operation, "HANDOFF_MANIFEST_PUBLICATION_FAILED", "The retained candidate exists but its handoff manifest was not published.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], retainedFailureCleanup("HANDOFF_MANIFEST_PUBLICATION_FAILED"), handoff, ownership);
        }
        const cleanup = verifiedExportCleanup();
        return {
            ok: true,
            target,
            operation,
            evidence: [
                "release candidate preflight passed",
                "same-filesystem staging validated",
                "candidate promoted with one rename operation",
                "external handoff manifest published"
            ],
            warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
            paths: { exportRoot: paths.exportRoot, destination: paths.destination, handoffManifest: paths.handoff },
            commands: [{ command: "rename", cwd: paths.exportRoot, exitCode: 0 }],
            logs: [{ source: "export_release_candidate", lines: ["candidate retained", "handoff manifest published"] }],
            manifest: handoff,
            ownership,
            cleanup
        };
    }
    catch {
        if (promoted) {
            return failure(target, operation, "EXPORT_FINALIZATION_FAILED", "The promoted candidate state requires operator inspection.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], retainedFailureCleanup("EXPORT_FINALIZATION_FAILED"));
        }
        const cleanup = await cleanupStaging(staging, remove, "EXPORT_ASSEMBLY_FAILED");
        return failure(target, operation, "EXPORT_ASSEMBLY_FAILED", "Candidate export failed before promotion.", {
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            handoffManifest: paths.handoff
        }, [], cleanup);
    }
}
export async function cleanupNodeExportedCandidate(input, dependencies = {}) {
    const operation = "cleanup_exported_candidate";
    if (input.target.kind === "remote") {
        return failure(input.target, operation, "REMOTE_CLEANUP_SERVICE_REQUIRED", "Remote cleanup requires target-native execution.");
    }
    const target = publicTarget(input.target);
    const paths = await validateExportPaths(input, dependencies.repositoryRoot ?? process.cwd(), true);
    if (!paths.ok)
        return failure(target, operation, paths.code, paths.message, paths.paths);
    const authorization = await authorizeCleanup(input, paths);
    if (!authorization.ok) {
        return failure(target, operation, authorization.code, authorization.message, {
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            handoffManifest: paths.handoff
        }, [], cleanupAuthorizationFailure(input.dryRun !== false, authorization.code));
    }
    if (input.dryRun !== false) {
        const cleanup = deepFreeze({
            schemaVersion: "1.0",
            mode: "dry-run",
            authorized: true,
            attempted: false,
            candidateRemoved: false,
            candidateAbsent: false,
            manifestRemoved: false,
            manifestAbsent: false,
            status: "verified"
        });
        return cleanupSuccess(target, input, paths, authorization.manifest, cleanup, "cleanup authorization passed without mutation");
    }
    const remove = dependencies.remove ?? rm;
    const removeFile = dependencies.unlink ?? unlink;
    let candidateRemoved = false;
    let manifestRemoved = false;
    try {
        await remove(paths.destination, { recursive: true });
        candidateRemoved = true;
    }
    catch { }
    try {
        await removeFile(paths.handoff);
        manifestRemoved = true;
    }
    catch { }
    const candidateAbsent = !await pathExists(paths.destination);
    const manifestAbsent = !await pathExists(paths.handoff);
    const verified = candidateRemoved && candidateAbsent && manifestRemoved && manifestAbsent;
    const cleanup = deepFreeze({
        schemaVersion: "1.0",
        mode: "execute",
        authorized: true,
        attempted: true,
        candidateRemoved,
        candidateAbsent,
        manifestRemoved,
        manifestAbsent,
        status: verified ? "verified" : "failed",
        ...(verified ? {} : { code: "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE" })
    });
    if (!verified) {
        return failure(target, operation, "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE", "Cleanup did not prove removal of both owned objects.", {
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            handoffManifest: paths.handoff
        }, [], cleanup, authorization.manifest, authorization.manifest.ownership);
    }
    return cleanupSuccess(target, input, paths, authorization.manifest, cleanup, "candidate and handoff manifest removed and proven absent");
}
async function authorizeCleanup(input, paths) {
    try {
        const manifest = parseExportedCandidateHandoffManifest(JSON.parse(await readFile(paths.handoff, "utf8")));
        if (manifest === undefined)
            return { ok: false, code: "HANDOFF_MANIFEST_INVALID", message: "Handoff manifest is invalid." };
        if (manifest.exportRoot !== paths.exportRoot
            || manifest.destination !== paths.destination
            || manifest.ownership.ownershipId !== input.ownershipId
            || manifest.schemaVersion !== input.manifestVersion
            || manifest.combinedSha256 !== input.combinedSha256)
            return { ok: false, code: "CLEANUP_AUTHORIZATION_MISMATCH", message: "Cleanup assertions do not match the handoff manifest." };
        const identity = await captureDirectoryIdentity(paths.destination);
        if (manifest.ownership.candidateIdentity.kind !== "node"
            || identity.device !== manifest.ownership.candidateIdentity.device
            || identity.inode !== manifest.ownership.candidateIdentity.inode)
            return { ok: false, code: "CANDIDATE_IDENTITY_MISMATCH", message: "Candidate identity changed after export." };
        const candidateManifest = await computeManifest(paths.destination);
        if (!manifestEqual(candidateManifest, manifest.manifest) || candidateManifest.combinedSha256 !== input.combinedSha256) {
            return { ok: false, code: "CANDIDATE_DIGEST_MISMATCH", message: "Candidate digest no longer matches the handoff evidence." };
        }
        return { ok: true, manifest };
    }
    catch {
        return { ok: false, code: "CLEANUP_AUTHORIZATION_FAILED", message: "Cleanup authorization evidence could not be verified." };
    }
}
async function validateExportPaths(input, repositoryRoot, allowExisting = false) {
    const rawPaths = { exportRoot: input.exportRoot, destination: input.destination };
    if (!portableAbsolute(input.exportRoot) || !portableAbsolute(input.destination) || containsUnsafePathText(input.exportRoot) || containsUnsafePathText(input.destination)) {
        return { ok: false, code: "EXPORT_PATH_INVALID", message: "Export paths must be safe absolute target-local paths.", paths: rawPaths };
    }
    try {
        const exportStats = await lstat(input.exportRoot);
        const canonicalExportRoot = resolve(await realpath(input.exportRoot));
        if (!exportStats.isDirectory() || exportStats.isSymbolicLink()) {
            return { ok: false, code: "EXPORT_ROOT_UNSAFE", message: "Export root must be a canonical non-link directory.", paths: rawPaths };
        }
        const rawExportRoot = resolve(input.exportRoot);
        const rawDestination = resolve(input.destination);
        const destinationLeaf = rawDestination.slice(rawDestination.lastIndexOf(sep) + 1);
        if (dirname(rawDestination) !== rawExportRoot || !safeLeaf(destinationLeaf)) {
            return { ok: false, code: "DESTINATION_OUTSIDE_EXPORT_ROOT", message: "Destination must be an absent direct child of the export root.", paths: rawPaths };
        }
        const destination = join(canonicalExportRoot, destinationLeaf);
        const protectedRoots = [resolve(await realpath(repositoryRoot))];
        if (input.target.kind === "local")
            protectedRoots.push(resolve(tmpdir()));
        if (input.target.kind === "fixture")
            protectedRoots.push(resolve(input.target.root));
        if (input.target.kind === "local" && input.target.dotaRoot !== undefined)
            protectedRoots.push(resolve(input.target.dotaRoot));
        if (canonicalExportRoot === parse(canonicalExportRoot).root || protectedRoots.some((protectedRoot) => pathsOverlap(canonicalExportRoot, protectedRoot))) {
            return { ok: false, code: "EXPORT_ROOT_PROTECTED", message: "Export root overlaps a protected location.", paths: rawPaths };
        }
        if (await hasGitAncestor(canonicalExportRoot)) {
            return { ok: false, code: "EXPORT_ROOT_REPOSITORY", message: "Export root cannot be inside a repository.", paths: rawPaths };
        }
        const handoff = `${destination}${EXPORTED_CANDIDATE_HANDOFF_SUFFIX}`;
        if (!allowExisting && (await pathExists(destination) || await pathExists(handoff))) {
            return { ok: false, code: "EXPORT_DESTINATION_EXISTS", message: "Destination or handoff manifest already exists.", paths: { exportRoot: canonicalExportRoot, destination, handoffManifest: handoff } };
        }
        if (allowExisting && (!await pathExists(destination) || !await pathExists(handoff))) {
            return { ok: false, code: "EXPORTED_CANDIDATE_STATE_MISSING", message: "Candidate and handoff manifest must both exist.", paths: { exportRoot: canonicalExportRoot, destination, handoffManifest: handoff } };
        }
        return { ok: true, exportRoot: canonicalExportRoot, destination, handoff };
    }
    catch {
        return { ok: false, code: "EXPORT_PATH_INSPECTION_FAILED", message: "Export path evidence could not be inspected.", paths: rawPaths };
    }
}
async function copyCandidateTree(sourceRoot, destinationRoot) {
    const folded = new Set();
    const walk = async (sourceDirectory, relativeDirectory) => {
        const names = [...await readdir(sourceDirectory)].sort(compareOrdinal);
        for (const name of names) {
            if (!safeLeaf(name))
                throw new Error("unsafe candidate name");
            const relativePath = relativeDirectory.length === 0 ? name : `${relativeDirectory}/${name}`;
            const foldedIdentity = relativePath.toLocaleLowerCase("en-US");
            if (folded.has(foldedIdentity))
                throw new Error("case-fold collision");
            folded.add(foldedIdentity);
            const source = join(sourceDirectory, name);
            const destination = join(destinationRoot, ...relativePath.split("/"));
            const sourceStats = await lstat(source);
            if (sourceStats.isSymbolicLink())
                throw new Error("symbolic link rejected");
            if (sourceStats.isDirectory()) {
                await mkdir(destination);
                await walk(source, relativePath);
            }
            else if (sourceStats.isFile()) {
                await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
            }
            else {
                throw new Error("unknown candidate entry type");
            }
        }
    };
    await walk(sourceRoot, "");
}
export async function computeExportedCandidateManifest(root) {
    return await computeManifest(root);
}
async function computeManifest(root) {
    const entries = [];
    const folded = new Set();
    const walk = async (directory) => {
        for (const name of [...await readdir(directory)].sort(compareOrdinal)) {
            if (!safeLeaf(name))
                throw new Error("unsafe candidate identity");
            const path = join(directory, name);
            const stats = await lstat(path);
            const identity = relative(root, path).replaceAll("\\", "/");
            const foldedIdentity = identity.toLocaleLowerCase("en-US");
            if (folded.has(foldedIdentity))
                throw new Error("case-fold collision");
            folded.add(foldedIdentity);
            if (stats.isSymbolicLink())
                throw new Error("symbolic link rejected");
            if (stats.isDirectory()) {
                await walk(path);
                continue;
            }
            if (!stats.isFile())
                throw new Error("unknown candidate entry type");
            const rootName = identity.split("/", 1)[0];
            if (rootName !== "game" && rootName !== "content")
                throw new Error("unexpected candidate root");
            const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
            try {
                const fileStats = await handle.stat();
                if (!fileStats.isFile())
                    throw new Error("candidate file changed");
                const hash = createHash("sha256");
                for (;;) {
                    const buffer = Buffer.alloc(64 * 1024);
                    const result = await handle.read(buffer, 0, buffer.length, null);
                    if (result.bytesRead === 0)
                        break;
                    hash.update(buffer.subarray(0, result.bytesRead));
                }
                entries.push({ schemaVersion: "1.0", root: rootName, path: identity, bytes: fileStats.size, sha256: hash.digest("hex") });
            }
            finally {
                await handle.close();
            }
        }
    };
    await walk(root);
    entries.sort((left, right) => compareOrdinal(left.root, right.root) || compareOrdinal(left.path, right.path));
    return deepFreeze({ schemaVersion: "1.0", entries, combinedSha256: computeReleaseCandidateCombinedDigest(entries) });
}
function manifestEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
export function parseExportedCandidateHandoffManifest(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const candidate = value;
    if (candidate.schemaVersion !== "1.0" || candidate.operation !== "export_release_candidate")
        return undefined;
    if (typeof candidate.addonName !== "string" || typeof candidate.exportRoot !== "string" || typeof candidate.destination !== "string")
        return undefined;
    if (typeof candidate.fileCount !== "number" || typeof candidate.combinedSha256 !== "string" || !/^[0-9a-f]{64}$/.test(candidate.combinedSha256))
        return undefined;
    const ownership = candidate.ownership;
    const identity = ownership?.candidateIdentity;
    const nodeIdentity = identity?.kind === "node" && typeof identity.device === "number" && typeof identity.inode === "number";
    const windowsIdentity = identity?.kind === "windows" && typeof identity.volumeIdentity === "string" && typeof identity.fileIdentity === "string";
    if (ownership?.schemaVersion !== "1.0" || typeof ownership.ownershipId !== "string" || (!nodeIdentity && !windowsIdentity))
        return undefined;
    const manifest = candidate.manifest;
    if (manifest?.schemaVersion !== "1.0" || !Array.isArray(manifest.entries) || manifest.combinedSha256 !== candidate.combinedSha256)
        return undefined;
    if (computeReleaseCandidateCombinedDigest(manifest.entries) !== manifest.combinedSha256 || manifest.entries.length !== candidate.fileCount)
        return undefined;
    if (candidate.boundaries === null || typeof candidate.boundaries !== "object" || JSON.stringify(candidate.boundaries) !== JSON.stringify(EXPORTED_CANDIDATE_BOUNDARIES))
        return undefined;
    return deepFreeze(value);
}
async function captureDirectoryIdentity(path) {
    const stats = await stat(path);
    const canonical = resolve(await realpath(path));
    if (!stats.isDirectory() || canonical !== resolve(path))
        throw new Error("directory identity invalid");
    return { device: stats.dev, inode: stats.ino };
}
async function createTemporaryManifestPath(exportRoot) {
    const directory = await mkdtemp(join(exportRoot, ".dota-workshop-handoff-"));
    await rm(directory, { recursive: true });
    return `${directory}.json`;
}
async function cleanupStaging(staging, remove, code) {
    let removed = false;
    try {
        await remove(staging, { recursive: true });
        removed = true;
    }
    catch { }
    const absent = !await pathExists(staging);
    return deepFreeze({
        schemaVersion: "1.0",
        mode: "export-failure",
        authorized: true,
        attempted: true,
        candidateRemoved: false,
        candidateAbsent: false,
        manifestRemoved: false,
        manifestAbsent: true,
        stagingRemoved: removed,
        stagingAbsent: absent,
        status: removed && absent ? "verified" : "failed",
        ...(removed && absent ? {} : { code })
    });
}
function retainedFailureCleanup(code) {
    return deepFreeze({
        schemaVersion: "1.0",
        mode: "export-failure",
        authorized: false,
        attempted: false,
        candidateRemoved: false,
        candidateAbsent: false,
        manifestRemoved: false,
        manifestAbsent: false,
        status: "failed",
        code
    });
}
function verifiedExportCleanup() {
    return deepFreeze({
        schemaVersion: "1.0",
        mode: "export-failure",
        authorized: true,
        attempted: false,
        candidateRemoved: false,
        candidateAbsent: false,
        manifestRemoved: false,
        manifestAbsent: false,
        stagingRemoved: false,
        stagingAbsent: true,
        status: "verified"
    });
}
function cleanupAuthorizationFailure(dryRun, code) {
    return deepFreeze({
        schemaVersion: "1.0",
        mode: dryRun ? "dry-run" : "execute",
        authorized: false,
        attempted: false,
        candidateRemoved: false,
        candidateAbsent: false,
        manifestRemoved: false,
        manifestAbsent: false,
        status: "failed",
        code
    });
}
function cleanupSuccess(target, input, paths, manifest, cleanup, evidence) {
    return {
        ok: true,
        target,
        operation: "cleanup_exported_candidate",
        evidence: [evidence],
        warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
        paths: { exportRoot: paths.exportRoot, destination: paths.destination, handoffManifest: paths.handoff },
        commands: [{ command: input.dryRun !== false ? "cleanup dry-run" : "remove exact exported candidate" }],
        logs: [{ source: "cleanup_exported_candidate", lines: [cleanup.status] }],
        manifest,
        ownership: manifest.ownership,
        cleanup
    };
}
function failure(target, operation, code, message, paths = {}, warnings = [], cleanup = deepFreeze({
    schemaVersion: "1.0",
    mode: operation === "cleanup_exported_candidate" ? "dry-run" : "export-failure",
    authorized: false,
    attempted: false,
    candidateRemoved: false,
    candidateAbsent: false,
    manifestRemoved: false,
    manifestAbsent: false,
    status: "not-reached"
}), manifest, ownership) {
    return {
        ok: false,
        target,
        operation,
        error: { code, message },
        evidence: [message],
        warnings,
        paths,
        commands: [],
        logs: [],
        ...(manifest === undefined ? {} : { manifest }),
        ...(ownership === undefined ? {} : { ownership }),
        cleanup
    };
}
function publicTarget(target) {
    if (target.kind === "fixture")
        return { kind: "fixture", root: "[redacted]" };
    if (target.kind === "local")
        return { kind: "local" };
    return { kind: "remote", name: target.name, transport: target.transport, host: "[redacted]" };
}
async function pathExists(path) {
    try {
        await lstat(path);
        return true;
    }
    catch {
        return false;
    }
}
async function hasGitAncestor(path) {
    let current = resolve(path);
    for (;;) {
        if (await pathExists(join(current, ".git")))
            return true;
        const parent = dirname(current);
        if (parent === current)
            return false;
        current = parent;
    }
}
function portableAbsolute(path) {
    return isAbsolute(path) || /^[A-Za-z]:[\\/]/u.test(path) || /^[/\\]{2}/u.test(path);
}
function containsUnsafePathText(path) {
    return path.includes("\0") || /[\r\n]/u.test(path) || path.split(/[\\/]/u).some((segment) => segment === "..");
}
function safeLeaf(value) {
    return value.length > 0 && value !== "." && value !== ".." && !/[\\/\0\r\n]/u.test(value);
}
function pathsOverlap(left, right) {
    return atOrInside(left, right) || atOrInside(right, left);
}
function atOrInside(child, parent) {
    const relation = relative(resolve(parent), resolve(child));
    return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}
function compareOrdinal(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function deepFreeze(value) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        for (const nested of Object.values(value))
            deepFreeze(nested);
        Object.freeze(value);
    }
    return value;
}

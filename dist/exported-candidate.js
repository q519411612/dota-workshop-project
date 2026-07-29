import { constants as fsConstants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, open, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { homedir, tmpdir } from "node:os";
import { discoverEnvironment } from "./environment.js";
import { createNodeReleaseCandidateFilesystem, preflightNodeReleaseCandidate } from "./release-candidate-node.js";
import { atomicMoveNoReplace, verifyAtomicMoveNoReplaceAvailable } from "./exported-candidate-native.js";
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
    const classifier = exportClassifier(dependencies);
    if (!classifier.ok)
        return failure(target, operation, classifier.code, classifier.message);
    const resolvedInput = await resolveLocalExportInput(input, dependencies);
    if (!resolvedInput.ok)
        return failure(target, operation, resolvedInput.code, resolvedInput.message);
    const paths = await validateExportPaths(resolvedInput.input, dependencies.repositoryRoot ?? process.cwd(), false, classifier.classify);
    if (!paths.ok)
        return failure(target, operation, paths.code, paths.message, paths.paths);
    const atomicCompiler = dependencies.atomicCompiler ?? (process.env.CC?.trim() || "/usr/bin/cc");
    if (dependencies.atomicMove === undefined && dependencies.rename === undefined) {
        try {
            await (dependencies.verifyAtomicMove ?? verifyAtomicMoveNoReplaceAvailable)(dependencies.platform ?? process.platform, atomicCompiler);
        }
        catch {
            return failure(target, operation, "ATOMIC_NO_REPLACE_UNAVAILABLE", "Target-native atomic no-replace is unavailable on this host.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            });
        }
    }
    let staging;
    try {
        staging = await (dependencies.createStaging ?? mkdtemp)(join(paths.exportRoot, ".dota-workshop-export-"));
    }
    catch {
        return failure(target, operation, "EXPORT_STAGING_CREATION_FAILED", "Export staging could not be created.", {
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            handoffManifest: paths.handoff
        });
    }
    let stagingSnapshot;
    let promoted = false;
    let failureStage = "assembly";
    const remove = dependencies.remove ?? rm;
    const moveNoReplace = dependencies.atomicMove ?? dependencies.rename ?? (async (source, destination) => await atomicMoveNoReplace(source, destination, dependencies.platform ?? process.platform, atomicCompiler));
    const write = dependencies.write ?? writeFile;
    try {
        const releaseCandidate = await (dependencies.preflight ?? preflightNodeReleaseCandidate)({ target: resolvedInput.input.target, addonName: input.addonName }, {
            ...dependencies,
            inspectCandidate: async (candidateRoot) => {
                await copyCandidateTree(candidateRoot, staging, classifier.classify);
                stagingSnapshot = await computeCandidateSnapshot(staging, classifier.classify);
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
        if (stagingSnapshot === undefined || !manifestEqual(releaseCandidate.manifest, stagingSnapshot.manifest)) {
            const cleanup = await cleanupStaging(staging, remove, "STAGING_MANIFEST_MISMATCH");
            return failure(target, operation, "STAGING_MANIFEST_MISMATCH", "Staging integrity did not match the validated candidate.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], cleanup);
        }
        failureStage = "promotion";
        await moveNoReplace(staging, paths.destination);
        promoted = true;
        const finalSnapshot = await computeCandidateSnapshot(paths.destination, classifier.classify);
        if (!snapshotEqual(stagingSnapshot, finalSnapshot)) {
            return failure(target, operation, "PROMOTED_MANIFEST_MISMATCH", "Promoted candidate integrity could not be proven.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], retainedFailureCleanup("PROMOTED_MANIFEST_MISMATCH"));
        }
        const identity = await captureDirectoryIdentity(paths.destination, classifier.classify);
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
            fileCount: finalSnapshot.manifest.entries.length,
            combinedSha256: finalSnapshot.manifest.combinedSha256,
            source: {
                gameAddon: `game/dota_addons/${input.addonName}`,
                contentAddon: `content/dota_addons/${input.addonName}`
            },
            manifest: finalSnapshot.manifest,
            topology: finalSnapshot.topology,
            ownership,
            boundaries: EXPORTED_CANDIDATE_BOUNDARIES
        });
        const temporaryManifest = await createTemporaryManifestPath(paths.exportRoot);
        try {
            await write(temporaryManifest, `${JSON.stringify(handoff, null, 2)}\n`, { flag: "wx" });
            await moveNoReplace(temporaryManifest, paths.handoff);
        }
        catch (error) {
            let temporaryHandoffRemoved = false;
            if (await pathExists(temporaryManifest)) {
                try {
                    await rm(temporaryManifest, { force: true });
                    temporaryHandoffRemoved = true;
                }
                catch { }
            }
            const temporaryHandoffAbsent = !await pathExists(temporaryManifest);
            const code = stableErrorCode(error, "HANDOFF_MANIFEST_PUBLICATION_FAILED");
            return failure(target, operation, code, "The retained candidate exists but its handoff manifest was not published.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], retainedFailureCleanup(code, { temporaryHandoffRemoved, temporaryHandoffAbsent }), handoff, ownership);
        }
        const cleanup = verifiedExportCleanup();
        return {
            ok: true,
            target,
            operation,
            evidence: [
                "release candidate preflight passed",
                "same-filesystem staging validated",
                "candidate promoted with atomic no-replace",
                "external handoff manifest published with atomic no-replace"
            ],
            warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
            paths: { exportRoot: paths.exportRoot, destination: paths.destination, handoffManifest: paths.handoff },
            commands: [{ command: "target-native atomic no-replace", cwd: paths.exportRoot, exitCode: 0 }],
            logs: [{ source: "export_release_candidate", lines: ["candidate retained", "handoff manifest published"] }],
            manifest: handoff,
            ownership,
            cleanup
        };
    }
    catch (error) {
        if (promoted) {
            const code = stableErrorCode(error, "EXPORT_FINALIZATION_FAILED");
            return failure(target, operation, code, "The promoted candidate state requires operator inspection.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], retainedFailureCleanup(code));
        }
        const code = stableErrorCode(error, failureStage === "promotion" ? "EXPORT_PROMOTION_FAILED" : "EXPORT_ASSEMBLY_FAILED");
        const cleanup = await cleanupStaging(staging, remove, code);
        return failure(target, operation, code, failureStage === "promotion" ? "Candidate promotion failed." : "Candidate export failed before promotion.", {
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
    const classifier = exportClassifier(dependencies);
    if (!classifier.ok)
        return failure(target, operation, classifier.code, classifier.message);
    const resolvedInput = await resolveLocalExportInput(input, dependencies);
    if (!resolvedInput.ok)
        return failure(target, operation, resolvedInput.code, resolvedInput.message);
    const paths = await validateExportPaths(resolvedInput.input, dependencies.repositoryRoot ?? process.cwd(), true, classifier.classify);
    if (!paths.ok)
        return failure(target, operation, paths.code, paths.message, paths.paths);
    const atomicCompiler = dependencies.atomicCompiler ?? (process.env.CC?.trim() || "/usr/bin/cc");
    const authorization = await authorizeCleanup(resolvedInput.input, paths, classifier.classify);
    if (!authorization.ok) {
        return failure(target, operation, authorization.code, authorization.message, {
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            handoffManifest: paths.handoff
        }, [], cleanupAuthorizationFailure(input.dryRun !== false, authorization.code));
    }
    if (input.dryRun !== false) {
        await authorization.handoffHandle.close().catch(() => undefined);
        const cleanup = deepFreeze({
            schemaVersion: "1.0",
            mode: "dry-run",
            authorized: true,
            attempted: false,
            candidateRemoved: false,
            candidateAbsent: false,
            manifestRemoved: false,
            manifestAbsent: false,
            candidateState: "present",
            manifestState: "present",
            status: "verified"
        });
        return cleanupSuccess(target, input, paths, authorization.manifest, cleanup, "cleanup authorization passed without mutation");
    }
    if (dependencies.atomicMove === undefined && dependencies.rename === undefined) {
        try {
            await (dependencies.verifyAtomicMove ?? verifyAtomicMoveNoReplaceAvailable)(dependencies.platform ?? process.platform, atomicCompiler);
        }
        catch {
            await authorization.handoffHandle.close().catch(() => undefined);
            return failure(target, operation, "ATOMIC_NO_REPLACE_UNAVAILABLE", "Target-native atomic no-replace is unavailable on this host.", {
                exportRoot: paths.exportRoot,
                destination: paths.destination,
                handoffManifest: paths.handoff
            }, [], cleanupAuthorizationFailure(false, "ATOMIC_NO_REPLACE_UNAVAILABLE"), authorization.manifest, authorization.manifest.ownership);
        }
    }
    const moveNoReplace = dependencies.atomicMove ?? dependencies.rename ?? (async (source, destination) => await atomicMoveNoReplace(source, destination, dependencies.platform ?? process.platform, atomicCompiler));
    const removePath = dependencies.remove ?? rm;
    const candidateTombstone = join(paths.exportRoot, `.dota-workshop-candidate-delete-${randomUUID()}`);
    const handoffTombstone = join(paths.exportRoot, `.dota-workshop-handoff-delete-${randomUUID()}.json`);
    let candidateRemoved = false;
    let manifestRemoved = false;
    let code = "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE";
    try {
        await dependencies.afterHandoffAuthorization?.(paths.handoff);
        const mutationAuthorization = await authorizeCleanup(resolvedInput.input, paths, classifier.classify);
        if (!mutationAuthorization.ok || !sameAuthorization(authorization, mutationAuthorization)) {
            if (mutationAuthorization.ok)
                await mutationAuthorization.handoffHandle.close().catch(() => undefined);
            throw new Error("CLEANUP_MUTATION_AUTHORIZATION_CHANGED");
        }
        await mutationAuthorization.handoffHandle.close().catch(() => undefined);
        await moveNoReplace(paths.destination, candidateTombstone);
        await dependencies.afterCandidateTombstoneMove?.(candidateTombstone);
        const movedIdentity = await captureDirectoryIdentity(candidateTombstone, classifier.classify);
        if (!sameNodeIdentity(movedIdentity, authorization.candidateIdentity))
            throw new Error("CANDIDATE_IDENTITY_MISMATCH");
        const movedSnapshot = await computeCandidateSnapshot(candidateTombstone, classifier.classify);
        if (!snapshotMatchesHandoff(movedSnapshot, authorization.manifest))
            throw new Error("CANDIDATE_DIGEST_MISMATCH");
        await removePath(candidateTombstone, { recursive: true, force: false });
        candidateRemoved = !await pathExists(candidateTombstone) && !await pathExists(paths.destination);
        if (!candidateRemoved)
            throw new Error("CANDIDATE_ABSENCE_UNVERIFIED");
    }
    catch (error) {
        code = stableErrorCode(error, "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE");
        try {
            if (await pathExists(candidateTombstone) && !await pathExists(paths.destination)) {
                const tombstoneIdentity = await captureDirectoryIdentity(candidateTombstone, classifier.classify);
                if (sameNodeIdentity(tombstoneIdentity, authorization.candidateIdentity)) {
                    await moveNoReplace(candidateTombstone, paths.destination);
                }
            }
        }
        catch { }
    }
    const candidateAbsent = candidateRemoved && !await pathExists(paths.destination) && !await pathExists(candidateTombstone);
    await authorization.handoffHandle.close().catch(() => undefined);
    if (candidateAbsent) {
        try {
            const handoffStats = await lstat(paths.handoff);
            if (await classifier.classify(paths.handoff) !== "file" || !handoffStats.isFile() || handoffStats.isSymbolicLink() || !sameNodeIdentity(handoffStats, authorization.handoffIdentity)) {
                throw new Error("HANDOFF_IDENTITY_MISMATCH");
            }
            await moveNoReplace(paths.handoff, handoffTombstone);
            const movedHandoffStats = await lstat(handoffTombstone);
            if (await classifier.classify(handoffTombstone) !== "file" || !movedHandoffStats.isFile() || movedHandoffStats.isSymbolicLink() || !sameNodeIdentity(movedHandoffStats, authorization.handoffIdentity)) {
                throw new Error("HANDOFF_IDENTITY_MISMATCH");
            }
            await removePath(handoffTombstone, { force: false });
            manifestRemoved = !await pathExists(handoffTombstone) && !await pathExists(paths.handoff);
            if (!manifestRemoved)
                throw new Error("HANDOFF_ABSENCE_UNVERIFIED");
        }
        catch (error) {
            code = stableErrorCode(error, "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE");
            try {
                if (await pathExists(handoffTombstone) && !await pathExists(paths.handoff)) {
                    const tombstoneStats = await lstat(handoffTombstone);
                    if (await classifier.classify(handoffTombstone) === "file" && tombstoneStats.isFile() && !tombstoneStats.isSymbolicLink() && sameNodeIdentity(tombstoneStats, authorization.handoffIdentity)) {
                        await moveNoReplace(handoffTombstone, paths.handoff);
                    }
                }
            }
            catch { }
        }
    }
    const manifestAbsent = manifestRemoved && !await pathExists(paths.handoff) && !await pathExists(handoffTombstone);
    const verified = candidateRemoved && candidateAbsent && manifestRemoved && manifestAbsent;
    const candidateState = candidateAbsent ? "absent" : await observedCandidateState(paths.destination, candidateTombstone, authorization.candidateIdentity, classifier.classify);
    const manifestState = manifestAbsent ? "absent" : await observedHandoffState(paths.handoff, authorization.handoffIdentity, classifier.classify);
    const cleanup = deepFreeze({
        schemaVersion: "1.0",
        mode: "execute",
        authorized: true,
        attempted: true,
        candidateRemoved,
        candidateAbsent,
        manifestRemoved,
        manifestAbsent,
        candidateState,
        manifestState,
        status: verified ? "verified" : "failed",
        ...(verified ? {} : { code })
    });
    if (!verified) {
        return failure(target, operation, code, "Cleanup did not prove removal of both owned objects.", {
            exportRoot: paths.exportRoot,
            destination: paths.destination,
            handoffManifest: paths.handoff,
            ...(await pathExists(candidateTombstone) ? { candidateTombstone } : {}),
            ...(await pathExists(handoffTombstone) ? { handoffTombstone } : {})
        }, ["inspect the preserved object state; do not retry automatically"], cleanup, authorization.manifest, authorization.manifest.ownership);
    }
    return cleanupSuccess(target, input, paths, authorization.manifest, cleanup, "candidate and handoff manifest removed and proven absent");
}
async function authorizeCleanup(input, paths, classify) {
    let handoffHandle;
    try {
        const handoffStats = await lstat(paths.handoff);
        if (await classify(paths.handoff) !== "file" || !handoffStats.isFile() || handoffStats.isSymbolicLink()) {
            return { ok: false, code: "HANDOFF_MANIFEST_INVALID", message: "Handoff manifest must be an owned regular file." };
        }
        if (typeof fsConstants.O_NOFOLLOW !== "number") {
            return { ok: false, code: "HANDOFF_NOFOLLOW_UNAVAILABLE", message: "The runtime cannot prove no-follow handoff access." };
        }
        handoffHandle = await open(paths.handoff, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
        const openStats = await handoffHandle.stat();
        if (!openStats.isFile() || !sameNodeIdentity(openStats, handoffStats)) {
            await handoffHandle.close();
            return { ok: false, code: "HANDOFF_IDENTITY_MISMATCH", message: "Handoff manifest identity changed while opening." };
        }
        const manifest = parseExportedCandidateHandoffManifest(JSON.parse(await handoffHandle.readFile({ encoding: "utf8" })));
        if (manifest === undefined) {
            await handoffHandle.close();
            return { ok: false, code: "HANDOFF_MANIFEST_INVALID", message: "Handoff manifest is invalid." };
        }
        if (manifest.exportRoot !== paths.exportRoot
            || manifest.destination !== paths.destination
            || manifest.targetKind !== input.target.kind
            || manifest.ownership.ownershipId !== input.ownershipId
            || manifest.schemaVersion !== input.manifestVersion
            || manifest.combinedSha256 !== input.combinedSha256) {
            await handoffHandle.close();
            return { ok: false, code: "CLEANUP_AUTHORIZATION_MISMATCH", message: "Cleanup assertions do not match the handoff manifest." };
        }
        const identity = await captureDirectoryIdentity(paths.destination, classify);
        if (manifest.ownership.candidateIdentity.kind !== "node"
            || identity.device !== manifest.ownership.candidateIdentity.device
            || identity.inode !== manifest.ownership.candidateIdentity.inode) {
            await handoffHandle.close();
            return { ok: false, code: "CANDIDATE_IDENTITY_MISMATCH", message: "Candidate identity changed after export." };
        }
        const candidateSnapshot = await computeCandidateSnapshot(paths.destination, classify);
        if (!snapshotMatchesHandoff(candidateSnapshot, manifest) || candidateSnapshot.manifest.combinedSha256 !== input.combinedSha256) {
            await handoffHandle.close();
            return { ok: false, code: "CANDIDATE_DIGEST_MISMATCH", message: "Candidate digest no longer matches the handoff evidence." };
        }
        return {
            ok: true,
            manifest,
            candidateIdentity: identity,
            handoffIdentity: { device: openStats.dev, inode: openStats.ino },
            handoffHandle
        };
    }
    catch {
        await handoffHandle?.close().catch(() => undefined);
        return { ok: false, code: "CLEANUP_AUTHORIZATION_FAILED", message: "Cleanup authorization evidence could not be verified." };
    }
}
function exportClassifier(dependencies) {
    const platform = dependencies.platform ?? process.platform;
    const filesystem = dependencies.filesystem ?? createNodeReleaseCandidateFilesystem({
        platform,
        windowsClassifierExecutor: dependencies.windowsClassifierExecutor
    });
    if (platform === "win32" && filesystem.reparsePointAware !== true) {
        return {
            ok: false,
            code: "WINDOWS_REPARSE_CLASSIFICATION_REQUIRED",
            message: "Local Windows export requires the reparse-aware classifier."
        };
    }
    return { ok: true, classify: async (path) => await filesystem.classifySourceEntry(path) };
}
async function resolveLocalExportInput(input, dependencies) {
    if (input.target.kind !== "local" || input.target.dotaRoot !== undefined)
        return { ok: true, input };
    const discovery = await (dependencies.discoverLocalEnvironment ?? discoverEnvironment)({
        target: input.target,
        platform: dependencies.platform ?? process.platform,
        environment: dependencies.environment ?? process.env
    });
    const dotaRoot = discovery.ok ? discovery.paths.dotaRoot : undefined;
    if (typeof dotaRoot !== "string" || dotaRoot.length === 0) {
        return { ok: false, code: "DOTA_INSTALL_NOT_FOUND", message: "Local export requires a provided or discovered Dota install root." };
    }
    return {
        ok: true,
        input: Object.freeze({ ...input, target: Object.freeze({ ...input.target, dotaRoot }) })
    };
}
async function validateExportPaths(input, repositoryRoot, allowExisting, classify) {
    const rawPaths = { exportRoot: input.exportRoot, destination: input.destination };
    if (!portableAbsolute(input.exportRoot) || !portableAbsolute(input.destination) || containsUnsafePathText(input.exportRoot) || containsUnsafePathText(input.destination)) {
        return { ok: false, code: "EXPORT_PATH_INVALID", message: "Export paths must be safe absolute target-local paths.", paths: rawPaths };
    }
    try {
        const exportStats = await lstat(input.exportRoot);
        const canonicalExportRoot = resolve(await realpath(input.exportRoot));
        if (await classify(input.exportRoot) !== "directory" || !exportStats.isDirectory() || exportStats.isSymbolicLink()) {
            return { ok: false, code: "EXPORT_ROOT_UNSAFE", message: "Export root must be a canonical non-link directory.", paths: rawPaths };
        }
        await assertNoSymbolicLinkAncestry(input.exportRoot, classify);
        const rawExportRoot = resolve(input.exportRoot);
        const rawDestination = resolve(input.destination);
        const destinationLeaf = rawDestination.slice(rawDestination.lastIndexOf(sep) + 1);
        if (dirname(rawDestination) !== rawExportRoot || !safeLeaf(destinationLeaf)) {
            return { ok: false, code: "DESTINATION_OUTSIDE_EXPORT_ROOT", message: "Destination must be an absent direct child of the export root.", paths: rawPaths };
        }
        const destination = join(canonicalExportRoot, destinationLeaf);
        const protectedRoots = [resolve(await realpath(repositoryRoot))];
        if (input.target.kind === "local") {
            protectedRoots.push(resolve(tmpdir()), resolve(homedir()));
            const windowsRoot = process.env.SystemRoot;
            if (windowsRoot)
                protectedRoots.push(resolve(windowsRoot));
        }
        if (input.target.kind === "fixture")
            protectedRoots.push(resolve(await realpath(input.target.root)));
        if (input.target.kind === "local" && input.target.dotaRoot !== undefined)
            protectedRoots.push(resolve(await realpath(input.target.dotaRoot)));
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
        if (allowExisting) {
            await assertNoSymbolicLinkAncestry(destination, classify);
            const destinationStats = await lstat(destination);
            const handoffStats = await lstat(handoff);
            if (await classify(destination) !== "directory" || await classify(handoff) !== "file" || !destinationStats.isDirectory() || destinationStats.isSymbolicLink() || !handoffStats.isFile() || handoffStats.isSymbolicLink()) {
                return { ok: false, code: "EXPORTED_CANDIDATE_STATE_UNSAFE", message: "Candidate and handoff manifest must be non-link owned objects.", paths: { exportRoot: canonicalExportRoot, destination, handoffManifest: handoff } };
            }
        }
        return { ok: true, exportRoot: canonicalExportRoot, destination, handoff };
    }
    catch {
        return { ok: false, code: "EXPORT_PATH_INSPECTION_FAILED", message: "Export path evidence could not be inspected.", paths: rawPaths };
    }
}
async function copyCandidateTree(sourceRoot, destinationRoot, classify) {
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
            const kind = await classify(source);
            if (kind === "directory" && sourceStats.isDirectory() && !sourceStats.isSymbolicLink()) {
                await mkdir(destination);
                await walk(source, relativePath);
            }
            else if (kind === "file" && sourceStats.isFile() && !sourceStats.isSymbolicLink()) {
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
    const filesystem = createNodeReleaseCandidateFilesystem();
    return (await computeCandidateSnapshot(root, async (path) => await filesystem.classifySourceEntry(path))).manifest;
}
async function computeCandidateSnapshot(root, classify) {
    const entries = [];
    const topology = [];
    const folded = new Set();
    const walk = async (directory) => {
        for (const name of [...await readdir(directory)].sort(compareOrdinal)) {
            if (!safeLeaf(name))
                throw new Error("unsafe candidate identity");
            const path = join(directory, name);
            const stats = await lstat(path);
            const kind = await classify(path);
            const identity = relative(root, path).replaceAll("\\", "/");
            const foldedIdentity = identity.toLocaleLowerCase("en-US");
            if (folded.has(foldedIdentity))
                throw new Error("case-fold collision");
            folded.add(foldedIdentity);
            if (kind === "directory" && stats.isDirectory() && !stats.isSymbolicLink()) {
                topology.push({ kind: "directory", path: identity });
                await walk(path);
                continue;
            }
            if (kind !== "file" || !stats.isFile() || stats.isSymbolicLink())
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
                topology.push({ kind: "file", path: identity });
            }
            finally {
                await handle.close();
            }
        }
    };
    await walk(root);
    entries.sort((left, right) => compareOrdinal(left.root, right.root) || compareOrdinal(left.path, right.path));
    topology.sort((left, right) => compareOrdinal(left.path, right.path));
    return deepFreeze({
        manifest: { schemaVersion: "1.0", entries, combinedSha256: computeReleaseCandidateCombinedDigest(entries) },
        topology
    });
}
function manifestEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function snapshotEqual(left, right) {
    return manifestEqual(left.manifest, right.manifest) && JSON.stringify(left.topology) === JSON.stringify(right.topology);
}
function snapshotMatchesHandoff(snapshot, handoff) {
    return manifestEqual(snapshot.manifest, handoff.manifest) && JSON.stringify(snapshot.topology) === JSON.stringify(handoff.topology);
}
export function parseExportedCandidateHandoffManifest(value) {
    try {
        if (!isRecordWithKeys(value, ["schemaVersion", "operation", "addonName", "exportRoot", "destination", "targetKind", "fileCount", "combinedSha256", "source", "manifest", "topology", "ownership", "boundaries"]))
            return undefined;
        if (value.schemaVersion !== "1.0" || value.operation !== "export_release_candidate")
            return undefined;
        if (typeof value.addonName !== "string" || !safeLeaf(value.addonName))
            return undefined;
        if (typeof value.exportRoot !== "string" || value.exportRoot.length === 0 || typeof value.destination !== "string" || value.destination.length === 0)
            return undefined;
        if (value.targetKind !== "fixture" && value.targetKind !== "local" && value.targetKind !== "ssh" && value.targetKind !== "powershell")
            return undefined;
        if (!isCount(value.fileCount) || typeof value.combinedSha256 !== "string" || !isDigest(value.combinedSha256))
            return undefined;
        if (!isRecordWithKeys(value.source, ["gameAddon", "contentAddon"]))
            return undefined;
        if (value.source.gameAddon !== `game/dota_addons/${value.addonName}` || value.source.contentAddon !== `content/dota_addons/${value.addonName}`)
            return undefined;
        const manifest = parseManifest(value.manifest);
        const topology = parseTopology(value.topology, manifest);
        const ownership = parseOwnership(value.ownership);
        if (manifest === undefined || topology === undefined || ownership === undefined)
            return undefined;
        if (manifest.entries.length !== value.fileCount || manifest.combinedSha256 !== value.combinedSha256)
            return undefined;
        if (!isRecordWithKeys(value.boundaries, Object.keys(EXPORTED_CANDIDATE_BOUNDARIES)) || JSON.stringify(value.boundaries) !== JSON.stringify(EXPORTED_CANDIDATE_BOUNDARIES))
            return undefined;
        return deepFreeze({
            schemaVersion: "1.0",
            operation: "export_release_candidate",
            addonName: value.addonName,
            exportRoot: value.exportRoot,
            destination: value.destination,
            targetKind: value.targetKind,
            fileCount: value.fileCount,
            combinedSha256: value.combinedSha256,
            source: { gameAddon: value.source.gameAddon, contentAddon: value.source.contentAddon },
            manifest,
            topology,
            ownership,
            boundaries: EXPORTED_CANDIDATE_BOUNDARIES
        });
    }
    catch {
        return undefined;
    }
}
function parseManifest(value) {
    if (!isRecordWithKeys(value, ["schemaVersion", "entries", "combinedSha256"]) || value.schemaVersion !== "1.0" || !Array.isArray(value.entries) || !isDigest(value.combinedSha256))
        return undefined;
    const entries = [];
    const seen = new Set();
    for (const raw of value.entries) {
        if (!isRecordWithKeys(raw, ["schemaVersion", "root", "path", "bytes", "sha256"]) || raw.schemaVersion !== "1.0")
            return undefined;
        const foldedPath = typeof raw.path === "string" ? raw.path.toLocaleLowerCase("en-US") : "";
        if ((raw.root !== "game" && raw.root !== "content") || typeof raw.path !== "string" || !safeManifestPath(raw.root, raw.path) || !isCount(raw.bytes) || !isDigest(raw.sha256) || seen.has(foldedPath))
            return undefined;
        seen.add(foldedPath);
        entries.push({ schemaVersion: "1.0", root: raw.root, path: raw.path, bytes: raw.bytes, sha256: raw.sha256 });
    }
    for (let index = 1; index < entries.length; index += 1) {
        const previous = entries[index - 1];
        const current = entries[index];
        if (compareOrdinal(previous.root, current.root) > 0)
            return undefined;
        if (previous.root === current.root && compareOrdinal(previous.path, current.path) >= 0)
            return undefined;
    }
    if (computeReleaseCandidateCombinedDigest(entries) !== value.combinedSha256)
        return undefined;
    return deepFreeze({ schemaVersion: "1.0", entries, combinedSha256: value.combinedSha256 });
}
function parseTopology(value, manifest) {
    if (manifest === undefined || !Array.isArray(value))
        return undefined;
    const topology = [];
    const seen = new Set();
    for (const raw of value) {
        const foldedPath = typeof raw === "object" && raw !== null && "path" in raw && typeof raw.path === "string" ? raw.path.toLocaleLowerCase("en-US") : "";
        if (!isRecordWithKeys(raw, ["kind", "path"]) || (raw.kind !== "directory" && raw.kind !== "file") || typeof raw.path !== "string" || !safeTopologyPath(raw.path) || seen.has(foldedPath))
            return undefined;
        seen.add(foldedPath);
        topology.push({ kind: raw.kind, path: raw.path });
    }
    for (let index = 1; index < topology.length; index += 1)
        if (compareOrdinal(topology[index - 1].path, topology[index].path) >= 0)
            return undefined;
    const manifestPaths = manifest.entries.map((entry) => entry.path);
    const topologyFilePaths = topology.filter((entry) => entry.kind === "file").map((entry) => entry.path);
    if (JSON.stringify(manifestPaths) !== JSON.stringify(topologyFilePaths))
        return undefined;
    const topologyKinds = new Map(topology.map((entry) => [entry.path, entry.kind]));
    const requiredDirectories = new Set(["game", "content"]);
    for (const entry of topology) {
        const segments = entry.path.split("/");
        for (let index = 1; index < segments.length; index += 1)
            requiredDirectories.add(segments.slice(0, index).join("/"));
    }
    for (const path of manifestPaths) {
        const segments = path.split("/");
        for (let index = 1; index < segments.length; index += 1)
            requiredDirectories.add(segments.slice(0, index).join("/"));
    }
    if ([...requiredDirectories].some((path) => topologyKinds.get(path) !== "directory"))
        return undefined;
    return deepFreeze(topology);
}
function parseOwnership(value) {
    if (!isRecordWithKeys(value, ["schemaVersion", "ownershipId", "candidateIdentity"]) || value.schemaVersion !== "1.0" || typeof value.ownershipId !== "string" || !isUuid(value.ownershipId))
        return undefined;
    const identity = value.candidateIdentity;
    if (!isRecord(identity))
        return undefined;
    if (identity.kind === "node" && isRecordWithKeys(identity, ["kind", "device", "inode"]) && isCount(identity.device) && isCount(identity.inode)) {
        return deepFreeze({ schemaVersion: "1.0", ownershipId: value.ownershipId, candidateIdentity: { kind: "node", device: identity.device, inode: identity.inode } });
    }
    if (identity.kind === "windows" && isRecordWithKeys(identity, ["kind", "volumeIdentity", "fileIdentity"]) && nonEmptyIdentity(identity.volumeIdentity) && nonEmptyIdentity(identity.fileIdentity)) {
        return deepFreeze({ schemaVersion: "1.0", ownershipId: value.ownershipId, candidateIdentity: { kind: "windows", volumeIdentity: identity.volumeIdentity, fileIdentity: identity.fileIdentity } });
    }
    return undefined;
}
async function captureDirectoryIdentity(path, classify) {
    const stats = await lstat(path);
    const canonical = resolve(await realpath(path));
    if (await classify(path) !== "directory" || !stats.isDirectory() || stats.isSymbolicLink() || canonical !== resolve(path))
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
function retainedFailureCleanup(code, temporaryHandoff) {
    return deepFreeze({
        schemaVersion: "1.0",
        mode: "export-failure",
        authorized: false,
        attempted: false,
        candidateRemoved: false,
        candidateAbsent: false,
        manifestRemoved: false,
        manifestAbsent: false,
        candidateState: "present",
        manifestState: "absent",
        ...(temporaryHandoff ?? {}),
        promotionState: "promoted",
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
        candidateState: "present",
        manifestState: "present",
        stagingRemoved: false,
        stagingAbsent: true,
        temporaryHandoffRemoved: false,
        temporaryHandoffAbsent: true,
        promotionState: "promoted",
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
        manifest: manifest ?? null,
        ownership: ownership ?? null,
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
    const segments = path.split(/[\\/]/u);
    return path.includes("\0")
        || /[\r\n]/u.test(path)
        || segments.some((segment) => segment === "." || segment === "..")
        || segments.slice(1).some((segment) => segment.includes(":"));
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
async function assertNoSymbolicLinkAncestry(path, classify) {
    const absolute = resolve(path);
    const root = parse(absolute).root;
    const relativeParts = relative(root, absolute).split(sep).filter(Boolean);
    let current = root;
    for (const part of relativeParts) {
        current = join(current, part);
        const stats = await lstat(current);
        if (darwinSystemLink(current))
            continue;
        if (await classify(current) !== "directory" || !stats.isDirectory() || stats.isSymbolicLink())
            throw new Error("symbolic link ancestry rejected");
    }
}
function darwinSystemLink(path) {
    return process.platform === "darwin" && (path === "/var" || path === "/tmp" || path === "/etc");
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isRecordWithKeys(value, keys) {
    if (!isRecord(value))
        return false;
    const actual = Object.keys(value).sort(compareOrdinal);
    const expected = [...keys].sort(compareOrdinal);
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isCount(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isDigest(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function nonEmptyIdentity(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\0\r\n]/u.test(value);
}
function safeManifestPath(root, value) {
    return safeTopologyPath(value) && (value === root || value.startsWith(`${root}/`));
}
function safeTopologyPath(value) {
    if (value.length === 0 || value.startsWith("/") || value.endsWith("/") || value.includes("\\"))
        return false;
    return value.split("/").every((segment) => safeLeaf(segment) && !segment.includes(":"));
}
function sameNodeIdentity(left, right) {
    return (left.device ?? left.dev) === (right.device ?? right.dev) && (left.inode ?? left.ino) === (right.inode ?? right.ino);
}
function sameAuthorization(left, right) {
    return JSON.stringify(left.manifest) === JSON.stringify(right.manifest)
        && sameNodeIdentity(left.candidateIdentity, right.candidateIdentity)
        && sameNodeIdentity(left.handoffIdentity, right.handoffIdentity);
}
async function observedCandidateState(destination, tombstone, identity, classify) {
    try {
        if (await pathExists(tombstone)) {
            const observed = await captureDirectoryIdentity(tombstone, classify);
            return sameNodeIdentity(observed, identity) ? "tombstoned" : "unknown";
        }
        if (await pathExists(destination)) {
            const observed = await captureDirectoryIdentity(destination, classify);
            return sameNodeIdentity(observed, identity) ? "present" : "unknown";
        }
        return "unknown";
    }
    catch {
        return "unknown";
    }
}
async function observedHandoffState(path, identity, classify) {
    try {
        const stats = await lstat(path);
        return await classify(path) === "file" && stats.isFile() && !stats.isSymbolicLink() && sameNodeIdentity(stats, identity) ? "present" : "unknown";
    }
    catch {
        return "unknown";
    }
}
function stableErrorCode(error, fallback) {
    return error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message) ? error.message : fallback;
}
function deepFreeze(value) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        for (const nested of Object.values(value))
            deepFreeze(nested);
        Object.freeze(value);
    }
    return value;
}

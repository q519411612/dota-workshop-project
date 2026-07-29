import { executeRemoteExport, executeRemoteExportCleanup } from "./exported-candidate-remote-executor.js";
import { parseExportedCandidateHandoffManifest } from "./exported-candidate.js";
import { normalizeReleaseCandidateDetail } from "./release-candidate-result.js";
export async function exportRemoteReleaseCandidate(input) {
    if (input.target.kind !== "remote")
        return invalidTarget("export_release_candidate");
    const outcome = await executeRemoteExport(input);
    const target = publicTarget(input.target);
    if (outcome.outcome !== "completed")
        return outcomeFailure(target, "export_release_candidate", outcome, "export-failure");
    const parsed = parseFramedObject(outcome.stdout);
    if (parsed === undefined)
        return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_EVIDENCE_INVALID");
    if (parsed.ok === false)
        return normalizeRemoteExportFailure(target, outcome.transport, input, parsed);
    const handoff = parseExportedCandidateHandoffManifest(parsed.export);
    const cleanup = parseCleanup(parsed.exportCleanup, "export-failure");
    const releaseCandidate = normalizeReleaseCandidateDetail({
        schemaVersion: parsed.schemaVersion,
        ok: parsed.ok,
        operation: parsed.operation,
        artifactValidation: parsed.artifactValidation,
        manifest: parsed.manifest,
        inclusionLedger: parsed.inclusionLedger,
        scanCoverage: parsed.scanCoverage,
        blockers: parsed.blockers,
        cleanup: parsed.cleanup,
        paths: parsed.paths,
        execution: { kind: outcome.transport, outcome: "completed", exitCode: 0 },
        warnings: parsed.warnings,
        commands: [{ description: `${outcome.transport} export_release_candidate`, outcome: "completed", exitCode: 0 }],
        logs: [{ source: "remote-exported-candidate", lines: ["remote evidence normalized"] }],
        boundaries: parsed.boundaries
    }, { expectedAddonName: input.addonName });
    if (!hasOnlyKeys(parsed, ["schemaVersion", "operation", "artifactValidation", "blockers", "cleanup", "paths", "execution", "warnings", "commands", "logs", "boundaries", "scanCoverage", "manifest", "inclusionLedger", "export", "exportCleanup", "exportPaths", "exportState", "ok"])
        || parsed.schemaVersion !== "1.0"
        || parsed.ok !== true
        || releaseCandidate.normalization.status !== "valid"
        || !releaseCandidate.ok
        || handoff === undefined
        || cleanup === undefined
        || !cleanupSuccessState(cleanup)
        || handoff.targetKind !== outcome.transport
        || handoff.addonName !== input.addonName
        || !windowsPathEqual(handoff.exportRoot, input.exportRoot)
        || !windowsPathEqual(handoff.destination, input.destination)
        || !("manifest" in releaseCandidate)
        || JSON.stringify(releaseCandidate.manifest) !== JSON.stringify(handoff.manifest))
        return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_SEMANTIC_INVALID");
    return {
        ok: true,
        target,
        operation: "export_release_candidate",
        evidence: ["remote target-local candidate export evidence normalized"],
        warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
        paths: { exportRoot: handoff.exportRoot, destination: handoff.destination, handoffManifest: `${handoff.destination}.dota-workshop-handoff.v1.json` },
        commands: [{ command: `${outcome.transport} export_release_candidate <redacted-script>`, exitCode: 0 }],
        logs: [{ source: "remote-exported-candidate", lines: ["remote evidence normalized"] }],
        manifest: handoff,
        ownership: handoff.ownership,
        cleanup
    };
}
export async function cleanupRemoteExportedCandidate(input) {
    if (input.target.kind !== "remote")
        return invalidTarget("cleanup_exported_candidate");
    const outcome = await executeRemoteExportCleanup(input);
    const target = publicTarget(input.target);
    const mode = input.dryRun !== false ? "dry-run" : "execute";
    if (outcome.outcome !== "completed")
        return outcomeFailure(target, "cleanup_exported_candidate", outcome, mode);
    const parsed = parseFramedObject(outcome.stdout);
    if (parsed === undefined)
        return evidenceFailure(target, "cleanup_exported_candidate", "REMOTE_CLEANUP_EVIDENCE_INVALID");
    const cleanup = parseCleanup(parsed.cleanup, mode);
    const handoff = parseExportedCandidateHandoffManifest(parsed.manifest);
    const paths = parseCleanupPaths(parsed.paths, input.exportRoot, input.destination);
    const envelopeValid = hasOnlyKeys(parsed, ["schemaVersion", "ok", "operation", "code", "cleanup", "authorized", "manifest", "paths"])
        && parsed.schemaVersion === "1.0"
        && parsed.operation === "cleanup_exported_candidate"
        && typeof parsed.ok === "boolean"
        && (parsed.code === null || (typeof parsed.code === "string" && /^[A-Z0-9_]+$/u.test(parsed.code)))
        && typeof parsed.authorized === "boolean"
        && cleanup !== undefined
        && handoff !== undefined
        && paths !== undefined
        && handoff.targetKind === outcome.transport
        && handoff.schemaVersion === input.manifestVersion
        && handoff.ownership.ownershipId === input.ownershipId
        && handoff.combinedSha256 === input.combinedSha256
        && windowsPathEqual(handoff.exportRoot, input.exportRoot)
        && windowsPathEqual(handoff.destination, input.destination);
    if (!envelopeValid || cleanup === undefined || handoff === undefined || paths === undefined) {
        const code = typeof parsed.code === "string" && /^[A-Z0-9_]+$/u.test(parsed.code) ? parsed.code : "REMOTE_CLEANUP_SEMANTIC_INVALID";
        return evidenceFailure(target, "cleanup_exported_candidate", code, cleanup);
    }
    if (parsed.ok === false) {
        const code = typeof parsed.code === "string" ? parsed.code : "REMOTE_CLEANUP_SEMANTIC_INVALID";
        if (parsed.authorized === true && cleanup.authorized && cleanup.status === "failed" && cleanupFailureStateValid(cleanup, paths, code)) {
            return partialCleanupFailure(target, outcome.transport, code, handoff, cleanup, paths);
        }
        return evidenceFailure(target, "cleanup_exported_candidate", code, cleanup);
    }
    if (parsed.ok !== true
        || parsed.code !== null
        || parsed.authorized !== true
        || !cleanupSuccessState(cleanup, paths)) {
        const code = typeof parsed.code === "string" && /^[A-Z0-9_]+$/u.test(parsed.code) ? parsed.code : "REMOTE_CLEANUP_SEMANTIC_INVALID";
        return evidenceFailure(target, "cleanup_exported_candidate", code, cleanup);
    }
    return {
        ok: true,
        target,
        operation: "cleanup_exported_candidate",
        evidence: [input.dryRun !== false ? "remote cleanup authorization passed without mutation" : "remote candidate and handoff removal verified"],
        warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
        paths,
        commands: [{ command: `${outcome.transport} cleanup_exported_candidate <redacted-script>`, exitCode: 0 }],
        logs: [{ source: "remote-exported-candidate-cleanup", lines: ["remote evidence normalized"] }],
        manifest: handoff,
        ownership: handoff.ownership,
        cleanup
    };
}
function normalizeRemoteExportFailure(target, transport, input, parsed) {
    const allowed = ["schemaVersion", "operation", "artifactValidation", "blockers", "cleanup", "paths", "execution", "warnings", "commands", "logs", "boundaries", "scanCoverage", "manifest", "inclusionLedger", "export", "exportCleanup", "exportPaths", "exportState", "ok"];
    if (!hasOnlyKeys(parsed, allowed, ["export"]) || parsed.schemaVersion !== "1.0" || parsed.ok !== false) {
        return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_SEMANTIC_INVALID");
    }
    const cleanup = parseCleanup(parsed.exportCleanup, "export-failure");
    const paths = parseExportPaths(parsed.exportPaths, input.exportRoot, input.destination);
    const state = parseExportState(parsed.exportState);
    const handoff = parsed.export === undefined ? undefined : parseExportedCandidateHandoffManifest(parsed.export);
    const code = cleanup?.code;
    const stateValid = cleanup !== undefined
        && paths !== undefined
        && state !== undefined
        && typeof code === "string"
        && cleanup.status === "failed"
        && cleanup.promotionState === state.promotionState
        && cleanup.candidateState === state.candidateState
        && cleanup.stagingAbsent === true
        && cleanup.temporaryHandoffAbsent === true
        && !cleanup.candidateRemoved
        && !cleanup.manifestRemoved
        && ((state.promotionState === "not-started" && state.candidateState === "absent" && cleanup.candidateAbsent)
            || (state.promotionState === "promoted" && state.candidateState === "present" && !cleanup.candidateAbsent))
        && ((cleanup.manifestState === "present" && !cleanup.manifestAbsent) || (cleanup.manifestState === "absent" && cleanup.manifestAbsent))
        && (handoff === undefined || (handoff.targetKind === transport
            && handoff.addonName === input.addonName
            && windowsPathEqual(handoff.exportRoot, input.exportRoot)
            && windowsPathEqual(handoff.destination, input.destination)));
    if (!stateValid || cleanup === undefined || paths === undefined || state === undefined || typeof code !== "string") {
        return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_SEMANTIC_INVALID", cleanup);
    }
    return {
        ok: false,
        target,
        operation: "export_release_candidate",
        error: { code, message: "Remote export stopped with validated target-local state." },
        evidence: [`promotion state: ${state.promotionState}`, `candidate state: ${state.candidateState}`, `handoff state: ${cleanup.manifestState}`],
        warnings: ["inspect retained target-local state; do not retry automatically"],
        paths,
        commands: [{ command: `${transport} export_release_candidate <redacted-script>`, exitCode: 0 }],
        logs: [{ source: "remote-exported-candidate", lines: ["validated remote export failure normalized"] }],
        manifest: handoff ?? null,
        ownership: handoff?.ownership ?? null,
        cleanup
    };
}
function parseExportPaths(value, exportRoot, destination) {
    if (!isRecord(value) || !hasOnlyKeys(value, ["exportRoot", "destination", "handoffManifest"]))
        return undefined;
    if (typeof value.exportRoot !== "string" || typeof value.destination !== "string" || typeof value.handoffManifest !== "string")
        return undefined;
    if (!windowsPathEqual(value.exportRoot, exportRoot) || !windowsPathEqual(value.destination, destination) || !windowsPathEqual(value.handoffManifest, `${destination}.dota-workshop-handoff.v1.json`))
        return undefined;
    return Object.freeze({ exportRoot: value.exportRoot, destination: value.destination, handoffManifest: value.handoffManifest });
}
function parseExportState(value) {
    if (!isRecord(value) || !hasOnlyKeys(value, ["schemaVersion", "promotionState", "candidateState"]) || value.schemaVersion !== "1.0")
        return undefined;
    if ((value.promotionState !== "not-started" && value.promotionState !== "promoted") || (value.candidateState !== "absent" && value.candidateState !== "present"))
        return undefined;
    return Object.freeze({ promotionState: value.promotionState, candidateState: value.candidateState });
}
function parseCleanup(value, mode) {
    const keys = ["schemaVersion", "mode", "authorized", "attempted", "candidateRemoved", "candidateAbsent", "manifestRemoved", "manifestAbsent", "status", "code"];
    keys.push("candidateState", "manifestState");
    if (mode === "export-failure")
        keys.push("stagingRemoved", "stagingAbsent", "temporaryHandoffRemoved", "temporaryHandoffAbsent", "promotionState");
    if (!isRecord(value) || !hasOnlyKeys(value, keys, ["code", "stagingRemoved", "stagingAbsent", "temporaryHandoffRemoved", "temporaryHandoffAbsent", "promotionState", "candidateState", "manifestState"]) || value.schemaVersion !== "1.0" || value.mode !== mode)
        return undefined;
    const booleanKeys = ["authorized", "attempted", "candidateRemoved", "candidateAbsent", "manifestRemoved", "manifestAbsent"];
    if (!booleanKeys.every((key) => typeof value[key] === "boolean"))
        return undefined;
    if (value.status !== "not-reached" && value.status !== "verified" && value.status !== "failed" && value.status !== "unknown")
        return undefined;
    if (value.code !== undefined && (typeof value.code !== "string" || !/^[A-Z0-9_]+$/u.test(value.code)))
        return undefined;
    if (value.candidateState !== undefined && value.candidateState !== "present" && value.candidateState !== "tombstoned" && value.candidateState !== "absent" && value.candidateState !== "unknown")
        return undefined;
    if (value.manifestState !== undefined && value.manifestState !== "present" && value.manifestState !== "tombstoned" && value.manifestState !== "absent" && value.manifestState !== "unknown")
        return undefined;
    if (value.promotionState !== undefined && value.promotionState !== "not-started" && value.promotionState !== "promoted" && value.promotionState !== "unknown")
        return undefined;
    const parsed = Object.freeze({
        schemaVersion: "1.0",
        mode,
        authorized: value.authorized,
        attempted: value.attempted,
        candidateRemoved: value.candidateRemoved,
        candidateAbsent: value.candidateAbsent,
        manifestRemoved: value.manifestRemoved,
        manifestAbsent: value.manifestAbsent,
        ...(typeof value.stagingRemoved === "boolean" ? { stagingRemoved: value.stagingRemoved } : {}),
        ...(typeof value.stagingAbsent === "boolean" ? { stagingAbsent: value.stagingAbsent } : {}),
        ...(typeof value.temporaryHandoffRemoved === "boolean" ? { temporaryHandoffRemoved: value.temporaryHandoffRemoved } : {}),
        ...(typeof value.temporaryHandoffAbsent === "boolean" ? { temporaryHandoffAbsent: value.temporaryHandoffAbsent } : {}),
        ...(typeof value.promotionState === "string" ? { promotionState: value.promotionState } : {}),
        ...(typeof value.candidateState === "string" ? { candidateState: value.candidateState } : {}),
        ...(typeof value.manifestState === "string" ? { manifestState: value.manifestState } : {}),
        status: value.status,
        ...(typeof value.code === "string" ? { code: value.code } : {})
    });
    if (parsed.status === "verified" && parsed.code !== undefined)
        return undefined;
    return parsed;
}
function parseCleanupPaths(value, exportRoot, destination) {
    if (!isRecord(value) || !hasOnlyKeys(value, ["exportRoot", "destination", "handoffManifest", "candidateTombstone", "handoffTombstone"], ["candidateTombstone", "handoffTombstone"]))
        return undefined;
    if (typeof value.exportRoot !== "string" || typeof value.destination !== "string" || typeof value.handoffManifest !== "string")
        return undefined;
    if (!windowsPathEqual(value.exportRoot, exportRoot) || !windowsPathEqual(value.destination, destination) || !windowsPathEqual(value.handoffManifest, `${destination}.dota-workshop-handoff.v1.json`))
        return undefined;
    const result = { exportRoot: value.exportRoot, destination: value.destination, handoffManifest: value.handoffManifest };
    for (const key of ["candidateTombstone", "handoffTombstone"]) {
        const path = value[key];
        if (path === undefined)
            continue;
        if (typeof path !== "string" || !safeTombstonePath(path, exportRoot, key))
            return undefined;
        result[key] = path;
    }
    return Object.freeze(result);
}
function safeTombstonePath(path, exportRoot, kind) {
    const normalized = path.replaceAll("/", "\\").replace(/[\\]+$/u, "");
    const parent = normalized.slice(0, normalized.lastIndexOf("\\"));
    const leaf = normalized.slice(normalized.lastIndexOf("\\") + 1);
    const pattern = kind === "candidateTombstone" ? /^\.dota-workshop-candidate-delete-[0-9a-f]{32}$/iu : /^\.dota-workshop-handoff-delete-[0-9a-f]{32}\.json$/iu;
    return windowsPathEqual(parent, exportRoot) && pattern.test(leaf);
}
function cleanupFailureStateValid(cleanup, paths, envelopeCode) {
    if (cleanup.status !== "failed" || cleanup.code !== envelopeCode || !cleanup.authorized || cleanup.candidateState === undefined || cleanup.manifestState === undefined)
        return false;
    if (!cleanup.attempted && (cleanup.candidateState !== "present" || cleanup.manifestState !== "present"))
        return false;
    return objectStateValid(cleanup.candidateState, cleanup.candidateRemoved, cleanup.candidateAbsent, paths.candidateTombstone !== undefined)
        && objectStateValid(cleanup.manifestState, cleanup.manifestRemoved, cleanup.manifestAbsent, paths.handoffTombstone !== undefined)
        && failureTransitionCodeValid(cleanup, envelopeCode);
}
function failureTransitionCodeValid(cleanup, code) {
    if (cleanup.candidateState === "tombstoned") {
        return code === "IDENTITY_BOUND_DELETION_UNAVAILABLE"
            || code === "CANDIDATE_IDENTITY_MISMATCH"
            || code === "CANDIDATE_DIGEST_MISMATCH"
            || code === "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE";
    }
    if (cleanup.candidateState === "absent" && cleanup.manifestState !== "absent") {
        return code.startsWith("HANDOFF_") || code === "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE";
    }
    if (cleanup.candidateState === "unknown" || cleanup.manifestState === "unknown") {
        return code.endsWith("_UNKNOWN") || code.includes("IDENTITY") || code === "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE";
    }
    return cleanup.candidateState === "present" && cleanup.manifestState === "present";
}
function objectStateValid(state, removed, absent, tombstonePath) {
    if (state === "present")
        return !removed && !absent && !tombstonePath;
    if (state === "tombstoned")
        return !removed && !absent && tombstonePath;
    if (state === "absent")
        return removed && absent && !tombstonePath;
    return !removed && !absent;
}
function partialCleanupFailure(target, transport, code, manifest, cleanup, paths) {
    const normalizedCleanup = cleanup.code === undefined ? Object.freeze({ ...cleanup, code }) : cleanup;
    return {
        ok: false,
        target,
        operation: "cleanup_exported_candidate",
        error: { code, message: "Remote cleanup stopped with validated partial state." },
        evidence: ["remote cleanup authorization evidence preserved", `candidate state: ${normalizedCleanup.candidateState}`, `handoff state: ${normalizedCleanup.manifestState}`],
        warnings: ["do not retry automatically; inspect the returned destination and tombstone paths"],
        paths,
        commands: [{ command: `${transport} cleanup_exported_candidate <redacted-script>`, exitCode: 0 }],
        logs: [{ source: "remote-exported-candidate-cleanup", lines: ["validated partial cleanup state normalized"] }],
        manifest,
        ownership: manifest.ownership,
        cleanup: normalizedCleanup
    };
}
function cleanupSuccessState(cleanup, paths) {
    if (cleanup.status !== "verified" || !cleanup.authorized || cleanup.code !== undefined)
        return false;
    if (cleanup.mode === "dry-run") {
        return !cleanup.attempted
            && !cleanup.candidateRemoved
            && !cleanup.candidateAbsent
            && !cleanup.manifestRemoved
            && !cleanup.manifestAbsent
            && cleanup.candidateState === "present"
            && cleanup.manifestState === "present"
            && paths?.candidateTombstone === undefined
            && paths?.handoffTombstone === undefined;
    }
    if (cleanup.mode === "execute") {
        return cleanup.attempted
            && cleanup.candidateRemoved
            && cleanup.candidateAbsent
            && cleanup.manifestRemoved
            && cleanup.manifestAbsent
            && cleanup.candidateState === "absent"
            && cleanup.manifestState === "absent"
            && paths?.candidateTombstone === undefined
            && paths?.handoffTombstone === undefined;
    }
    return !cleanup.attempted
        && !cleanup.candidateRemoved
        && !cleanup.candidateAbsent
        && !cleanup.manifestRemoved
        && !cleanup.manifestAbsent
        && cleanup.candidateState === "present"
        && cleanup.manifestState === "present"
        && cleanup.stagingRemoved === false
        && cleanup.stagingAbsent === true
        && cleanup.temporaryHandoffRemoved === false
        && cleanup.temporaryHandoffAbsent === true
        && cleanup.promotionState === "promoted";
}
function parseFramedObject(stdout) {
    if (stdout.length < 2 || stdout[0] !== "{" || stdout.at(-1) !== "}" || /[\r\n]/u.test(stdout))
        return undefined;
    try {
        const parsed = JSON.parse(stdout);
        return isRecord(parsed) && JSON.stringify(parsed) === stdout ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function outcomeFailure(target, operation, outcome, mode) {
    const code = outcome.outcome === "configuration-failed"
        ? outcome.code
        : outcome.outcome === "uncertain"
            ? "REMOTE_EXPORTED_CANDIDATE_TRANSPORT_UNCERTAIN"
            : "REMOTE_EXPORTED_CANDIDATE_TRANSPORT_FAILED";
    const uncertain = outcome.outcome === "uncertain";
    return evidenceFailure(target, operation, code, Object.freeze({
        schemaVersion: "1.0",
        mode,
        authorized: false,
        attempted: false,
        candidateRemoved: false,
        candidateAbsent: false,
        manifestRemoved: false,
        manifestAbsent: false,
        ...(uncertain ? { candidateState: "unknown", manifestState: "unknown" } : {}),
        status: uncertain ? "unknown" : "failed",
        code
    }), uncertain);
}
function evidenceFailure(target, operation, code, cleanup = Object.freeze({
    schemaVersion: "1.0",
    mode: operation === "cleanup_exported_candidate" ? "dry-run" : "export-failure",
    authorized: false,
    attempted: false,
    candidateRemoved: false,
    candidateAbsent: false,
    manifestRemoved: false,
    manifestAbsent: false,
    status: "failed",
    code
}), uncertain = false) {
    return {
        ok: false,
        target,
        operation,
        error: { code, message: "Remote exported-candidate evidence was rejected." },
        evidence: [uncertain ? "remote operation completion and object state are unknown" : "remote exported-candidate evidence rejected"],
        warnings: [uncertain ? "do not retry; candidate and handoff state require target-local inspection" : "remote state is not assumed clean without complete evidence"],
        paths: {},
        commands: [{ command: `${target.transport} ${operation} <redacted-script>` }],
        logs: [{ source: "remote-exported-candidate", lines: ["remote evidence unavailable or invalid"] }],
        manifest: null,
        ownership: null,
        cleanup
    };
}
function invalidTarget(operation) {
    return evidenceFailure({ kind: "remote", name: "remote-target", transport: "ssh", host: "redacted" }, operation, "REMOTE_TARGET_REQUIRED");
}
function publicTarget(target) {
    return Object.freeze({ kind: "remote", name: "remote-target", transport: target.transport, host: "redacted" });
}
function windowsPathEqual(left, right) {
    return left.replaceAll("/", "\\").replace(/[\\]+$/u, "").toLocaleLowerCase("en-US")
        === right.replaceAll("/", "\\").replace(/[\\]+$/u, "").toLocaleLowerCase("en-US");
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasOnlyKeys(value, keys, optional = []) {
    const allowed = new Set(keys);
    const required = keys.filter((key) => !optional.includes(key));
    return Object.keys(value).every((key) => allowed.has(key)) && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

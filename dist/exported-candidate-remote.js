import { executeRemoteExport, executeRemoteExportCleanup } from "./exported-candidate-remote-executor.js";
import { parseExportedCandidateHandoffManifest } from "./exported-candidate.js";
export async function exportRemoteReleaseCandidate(input) {
    if (input.target.kind !== "remote")
        return invalidTarget("export_release_candidate");
    const outcome = await executeRemoteExport(input);
    const target = publicTarget(input.target);
    if (outcome.outcome !== "completed")
        return outcomeFailure(target, "export_release_candidate", outcome);
    const parsed = parseFramedObject(outcome.stdout);
    if (parsed === undefined)
        return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_EVIDENCE_INVALID");
    const handoff = parseExportedCandidateHandoffManifest(parsed.export);
    const cleanup = parseCleanup(parsed.exportCleanup, "export-failure");
    if (parsed.ok !== true
        || !isRecord(parsed.cleanup)
        || parsed.cleanup.status !== "verified"
        || handoff === undefined
        || cleanup === undefined
        || cleanup.status !== "verified"
        || handoff.targetKind !== outcome.transport
        || handoff.addonName !== input.addonName
        || !windowsPathEqual(handoff.exportRoot, input.exportRoot)
        || !windowsPathEqual(handoff.destination, input.destination))
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
    if (outcome.outcome !== "completed")
        return outcomeFailure(target, "cleanup_exported_candidate", outcome);
    const parsed = parseFramedObject(outcome.stdout);
    if (parsed === undefined)
        return evidenceFailure(target, "cleanup_exported_candidate", "REMOTE_CLEANUP_EVIDENCE_INVALID");
    const cleanup = parseCleanup(parsed.cleanup, input.dryRun !== false ? "dry-run" : "execute");
    const handoff = parseExportedCandidateHandoffManifest(parsed.manifest);
    if (parsed.ok !== true || cleanup === undefined || cleanup.status !== "verified" || handoff === undefined) {
        const code = typeof parsed.code === "string" && /^[A-Z0-9_]+$/u.test(parsed.code) ? parsed.code : "REMOTE_CLEANUP_SEMANTIC_INVALID";
        return evidenceFailure(target, "cleanup_exported_candidate", code, cleanup);
    }
    return {
        ok: true,
        target,
        operation: "cleanup_exported_candidate",
        evidence: [input.dryRun !== false ? "remote cleanup authorization passed without mutation" : "remote candidate and handoff removal verified"],
        warnings: ["contract evidence only; real Windows runtime behavior is not proven"],
        paths: { exportRoot: handoff.exportRoot, destination: handoff.destination, handoffManifest: `${handoff.destination}.dota-workshop-handoff.v1.json` },
        commands: [{ command: `${outcome.transport} cleanup_exported_candidate <redacted-script>`, exitCode: 0 }],
        logs: [{ source: "remote-exported-candidate-cleanup", lines: ["remote evidence normalized"] }],
        manifest: handoff,
        ownership: handoff.ownership,
        cleanup
    };
}
function parseCleanup(value, mode) {
    if (!isRecord(value) || value.schemaVersion !== "1.0" || value.mode !== mode)
        return undefined;
    const booleanKeys = ["authorized", "attempted", "candidateRemoved", "candidateAbsent", "manifestRemoved", "manifestAbsent"];
    if (!booleanKeys.every((key) => typeof value[key] === "boolean"))
        return undefined;
    if (value.status !== "not-reached" && value.status !== "verified" && value.status !== "failed")
        return undefined;
    if (value.code !== undefined && (typeof value.code !== "string" || !/^[A-Z0-9_]+$/u.test(value.code)))
        return undefined;
    return Object.freeze({
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
        status: value.status,
        ...(typeof value.code === "string" ? { code: value.code } : {})
    });
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
function outcomeFailure(target, operation, outcome) {
    const code = outcome.outcome === "configuration-failed" ? outcome.code : "REMOTE_EXPORTED_CANDIDATE_TRANSPORT_FAILED";
    return evidenceFailure(target, operation, code);
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
})) {
    return {
        ok: false,
        target,
        operation,
        error: { code, message: "Remote exported-candidate evidence was rejected." },
        evidence: ["remote exported-candidate evidence rejected"],
        warnings: ["remote state is not assumed clean without complete evidence"],
        paths: {},
        commands: [{ command: `${target.transport} ${operation} <redacted-script>` }],
        logs: [{ source: "remote-exported-candidate", lines: ["remote evidence unavailable or invalid"] }],
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

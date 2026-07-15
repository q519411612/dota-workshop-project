import { createHash } from "node:crypto";
import { executeRemoteReleaseCandidateScript } from "./release-candidate-remote-executor.js";
import { normalizeReleaseCandidateDetail, RELEASE_CANDIDATE_BOUNDARIES, RELEASE_CANDIDATE_CONTRACT_WARNING } from "./release-candidate-result.js";
import { createFailureResult, createSuccessResult } from "./result.js";
const OPERATION = "preflight_release_candidate";
export async function preflightRemoteReleaseCandidate(input) {
    const outcome = await executeRemoteReleaseCandidateScript(input);
    const target = publicTarget(outcome.transport);
    if (outcome.outcome === "configuration-failed") {
        return configurationFailure(target, outcome.code, input.addonName);
    }
    if (outcome.outcome !== "completed") {
        return transportFailure(target, outcome.outcome === "failed" ? outcome.exitCode : undefined);
    }
    const framed = inspectFraming(outcome.stdout);
    if (framed === "invalid") {
        return invalidEvidence(target, "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID");
    }
    let parsed;
    try {
        parsed = JSON.parse(outcome.stdout);
    }
    catch {
        return invalidEvidence(target, "REMOTE_RELEASE_CANDIDATE_JSON_INVALID");
    }
    if (!isRecord(parsed) || Array.isArray(parsed) || JSON.stringify(parsed) !== outcome.stdout) {
        return invalidEvidence(target, "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID");
    }
    if (parsed.schemaVersion !== "1.0") {
        return invalidEvidence(target, "REMOTE_RELEASE_CANDIDATE_VERSION_INVALID");
    }
    const candidate = {
        ...parsed,
        execution: { kind: outcome.transport, outcome: "completed", exitCode: 0 },
        commands: [{ description: commandDescription(outcome.transport), outcome: "completed", exitCode: 0 }],
        logs: [{ source: "remote-release-candidate", lines: ["remote evidence normalized"] }]
    };
    const normalized = normalizeReleaseCandidateDetail(candidate, { expectedAddonName: input.addonName });
    if (!("operation" in normalized)) {
        const code = hasDigestViolation(parsed)
            ? "REMOTE_RELEASE_CANDIDATE_DIGEST_INVALID"
            : "REMOTE_RELEASE_CANDIDATE_SEMANTIC_INVALID";
        return invalidEvidence(target, code);
    }
    if (!isPublicDetailSafe(normalized, input.target)) {
        return invalidEvidence(target, "REMOTE_RELEASE_CANDIDATE_SEMANTIC_INVALID");
    }
    return completedResult(target, normalized);
}
function configurationFailure(target, code, addonName) {
    return createFailureResult({
        target,
        operation: OPERATION,
        error: {
            code,
            message: "Remote release-candidate configuration was rejected before invocation."
        },
        evidence: ["remote release-candidate invocation was not started"],
        logs: [{ source: "remote-release-candidate", lines: ["remote configuration rejected"] }],
        releaseCandidate: precreationDetail(target.transport, addonName, code)
    });
}
function precreationDetail(transport, addonName, code) {
    const safeAddonName = /^[a-z][a-z0-9_]{0,63}$/.test(addonName) ? addonName : "unverified";
    return normalizeReleaseCandidateDetail({
        schemaVersion: "1.0",
        operation: { status: "not-reached" },
        artifactValidation: { status: "not-reached" },
        blockers: [{ code, category: "configuration", disposition: "blocker" }],
        cleanup: {
            schemaVersion: "1.0",
            attempted: false,
            attempts: 0,
            status: "not-reached",
            verified: false
        },
        paths: {
            gameAddon: `game/dota_addons/${safeAddonName}`,
            contentAddon: `content/dota_addons/${safeAddonName}`
        },
        execution: { kind: transport, outcome: "failed" },
        warnings: [RELEASE_CANDIDATE_CONTRACT_WARNING],
        commands: [],
        logs: [],
        boundaries: RELEASE_CANDIDATE_BOUNDARIES
    });
}
function completedResult(target, detail) {
    const common = {
        target,
        operation: OPERATION,
        evidence: ["remote release-candidate evidence normalized"],
        warnings: [...detail.warnings],
        paths: { ...detail.paths },
        commands: [{ command: commandDescription(target.transport), exitCode: 0 }],
        logs: [{ source: "remote-release-candidate", lines: ["remote evidence normalized"] }],
        releaseCandidate: detail
    };
    if (detail.ok)
        return createSuccessResult(common);
    return createFailureResult({
        ...common,
        error: {
            code: "RELEASE_CANDIDATE_PREFLIGHT_FAILED",
            message: "Release candidate preflight did not satisfy the required invariants."
        }
    });
}
function transportFailure(target, exitCode) {
    return createFailureResult({
        target,
        operation: OPERATION,
        error: {
            code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_FAILED",
            message: "Remote release-candidate transport did not return complete evidence."
        },
        evidence: ["remote release-candidate transport evidence is incomplete"],
        commands: [{
                command: commandDescription(target.transport),
                ...(exitCode === undefined ? {} : { exitCode })
            }],
        logs: [{ source: "remote-release-candidate", lines: ["remote transport evidence unavailable"] }],
        releaseCandidate: uncertainDetail(target.transport, exitCode)
    });
}
function invalidEvidence(target, code) {
    return createFailureResult({
        target,
        operation: OPERATION,
        error: {
            code,
            message: "Remote release-candidate evidence was rejected."
        },
        evidence: ["remote release-candidate evidence rejected"],
        commands: [{ command: commandDescription(target.transport), exitCode: 0 }],
        logs: [{ source: "remote-release-candidate", lines: ["remote evidence invalid"] }],
        releaseCandidate: uncertainDetail(target.transport, 0)
    });
}
function uncertainDetail(transport, exitCode) {
    return normalizeReleaseCandidateDetail({
        schemaVersion: "1.0",
        operation: { status: "not-reached" },
        artifactValidation: { status: "not-reached" },
        blockers: [{
                code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN",
                category: "transport"
            }],
        cleanup: {
            schemaVersion: "1.0",
            attempted: false,
            attempts: 0,
            status: "unknown",
            verified: false,
            code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN"
        },
        paths: {
            gameAddon: "game/dota_addons/unverified",
            contentAddon: "content/dota_addons/unverified"
        },
        execution: {
            kind: transport,
            outcome: "uncertain",
            ...(exitCode === undefined ? {} : { exitCode })
        },
        warnings: [RELEASE_CANDIDATE_CONTRACT_WARNING],
        commands: [{
                description: commandDescription(transport),
                outcome: exitCode === undefined ? "uncertain" : "failed",
                ...(exitCode === undefined ? {} : { exitCode })
            }],
        logs: [{ source: "remote-release-candidate", lines: ["remote evidence unavailable"] }],
        boundaries: RELEASE_CANDIDATE_BOUNDARIES
    });
}
function publicTarget(transport) {
    return Object.freeze({
        kind: "remote",
        name: "remote-target",
        transport,
        host: "redacted"
    });
}
function commandDescription(transport) {
    return `${transport} remote-target preflight_release_candidate <redacted-script>`;
}
function inspectFraming(stdout) {
    if (stdout.length < 2 || stdout[0] !== "{" || stdout[stdout.length - 1] !== "}")
        return "invalid";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < stdout.length; index += 1) {
        const character = stdout[index];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (character === "\\")
                escaped = true;
            else if (character === "\"")
                inString = false;
            continue;
        }
        if (character === "\"")
            inString = true;
        else if (character === "{" || character === "[")
            depth += 1;
        else if (character === "}" || character === "]")
            depth -= 1;
        if (depth < 0 || (depth === 0 && index !== stdout.length - 1))
            return "invalid";
    }
    return depth === 0 && !inString ? "valid" : "invalid";
}
function hasDigestViolation(input) {
    return manifestDigestInvalid(input.manifest) || manifestDigestInvalid(readNestedManifest(input.artifactValidation));
}
function readNestedManifest(input) {
    return isRecord(input) ? input.manifest : undefined;
}
function manifestDigestInvalid(input) {
    if (!isRecord(input))
        return false;
    const entries = input.entries;
    const combinedSha256 = input.combinedSha256;
    if (typeof combinedSha256 !== "string" || !/^[0-9a-f]{64}$/.test(combinedSha256))
        return true;
    if (!Array.isArray(entries))
        return false;
    const normalizedEntries = [];
    for (const entry of entries) {
        if (!isRecord(entry))
            return false;
        const { schemaVersion, root, path, bytes, sha256 } = entry;
        if (schemaVersion !== "1.0"
            || (root !== "game" && root !== "content")
            || typeof path !== "string"
            || !Number.isSafeInteger(bytes)
            || typeof sha256 !== "string")
            return typeof sha256 === "string" && !/^[0-9a-f]{64}$/.test(sha256);
        if (!/^[0-9a-f]{64}$/.test(sha256))
            return true;
        normalizedEntries.push({ schemaVersion: "1.0", root, path, bytes: bytes, sha256 });
    }
    return computeDigest(normalizedEntries) !== combinedSha256;
}
function computeDigest(entries) {
    const payload = ["1.0", entries.map(({ root, path, bytes, sha256 }) => [root, path, bytes, sha256])];
    return importDigest(payload);
}
function importDigest(payload) {
    return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}
function isPublicDetailSafe(detail, privateTarget) {
    const serialized = JSON.stringify(detail);
    const privateValues = [privateTarget.name, privateTarget.host, privateTarget.username, privateTarget.dotaRoot]
        .filter((value) => typeof value === "string" && value.length > 0);
    if (privateValues.some((value) => serialized.includes(value)))
        return false;
    return !/[A-Za-z]:[\\/]|(?:^|["\s])\/(?:Users|home|private|Volumes)\/|gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(serialized);
}
function isRecord(input) {
    return input !== null && typeof input === "object";
}

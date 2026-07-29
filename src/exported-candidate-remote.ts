import {
  executeRemoteExport,
  executeRemoteExportCleanup,
  type RemoteExportExecutor
} from "./exported-candidate-remote-executor.js";
import {
  parseExportedCandidateHandoffManifest,
  type ExportedCandidateCleanupEvidence,
  type ExportedCandidateHandoffManifest
} from "./exported-candidate.js";
import type { CleanupExportedCandidateToolInput, ExportReleaseCandidateToolInput } from "./schemas.js";
import type { RemoteTarget, ToolResult } from "./types.js";

export async function exportRemoteReleaseCandidate(
  input: ExportReleaseCandidateToolInput & Readonly<{ executor?: RemoteExportExecutor }>
): Promise<ToolResult> {
  if (input.target.kind !== "remote") return invalidTarget("export_release_candidate");
  const outcome = await executeRemoteExport(input);
  const target = publicTarget(input.target);
  if (outcome.outcome !== "completed") return outcomeFailure(target, "export_release_candidate", outcome, "export-failure");
  const parsed = parseFramedObject(outcome.stdout);
  if (parsed === undefined) return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_EVIDENCE_INVALID");
  const handoff = parseExportedCandidateHandoffManifest(parsed.export);
  const cleanup = parseCleanup(parsed.exportCleanup, "export-failure");
  if (
    !hasOnlyKeys(parsed, ["schemaVersion", "operation", "artifactValidation", "blockers", "cleanup", "paths", "execution", "warnings", "commands", "logs", "boundaries", "scanCoverage", "manifest", "inclusionLedger", "export", "exportCleanup", "ok"])
    || parsed.schemaVersion !== "1.0"
    || parsed.ok !== true
    || !isRecordWithExact(parsed.operation, ["status"])
    || parsed.operation.status !== "completed"
    || !isRecord(parsed.cleanup)
    || parsed.cleanup.status !== "verified"
    || handoff === undefined
    || cleanup === undefined
    || !cleanupSuccessState(cleanup)
    || handoff.targetKind !== outcome.transport
    || handoff.addonName !== input.addonName
    || !windowsPathEqual(handoff.exportRoot, input.exportRoot)
    || !windowsPathEqual(handoff.destination, input.destination)
  ) return evidenceFailure(target, "export_release_candidate", "REMOTE_EXPORT_SEMANTIC_INVALID");
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

export async function cleanupRemoteExportedCandidate(
  input: CleanupExportedCandidateToolInput & Readonly<{ executor?: RemoteExportExecutor }>
): Promise<ToolResult> {
  if (input.target.kind !== "remote") return invalidTarget("cleanup_exported_candidate");
  const outcome = await executeRemoteExportCleanup(input);
  const target = publicTarget(input.target);
  const mode = input.dryRun !== false ? "dry-run" : "execute";
  if (outcome.outcome !== "completed") return outcomeFailure(target, "cleanup_exported_candidate", outcome, mode);
  const parsed = parseFramedObject(outcome.stdout);
  if (parsed === undefined) return evidenceFailure(target, "cleanup_exported_candidate", "REMOTE_CLEANUP_EVIDENCE_INVALID");
  const cleanup = parseCleanup(parsed.cleanup, mode);
  const handoff = parseExportedCandidateHandoffManifest(parsed.manifest);
  if (
    !hasOnlyKeys(parsed, ["schemaVersion", "ok", "operation", "code", "cleanup", "authorized", "manifest"])
    || parsed.schemaVersion !== "1.0"
    || parsed.ok !== true
    || parsed.operation !== "cleanup_exported_candidate"
    || parsed.code !== null
    || parsed.authorized !== true
    || cleanup === undefined
    || !cleanupSuccessState(cleanup)
    || handoff === undefined
    || handoff.targetKind !== outcome.transport
    || handoff.schemaVersion !== input.manifestVersion
    || handoff.ownership.ownershipId !== input.ownershipId
    || handoff.combinedSha256 !== input.combinedSha256
    || !windowsPathEqual(handoff.exportRoot, input.exportRoot)
    || !windowsPathEqual(handoff.destination, input.destination)
  ) {
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

function parseCleanup(value: unknown, mode: ExportedCandidateCleanupEvidence["mode"]): ExportedCandidateCleanupEvidence | undefined {
  const keys = ["schemaVersion", "mode", "authorized", "attempted", "candidateRemoved", "candidateAbsent", "manifestRemoved", "manifestAbsent", "status", "code"];
  if (mode === "export-failure") keys.push("stagingRemoved", "stagingAbsent");
  if (!isRecord(value) || !hasOnlyKeys(value, keys, ["code", "stagingRemoved", "stagingAbsent"]) || value.schemaVersion !== "1.0" || value.mode !== mode) return undefined;
  const booleanKeys = ["authorized", "attempted", "candidateRemoved", "candidateAbsent", "manifestRemoved", "manifestAbsent"];
  if (!booleanKeys.every((key) => typeof value[key] === "boolean")) return undefined;
  if (value.status !== "not-reached" && value.status !== "verified" && value.status !== "failed" && value.status !== "unknown") return undefined;
  if (value.code !== undefined && (typeof value.code !== "string" || !/^[A-Z0-9_]+$/u.test(value.code))) return undefined;
  const parsed = Object.freeze({
    schemaVersion: "1.0",
    mode,
    authorized: value.authorized as boolean,
    attempted: value.attempted as boolean,
    candidateRemoved: value.candidateRemoved as boolean,
    candidateAbsent: value.candidateAbsent as boolean,
    manifestRemoved: value.manifestRemoved as boolean,
    manifestAbsent: value.manifestAbsent as boolean,
    ...(typeof value.stagingRemoved === "boolean" ? { stagingRemoved: value.stagingRemoved } : {}),
    ...(typeof value.stagingAbsent === "boolean" ? { stagingAbsent: value.stagingAbsent } : {}),
    status: value.status,
    ...(typeof value.code === "string" ? { code: value.code } : {})
  });
  if (parsed.status === "verified" && parsed.code !== undefined) return undefined;
  return parsed;
}

function cleanupSuccessState(cleanup: ExportedCandidateCleanupEvidence): boolean {
  if (cleanup.status !== "verified" || !cleanup.authorized) return false;
  if (cleanup.mode === "dry-run") {
    return !cleanup.attempted && !cleanup.candidateRemoved && !cleanup.candidateAbsent && !cleanup.manifestRemoved && !cleanup.manifestAbsent;
  }
  if (cleanup.mode === "execute") {
    return cleanup.attempted && cleanup.candidateRemoved && cleanup.candidateAbsent && cleanup.manifestRemoved && cleanup.manifestAbsent;
  }
  return !cleanup.attempted
    && !cleanup.candidateRemoved
    && !cleanup.candidateAbsent
    && !cleanup.manifestRemoved
    && !cleanup.manifestAbsent
    && cleanup.stagingRemoved === false
    && cleanup.stagingAbsent === true;
}

function parseFramedObject(stdout: string): Record<string, unknown> | undefined {
  if (stdout.length < 2 || stdout[0] !== "{" || stdout.at(-1) !== "}" || /[\r\n]/u.test(stdout)) return undefined;
  try {
    const parsed: unknown = JSON.parse(stdout);
    return isRecord(parsed) && JSON.stringify(parsed) === stdout ? parsed : undefined;
  } catch { return undefined; }
}

function outcomeFailure(
  target: RemoteTarget,
  operation: string,
  outcome: Exclude<Awaited<ReturnType<typeof executeRemoteExport>>, { outcome: "completed" }>,
  mode: ExportedCandidateCleanupEvidence["mode"]
): ToolResult {
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
    ...(uncertain ? { candidateState: "unknown" as const, manifestState: "unknown" as const } : {}),
    status: uncertain ? "unknown" : "failed",
    code
  }), uncertain);
}

function evidenceFailure(
  target: RemoteTarget,
  operation: string,
  code: string,
  cleanup: ExportedCandidateCleanupEvidence = Object.freeze({
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
  }),
  uncertain = false
): ToolResult {
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

function invalidTarget(operation: string): ToolResult {
  return evidenceFailure({ kind: "remote", name: "remote-target", transport: "ssh", host: "redacted" }, operation, "REMOTE_TARGET_REQUIRED");
}

function publicTarget(target: RemoteTarget): RemoteTarget {
  return Object.freeze({ kind: "remote", name: "remote-target", transport: target.transport, host: "redacted" });
}

function windowsPathEqual(left: string, right: string): boolean {
  return left.replaceAll("/", "\\").replace(/[\\]+$/u, "").toLocaleLowerCase("en-US")
    === right.replaceAll("/", "\\").replace(/[\\]+$/u, "").toLocaleLowerCase("en-US");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set(keys);
  const required = keys.filter((key) => !optional.includes(key));
  return Object.keys(value).every((key) => allowed.has(key)) && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isRecordWithExact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && hasOnlyKeys(value, keys) && Object.keys(value).length === keys.length;
}

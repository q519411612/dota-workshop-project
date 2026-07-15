import { computeReleaseCandidateCombinedDigest as computeCanonicalCombinedDigest } from "./release-candidate.js";
import { sanitizeRelativeEvidenceIdentity } from "./release-readiness.js";
import { createFailureResult, createSuccessResult } from "./result.js";
import type { Target, ToolResult } from "./types.js";

export type ReleaseCandidateManifestEntryDetail = Readonly<{
  schemaVersion: "1.0";
  root: "game" | "content";
  path: string;
  bytes: number;
  sha256: string;
}>;

export type ReleaseCandidateManifestDetail = Readonly<{
  schemaVersion: "1.0";
  entries: readonly ReleaseCandidateManifestEntryDetail[];
  combinedSha256: string;
}>;

export type ReleaseCandidateInclusionLedgerDetail = Readonly<{
  schemaVersion: "1.0";
  expectedFileCount: number;
  observedFileCount: number;
  matchedFileCount: number;
}>;

export type ReleaseCandidateCoverageCategoryDetail = Readonly<{
  count: number;
  paths: readonly string[];
}>;

export type ReleaseCandidateScanCoverageDetail = Readonly<{
  schemaVersion: "1.0";
  totalFileCount: number;
  text: ReleaseCandidateCoverageCategoryDetail;
  binary: ReleaseCandidateCoverageCategoryDetail;
  unreadable: ReleaseCandidateCoverageCategoryDetail;
  oversized: ReleaseCandidateCoverageCategoryDetail;
}>;

export type ReleaseCandidateBlockerDetail = Readonly<{
  code: string;
  category: string;
  field?: string;
  path?: string;
  count?: number;
  disposition?: "blocker" | "warning" | "evidence";
}>;

export type ReleaseCandidateOperationDetail =
  | Readonly<{ status: "not-reached" }>
  | Readonly<{ status: "completed" }>
  | Readonly<{
      status: "failed";
      code: "CANDIDATE_INSPECTION_FAILED" | "CANDIDATE_INSPECTION_VALUE_UNSAFE";
    }>;

export type ReleaseCandidateArtifactDetail =
  | Readonly<{ status: "not-reached" }>
  | Readonly<{
      status: "blocked";
      blockers: readonly ReleaseCandidateBlockerDetail[];
      inclusionLedger?: ReleaseCandidateInclusionLedgerDetail;
      scanCoverage?: ReleaseCandidateScanCoverageDetail;
    }>
  | Readonly<{
      status: "passed";
      manifest: ReleaseCandidateManifestDetail;
      inclusionLedger: ReleaseCandidateInclusionLedgerDetail;
      scanCoverage: ReleaseCandidateScanCoverageDetail;
    }>;

export type ReleaseCandidateCleanupDetail =
  | Readonly<{
      schemaVersion: "1.0";
      attempted: false;
      attempts: 0;
      status: "not-reached";
      verified: false;
    }>
  | Readonly<{
      schemaVersion: "1.0";
      attempted: true;
      attempts: 1;
      status: "verified";
      verified: true;
      identityMatched: true;
      removed: true;
      absent: true;
    }>
  | Readonly<{
      schemaVersion: "1.0";
      attempted: boolean;
      attempts: 0 | 1;
      status: "failed";
      verified: false;
      code: ReleaseCandidateCleanupFailureCode;
      identityMatched?: boolean;
      removed?: boolean;
      absent?: boolean;
    }>
  | Readonly<{
      schemaVersion: "1.0";
      attempted: boolean;
      attempts: 0 | 1;
      status: "unknown";
      verified: false;
      code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN";
    }>;

export type ReleaseCandidateExecutionDetail = Readonly<{
  kind: "fixture" | "local" | "ssh" | "powershell";
  outcome: "completed" | "failed" | "uncertain";
  exitCode?: number;
}>;

export type ReleaseCandidateCommandDetail = Readonly<{
  description: string;
  outcome: "completed" | "failed" | "uncertain";
  exitCode?: number;
}>;

export type ReleaseCandidateLogDetail = Readonly<{
  source: string;
  lines: readonly string[];
}>;

export type ReleaseCandidateBoundaryDetail = Readonly<{
  steamLogin: boolean;
  workshopCreate: boolean;
  workshopMutation: boolean;
  upload: boolean;
  archive: boolean;
  signing: boolean;
  encryption: boolean;
  gameLaunch: boolean;
  runtimeValidation: boolean;
  compilation: boolean;
  sourceConversion: boolean;
  metadataRepair: boolean;
  persistentCandidate: boolean;
  fileTransfer: boolean;
  temporaryCandidate: boolean;
  sourceTreesModified: boolean;
  evidenceOnly: boolean;
  realWindowsRuntimeProven: boolean;
}>;

export type ValidReleaseCandidateDetail = Readonly<{
  schemaVersion: "1.0";
  ok: boolean;
  normalization: Readonly<{ status: "valid" }>;
  operation: ReleaseCandidateOperationDetail;
  artifactValidation: ReleaseCandidateArtifactDetail;
  manifest?: ReleaseCandidateManifestDetail;
  inclusionLedger?: ReleaseCandidateInclusionLedgerDetail;
  scanCoverage?: ReleaseCandidateScanCoverageDetail;
  blockers: readonly ReleaseCandidateBlockerDetail[];
  cleanup: ReleaseCandidateCleanupDetail;
  paths: Readonly<{ gameAddon: string; contentAddon: string }>;
  execution: ReleaseCandidateExecutionDetail;
  warnings: readonly string[];
  commands: readonly ReleaseCandidateCommandDetail[];
  logs: readonly ReleaseCandidateLogDetail[];
  boundaries: ReleaseCandidateBoundaryDetail;
}>;

export type ReleaseCandidateNormalizationFailure = Readonly<{
  schemaVersion: "1.0";
  ok: false;
  normalization: Readonly<{
    status: "failed";
    code: "RELEASE_CANDIDATE_DETAIL_INVALID";
  }>;
  blockers: readonly [Readonly<{
    code: "RELEASE_CANDIDATE_DETAIL_INVALID";
    category: "normalization";
  }>];
}>;

export type ReleaseCandidateDetail = ValidReleaseCandidateDetail | ReleaseCandidateNormalizationFailure;

type ReleaseCandidateCleanupFailureCode =
  | "CANDIDATE_IDENTITY_MISMATCH"
  | "CANDIDATE_REMOVAL_FAILED"
  | "CANDIDATE_ABSENCE_UNVERIFIED"
  | "CANDIDATE_LEASE_INVALID"
  | "CANDIDATE_CLEANUP_RESULT_INVALID"
  | "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE";

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
  "WINDOWS_REPARSE_CLASSIFIER_REQUIRED"
]);

const CLEANUP_FAILURE_CODES = new Set<ReleaseCandidateCleanupFailureCode>([
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
] as const;

export const computeReleaseCandidateCombinedDigest = computeCanonicalCombinedDigest;

export function normalizeReleaseCandidateDetail(input: unknown): ReleaseCandidateDetail {
  try {
    return normalizeValidDetail(input) ?? normalizationFailure();
  } catch {
    return normalizationFailure();
  }
}

export function createReleaseCandidateToolResult(input: Readonly<{
  target: Target;
  operation: string;
  releaseCandidate: unknown;
  evidence?: string[];
  warnings?: string[];
  paths?: Record<string, string>;
}>): ToolResult {
  const releaseCandidate = normalizeReleaseCandidateDetail(input.releaseCandidate);
  const common = {
    target: input.target,
    operation: input.operation,
    evidence: input.evidence,
    warnings: input.warnings,
    paths: input.paths,
    releaseCandidate
  };
  if (releaseCandidate.ok) return createSuccessResult(common);
  const code = releaseCandidate.normalization.status === "failed"
    ? releaseCandidate.normalization.code
    : "RELEASE_CANDIDATE_PREFLIGHT_FAILED";
  return createFailureResult({
    ...common,
    error: { code, message: "Release candidate preflight did not satisfy the required invariants." }
  });
}

function normalizeValidDetail(input: unknown): ValidReleaseCandidateDetail | undefined {
  if (!isObject(input) || get(input, "schemaVersion") !== "1.0") return undefined;
  const operation = normalizeOperation(get(input, "operation"));
  const manifest = normalizeOptionalManifest(get(input, "manifest"));
  const inclusionLedger = normalizeOptionalLedger(get(input, "inclusionLedger"));
  const scanCoverage = normalizeOptionalCoverage(get(input, "scanCoverage"));
  const blockers = normalizeBlockers(get(input, "blockers"));
  const cleanup = normalizeCleanup(get(input, "cleanup"));
  const paths = normalizePaths(get(input, "paths"));
  const execution = normalizeExecution(get(input, "execution"));
  const warnings = normalizeStringArray(get(input, "warnings"));
  const commands = normalizeCommands(get(input, "commands"));
  const logs = normalizeLogs(get(input, "logs"));
  const boundaries = normalizeBoundaries(get(input, "boundaries"));
  if (
    operation === undefined
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
    || boundaries === undefined
  ) return undefined;

  const artifactValidation = normalizeArtifact(get(input, "artifactValidation"));
  if (artifactValidation === undefined) return undefined;
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
    paths,
    execution,
    warnings,
    commands,
    logs,
    boundaries
  });
}

function normalizeOperation(input: unknown): ReleaseCandidateOperationDetail | undefined {
  if (!isObject(input)) return undefined;
  const status = get(input, "status");
  if (status === "not-reached" || status === "completed") return { status };
  const code = get(input, "code");
  if (
    status === "failed"
    && (code === "CANDIDATE_INSPECTION_FAILED" || code === "CANDIDATE_INSPECTION_VALUE_UNSAFE")
  ) return { status, code };
  return undefined;
}

function normalizeArtifact(input: unknown): ReleaseCandidateArtifactDetail | undefined {
  if (!isObject(input)) return undefined;
  const status = get(input, "status");
  if (status === "not-reached") return { status };
  if (status === "blocked") {
    const blockers = normalizeBlockers(get(input, "blockers"));
    const inclusionLedger = normalizeOptionalLedger(get(input, "inclusionLedger"));
    const scanCoverage = normalizeOptionalCoverage(get(input, "scanCoverage"));
    if (
      blockers === undefined
      || blockers.length === 0
      || inclusionLedger === false
      || scanCoverage === false
    ) return undefined;
    return {
      status,
      blockers,
      ...(inclusionLedger === undefined ? {} : { inclusionLedger }),
      ...(scanCoverage === undefined ? {} : { scanCoverage })
    };
  }
  if (status === "passed") {
    const manifest = normalizeManifest(get(input, "manifest"));
    const inclusionLedger = normalizeLedger(get(input, "inclusionLedger"));
    const scanCoverage = normalizeCoverage(get(input, "scanCoverage"));
    if (manifest === undefined || inclusionLedger === undefined || scanCoverage === undefined) return undefined;
    if (!validatePassedEvidence(manifest, inclusionLedger, scanCoverage)) return undefined;
    return { status, manifest, inclusionLedger, scanCoverage };
  }
  return undefined;
}

function normalizeOptionalManifest(input: unknown): ReleaseCandidateManifestDetail | undefined | false {
  return input === undefined ? undefined : normalizeManifest(input) ?? false;
}

function normalizeManifest(input: unknown): ReleaseCandidateManifestDetail | undefined {
  if (!isObject(input) || get(input, "schemaVersion") !== "1.0") return undefined;
  const rawEntries = get(input, "entries");
  const combinedSha256 = get(input, "combinedSha256");
  if (!Array.isArray(rawEntries) || !isDigest(combinedSha256)) return undefined;
  const entries: ReleaseCandidateManifestEntryDetail[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < rawEntries.length; index += 1) {
    const raw = rawEntries[index];
    if (!isObject(raw) || get(raw, "schemaVersion") !== "1.0") return undefined;
    const root = get(raw, "root");
    const path = get(raw, "path");
    const bytes = get(raw, "bytes");
    const sha256 = get(raw, "sha256");
    if (
      (root !== "game" && root !== "content")
      || typeof path !== "string"
      || !isManifestPath(root, path)
      || !isCount(bytes)
      || !isDigest(sha256)
      || seen.has(path)
    ) return undefined;
    seen.add(path);
    entries.push({ schemaVersion: "1.0", root, path, bytes, sha256 });
  }
  for (let index = 1; index < entries.length; index += 1) {
    if (compareManifestEntry(entries[index - 1]!, entries[index]!) >= 0) return undefined;
  }
  if (computeReleaseCandidateCombinedDigest(entries) !== combinedSha256) return undefined;
  return { schemaVersion: "1.0", entries, combinedSha256 };
}

function normalizeOptionalLedger(input: unknown): ReleaseCandidateInclusionLedgerDetail | undefined | false {
  return input === undefined ? undefined : normalizeLedger(input) ?? false;
}

function normalizeLedger(input: unknown): ReleaseCandidateInclusionLedgerDetail | undefined {
  if (!isObject(input) || get(input, "schemaVersion") !== "1.0") return undefined;
  const expectedFileCount = get(input, "expectedFileCount");
  const observedFileCount = get(input, "observedFileCount");
  const matchedFileCount = get(input, "matchedFileCount");
  if (!isCount(expectedFileCount) || !isCount(observedFileCount) || !isCount(matchedFileCount)) return undefined;
  if (matchedFileCount > expectedFileCount || matchedFileCount > observedFileCount) return undefined;
  return { schemaVersion: "1.0", expectedFileCount, observedFileCount, matchedFileCount };
}

function normalizeOptionalCoverage(input: unknown): ReleaseCandidateScanCoverageDetail | undefined | false {
  return input === undefined ? undefined : normalizeCoverage(input) ?? false;
}

function normalizeCoverage(input: unknown): ReleaseCandidateScanCoverageDetail | undefined {
  if (!isObject(input) || get(input, "schemaVersion") !== "1.0") return undefined;
  const totalFileCount = get(input, "totalFileCount");
  if (!isCount(totalFileCount)) return undefined;
  const text = normalizeCoverageCategory(get(input, "text"));
  const binary = normalizeCoverageCategory(get(input, "binary"));
  const unreadable = normalizeCoverageCategory(get(input, "unreadable"));
  const oversized = normalizeCoverageCategory(get(input, "oversized"));
  if (text === undefined || binary === undefined || unreadable === undefined || oversized === undefined) return undefined;
  const allPaths = [...text.paths, ...binary.paths, ...unreadable.paths, ...oversized.paths];
  if (new Set(allPaths).size !== allPaths.length || totalFileCount !== allPaths.length) return undefined;
  return { schemaVersion: "1.0", totalFileCount, text, binary, unreadable, oversized };
}

function normalizeCoverageCategory(input: unknown): ReleaseCandidateCoverageCategoryDetail | undefined {
  if (!isObject(input)) return undefined;
  const count = get(input, "count");
  const paths = normalizePathArray(get(input, "paths"));
  if (!isCount(count) || paths === undefined || count !== paths.length) return undefined;
  return { count, paths };
}

function normalizePathArray(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const paths: string[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const path = input[index];
    if (typeof path !== "string" || !isSafeRelativePath(path)) return undefined;
    if (index > 0 && paths[index - 1]! >= path) return undefined;
    paths.push(path);
  }
  return paths;
}

function normalizeBlockers(input: unknown): ReleaseCandidateBlockerDetail[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const blockers: ReleaseCandidateBlockerDetail[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (!isObject(raw)) return undefined;
    const code = get(raw, "code");
    const category = get(raw, "category");
    const field = get(raw, "field");
    const path = get(raw, "path");
    const count = get(raw, "count");
    const disposition = get(raw, "disposition");
    if (
      typeof code !== "string"
      || !BLOCKER_CODES.has(code)
      || typeof category !== "string"
      || !isSafeText(category)
      || (field !== undefined && (typeof field !== "string" || !isSafeText(field)))
      || (path !== undefined && (typeof path !== "string" || !isSafeRelativePath(path)))
      || (count !== undefined && !isCount(count))
      || (disposition !== undefined && disposition !== "blocker" && disposition !== "warning" && disposition !== "evidence")
    ) return undefined;
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

function normalizeCleanup(input: unknown): ReleaseCandidateCleanupDetail | undefined {
  if (!isObject(input) || get(input, "schemaVersion") !== "1.0") return undefined;
  const attempted = get(input, "attempted");
  const attempts = get(input, "attempts");
  const status = get(input, "status");
  const verified = get(input, "verified");
  if (status === "not-reached" && attempted === false && attempts === 0 && verified === false) {
    return { schemaVersion: "1.0", attempted, attempts, status, verified };
  }
  const identityMatched = get(input, "identityMatched");
  const removed = get(input, "removed");
  const absent = get(input, "absent");
  if (
    status === "verified"
    && attempted === true
    && attempts === 1
    && verified === true
    && identityMatched === true
    && removed === true
    && absent === true
  ) return { schemaVersion: "1.0", attempted, attempts, status, verified, identityMatched, removed, absent };
  const code = get(input, "code");
  if (
    status === "failed"
    && verified === false
    && typeof attempted === "boolean"
    && (attempts === 0 || attempts === 1)
    && attempts === (attempted ? 1 : 0)
    && typeof code === "string"
    && CLEANUP_FAILURE_CODES.has(code as ReleaseCandidateCleanupFailureCode)
    && (identityMatched === undefined || typeof identityMatched === "boolean")
    && (removed === undefined || typeof removed === "boolean")
    && (absent === undefined || typeof absent === "boolean")
  ) {
    if (
      attempted === false
      && code === "CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE"
      && identityMatched === undefined
      && removed === undefined
      && absent === undefined
    ) return { schemaVersion: "1.0", attempted, attempts, status, verified, code };
    if (
      attempted === true
      && code === "CANDIDATE_CLEANUP_RESULT_INVALID"
      && identityMatched === undefined
      && removed === undefined
      && absent === undefined
    ) return { schemaVersion: "1.0", attempted, attempts, status, verified, code };
    if (
      attempted === true
      && typeof identityMatched === "boolean"
      && typeof removed === "boolean"
      && typeof absent === "boolean"
      && cleanupFailureFactsAgree(code as ReleaseCandidateCleanupFailureCode, identityMatched, removed, absent)
    ) return {
      schemaVersion: "1.0",
      attempted,
      attempts,
      status,
      verified,
      code: code as ReleaseCandidateCleanupFailureCode,
      identityMatched,
      removed,
      absent
    };
    return undefined;
  }
  if (
    status === "unknown"
    && verified === false
    && typeof attempted === "boolean"
    && (attempts === 0 || attempts === 1)
    && attempts === (attempted ? 1 : 0)
    && code === "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN"
  ) return { schemaVersion: "1.0", attempted, attempts, status, verified, code };
  return undefined;
}

function normalizePaths(input: unknown): { gameAddon: string; contentAddon: string } | undefined {
  if (!isObject(input)) return undefined;
  const gameAddon = get(input, "gameAddon");
  const contentAddon = get(input, "contentAddon");
  if (
    typeof gameAddon !== "string"
    || typeof contentAddon !== "string"
    || !isSafeRelativePath(gameAddon)
    || !isSafeRelativePath(contentAddon)
    || !gameAddon.startsWith("game/dota_addons/")
    || !contentAddon.startsWith("content/dota_addons/")
  ) return undefined;
  return { gameAddon, contentAddon };
}

function normalizeExecution(input: unknown): ReleaseCandidateExecutionDetail | undefined {
  if (!isObject(input)) return undefined;
  const kind = get(input, "kind");
  const outcome = get(input, "outcome");
  const exitCode = get(input, "exitCode");
  if (
    kind !== "fixture" && kind !== "local" && kind !== "ssh" && kind !== "powershell"
  ) return undefined;
  if (outcome !== "completed" && outcome !== "failed" && outcome !== "uncertain") return undefined;
  if (exitCode !== undefined && !Number.isSafeInteger(exitCode)) return undefined;
  return { kind, outcome, ...(exitCode === undefined ? {} : { exitCode: exitCode as number }) };
}

function normalizeCommands(input: unknown): ReleaseCandidateCommandDetail[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const commands: ReleaseCandidateCommandDetail[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (!isObject(raw)) return undefined;
    const description = get(raw, "description");
    const outcome = get(raw, "outcome");
    const exitCode = get(raw, "exitCode");
    if (
      typeof description !== "string"
      || !isSafeText(description)
      || (outcome !== "completed" && outcome !== "failed" && outcome !== "uncertain")
      || (exitCode !== undefined && !Number.isSafeInteger(exitCode))
    ) return undefined;
    commands.push({ description, outcome, ...(exitCode === undefined ? {} : { exitCode: exitCode as number }) });
  }
  return commands;
}

function normalizeLogs(input: unknown): ReleaseCandidateLogDetail[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const logs: ReleaseCandidateLogDetail[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (!isObject(raw)) return undefined;
    const source = get(raw, "source");
    const lines = normalizeStringArray(get(raw, "lines"));
    if (typeof source !== "string" || !isSafeText(source) || lines === undefined) return undefined;
    logs.push({ source, lines });
  }
  return logs;
}

function normalizeStringArray(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const values: string[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (typeof value !== "string" || !isSafeText(value)) return undefined;
    values.push(value);
  }
  return values;
}

function normalizeBoundaries(input: unknown): ReleaseCandidateBoundaryDetail | undefined {
  if (!isObject(input)) return undefined;
  const output: Record<string, boolean> = {};
  for (const key of BOUNDARY_KEYS) {
    const value = get(input, key);
    if (typeof value !== "boolean") return undefined;
    output[key] = value;
  }
  return output as ReleaseCandidateBoundaryDetail;
}

function validateDomainConsistency(input: Readonly<{
  operation: ReleaseCandidateOperationDetail;
  artifactValidation: ReleaseCandidateArtifactDetail;
  manifest: ReleaseCandidateManifestDetail | undefined;
  inclusionLedger: ReleaseCandidateInclusionLedgerDetail | undefined;
  scanCoverage: ReleaseCandidateScanCoverageDetail | undefined;
  blockers: readonly ReleaseCandidateBlockerDetail[];
  cleanup: ReleaseCandidateCleanupDetail;
  execution: ReleaseCandidateExecutionDetail;
}>): boolean {
  const { operation, artifactValidation, manifest, inclusionLedger, scanCoverage, blockers, cleanup, execution } = input;
  if (artifactValidation.status === "passed") {
    if (
      manifest === undefined
      || inclusionLedger === undefined
      || scanCoverage === undefined
      || blockers.some((blocker) => blocker.category !== "removal" && blocker.category !== "transport")
      || !sameValue(manifest, artifactValidation.manifest)
      || !sameValue(inclusionLedger, artifactValidation.inclusionLedger)
      || !sameValue(scanCoverage, artifactValidation.scanCoverage)
      || !validatePassedEvidence(manifest, inclusionLedger, scanCoverage)
    ) return false;
  } else if (manifest !== undefined) {
    return false;
  }
  if (artifactValidation.status === "passed" && operation.status === "not-reached") return false;
  if (artifactValidation.status === "blocked") {
    if (!sameValue(blockers, artifactValidation.blockers)) return false;
    if (!sameValue(inclusionLedger, artifactValidation.inclusionLedger)) return false;
    if (!sameValue(scanCoverage, artifactValidation.scanCoverage)) return false;
  }
  if (artifactValidation.status === "not-reached" && blockers.length === 0) return false;
  if (artifactValidation.status === "not-reached" && operation.status !== "not-reached") return false;
  if (cleanup.status === "failed") {
    if (!blockers.some((blocker) => blocker.code === cleanup.code && blocker.category === "removal")) return false;
  }
  if (cleanup.status === "unknown") {
    if (!blockers.some((blocker) => blocker.code === cleanup.code && blocker.category === "transport")) return false;
  }
  if ((execution.outcome === "uncertain") !== (cleanup.status === "unknown")) return false;
  return true;
}

function cleanupFailureFactsAgree(
  code: ReleaseCandidateCleanupFailureCode,
  identityMatched: boolean,
  removed: boolean,
  absent: boolean
): boolean {
  if (code === "CANDIDATE_IDENTITY_MISMATCH") return identityMatched === false;
  if (code === "CANDIDATE_REMOVAL_FAILED") return identityMatched === true && removed === false;
  if (code === "CANDIDATE_ABSENCE_UNVERIFIED") {
    return identityMatched === true && removed === true && absent === false;
  }
  return code === "CANDIDATE_LEASE_INVALID";
}

function validatePassedEvidence(
  manifest: ReleaseCandidateManifestDetail,
  inclusionLedger: ReleaseCandidateInclusionLedgerDetail,
  scanCoverage: ReleaseCandidateScanCoverageDetail
): boolean {
  const count = manifest.entries.length;
  if (
    inclusionLedger.expectedFileCount !== count
    || inclusionLedger.observedFileCount !== count
    || inclusionLedger.matchedFileCount !== count
  ) return false;
  const covered = [
    ...scanCoverage.text.paths,
    ...scanCoverage.binary.paths,
    ...scanCoverage.unreadable.paths,
    ...scanCoverage.oversized.paths
  ].sort(compareOrdinal);
  const manifestPaths = manifest.entries.map((entry) => entry.path).sort(compareOrdinal);
  return sameValue(covered, manifestPaths);
}

function normalizationFailure(): ReleaseCandidateNormalizationFailure {
  return deepFreeze({
    schemaVersion: "1.0",
    ok: false,
    normalization: { status: "failed", code: "RELEASE_CANDIDATE_DETAIL_INVALID" },
    blockers: [{ code: "RELEASE_CANDIDATE_DETAIL_INVALID", category: "normalization" }]
  });
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function get(input: object, key: PropertyKey): unknown {
  return Reflect.get(input, key);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isManifestPath(root: "game" | "content", path: string): boolean {
  return isSafeRelativePath(path) && path.startsWith(`${root}/dota_addons/`);
}

function isSafeRelativePath(path: string): boolean {
  return path.length > 0
    && !path.startsWith("/")
    && !path.startsWith("\\")
    && !/^[A-Za-z]:[\\/]/.test(path)
    && !path.includes("\\")
    && path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
    && sanitizeRelativeEvidenceIdentity(path) === path;
}

function isSafeText(value: string): boolean {
  return value.length <= 4096
    && !value.includes("\0")
    && !/(?:^|\s)(?:[A-Za-z]:[\\/]|\\\\|\/Users\/|\/home\/|\/var\/|\/tmp\/)/.test(value)
    && sanitizeRelativeEvidenceIdentity(value) === value;
}

function compareManifestEntry(
  left: Pick<ReleaseCandidateManifestEntryDetail, "root" | "path">,
  right: Pick<ReleaseCandidateManifestEntryDetail, "root" | "path">
): number {
  return compareOrdinal(left.root, right.root) || compareOrdinal(left.path, right.path);
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value as object, key));
    }
    Object.freeze(value);
  }
  return value;
}

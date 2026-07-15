import { lstat, mkdtemp, readdir, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Stats } from "node:fs";
import { validateAddonName } from "./addon.js";
import {
  evaluateReleaseReadiness,
  evaluateReleaseScanCoverage,
  isReleaseTextPath,
  MAX_SECRET_SCAN_BYTES,
  sanitizeRelativeEvidenceIdentity,
  type ReleaseReadinessFinding,
  type ReleaseReadinessInput,
  type ReleaseScanCoverage
} from "./release-readiness.js";

export type ReleaseCandidateInput = {
  addonName: string;
  dotaRoot: string;
  tempParent: string;
};

export type ReleaseCandidateInputField =
  | "addonName"
  | "dotaRoot"
  | "repositoryRoot"
  | "tempParent"
  | "gameAddonRoot"
  | "contentAddonRoot";

export type ReleaseCandidateInputBlocker = {
  code: string;
  field: ReleaseCandidateInputField;
  category: "invalid" | "required" | "missing" | "not-directory" | "unreadable" | "unsafe-isolation";
};

const validatedReleaseCandidateInputBrand: unique symbol = Symbol("validatedReleaseCandidateInput");
const releaseCandidateFilesystemCapability: unique symbol = Symbol("releaseCandidateFilesystemCapability");
const releaseCandidateLeaseBrand: unique symbol = Symbol("releaseCandidateLease");
const identityBoundCandidateLifecycleBrand: unique symbol = Symbol("identityBoundCandidateLifecycle");

export type ValidatedReleaseCandidateInput = Readonly<{
  [validatedReleaseCandidateInputBrand]: true;
  [releaseCandidateFilesystemCapability]: ReleaseCandidateFilesystem;
  addonName: string;
  dotaRoot: string;
  repositoryRoot: string;
  tempParent: string;
  gameAddonRoot: string;
  contentAddonRoot: string;
}>;

export type ReleaseCandidateInputResult =
  | { ok: true; value: ValidatedReleaseCandidateInput }
  | { ok: false; blockers: ReleaseCandidateInputBlocker[] };

export type ReleaseCandidateEntryKind =
  | "file"
  | "directory"
  | "symbolic-link"
  | "reparse"
  | "special"
  | "unknown";

export type ReleaseCandidateSourceRoot = "game" | "content";

export type ReleaseCandidateSourceEntry = Readonly<{
  root: ReleaseCandidateSourceRoot;
  path: string;
  kind: "file" | "directory";
}>;

export type ReleaseCandidateInventoryBlocker = Readonly<{
  code: string;
  path: string;
  category: string;
}>;

export type ReleaseCandidateInventoryResult =
  | { ok: true; entries: ReleaseCandidateSourceEntry[] }
  | { ok: false; blockers: ReleaseCandidateInventoryBlocker[] };

export type ReleaseCandidateFilesystem = {
  reparsePointAware?: true;
  lstat(path: string): Promise<Pick<Stats, "isDirectory">>;
  realpath(path: string): Promise<string>;
  readDirectory(path: string): Promise<string[]>;
  classifySourceEntry(path: string): Promise<ReleaseCandidateEntryKind>;
  createCandidateRoot(input: ValidatedReleaseCandidateInput): Promise<string>;
  candidateLifecycle?: IdentityBoundCandidateLifecycle;
};

export type ReleaseCandidateDependencies = {
  repositoryRoot?: string;
  filesystem?: ReleaseCandidateFilesystem;
  platform?: NodeJS.Platform;
};

function createDefaultFilesystem(platform: NodeJS.Platform): ReleaseCandidateFilesystem {
  return {
    lstat,
    realpath,
    readDirectory: async (path) => await readdir(path),
    classifySourceEntry: platform === "win32"
      ? async () => "unknown"
      : classifySourceEntry,
    createCandidateRoot: async (input) => await mkdtemp(join(input.tempParent, "dota-release-candidate-"))
  };
}

export type ReleaseCandidateLifecycleBlocker = Readonly<{
  code: string;
  category:
    | "assembly"
    | "creation"
    | "inspection"
    | "integrity"
    | "integrity-duplicate"
    | "integrity-missing"
    | "integrity-unexpected"
    | "integrity-unobserved"
    | "integrity-wrong-kind"
    | "integrity-wrong-root"
    | "removal"
    | "unsafe-isolation"
    | "unexpected-entry";
  path?: string;
  count?: number;
}>;

export type ReleaseCandidateInclusionLedger = Readonly<{
  schemaVersion: "1.0";
  expectedFileCount: number;
  observedFileCount: number;
  matchedFileCount: number;
}>;

export type ReleaseCandidateManifestEntry = Readonly<{
  schemaVersion: "1.0";
  root: ReleaseCandidateSourceRoot;
  path: string;
  bytes: number;
  sha256: string;
}>;

export type ReleaseCandidateManifest = Readonly<{
  schemaVersion: "1.0";
  entries: readonly ReleaseCandidateManifestEntry[];
  combinedSha256: string;
}>;

export type ReleaseCandidateCleanupEvidence =
  | Readonly<{
      schemaVersion: "1.0";
      attempted: true;
      attempts: 1;
      status: "verified";
      identityMatched: true;
      removed: true;
      absent: true;
    }>
  | Readonly<{
      schemaVersion: "1.0";
      attempted: true;
      attempts: 1;
      status: "failed";
      code: CandidateLeaseCleanupFailureCode | "CANDIDATE_CLEANUP_RESULT_INVALID";
      identityMatched?: boolean;
      removed?: boolean;
      absent?: boolean;
    }>;

export type ReleaseCandidateLifecycleResult<T> =
  | {
      ok: true;
      value: T;
      manifest: ReleaseCandidateManifest;
      inclusionLedger: ReleaseCandidateInclusionLedger;
      scanCoverage: ReleaseScanCoverage;
      cleanup?: ReleaseCandidateCleanupEvidence;
    }
  | {
      ok: false;
      inclusionLedger?: ReleaseCandidateInclusionLedger;
      scanCoverage?: ReleaseScanCoverage;
      cleanup?: ReleaseCandidateCleanupEvidence;
      blockers: Array<
        ReleaseCandidateInputBlocker
        | ReleaseCandidateInventoryBlocker
        | ReleaseCandidateLifecycleBlocker
        | ReleaseReadinessFinding
      >;
    };

type ReleaseCandidateLifecycleFailure = Extract<ReleaseCandidateLifecycleResult<never>, { ok: false }>;
type AcceptedSourceObservation = Extract<AcceptedSourceObservationResult, { ok: true }>;
type AcceptedSourceObservations = ReadonlyMap<string, AcceptedSourceObservation>;
type FileIntegrityObservations = ReadonlyMap<string, FileIntegrityObservation>;
type CandidateIntegrityCapture = Readonly<{
  observations: FileIntegrityObservations;
  inclusionLedger: ReleaseCandidateInclusionLedger;
}>;
type CandidateIntegrityOccurrence = Readonly<{
  root: ReleaseCandidateSourceRoot;
  path: string;
  bytes: number;
  sha256: string;
  identityMatched: boolean;
  kindMatched: boolean;
}>;

export type ReleaseCandidateLease = Readonly<{
  [releaseCandidateLeaseBrand]: true;
}>;

export type CandidateLeaseCleanupFailureCode =
  | "CANDIDATE_IDENTITY_MISMATCH"
  | "CANDIDATE_REMOVAL_FAILED"
  | "CANDIDATE_ABSENCE_UNVERIFIED"
  | "CANDIDATE_LEASE_INVALID";

export type CandidateLeaseCleanupResult =
  | Readonly<{
      ok: true;
      removed: true;
      absent: true;
      identityMatched: true;
    }>
  | Readonly<{
      ok: false;
      removed: boolean;
      absent: boolean;
      identityMatched: boolean;
      code: CandidateLeaseCleanupFailureCode;
    }>;

export type CandidateLeaseAcquisitionResult =
  | Readonly<{
      ok: true;
      schemaVersion: "1.0";
      state: "acquired";
      inspectionRoot: string;
      lease: ReleaseCandidateLease;
    }>
  | Readonly<{
      ok: false;
      schemaVersion: "1.0";
      state: "not-created";
      code: "CANDIDATE_CREATION_FAILED" | "CANDIDATE_ACQUISITION_RESULT_INVALID";
    }>
  | Readonly<{
      ok: false;
      schemaVersion: "1.0";
      state: "created-failure";
      code: "CANDIDATE_ACQUISITION_RESULT_INVALID";
      cleanup: ReleaseCandidateCleanupEvidence;
    }>;

export type AcceptedSourceReadResult =
  | Readonly<{
      ok: true;
      schemaVersion: "1.0";
      state: "readable";
      size: number;
      bytes: Uint8Array;
      identityMatched: true;
      kindMatched: true;
      contained: true;
    }>
  | Readonly<{
      ok: true;
      schemaVersion: "1.0";
      state: "oversized";
      size: number;
      identityMatched: true;
      kindMatched: true;
      contained: true;
    }>
  | Readonly<{
      ok: true;
      schemaVersion: "1.0";
      state: "binary" | "unreadable";
      size: number;
      identityMatched: true;
      kindMatched: true;
      contained: true;
    }>
  | Readonly<{ ok: false; code: "SOURCE_FILE_IDENTITY_CHANGED" | "SOURCE_FILE_READ_FAILED" }>;

export type AcceptedSourceObservationResult =
  | Readonly<{
      ok: true;
      kind: "file" | "directory";
      canonicalPath: string;
      size: number;
      mtimeMs: number;
      ctimeMs: number;
      mode: number;
      identityMatched: true;
      contained: true;
    }>
  | Readonly<{ ok: false; code: "SOURCE_ENTRY_CHANGED" | "SOURCE_OBSERVATION_FAILED" }>;

export type FileIntegrityObservation = Readonly<{
  ok: true;
  schemaVersion: "1.0";
  root: ReleaseCandidateSourceRoot;
  path: string;
  bytes: number;
  sha256: string;
  identityMatched: true;
  kindMatched: true;
  contained: true;
}>;

export type SourceIntegrityObservationResult =
  | FileIntegrityObservation
  | Readonly<{ ok: false; code: "SOURCE_INTEGRITY_OBSERVATION_FAILED" | "SOURCE_INTEGRITY_IDENTITY_CHANGED" }>;

export type CandidateIntegrityObservationResult =
  | Readonly<{
      ok: true;
      schemaVersion: "1.0";
      observations: FileIntegrityObservation[];
    }>
  | Readonly<{ ok: false; code: "CANDIDATE_INTEGRITY_OBSERVATION_FAILED" | "CANDIDATE_INTEGRITY_IDENTITY_CHANGED" }>;

export type IdentityBoundIntegrityStreamInput = Readonly<{
  root: ReleaseCandidateSourceRoot;
  path: string;
  identityMatched: true;
  kindMatched: true;
  contained: true;
  openByteStream(): Promise<unknown> | unknown;
}>;

export type IdentityBoundIntegrityStreamResult =
  | FileIntegrityObservation
  | Readonly<{ ok: false; code: "INTEGRITY_STREAM_RESULT_INVALID" }>;

const MAX_INTEGRITY_STREAM_CHUNK_BYTES = 64 * 1024;

export async function observeIdentityBoundIntegrityStream(
  input: unknown
): Promise<IdentityBoundIntegrityStreamResult> {
  let iterator: object | undefined;
  let completed = false;
  try {
    if (input === null || typeof input !== "object") return invalidIntegrityStream();
    const root = Reflect.get(input, "root");
    const path = Reflect.get(input, "path");
    if (
      (root !== "game" && root !== "content")
      || typeof path !== "string"
      || !isSafeIntegrityIdentity(root, path)
      || Reflect.get(input, "identityMatched") !== true
      || Reflect.get(input, "kindMatched") !== true
      || Reflect.get(input, "contained") !== true
    ) return invalidIntegrityStream();
    const openByteStream = Reflect.get(input, "openByteStream");
    if (typeof openByteStream !== "function") return invalidIntegrityStream();
    const stream = await Reflect.apply(openByteStream, input, []);
    if (stream === null || typeof stream !== "object") return invalidIntegrityStream();
    if (stream instanceof Uint8Array) return invalidIntegrityStream();
    const createIterator = Reflect.get(stream, Symbol.asyncIterator);
    if (typeof createIterator !== "function") return invalidIntegrityStream();
    const foreignIterator = Reflect.apply(createIterator, stream, []);
    if (foreignIterator === null || typeof foreignIterator !== "object") return invalidIntegrityStream();
    iterator = foreignIterator;
    const next = Reflect.get(iterator, "next");
    if (typeof next !== "function") return invalidIntegrityStream();

    const hash = createHash("sha256");
    let bytes = 0;
    for (;;) {
      const step = await Reflect.apply(next, iterator, []);
      if (step === null || typeof step !== "object") return invalidIntegrityStream();
      const done = Reflect.get(step, "done");
      if (done === true) {
        completed = true;
        return {
          ok: true,
          schemaVersion: "1.0",
          root,
          path,
          bytes,
          sha256: hash.digest("hex"),
          identityMatched: true,
          kindMatched: true,
          contained: true
        };
      }
      if (done !== false) return invalidIntegrityStream();
      const chunk = Reflect.get(step, "value");
      if (!(chunk instanceof Uint8Array)) return invalidIntegrityStream();
      const chunkBytes = chunk.byteLength;
      if (chunkBytes <= 0 || chunkBytes > MAX_INTEGRITY_STREAM_CHUNK_BYTES) {
        return invalidIntegrityStream();
      }
      if (!Number.isSafeInteger(bytes + chunkBytes)) return invalidIntegrityStream();
      bytes += chunkBytes;
      hash.update(chunk);
    }
  } catch {
    return invalidIntegrityStream();
  } finally {
    if (!completed && iterator !== undefined) await closeIntegrityIterator(iterator);
  }
}

function isSafeIntegrityIdentity(root: ReleaseCandidateSourceRoot, path: string): boolean {
  if (!path.startsWith(`${root}/`) || path.startsWith("/") || path.startsWith("\\") || path.includes("\\")) {
    return false;
  }
  const segments = path.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function invalidIntegrityStream(): Extract<IdentityBoundIntegrityStreamResult, { ok: false }> {
  return { ok: false, code: "INTEGRITY_STREAM_RESULT_INVALID" };
}

async function closeIntegrityIterator(iterator: object): Promise<void> {
  try {
    const close = Reflect.get(iterator, "return");
    if (typeof close === "function") await Reflect.apply(close, iterator, []);
  } catch {
    // 失败结果已屏蔽外部异常，关闭异常不得覆盖稳定证据。
  }
}

export type CandidateMaterializationOperation = Readonly<{
  destination: string;
  kind: "file" | "directory";
  source: ReleaseCandidateSourceEntry;
}>;

export type CandidateMaterializationResult =
  | Readonly<{ ok: true; created: true; identityMatched: true; kindMatched: true; contained: true }>
  | Readonly<{
      ok: false;
      code:
        | "CANDIDATE_DESTINATION_IDENTITY_MISMATCH"
        | "CANDIDATE_DESTINATION_UNEXPECTED"
        | "CANDIDATE_MATERIALIZATION_FAILED"
        | "SOURCE_ENTRY_CHANGED";
    }>;

export type CandidateRootInspectionResult =
  | Readonly<{ ok: true; empty: true; identityMatched: true }>
  | Readonly<{
      ok: false;
      code: "CANDIDATE_ROOT_IDENTITY_MISMATCH" | "CANDIDATE_ROOT_INSPECTION_FAILED" | "CANDIDATE_ROOT_NOT_EMPTY";
      entries?: string[];
    }>;

export type CandidateExpectedEntry = Readonly<{ path: string; kind: "file" | "directory" }>;
export type CandidateTreeReconciliationResult =
  | Readonly<{ ok: true; exact: true; identityMatched: true }>
  | Readonly<{
      ok: false;
      code: "CANDIDATE_TREE_MISMATCH" | "CANDIDATE_TREE_RECONCILIATION_FAILED";
      issues?: Array<Readonly<{
        code: "CANDIDATE_TREE_MISSING" | "CANDIDATE_TREE_UNEXPECTED" | "CANDIDATE_TREE_WRONG_KIND" | "CANDIDATE_TREE_IDENTITY_INVALID";
        path: string;
        kind?: "file" | "directory";
      }>>;
    }>;

export type IdentityBoundCandidateLifecycle = Readonly<{
  [identityBoundCandidateLifecycleBrand]: true;
  identityBoundCleanup: true;
  identityBoundAssembly: boolean;
  createCandidateLease(input: ValidatedReleaseCandidateInput): Promise<CandidateLeaseAcquisitionResult>;
  cleanupCandidateLease(lease: ReleaseCandidateLease): Promise<CandidateLeaseCleanupResult>;
  readAcceptedSourceFile(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry,
    maxBytes: number
  ): Promise<AcceptedSourceReadResult>;
  observeAcceptedSourceEntry(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry
  ): Promise<AcceptedSourceObservationResult>;
  observeAcceptedSource(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry
  ): Promise<unknown>;
  observeCandidate(
    lease: ReleaseCandidateLease,
    expected: CandidateExpectedEntry[]
  ): Promise<unknown>;
  inspectCandidateRoot(lease: ReleaseCandidateLease): Promise<CandidateRootInspectionResult>;
  materializeCandidateEntry(
    lease: ReleaseCandidateLease,
    input: ValidatedReleaseCandidateInput,
    operation: CandidateMaterializationOperation
  ): Promise<CandidateMaterializationResult>;
  reconcileCandidateTree(
    lease: ReleaseCandidateLease,
    expected: CandidateExpectedEntry[]
  ): Promise<CandidateTreeReconciliationResult>;
}>;

export function createIdentityBoundCandidateLifecycle<TIdentity extends object>(operations: {
  createCandidateLease(
    input: ValidatedReleaseCandidateInput,
    recordCreated?: (created: Readonly<{ inspectionRoot: string; identity: TIdentity }>) => void
  ): Promise<unknown>;
  cleanupCandidateLease(identity: TIdentity): Promise<CandidateLeaseCleanupResult>;
  readAcceptedSourceFile?(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry,
    maxBytes: number
  ): Promise<AcceptedSourceReadResult>;
  observeAcceptedSourceEntry?(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry
  ): Promise<AcceptedSourceObservationResult>;
  observeAcceptedSource?(
    input: ValidatedReleaseCandidateInput,
    entry: ReleaseCandidateSourceEntry
  ): Promise<unknown>;
  observeCandidate?(
    identity: TIdentity,
    expected: CandidateExpectedEntry[]
  ): Promise<unknown>;
  inspectCandidateRoot?(identity: TIdentity): Promise<CandidateRootInspectionResult>;
  materializeCandidateEntry?(
    identity: TIdentity,
    input: ValidatedReleaseCandidateInput,
    operation: CandidateMaterializationOperation
  ): Promise<CandidateMaterializationResult>;
  reconcileCandidateTree?(
    identity: TIdentity,
    expected: CandidateExpectedEntry[]
  ): Promise<CandidateTreeReconciliationResult>;
}): IdentityBoundCandidateLifecycle {
  const identities = new WeakMap<ReleaseCandidateLease, TIdentity>();
  const createCandidateLease = operations.createCandidateLease.bind(operations);
  const cleanupCandidateLease = operations.cleanupCandidateLease.bind(operations);
  const readAcceptedSourceFile = operations.readAcceptedSourceFile?.bind(operations);
  const observeAcceptedSourceEntry = operations.observeAcceptedSourceEntry?.bind(operations);
  const observeAcceptedSource = operations.observeAcceptedSource?.bind(operations);
  const observeCandidate = operations.observeCandidate?.bind(operations);
  const inspectCandidateRoot = operations.inspectCandidateRoot?.bind(operations);
  const materializeCandidateEntry = operations.materializeCandidateEntry?.bind(operations);
  const reconcileCandidateTree = operations.reconcileCandidateTree?.bind(operations);
  const identityBoundAssembly = readAcceptedSourceFile !== undefined
    && observeAcceptedSourceEntry !== undefined
    && inspectCandidateRoot !== undefined
    && materializeCandidateEntry !== undefined
    && reconcileCandidateTree !== undefined;
  return Object.freeze({
    [identityBoundCandidateLifecycleBrand]: true as const,
    identityBoundCleanup: true as const,
    identityBoundAssembly,
    createCandidateLease: async (input) => {
      let recorded: Readonly<{ inspectionRoot: string; identity: TIdentity }> | undefined;
      let registrationInvalid = false;
      const recordCreated = (created: Readonly<{ inspectionRoot: string; identity: TIdentity }>): void => {
        if (recorded !== undefined || registrationInvalid) {
          registrationInvalid = true;
          return;
        }
        const parsed = parseCreatedCandidateIdentity<TIdentity>(created);
        if (parsed === undefined) {
          registrationInvalid = true;
          return;
        }
        recorded = parsed;
      };

      let returned: unknown;
      try {
        returned = await createCandidateLease(input, recordCreated);
      } catch {
        return recorded === undefined
          ? notCreatedAcquisitionFailure("CANDIDATE_CREATION_FAILED")
          : await cleanupFailedAcquisition(recorded.identity, cleanupCandidateLease);
      }

      const parsed = parseCreatedCandidateIdentity<TIdentity>(returned);
      if (
        registrationInvalid
        || parsed === undefined
        || (recorded !== undefined && (
          recorded.inspectionRoot !== parsed.inspectionRoot
          || recorded.identity !== parsed.identity
        ))
      ) {
        return recorded === undefined
          ? notCreatedAcquisitionFailure("CANDIDATE_ACQUISITION_RESULT_INVALID")
          : await cleanupFailedAcquisition(recorded.identity, cleanupCandidateLease);
      }

      const created = recorded ?? parsed;
      const lease = Object.freeze({ [releaseCandidateLeaseBrand]: true as const });
      identities.set(lease, created.identity);
      return Object.freeze({
        ok: true as const,
        schemaVersion: "1.0" as const,
        state: "acquired" as const,
        inspectionRoot: created.inspectionRoot,
        lease
      });
    },
    cleanupCandidateLease: async (lease) => {
      const identity = identities.get(lease);
      if (identity === undefined) {
        return {
          ok: false,
          removed: false,
          absent: false,
          identityMatched: false,
          code: "CANDIDATE_LEASE_INVALID"
        };
      }
      identities.delete(lease);
      return await cleanupCandidateLease(identity);
    },
    readAcceptedSourceFile: async (input, entry, maxBytes) => (
      readAcceptedSourceFile === undefined
        ? { ok: false, code: "SOURCE_FILE_READ_FAILED" }
        : await readAcceptedSourceFile(input, entry, maxBytes)
    ),
    observeAcceptedSourceEntry: async (input, entry) => (
      observeAcceptedSourceEntry === undefined
        ? { ok: false, code: "SOURCE_OBSERVATION_FAILED" }
        : await observeAcceptedSourceEntry(input, entry)
    ),
    observeAcceptedSource: async (input, entry) => (
      observeAcceptedSource === undefined
        ? { ok: false, code: "SOURCE_INTEGRITY_OBSERVATION_FAILED" }
        : await observeAcceptedSource(input, entry)
    ),
    observeCandidate: async (lease, expected) => {
      const identity = identities.get(lease);
      if (identity === undefined || observeCandidate === undefined) {
        return { ok: false, code: "CANDIDATE_INTEGRITY_IDENTITY_CHANGED" };
      }
      return await observeCandidate(identity, expected);
    },
    inspectCandidateRoot: async (lease) => {
      const identity = identities.get(lease);
      if (identity === undefined || inspectCandidateRoot === undefined) {
        return { ok: false, code: "CANDIDATE_ROOT_IDENTITY_MISMATCH" };
      }
      return await inspectCandidateRoot(identity);
    },
    materializeCandidateEntry: async (lease, input, operation) => {
      const identity = identities.get(lease);
      if (identity === undefined || materializeCandidateEntry === undefined) {
        return { ok: false, code: "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" };
      }
      return await materializeCandidateEntry(identity, input, operation);
    },
    reconcileCandidateTree: async (lease, expected) => {
      const identity = identities.get(lease);
      if (identity === undefined || reconcileCandidateTree === undefined) {
        return { ok: false, code: "CANDIDATE_TREE_RECONCILIATION_FAILED" };
      }
      return await reconcileCandidateTree(identity, expected);
    }
  });
}

function parseCreatedCandidateIdentity<TIdentity extends object>(
  value: unknown
): Readonly<{ inspectionRoot: string; identity: TIdentity }> | undefined {
  try {
    if (value === null || typeof value !== "object") return undefined;
    const inspectionRoot = Reflect.get(value, "inspectionRoot");
    const identity = Reflect.get(value, "identity");
    if (typeof inspectionRoot !== "string" || inspectionRoot.length === 0) return undefined;
    if (identity === null || typeof identity !== "object") return undefined;
    return Object.freeze({ inspectionRoot, identity: identity as TIdentity });
  } catch {
    return undefined;
  }
}

function notCreatedAcquisitionFailure(
  code: Extract<CandidateLeaseAcquisitionResult, { state: "not-created" }>["code"]
): Extract<CandidateLeaseAcquisitionResult, { state: "not-created" }> {
  return Object.freeze({ ok: false, schemaVersion: "1.0", state: "not-created", code });
}

async function cleanupFailedAcquisition<TIdentity extends object>(
  identity: TIdentity,
  cleanup: (identity: TIdentity) => Promise<CandidateLeaseCleanupResult>
): Promise<Extract<CandidateLeaseAcquisitionResult, { state: "created-failure" }>> {
  const evidence = await normalizeCandidateCleanupEvidence(async () => await cleanup(identity));
  return Object.freeze({
    ok: false,
    schemaVersion: "1.0",
    state: "created-failure",
    code: "CANDIDATE_ACQUISITION_RESULT_INVALID",
    cleanup: evidence
  });
}

type BoundCandidateLifecycle = Readonly<{
  lstat: ReleaseCandidateFilesystem["lstat"];
  realpath: ReleaseCandidateFilesystem["realpath"];
  createCandidateLease: IdentityBoundCandidateLifecycle["createCandidateLease"];
  cleanupCandidateLease: IdentityBoundCandidateLifecycle["cleanupCandidateLease"];
  readAcceptedSourceFile: IdentityBoundCandidateLifecycle["readAcceptedSourceFile"];
  observeAcceptedSourceEntry: IdentityBoundCandidateLifecycle["observeAcceptedSourceEntry"];
  observeAcceptedSource: IdentityBoundCandidateLifecycle["observeAcceptedSource"];
  observeCandidate: IdentityBoundCandidateLifecycle["observeCandidate"];
  inspectCandidateRoot: IdentityBoundCandidateLifecycle["inspectCandidateRoot"];
  materializeCandidateEntry: IdentityBoundCandidateLifecycle["materializeCandidateEntry"];
  reconcileCandidateTree: IdentityBoundCandidateLifecycle["reconcileCandidateTree"];
}>;

export type ReleaseCandidateContinuationResult<T> =
  | { ok: true; value: T }
  | { ok: false; blockers: ReleaseCandidateInputBlocker[] };

export async function continueReleaseCandidatePreparation<T>(
  input: ReleaseCandidateInput,
  dependencies: ReleaseCandidateDependencies,
  continuation: (validated: ValidatedReleaseCandidateInput) => Promise<T>
): Promise<ReleaseCandidateContinuationResult<T>> {
  const prepared = await prepareReleaseCandidateInput(input, dependencies);
  if (!prepared.ok) return prepared;
  return { ok: true, value: await continuation(prepared.value) };
}

export async function prepareReleaseCandidateInput(
  input: ReleaseCandidateInput,
  dependencies: ReleaseCandidateDependencies = {}
): Promise<ReleaseCandidateInputResult> {
  const addonValidation = validateAddonName(input?.addonName);
  if (!addonValidation.ok) {
    return blocked("INVALID_ADDON_NAME", "addonName", "invalid");
  }

  const platform = dependencies.platform ?? process.platform;
  if (platform === "win32" && dependencies.filesystem?.reparsePointAware !== true) {
    return blocked("WINDOWS_REPARSE_CLASSIFIER_REQUIRED", "dotaRoot", "unsafe-isolation");
  }

  const filesystem = dependencies.filesystem ?? createDefaultFilesystem(platform);
  const dotaRoot = await validateDirectory(input?.dotaRoot, "dotaRoot", "DOTA_ROOT", filesystem);
  if (!dotaRoot.ok) return dotaRoot.result;

  const repositoryRoot = await validateDirectory(
    dependencies.repositoryRoot ?? process.cwd(),
    "repositoryRoot",
    "REPOSITORY_ROOT",
    filesystem
  );
  if (!repositoryRoot.ok) return repositoryRoot.result;

  const tempParent = await validateDirectory(input?.tempParent, "tempParent", "TEMP_PARENT", filesystem);
  if (!tempParent.ok) return tempParent.result;

  const gameAddonRootPath = join(dotaRoot.path, "game", "dota_addons", input.addonName);
  const gameAddonRoot = await validateDirectory(gameAddonRootPath, "gameAddonRoot", "GAME_ADDON_ROOT", filesystem);
  if (!gameAddonRoot.ok) return gameAddonRoot.result;
  if (!isPathInside(gameAddonRoot.path, dotaRoot.path)) {
    return blocked("GAME_ADDON_ROOT_OUTSIDE_DOTA_ROOT", "gameAddonRoot", "unsafe-isolation");
  }

  const contentAddonRootPath = join(dotaRoot.path, "content", "dota_addons", input.addonName);
  const contentAddonRoot = await validateDirectory(
    contentAddonRootPath,
    "contentAddonRoot",
    "CONTENT_ADDON_ROOT",
    filesystem
  );
  if (!contentAddonRoot.ok) return contentAddonRoot.result;
  if (!isPathInside(contentAddonRoot.path, dotaRoot.path)) {
    return blocked("CONTENT_ADDON_ROOT_OUTSIDE_DOTA_ROOT", "contentAddonRoot", "unsafe-isolation");
  }

  const protectedRoots = [dotaRoot.path, repositoryRoot.path, gameAddonRoot.path, contentAddonRoot.path];
  if (protectedRoots.some((root) => isPathAtOrInside(tempParent.path, root))) {
    return blocked("TEMP_PARENT_NOT_ISOLATED", "tempParent", "unsafe-isolation");
  }

  return {
    ok: true,
    value: Object.freeze({
      [validatedReleaseCandidateInputBrand]: true as const,
      [releaseCandidateFilesystemCapability]: filesystem,
      addonName: input.addonName,
      dotaRoot: dotaRoot.path,
      repositoryRoot: repositoryRoot.path,
      tempParent: tempParent.path,
      gameAddonRoot: gameAddonRoot.path,
      contentAddonRoot: contentAddonRoot.path
    })
  };
}

export async function inventoryReleaseCandidateSources(
  input: ValidatedReleaseCandidateInput
): Promise<ReleaseCandidateInventoryResult> {
  const result = await inventoryReleaseCandidateSourcesInternal(input);
  if (!result.ok) return result;
  return {
    ok: true,
    entries: result.entries.map((entry) => ({
      ...entry,
      path: sanitizeRelativeEvidenceIdentity(entry.path)
    }))
  };
}

async function inventoryReleaseCandidateSourcesInternal(
  input: ValidatedReleaseCandidateInput
): Promise<ReleaseCandidateInventoryResult> {
  const filesystem = input[releaseCandidateFilesystemCapability];
  const entries: ReleaseCandidateSourceEntry[] = [];
  const blockers: ReleaseCandidateInventoryBlocker[] = [];
  const identities = new Map<string, Set<string>>();
  const roots: Array<{
    root: ReleaseCandidateSourceRoot;
    sourcePath: string;
    identity: string;
  }> = [
    {
      root: "game",
      sourcePath: input.gameAddonRoot,
      identity: `game/dota_addons/${input.addonName}`
    },
    {
      root: "content",
      sourcePath: input.contentAddonRoot,
      identity: `content/dota_addons/${input.addonName}`
    }
  ];

  for (const root of roots) {
    addIdentity(identities, root.identity);
    await inventorySourceDirectory({
      ...root,
      sourceRoot: root.sourcePath,
      segments: [],
      filesystem,
      entries,
      blockers,
      identities
    });
  }

  appendCollisionBlockers(identities, blockers);

  if (blockers.length > 0) {
    const sanitizedBlockers = blockers.map((blocker) => ({
      ...blocker,
      path: sanitizeRelativeEvidenceIdentity(blocker.path)
    }));
    sanitizedBlockers.sort(compareInventoryBlockers);
    return { ok: false, blockers: sanitizedBlockers };
  }

  entries.sort((left, right) => compareOrdinal(left.path, right.path));
  return { ok: true, entries };
}

export async function withAssembledReleaseCandidate<T>(
  input: ReleaseCandidateInput,
  inspect: (candidateRoot: string) => Promise<T>,
  dependencies: ReleaseCandidateDependencies = {}
): Promise<ReleaseCandidateLifecycleResult<T>> {
  const prepared = await prepareReleaseCandidateInput(input, dependencies);
  if (!prepared.ok) return prepared;

  const inventory = await inventoryReleaseCandidateSourcesInternal(prepared.value);
  if (!inventory.ok) return inventory;

  const filesystem = prepared.value[releaseCandidateFilesystemCapability];
  const capability = filesystem.candidateLifecycle;
  if (
    capability?.identityBoundCleanup !== true
    || capability[identityBoundCandidateLifecycleBrand] !== true
  ) {
    return lifecycleBlocked("IDENTITY_BOUND_CLEANUP_REQUIRED", "creation");
  }
  if (capability.identityBoundAssembly !== true) {
    return lifecycleBlocked("IDENTITY_BOUND_ASSEMBLY_REQUIRED", "creation");
  }
  const lifecycle = bindIdentityBoundCandidateLifecycle(filesystem);
  if (lifecycle === undefined) {
    return lifecycleBlocked("IDENTITY_BOUND_CLEANUP_REQUIRED", "creation");
  }
  const observations = await captureSourceObservations(prepared.value, inventory.entries, lifecycle);
  if (!observations.ok) return observations;
  const readiness = await releaseReadinessBlockers(prepared.value, inventory.entries, lifecycle);
  if (!readiness.ok) return readiness;
  if (readiness.blockers.length > 0) {
    return { ok: false, blockers: readiness.blockers, scanCoverage: readiness.scanCoverage };
  }
  const precreationStability = await verifySourceStability(
    prepared.value,
    inventory.entries,
    observations.value,
    lifecycle
  );
  if (precreationStability !== undefined) return withScanCoverage(precreationStability, readiness.scanCoverage);
  const sourceBefore = await captureSourceIntegrity(prepared.value, inventory.entries, lifecycle);
  if (!sourceBefore.ok) return withScanCoverage(sourceBefore, readiness.scanCoverage);

  let acquisition: CandidateLeaseAcquisitionResult;
  try {
    acquisition = await lifecycle.createCandidateLease(prepared.value);
  } catch {
    return withScanCoverage(lifecycleBlocked("CANDIDATE_CREATION_FAILED", "creation"), readiness.scanCoverage);
  }
  if (!acquisition.ok) {
    const failure = withScanCoverage(
      lifecycleBlocked(acquisition.code, "creation"),
      readiness.scanCoverage
    );
    return acquisition.state === "created-failure"
      ? { ...failure, cleanup: acquisition.cleanup }
      : failure;
  }

  let outcome: ReleaseCandidateLifecycleResult<T>;
  let cleanup: ReleaseCandidateCleanupEvidence;
  try {
    outcome = await inspectCandidateLease(
      acquisition.inspectionRoot,
      acquisition.lease,
      prepared.value,
      inventory.entries,
      observations.value,
      sourceBefore.value,
      readiness.scanCoverage,
      lifecycle,
      inspect
    );
  } finally {
    cleanup = await normalizeCandidateCleanupEvidence(
      async () => await lifecycle.cleanupCandidateLease(acquisition.lease)
    );
  }
  if (cleanup.status === "failed") {
    return {
      ok: false,
      blockers: [{ code: cleanup.code, category: "removal" }],
      cleanup
    };
  }
  return { ...outcome, cleanup };
}

function bindIdentityBoundCandidateLifecycle(
  filesystem: ReleaseCandidateFilesystem
): BoundCandidateLifecycle | undefined {
  const capability = filesystem.candidateLifecycle;
  if (
    capability?.identityBoundCleanup !== true
    || capability[identityBoundCandidateLifecycleBrand] !== true
    || capability.identityBoundAssembly !== true
  ) {
    return undefined;
  }
  return Object.freeze({
    lstat: filesystem.lstat.bind(filesystem),
    realpath: filesystem.realpath.bind(filesystem),
    createCandidateLease: capability.createCandidateLease.bind(capability),
    cleanupCandidateLease: capability.cleanupCandidateLease.bind(capability),
    readAcceptedSourceFile: capability.readAcceptedSourceFile.bind(capability),
    observeAcceptedSourceEntry: capability.observeAcceptedSourceEntry.bind(capability),
    observeAcceptedSource: capability.observeAcceptedSource.bind(capability),
    observeCandidate: capability.observeCandidate.bind(capability),
    inspectCandidateRoot: capability.inspectCandidateRoot.bind(capability),
    materializeCandidateEntry: capability.materializeCandidateEntry.bind(capability),
    reconcileCandidateTree: capability.reconcileCandidateTree.bind(capability)
  });
}

async function inspectCandidateLease<T>(
  inspectionRoot: string,
  lease: ReleaseCandidateLease,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  observations: AcceptedSourceObservations,
  sourceBefore: FileIntegrityObservations,
  scanCoverage: ReleaseScanCoverage,
  lifecycle: BoundCandidateLifecycle,
  inspect: (candidateRoot: string) => Promise<T>
): Promise<ReleaseCandidateLifecycleResult<T>> {
  let root: string;
  try {
    root = resolve(inspectionRoot);
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
  }

  if (!isPathInside(root, input.tempParent)) {
    return lifecycleBlocked("CANDIDATE_ROOT_NOT_OWNED", "unsafe-isolation");
  }

  try {
    const stats = await parseDirectoryAdapterResult(async () => await lifecycle.lstat(root));
    if (stats === "invalid") {
      return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
    }
    if (stats === "not-directory") {
      return lifecycleBlocked("CANDIDATE_ROOT_NOT_OWNED", "unsafe-isolation");
    }
    const canonicalRoot = await parseCanonicalPathAdapterResult(
      async () => await lifecycle.realpath(root)
    );
    if (canonicalRoot === undefined) {
      return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
    }
    if (!isCandidateRootIsolated(canonicalRoot, input)) {
      return lifecycleBlocked("CANDIDATE_ROOT_NOT_ISOLATED", "unsafe-isolation");
    }
    const unexpectedEntries = await parseCandidateRootInspection(
      async () => await lifecycle.inspectCandidateRoot(lease)
    );
    if (unexpectedEntries !== undefined) return unexpectedEntries;
    const preassemblyStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (preassemblyStability !== undefined) return preassemblyStability;
    const assemblyFailure = await assembleReleaseCandidate(lease, input, inventory, observations, lifecycle);
    if (assemblyFailure !== undefined) return assemblyFailure;
    const postassemblyStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (postassemblyStability !== undefined) return postassemblyStability;
    const reconciliationFailure = await reconcileReleaseCandidate(lease, input, inventory, lifecycle);
    if (reconciliationFailure !== undefined) return reconciliationFailure;
    const prereviewStability = await verifySourceStability(input, inventory, observations, lifecycle);
    if (prereviewStability !== undefined) return prereviewStability;
    const expected = expectedCandidateTree(input, inventory);
    const candidateBefore = await captureCandidateIntegrity(lease, expected, inventory, sourceBefore, lifecycle);
    if (!candidateBefore.ok) return candidateBefore;
    if (!sameIntegritySets(sourceBefore, candidateBefore.value.observations)) return integrityMismatch();
    let value: T | undefined;
    let inspectionFailed = false;
    try {
      value = await inspect(canonicalRoot);
    } catch {
      inspectionFailed = true;
    }
    const finalStability = await verifySourceStability(input, inventory, observations, lifecycle);
    const candidateAfter = await captureCandidateIntegrity(lease, expected, inventory, sourceBefore, lifecycle);
    const sourceAfter = await captureSourceIntegrity(input, inventory, lifecycle);
    const finalReconciliation = await reconcileReleaseCandidate(lease, input, inventory, lifecycle);
    const sourceIntegrityChanged = sourceAfter.ok
      && !sameIntegritySets(sourceBefore, sourceAfter.value);
    const candidateIntegrityChanged = candidateAfter.ok
      && !sameIntegritySets(sourceBefore, candidateAfter.value.observations);
    const primaryFailure = sourceIntegrityChanged || candidateIntegrityChanged
      ? integrityMismatch()
      : finalStability
        ?? finalReconciliation
        ?? (!sourceAfter.ok ? sourceAfter : undefined);
    if (primaryFailure !== undefined) return composeFinalFailure(primaryFailure, candidateAfter);
    if (!candidateAfter.ok) return candidateAfter;
    if (inspectionFailed) return lifecycleBlocked("CANDIDATE_INSPECTION_FAILED", "inspection");
    const manifest = projectReleaseCandidateManifest(inventory, candidateAfter.value.observations);
    if (manifest === undefined) {
      return lifecycleBlocked("CANDIDATE_MANIFEST_PROJECTION_FAILED", "integrity");
    }
    return {
      ok: true,
      value: value as T,
      manifest,
      inclusionLedger: candidateAfter.value.inclusionLedger,
      scanCoverage
    };
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_UNREADABLE", "unsafe-isolation");
  }
}

async function parseCandidateRootInspection(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
    }
    const ok = Reflect.get(result, "ok");
    if (
      ok === true
      && Reflect.get(result, "empty") === true
      && Reflect.get(result, "identityMatched") === true
    ) return undefined;
    const code = Reflect.get(result, "code");
    if (ok !== false || typeof code !== "string") {
      return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
    }
    if (code === "CANDIDATE_ROOT_NOT_EMPTY") {
      const entries = Reflect.get(result, "entries");
      if (!Array.isArray(entries) || entries.length === 0 || !entries.every((entry) => typeof entry === "string")) {
        return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
      }
      return {
        ok: false,
        blockers: [...entries].sort(compareOrdinal).map((entry) => ({
          code: "CANDIDATE_ROOT_NOT_EMPTY",
          category: "unexpected-entry" as const,
          path: safeCandidateEntryIdentity(entry)
        }))
      };
    }
    if (code === "CANDIDATE_ROOT_IDENTITY_MISMATCH") {
      return lifecycleBlocked(code, "unsafe-isolation");
    }
    if (code === "CANDIDATE_ROOT_INSPECTION_FAILED") {
      return lifecycleBlocked(code, "inspection");
    }
  } catch {
    return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
  }
  return lifecycleBlocked("CANDIDATE_ROOT_INSPECTION_RESULT_INVALID", "unsafe-isolation");
}

function safeCandidateEntryIdentity(name: string): string {
  if (invalidSourceNameCategory(name) !== undefined) return "[invalid]";
  return sanitizeRelativeEvidenceIdentity(name);
}

async function assembleReleaseCandidate(
  lease: ReleaseCandidateLease,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  const fixedDirectories = [
    { path: "content", root: "content" as const },
    { path: "content/dota_addons", root: "content" as const },
    { path: `content/dota_addons/${input.addonName}`, root: "content" as const },
    { path: "game", root: "game" as const },
    { path: "game/dota_addons", root: "game" as const },
    { path: `game/dota_addons/${input.addonName}`, root: "game" as const }
  ];

  for (const directory of fixedDirectories) {
    const failure = await parseCandidateMaterialization(async () => (
      await lifecycle.materializeCandidateEntry(lease, input, {
        destination: directory.path,
        kind: "directory",
        source: { root: directory.root, path: `${directory.root}/dota_addons/${input.addonName}`, kind: "directory" }
      })
    ));
    if (failure !== undefined) return failure;
  }

  for (const entry of inventory) {
    const beforeUse = await verifySourceEntryObservation(input, entry, observations, lifecycle);
    if (beforeUse !== undefined) return beforeUse;
    const failure = await parseCandidateMaterialization(async () => (
      await lifecycle.materializeCandidateEntry(lease, input, {
        destination: entry.path,
        kind: entry.kind,
        source: entry
      })
    ));
    if (failure !== undefined) return failure;
    const afterUse = await verifySourceEntryObservation(input, entry, observations, lifecycle);
    if (afterUse !== undefined) return afterUse;
  }
  return undefined;
}

async function parseCandidateMaterialization(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleResult<never> | undefined> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
    }
    if (
      Reflect.get(result, "ok") === true
      && Reflect.get(result, "created") === true
      && Reflect.get(result, "identityMatched") === true
      && Reflect.get(result, "kindMatched") === true
      && Reflect.get(result, "contained") === true
    ) return undefined;
    const code = Reflect.get(result, "code");
    if (Reflect.get(result, "ok") !== false || typeof code !== "string") {
      return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
    }
    if (code === "CANDIDATE_DESTINATION_IDENTITY_MISMATCH" || code === "CANDIDATE_DESTINATION_UNEXPECTED") {
      return lifecycleBlocked(code, "unsafe-isolation");
    }
    if (code === "SOURCE_ENTRY_CHANGED") return sourceChangedDuringAssembly();
    if (code === "CANDIDATE_MATERIALIZATION_FAILED") return lifecycleBlocked(code, "assembly");
  } catch {
    return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
  }
  return lifecycleBlocked("CANDIDATE_MATERIALIZATION_RESULT_INVALID", "assembly");
}

async function reconcileReleaseCandidate(
  lease: ReleaseCandidateLease,
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleFailure | undefined> {
  const expected = expectedCandidateTree(input, inventory);
  return await parseCandidateReconciliation(
    async () => await lifecycle.reconcileCandidateTree(lease, expected)
  );
}

function expectedCandidateTree(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[]
): CandidateExpectedEntry[] {
  const fixed = [
    "content",
    "content/dota_addons",
    `content/dota_addons/${input.addonName}`,
    "game",
    "game/dota_addons",
    `game/dota_addons/${input.addonName}`
  ].map((path) => ({ path, kind: "directory" as const }));
  return [...fixed, ...inventory.map((entry) => ({ path: entry.path, kind: entry.kind }))]
    .sort((left, right) => compareOrdinal(left.path, right.path));
}

async function captureSourceIntegrity(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<{ ok: true; value: FileIntegrityObservations } | ReleaseCandidateLifecycleFailure> {
  const occurrences: FileIntegrityObservation[] = [];
  for (const entry of inventory) {
    if (entry.kind !== "file") continue;
    const parsed = await parseFileIntegrityObservation(
      async () => await lifecycle.observeAcceptedSource(input, entry),
      entry,
      "SOURCE_INTEGRITY_RESULT_INVALID"
    );
    if (!parsed.ok) return parsed;
    occurrences.push(parsed.value);
  }
  return {
    ok: true,
    value: new Map(occurrences.map((observation) => [observation.path, observation]))
  };
}

async function captureCandidateIntegrity(
  lease: ReleaseCandidateLease,
  expectedTree: CandidateExpectedEntry[],
  inventory: ReleaseCandidateSourceEntry[],
  sourceBefore: FileIntegrityObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<{ ok: true; value: CandidateIntegrityCapture } | ReleaseCandidateLifecycleFailure> {
  const expectedFiles = inventory.filter((entry) => entry.kind === "file");
  try {
    const result = await lifecycle.observeCandidate(lease, expectedTree);
    if (
      result === null
      || typeof result !== "object"
      || Reflect.get(result, "ok") !== true
      || Reflect.get(result, "schemaVersion") !== "1.0"
    ) return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    const foreign = Reflect.get(result, "observations");
    if (!Array.isArray(foreign)) {
      return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    }
    if (typeof Reflect.get(foreign, Symbol.iterator) !== "function") {
      return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    }
    const length = Reflect.get(foreign, "length");
    if (!Number.isSafeInteger(length) || (length as number) < 0) {
      return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    }

    const occurrences: CandidateIntegrityOccurrence[] = [];
    for (let index = 0; index < length; index += 1) {
      const foreignObservation = Reflect.get(foreign, String(index));
      const parsed = parseCandidateIntegrityOccurrence(foreignObservation);
      if (!parsed.ok) return parsed;
      occurrences.push(parsed.value);
    }
    return reconcileCandidateIntegrityOccurrences(expectedFiles, sourceBefore, occurrences);
  } catch {
    return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
  }
}

function parseCandidateIntegrityOccurrence(
  result: unknown
): { ok: true; value: CandidateIntegrityOccurrence } | ReleaseCandidateLifecycleFailure {
  try {
    if (result === null || typeof result !== "object" || Reflect.get(result, "ok") !== true) {
      return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    }
    const schemaVersion = Reflect.get(result, "schemaVersion");
    const root = Reflect.get(result, "root");
    const path = Reflect.get(result, "path");
    const bytes = Reflect.get(result, "bytes");
    const sha256 = Reflect.get(result, "sha256");
    const identityMatched = Reflect.get(result, "identityMatched");
    const kindMatched = Reflect.get(result, "kindMatched");
    if (
      schemaVersion !== "1.0"
      || (root !== "game" && root !== "content")
      || typeof path !== "string"
      || !isSafeCandidateLedgerPath(path)
      || !Number.isSafeInteger(bytes)
      || (bytes as number) < 0
      || typeof sha256 !== "string"
      || !/^[0-9a-f]{64}$/.test(sha256)
      || (identityMatched !== true && identityMatched !== false)
      || (kindMatched !== true && kindMatched !== false)
      || Reflect.get(result, "contained") !== true
    ) return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    return {
      ok: true,
      value: {
        root,
        path,
        bytes: bytes as number,
        sha256,
        identityMatched,
        kindMatched
      }
    };
  } catch {
    return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
  }
}

function reconcileCandidateIntegrityOccurrences(
  expectedFiles: ReleaseCandidateSourceEntry[],
  sourceBefore: FileIntegrityObservations,
  inputOccurrences: CandidateIntegrityOccurrence[]
): { ok: true; value: CandidateIntegrityCapture } | ReleaseCandidateLifecycleFailure {
  const occurrences = [...inputOccurrences].sort((left, right) => (
    compareOrdinal(left.root, right.root)
    || compareOrdinal(left.path, right.path)
    || compareOrdinal(left.sha256, right.sha256)
    || left.bytes - right.bytes
  ));
  const expected = expectedFiles.map((entry) => ({ root: entry.root, path: entry.path }))
    .sort((left, right) => compareOrdinal(left.root, right.root) || compareOrdinal(left.path, right.path));
  if (sourceBefore.size !== expected.length) {
    return lifecycleBlocked("SOURCE_INTEGRITY_RESULT_INVALID", "integrity");
  }
  const blockers: ReleaseCandidateLifecycleBlocker[] = [];
  let matchedFileCount = 0;

  for (const file of expected) {
    const samePath = occurrences.filter((occurrence) => occurrence.path === file.path);
    const exact = samePath.filter((occurrence) => occurrence.root === file.root);
    const wrongRootCount = samePath.filter((occurrence) => occurrence.root !== file.root).length;
    if (wrongRootCount > 0) {
      blockers.push(candidateLedgerBlocker(
        "CANDIDATE_LEDGER_WRONG_ROOT",
        "integrity-wrong-root",
        file.path,
        wrongRootCount
      ));
    }
    if (exact.length === 0 && wrongRootCount === 0) {
      blockers.push(candidateLedgerBlocker(
        "CANDIDATE_LEDGER_MISSING",
        "integrity-missing",
        file.path,
        0
      ));
      continue;
    }
    if (exact.length > 1) {
      blockers.push(candidateLedgerBlocker(
        "CANDIDATE_LEDGER_DUPLICATE",
        "integrity-duplicate",
        file.path,
        exact.length
      ));
    }
    const wrongKindCount = exact.filter((occurrence) => !occurrence.kindMatched).length;
    if (wrongKindCount > 0) {
      blockers.push(candidateLedgerBlocker(
        "CANDIDATE_LEDGER_WRONG_KIND",
        "integrity-wrong-kind",
        file.path,
        wrongKindCount
      ));
    }
    const unobservedCount = exact.filter((occurrence) => !occurrence.identityMatched).length;
    if (unobservedCount > 0) {
      blockers.push(candidateLedgerBlocker(
        "CANDIDATE_LEDGER_UNOBSERVED",
        "integrity-unobserved",
        file.path,
        unobservedCount
      ));
    }
    if (
      samePath.length === 1
      && exact.length === 1
      && exact[0]?.kindMatched === true
      && exact[0].identityMatched === true
    ) {
      matchedFileCount += 1;
    }
  }

  const unexpected = occurrences.filter((occurrence) => (
    !expected.some((file) => file.path === occurrence.path)
  ));
  for (let index = 0; index < unexpected.length;) {
    const occurrence = unexpected[index];
    if (occurrence === undefined) break;
    let count = 1;
    while (
      unexpected[index + count]?.root === occurrence.root
      && unexpected[index + count]?.path === occurrence.path
    ) count += 1;
    blockers.push(candidateLedgerBlocker(
      "CANDIDATE_LEDGER_UNEXPECTED",
      "integrity-unexpected",
      occurrence.path,
      count
    ));
    index += count;
  }

  blockers.sort(compareCandidateLedgerBlockers);
  const inclusionLedger = Object.freeze({
    schemaVersion: "1.0" as const,
    expectedFileCount: expected.length,
    observedFileCount: occurrences.length,
    matchedFileCount
  });
  if (blockers.length > 0) return { ok: false, inclusionLedger, blockers };
  const accepted = new Map<string, FileIntegrityObservation>();
  for (const file of expected) {
    const occurrence = occurrences.find((candidate) => (
      candidate.root === file.root && candidate.path === file.path
    ));
    if (occurrence === undefined) {
      return lifecycleBlocked("CANDIDATE_INTEGRITY_RESULT_INVALID", "integrity");
    }
    accepted.set(file.path, {
      ok: true,
      schemaVersion: "1.0",
      root: occurrence.root,
      path: occurrence.path,
      bytes: occurrence.bytes,
      sha256: occurrence.sha256,
      identityMatched: true,
      kindMatched: true,
      contained: true
    });
  }
  return {
    ok: true,
    value: Object.freeze({
      observations: accepted,
      inclusionLedger
    })
  };
}

function candidateLedgerBlocker(
  code: string,
  category: ReleaseCandidateLifecycleBlocker["category"],
  path: string,
  count: number
): ReleaseCandidateLifecycleBlocker {
  return Object.freeze({
    code,
    category,
    path: safeCandidateTreeIdentity(path),
    count
  });
}

function compareCandidateLedgerBlockers(
  left: ReleaseCandidateLifecycleBlocker,
  right: ReleaseCandidateLifecycleBlocker
): number {
  const priorities: Record<string, number> = {
    "integrity-duplicate": 0,
    "integrity-wrong-root": 1,
    "integrity-wrong-kind": 2,
    "integrity-unobserved": 3,
    "integrity-missing": 4,
    "integrity-unexpected": 5
  };
  return (priorities[left.category] ?? Number.MAX_SAFE_INTEGER)
    - (priorities[right.category] ?? Number.MAX_SAFE_INTEGER)
    || compareOrdinal(left.path ?? "", right.path ?? "")
    || compareOrdinal(left.code, right.code);
}

function isSafeCandidateLedgerPath(path: string): boolean {
  if (
    (!path.startsWith("game/") && !path.startsWith("content/"))
    || path.startsWith("/")
    || path.startsWith("\\")
    || path.includes("\\")
  ) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

async function parseFileIntegrityObservation(
  acquire: () => Promise<unknown>,
  expected: Pick<ReleaseCandidateSourceEntry, "root" | "path">,
  invalidCode: string
): Promise<{ ok: true; value: FileIntegrityObservation } | ReleaseCandidateLifecycleFailure> {
  try {
    return parseFileIntegrityObservationValue(await acquire(), expected, invalidCode);
  } catch {
    return lifecycleBlocked(invalidCode, "integrity");
  }
}

function parseFileIntegrityObservationValue(
  result: unknown,
  expected: Pick<ReleaseCandidateSourceEntry, "root" | "path">,
  invalidCode: string
): { ok: true; value: FileIntegrityObservation } | ReleaseCandidateLifecycleFailure {
  try {
    if (result === null || typeof result !== "object" || Reflect.get(result, "ok") !== true) {
      return lifecycleBlocked(invalidCode, "integrity");
    }
    const schemaVersion = Reflect.get(result, "schemaVersion");
    const root = Reflect.get(result, "root");
    const path = Reflect.get(result, "path");
    const bytes = Reflect.get(result, "bytes");
    const sha256 = Reflect.get(result, "sha256");
    if (
      schemaVersion !== "1.0"
      || root !== expected.root
      || path !== expected.path
      || !Number.isSafeInteger(bytes)
      || (bytes as number) < 0
      || typeof sha256 !== "string"
      || !/^[0-9a-f]{64}$/.test(sha256)
      || Reflect.get(result, "identityMatched") !== true
      || Reflect.get(result, "kindMatched") !== true
      || Reflect.get(result, "contained") !== true
    ) return lifecycleBlocked(invalidCode, "integrity");
    return {
      ok: true,
      value: {
        ok: true,
        schemaVersion: "1.0",
        root,
        path,
        bytes: bytes as number,
        sha256,
        identityMatched: true,
        kindMatched: true,
        contained: true
      }
    };
  } catch {
    return lifecycleBlocked(invalidCode, "integrity");
  }
}

function sameIntegritySets(
  expected: FileIntegrityObservations,
  observed: FileIntegrityObservations
): boolean {
  if (expected.size !== observed.size) return false;
  for (const [path, baseline] of expected) {
    const current = observed.get(path);
    if (
      current === undefined
      || current.root !== baseline.root
      || current.path !== baseline.path
      || current.bytes !== baseline.bytes
      || current.sha256 !== baseline.sha256
    ) return false;
  }
  return true;
}

function projectReleaseCandidateManifest(
  inventory: ReleaseCandidateSourceEntry[],
  finalCandidate: FileIntegrityObservations
): ReleaseCandidateManifest | undefined {
  const entries: ReleaseCandidateManifestEntry[] = [];
  for (const accepted of inventory) {
    if (accepted.kind !== "file") continue;
    const observed = finalCandidate.get(accepted.path);
    if (
      observed === undefined
      || observed.root !== accepted.root
      || observed.path !== accepted.path
    ) return undefined;
    entries.push(Object.freeze({
      schemaVersion: "1.0",
      root: accepted.root,
      path: accepted.path,
      bytes: observed.bytes,
      sha256: observed.sha256
    }));
  }
  if (entries.length !== finalCandidate.size) return undefined;
  entries.sort((left, right) => (
    compareOrdinal(left.root, right.root) || compareOrdinal(left.path, right.path)
  ));
  const canonical = [
    "1.0",
    entries.map((entry) => [entry.root, entry.path, entry.bytes, entry.sha256])
  ];
  const combinedSha256 = createHash("sha256")
    .update(Buffer.from(JSON.stringify(canonical), "utf8"))
    .digest("hex");
  return Object.freeze({
    schemaVersion: "1.0",
    entries: Object.freeze(entries),
    combinedSha256
  });
}

function integrityMismatch(): ReleaseCandidateLifecycleFailure {
  return lifecycleBlocked("RELEASE_CANDIDATE_INTEGRITY_MISMATCH", "integrity");
}

function composeFinalFailure(
  primary: ReleaseCandidateLifecycleFailure,
  candidate: { ok: true; value: CandidateIntegrityCapture } | ReleaseCandidateLifecycleFailure
): ReleaseCandidateLifecycleFailure {
  if (candidate.ok) return primary;
  return {
    ok: false,
    ...(candidate.inclusionLedger === undefined ? {} : { inclusionLedger: candidate.inclusionLedger }),
    blockers: [...primary.blockers, ...candidate.blockers]
  };
}

async function parseCandidateReconciliation(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateLifecycleFailure | undefined> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
    }
    if (
      Reflect.get(result, "ok") === true
      && Reflect.get(result, "exact") === true
      && Reflect.get(result, "identityMatched") === true
    ) return undefined;
    if (Reflect.get(result, "ok") !== false || Reflect.get(result, "code") !== "CANDIDATE_TREE_MISMATCH") {
      return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
    }
    const issues = Reflect.get(result, "issues");
    if (!Array.isArray(issues) || issues.length === 0) {
      return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
    }
    const blockers: ReleaseCandidateLifecycleBlocker[] = [];
    for (const issue of issues) {
      if (issue === null || typeof issue !== "object") {
        return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
      }
      const code = Reflect.get(issue, "code");
      const path = Reflect.get(issue, "path");
      if (
        typeof path !== "string"
        || ![
          "CANDIDATE_TREE_MISSING",
          "CANDIDATE_TREE_UNEXPECTED",
          "CANDIDATE_TREE_WRONG_KIND",
          "CANDIDATE_TREE_IDENTITY_INVALID"
        ].includes(code)
      ) {
        return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
      }
      blockers.push({
        code,
        category: code === "CANDIDATE_TREE_UNEXPECTED" ? "unexpected-entry" : "assembly",
        path: safeCandidateTreeIdentity(path)
      });
    }
    blockers.sort((left, right) => compareOrdinal(left.path ?? "", right.path ?? "") || compareOrdinal(left.code, right.code));
    return { ok: false, blockers };
  } catch {
    return lifecycleBlocked("CANDIDATE_TREE_RECONCILIATION_RESULT_INVALID", "assembly");
  }
}

function safeCandidateTreeIdentity(path: string): string {
  if (path.length === 0 || path.startsWith("/") || path.startsWith("\\") || path.includes("\\")) return "[invalid]";
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return "[invalid]";
  return segments.map(safeCandidateEntryIdentity).join("/");
}

async function captureSourceObservations(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<{ ok: true; value: AcceptedSourceObservations } | ReleaseCandidateLifecycleFailure> {
  const observations = new Map<string, AcceptedSourceObservation>();
  for (const entry of sourceEntriesWithRoots(input, inventory)) {
    const observed = await parseAcceptedSourceObservation(
      async () => await lifecycle.observeAcceptedSourceEntry(input, entry)
    );
    if (!observed.ok) return observed;
    observations.set(entry.path, observed.value);
  }
  return { ok: true, value: observations };
}

async function verifySourceStability(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleFailure | undefined> {
  const rewalk = await inventoryReleaseCandidateSources(input);
  if (!rewalk.ok) return rewalk;
  if (!sameSourceInventory(inventory, rewalk.entries)) return sourceChangedDuringAssembly();
  for (const entry of sourceEntriesWithRoots(input, inventory)) {
    const failure = await verifySourceEntryObservation(input, entry, observations, lifecycle);
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function sourceEntriesWithRoots(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[]
): ReleaseCandidateSourceEntry[] {
  return [
    { root: "content", path: `content/dota_addons/${input.addonName}`, kind: "directory" },
    { root: "game", path: `game/dota_addons/${input.addonName}`, kind: "directory" },
    ...inventory
  ];
}

async function verifySourceEntryObservation(
  input: ValidatedReleaseCandidateInput,
  entry: ReleaseCandidateSourceEntry,
  observations: AcceptedSourceObservations,
  lifecycle: BoundCandidateLifecycle
): Promise<ReleaseCandidateLifecycleFailure | undefined> {
  const accepted = observations.get(entry.path);
  if (accepted === undefined) return sourceChangedDuringAssembly();
  const current = await parseAcceptedSourceObservation(
    async () => await lifecycle.observeAcceptedSourceEntry(input, entry)
  );
  if (!current.ok || !sameSourceObservation(accepted, current.value)) {
    return sourceChangedDuringAssembly();
  }
  return undefined;
}

async function parseAcceptedSourceObservation(
  acquire: () => Promise<unknown>
): Promise<{ ok: true; value: AcceptedSourceObservation } | ReleaseCandidateLifecycleFailure> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object" || Reflect.get(result, "ok") !== true) {
      return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
    }
    const kind = Reflect.get(result, "kind");
    const canonicalPath = Reflect.get(result, "canonicalPath");
    const size = Reflect.get(result, "size");
    const mtimeMs = Reflect.get(result, "mtimeMs");
    const ctimeMs = Reflect.get(result, "ctimeMs");
    const mode = Reflect.get(result, "mode");
    if (
      (kind !== "file" && kind !== "directory")
      || typeof canonicalPath !== "string"
      || canonicalPath.length === 0
      || !Number.isSafeInteger(size)
      || size < 0
      || typeof mtimeMs !== "number"
      || !Number.isFinite(mtimeMs)
      || typeof ctimeMs !== "number"
      || !Number.isFinite(ctimeMs)
      || !Number.isSafeInteger(mode)
      || mode < 0
      || Reflect.get(result, "identityMatched") !== true
      || Reflect.get(result, "contained") !== true
    ) return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
    return {
      ok: true,
      value: {
        ok: true,
        kind,
        canonicalPath,
        size,
        mtimeMs,
        ctimeMs,
        mode,
        identityMatched: true,
        contained: true
      }
    };
  } catch {
    return lifecycleBlocked("SOURCE_OBSERVATION_RESULT_INVALID", "assembly");
  }
}

function sameSourceInventory(
  accepted: ReleaseCandidateSourceEntry[],
  current: ReleaseCandidateSourceEntry[]
): boolean {
  return accepted.length === current.length && accepted.every((entry, index) => {
    const candidate = current[index];
    return candidate !== undefined
      && entry.root === candidate.root
      && entry.path === candidate.path
      && entry.kind === candidate.kind;
  });
}

function sameSourceObservation(
  accepted: AcceptedSourceObservation,
  current: AcceptedSourceObservation
): boolean {
  if (
    accepted.kind !== current.kind
    || accepted.canonicalPath !== current.canonicalPath
    || accepted.size !== current.size
    || accepted.mtimeMs !== current.mtimeMs
    || accepted.ctimeMs !== current.ctimeMs
    || accepted.mode !== current.mode
  ) return false;
  return true;
}

function sourceChangedDuringAssembly(): ReleaseCandidateLifecycleFailure {
  return lifecycleBlocked("SOURCE_CHANGED_DURING_ASSEMBLY", "assembly");
}

async function releaseReadinessBlockers(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<
  | { ok: true; blockers: ReleaseReadinessFinding[]; scanCoverage: ReleaseScanCoverage }
  | ReleaseCandidateLifecycleFailure
> {
  const collected = await collectReleaseReadinessInput(input, inventory, lifecycle);
  if (!collected.ok) return collected;
  const blockers = evaluateReleaseReadiness(collected.value)
    .filter((finding) => finding.disposition === "blocker");
  const scanCoverage = evaluateReleaseScanCoverage(collected.value);
  if (!scanCoverage.ok) return { ok: false, blockers: [...scanCoverage.blockers] };
  const unique = new Map<string, ReleaseReadinessFinding>();
  for (const blocker of blockers) unique.set(JSON.stringify(blocker), blocker);
  return {
    ok: true,
    blockers: [...unique.values()],
    scanCoverage: scanCoverage.value
  };
}

async function collectReleaseReadinessInput(
  input: ValidatedReleaseCandidateInput,
  inventory: ReleaseCandidateSourceEntry[],
  lifecycle: BoundCandidateLifecycle
): Promise<{ ok: true; value: ReleaseReadinessInput } | ReleaseCandidateLifecycleFailure> {
  const identities = new Map(inventory.map((entry) => [entry.path, entry]));
  const gamePrefix = `game/dota_addons/${input.addonName}`;
  const contentPrefix = `content/dota_addons/${input.addonName}`;
  const required = (
    label: ReleaseReadinessInput["requiredPaths"][number]["label"],
    path: string,
    expectedKind: "file" | "directory"
  ): ReleaseReadinessInput["requiredPaths"][number] => {
    const entry = identities.get(path);
    return { label, present: entry !== undefined, kind: entry?.kind, expectedKind };
  };
  const requiredPaths: ReleaseReadinessInput["requiredPaths"] = [
    { label: "game addon root", present: true, kind: "directory", expectedKind: "directory" },
    { label: "content addon root", present: true, kind: "directory", expectedKind: "directory" },
    required("addon metadata", `${gamePrefix}/addoninfo.txt`, "file"),
    required("lua entry", `${gamePrefix}/scripts/vscripts/addon_game_mode.lua`, "file"),
    required("localization file", `${gamePrefix}/resource/addon_${input.addonName}_english.txt`, "file"),
    required("content maps directory", `${contentPrefix}/maps`, "directory"),
    required("hero list", `${gamePrefix}/scripts/npc/herolist.txt`, "file"),
    required("hero data", `${gamePrefix}/scripts/npc/npc_heroes_custom.txt`, "file"),
    required("unit support file", `${gamePrefix}/scripts/npc/npc_units_custom.txt`, "file"),
    required("ability support file", `${gamePrefix}/scripts/npc/npc_abilities_custom.txt`, "file")
  ];

  const observations = new Map<string, Extract<AcceptedSourceReadResult, { ok: true }>>();
  for (const entry of inventory.filter((candidate) => candidate.kind === "file")) {
    const relativePath = entry.path.split(`/dota_addons/${input.addonName}/`)[1];
    const observed = await parseAcceptedSourceRead(
      async () => await lifecycle.readAcceptedSourceFile(input, entry, MAX_SECRET_SCAN_BYTES),
      isReleaseTextPath(relativePath)
    );
    if (!observed.ok) return observed;
    observations.set(entry.path, observed.value);
  }

  let metadata: ReleaseReadinessInput["metadata"] = { state: "missing" };
  const metadataObservation = observations.get(`${gamePrefix}/addoninfo.txt`);
  if (metadataObservation?.state === "readable") {
    const content = decodeReleaseText(metadataObservation.bytes);
    metadata = content === undefined
      ? { state: "unreadable", path: "addoninfo.txt" }
      : { state: "readable", content };
  } else if (metadataObservation?.state === "oversized") {
    metadata = { state: "oversized", path: "addoninfo.txt" };
  } else if (metadataObservation?.state === "unreadable") {
    metadata = { state: "unreadable", path: "addoninfo.txt" };
  }

  const requiredText = new Set([
    "addoninfo.txt",
    "scripts/vscripts/addon_game_mode.lua",
    `resource/addon_${input.addonName}_english.txt`,
    "scripts/npc/herolist.txt",
    "scripts/npc/npc_heroes_custom.txt",
    "scripts/npc/npc_units_custom.txt",
    "scripts/npc/npc_abilities_custom.txt"
  ]);
  const scanRoots: ReleaseReadinessInput["scanRoots"] = [];
  for (const root of ["game", "content"] as const) {
    const prefix = root === "game" ? gamePrefix : contentPrefix;
    const files: ReleaseReadinessInput["scanRoots"][number]["files"] = [];
    for (const entry of inventory.filter((candidate) => candidate.root === root && candidate.kind === "file")) {
      const relativePath = entry.path.slice(prefix.length + 1);
      const observed = observations.get(entry.path);
      if (observed?.state === "binary") {
        files.push({ relativePath, state: "binary", requiredText: requiredText.has(relativePath) });
      } else if (observed?.state === "oversized") {
        files.push({ relativePath, state: "oversized", requiredText: requiredText.has(relativePath) });
      } else if (observed?.state === "readable") {
        const content = decodeReleaseText(observed.bytes);
        files.push(content === undefined
          ? { relativePath, state: "invalid-encoding", requiredText: requiredText.has(relativePath) }
          : { relativePath, state: "text", content, requiredText: requiredText.has(relativePath) });
      } else files.push({ relativePath, state: "unreadable", requiredText: requiredText.has(relativePath) });
    }
    scanRoots.push({ root, files });
  }
  return { ok: true, value: { requiredPaths, metadata, scanRoots } };
}

async function parseAcceptedSourceRead(
  acquire: () => Promise<unknown>,
  expectedText: boolean
): Promise<
  | { ok: true; value: Extract<AcceptedSourceReadResult, { ok: true }> }
  | ReleaseCandidateLifecycleFailure
> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    const ok = Reflect.get(result, "ok");
    if (ok === false) {
      const code = Reflect.get(result, "code");
      if (code === "SOURCE_FILE_IDENTITY_CHANGED" || code === "SOURCE_FILE_READ_FAILED") {
        return lifecycleBlocked(code, "assembly");
      }
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    const state = Reflect.get(result, "state");
    const size = Reflect.get(result, "size");
    if (ok !== true || Reflect.get(result, "schemaVersion") !== "1.0" || !Number.isSafeInteger(size) || size < 0) {
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    const identityMatched = Reflect.get(result, "identityMatched");
    const kindMatched = Reflect.get(result, "kindMatched");
    const contained = Reflect.get(result, "contained");
    if (identityMatched !== true || kindMatched !== true || contained !== true) {
      return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
    }
    if (state === "oversized" && size > MAX_SECRET_SCAN_BYTES) {
      if (!expectedText) return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
      return { ok: true, value: { ok: true, schemaVersion: "1.0", state, size, identityMatched, kindMatched, contained } };
    }
    if (state === "binary" && !expectedText) {
      return { ok: true, value: { ok: true, schemaVersion: "1.0", state, size, identityMatched, kindMatched, contained } };
    }
    if (state === "unreadable" && expectedText) {
      return { ok: true, value: { ok: true, schemaVersion: "1.0", state, size, identityMatched, kindMatched, contained } };
    }
    const bytes = Reflect.get(result, "bytes");
    if (
      state === "readable"
      && expectedText
      && size <= MAX_SECRET_SCAN_BYTES
      && bytes instanceof Uint8Array
      && bytes.byteLength === size
    ) {
      return {
        ok: true,
        value: {
          ok: true,
          schemaVersion: "1.0",
          state,
          size,
          bytes: Uint8Array.from(bytes),
          identityMatched,
          kindMatched,
          contained
        }
      };
    }
  } catch {
    return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
  }
  return lifecycleBlocked("SOURCE_READ_RESULT_INVALID", "assembly");
}

function decodeReleaseText(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function withScanCoverage<T extends ReleaseCandidateLifecycleFailure>(
  failure: T,
  scanCoverage: ReleaseScanCoverage
): T & { scanCoverage: ReleaseScanCoverage } {
  return { ...failure, scanCoverage };
}

async function normalizeCandidateCleanupEvidence(
  acquire: () => Promise<unknown>
): Promise<ReleaseCandidateCleanupEvidence> {
  try {
    const result = await acquire();
    if (result === null || typeof result !== "object") {
      return failedCleanupEvidence("CANDIDATE_CLEANUP_RESULT_INVALID");
    }

    const ok = Reflect.get(result, "ok");
    const removed = Reflect.get(result, "removed");
    const absent = Reflect.get(result, "absent");
    const identityMatched = Reflect.get(result, "identityMatched");
    if (ok === true && removed === true && absent === true && identityMatched === true) {
      return Object.freeze({
        schemaVersion: "1.0",
        attempted: true,
        attempts: 1,
        status: "verified",
        identityMatched: true,
        removed: true,
        absent: true
      });
    }

    const code = Reflect.get(result, "code");
    if (
      ok === false
      && typeof removed === "boolean"
      && typeof absent === "boolean"
      && typeof identityMatched === "boolean"
      && isCandidateLeaseCleanupFailureCode(code)
    ) {
      return failedCleanupEvidence(code, { identityMatched, removed, absent });
    }
  } catch {
    return failedCleanupEvidence("CANDIDATE_CLEANUP_RESULT_INVALID");
  }
  return failedCleanupEvidence("CANDIDATE_CLEANUP_RESULT_INVALID");
}

function failedCleanupEvidence(
  code: Extract<ReleaseCandidateCleanupEvidence, { status: "failed" }>["code"],
  facts: Readonly<{ identityMatched: boolean; removed: boolean; absent: boolean }> | undefined = undefined
): Extract<ReleaseCandidateCleanupEvidence, { status: "failed" }> {
  return Object.freeze({
    schemaVersion: "1.0",
    attempted: true,
    attempts: 1,
    status: "failed",
    code,
    ...(facts === undefined ? {} : facts)
  });
}

function isCandidateLeaseCleanupFailureCode(
  value: unknown
): value is CandidateLeaseCleanupFailureCode {
  return value === "CANDIDATE_IDENTITY_MISMATCH"
    || value === "CANDIDATE_REMOVAL_FAILED"
    || value === "CANDIDATE_ABSENCE_UNVERIFIED"
    || value === "CANDIDATE_LEASE_INVALID";
}

function isCandidateRootIsolated(
  candidateRoot: string,
  input: ValidatedReleaseCandidateInput
): boolean {
  if (!isPathInside(candidateRoot, input.tempParent)) return false;
  const protectedRoots = [input.dotaRoot, input.gameAddonRoot, input.contentAddonRoot, input.repositoryRoot];
  return protectedRoots.every((root) => (
    !isPathAtOrInside(candidateRoot, root) && !isPathAtOrInside(root, candidateRoot)
  ));
}

function lifecycleBlocked(
  code: string,
  category: ReleaseCandidateLifecycleBlocker["category"]
): ReleaseCandidateLifecycleFailure {
  return { ok: false, blockers: [{ code, category }] };
}

type InventoryDirectoryInput = {
  root: ReleaseCandidateSourceRoot;
  sourceRoot: string;
  sourcePath: string;
  identity: string;
  segments: string[];
  filesystem: ReleaseCandidateFilesystem;
  entries: ReleaseCandidateSourceEntry[];
  blockers: ReleaseCandidateInventoryBlocker[];
  identities: Map<string, Set<string>>;
};

async function inventorySourceDirectory(input: InventoryDirectoryInput): Promise<void> {
  const names = await parseDirectoryNamesAdapterResult(
    async () => await input.filesystem.readDirectory(input.sourcePath)
  );
  if (names === undefined) {
    input.blockers.push({
      code: "SOURCE_ENTRY_UNREADABLE",
      path: input.identity,
      category: "unreadable"
    });
    return;
  }

  const occurrenceCounts = new Map<string, number>();
  for (const name of names) occurrenceCounts.set(name, (occurrenceCounts.get(name) ?? 0) + 1);
  for (const [name, count] of [...occurrenceCounts.entries()].sort(([left], [right]) => compareOrdinal(left, right))) {
    if (invalidSourceNameCategory(name) === undefined) {
      addIdentity(input.identities, safeChildIdentity(input.identity, name));
    }
    if (count < 2) continue;
    input.blockers.push({
      code: "SOURCE_IDENTITY_COLLISION",
      path: safeChildIdentity(input.identity, name),
      category: "exact-duplicate"
    });
  }

  for (const name of names.filter((name) => occurrenceCounts.get(name) === 1).sort(compareOrdinal)) {
    const identity = safeChildIdentity(input.identity, name);
    const invalidCategory = invalidSourceNameCategory(name);
    if (invalidCategory !== undefined) {
      input.blockers.push({
        code: "SOURCE_IDENTITY_INVALID",
        path: identity,
        category: invalidCategory
      });
      continue;
    }

    const sourcePath = join(input.sourceRoot, ...input.segments, name);
    let kind: ReleaseCandidateEntryKind;
    try {
      kind = normalizeEntryKind(await input.filesystem.classifySourceEntry(sourcePath));
    } catch {
      input.blockers.push({
        code: "SOURCE_ENTRY_UNREADABLE",
        path: identity,
        category: "unreadable"
      });
      continue;
    }

    if (kind !== "file" && kind !== "directory") {
      input.blockers.push({ code: "SOURCE_ENTRY_UNSAFE", path: identity, category: kind });
      continue;
    }

    const canonicalPath = await parseCanonicalPathAdapterResult(
      async () => await input.filesystem.realpath(sourcePath)
    );
    if (canonicalPath === undefined) {
      input.blockers.push({
        code: "SOURCE_ENTRY_UNREADABLE",
        path: identity,
        category: "unreadable"
      });
      continue;
    }
    if (!isPathAtOrInside(canonicalPath, input.sourceRoot)) {
      input.blockers.push({
        code: "SOURCE_ENTRY_OUTSIDE_ROOT",
        path: identity,
        category: "escape"
      });
      continue;
    }

    input.entries.push({ root: input.root, path: identity, kind });

    if (kind === "directory") {
      await inventorySourceDirectory({
        ...input,
        sourcePath,
        identity,
        segments: [...input.segments, name]
      });
    }
  }
}

async function classifySourceEntry(path: string): Promise<ReleaseCandidateEntryKind> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "special";
}

function normalizeEntryKind(kind: unknown): ReleaseCandidateEntryKind {
  if (
    kind === "file"
    || kind === "directory"
    || kind === "symbolic-link"
    || kind === "reparse"
    || kind === "special"
    || kind === "unknown"
  ) {
    return kind;
  }
  return "unknown";
}

function invalidSourceNameCategory(name: string): "absolute" | "traversal" | "separator" | undefined {
  if (isAbsolute(name) || /^[A-Za-z]:[\\/]/u.test(name) || /^[/\\]{2}/u.test(name)) return "absolute";
  if (name === "" || name === "." || name === "..") return "traversal";
  if (name.includes("/") || name.includes("\\")) return "separator";
  return undefined;
}

function safeChildIdentity(parent: string, name: string): string {
  const normalized = name.replaceAll("\\", "/").replace(/^\/+/, "");
  return `${parent}/${normalized}`;
}

function foldIdentity(identity: string): string {
  return identity.toLowerCase();
}

function addIdentity(identities: Map<string, Set<string>>, identity: string): void {
  const folded = foldIdentity(identity);
  const group = identities.get(folded) ?? new Set<string>();
  group.add(identity);
  identities.set(folded, group);
}

function appendCollisionBlockers(
  identities: Map<string, Set<string>>,
  blockers: ReleaseCandidateInventoryBlocker[]
): void {
  for (const group of identities.values()) {
    if (group.size < 2) continue;
    for (const path of group) {
      blockers.push({
        code: "SOURCE_IDENTITY_COLLISION",
        path,
        category: "case-fold"
      });
    }
  }
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareInventoryBlockers(
  left: ReleaseCandidateInventoryBlocker,
  right: ReleaseCandidateInventoryBlocker
): number {
  return compareOrdinal(left.path, right.path)
    || compareOrdinal(left.code, right.code)
    || compareOrdinal(left.category, right.category);
}

type ValidDirectory =
  | { ok: true; path: string }
  | { ok: false; result: ReleaseCandidateInputResult };

async function validateDirectory(
  value: string,
  field: Exclude<ReleaseCandidateInputField, "addonName">,
  codePrefix: string,
  filesystem: ReleaseCandidateFilesystem
): Promise<ValidDirectory> {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, result: blocked(`${codePrefix}_REQUIRED`, field, "required") };
  }

  const path = resolve(value);
  let lstatFailure: unknown;
  const stats = await parseDirectoryAdapterResult(
    async () => await filesystem.lstat(path),
    (error) => { lstatFailure = error; }
  );
  if (stats === "invalid") {
    const category = errorCode(lstatFailure) === "ENOENT" ? "missing" : "unreadable";
    const suffix = category === "missing" ? "MISSING" : "UNREADABLE";
    return { ok: false, result: blocked(`${codePrefix}_${suffix}`, field, category) };
  }
  if (stats === "not-directory") {
    return { ok: false, result: blocked(`${codePrefix}_NOT_DIRECTORY`, field, "not-directory") };
  }

  const canonicalPath = await parseCanonicalPathAdapterResult(
    async () => await filesystem.realpath(path)
  );
  if (canonicalPath === undefined) {
    return { ok: false, result: blocked(`${codePrefix}_UNREADABLE`, field, "unreadable") };
  }
  return { ok: true, path: canonicalPath };
}

type DirectoryAdapterResult = "directory" | "not-directory" | "invalid";

async function parseDirectoryAdapterResult(
  acquire: () => Promise<unknown>,
  onFailure?: (error: unknown) => void
): Promise<DirectoryAdapterResult> {
  try {
    const result = await acquire();
    if ((typeof result !== "object" && typeof result !== "function") || result === null) return "invalid";
    const predicate = Reflect.get(result, "isDirectory");
    if (typeof predicate !== "function") return "invalid";
    const directory = Reflect.apply(predicate, result, []);
    if (typeof directory !== "boolean") return "invalid";
    return directory ? "directory" : "not-directory";
  } catch (error) {
    onFailure?.(error);
    return "invalid";
  }
}

async function parseCanonicalPathAdapterResult(
  acquire: () => Promise<unknown>
): Promise<string | undefined> {
  try {
    const result = await acquire();
    if (typeof result !== "string" || result.trim() === "" || !isAbsolute(result)) return undefined;
    return result;
  } catch {
    return undefined;
  }
}

async function parseDirectoryNamesAdapterResult(
  acquire: () => Promise<unknown>
): Promise<string[] | undefined> {
  try {
    const result = await acquire();
    if (!Array.isArray(result)) return undefined;
    if (Reflect.get(result, Symbol.iterator) !== Array.prototype[Symbol.iterator]) return undefined;
    const length = Reflect.get(result, "length");
    if (!Number.isSafeInteger(length) || length < 0) return undefined;
    const names: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const name = Reflect.get(result, String(index));
      if (typeof name !== "string") return undefined;
      names.push(name);
    }
    return names;
  } catch {
    return undefined;
  }
}

function blocked(
  code: string,
  field: ReleaseCandidateInputField,
  category: ReleaseCandidateInputBlocker["category"]
): ReleaseCandidateInputResult {
  return { ok: false, blockers: [{ code, field, category }] };
}

function errorCode(error: unknown): string | undefined {
  try {
    if (error === null || (typeof error !== "object" && typeof error !== "function")) return undefined;
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

function isPathAtOrInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  return isPathInside(child, parent);
}

function isPathInside(child: string, parent: string): boolean {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { PreflightReleaseCandidateInputSchema } from "../src/schemas.js";
import {
  computeReleaseCandidateCombinedDigest,
  createReleaseCandidateToolResult,
  normalizeReleaseCandidateDetail
} from "../src/release-candidate-result.js";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function manifestEntries(): Array<{
  schemaVersion: "1.0";
  root: "content" | "game";
  path: string;
  bytes: number;
  sha256: string;
}> {
  return [
    { schemaVersion: "1.0", root: "content", path: "content/dota_addons/demo/panorama/layout/custom_game/main.xml", bytes: 7, sha256: DIGEST_A },
    { schemaVersion: "1.0", root: "game", path: "game/dota_addons/demo/scripts/vscripts/addon_game_mode.lua", bytes: 11, sha256: DIGEST_B }
  ];
}

function coverage() {
  return {
    schemaVersion: "1.0",
    totalFileCount: 2,
    text: { count: 2, paths: manifestEntries().map((entry) => entry.path) },
    binary: { count: 0, paths: [] },
    unreadable: { count: 0, paths: [] },
    oversized: { count: 0, paths: [] }
  };
}

function boundaries() {
  return {
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
  };
}

function validSuccess(): any {
  const entries = manifestEntries();
  const manifest = {
    schemaVersion: "1.0",
    entries,
    combinedSha256: computeReleaseCandidateCombinedDigest(entries)
  };
  const inclusionLedger = {
    schemaVersion: "1.0",
    expectedFileCount: 2,
    observedFileCount: 2,
    matchedFileCount: 2
  };
  const scanCoverage = coverage();
  return {
    schemaVersion: "1.0",
    ok: false,
    operation: { status: "completed" },
    artifactValidation: { status: "passed", manifest, inclusionLedger, scanCoverage },
    manifest,
    inclusionLedger,
    scanCoverage,
    blockers: [],
    cleanup: {
      schemaVersion: "1.0",
      attempted: true,
      attempts: 1,
      status: "verified",
      verified: true,
      identityMatched: true,
      removed: true,
      absent: true
    },
    paths: {
      gameAddon: "game/dota_addons/demo",
      contentAddon: "content/dota_addons/demo"
    },
    execution: { kind: "fixture", outcome: "completed" },
    warnings: ["contract evidence only"],
    commands: [{ description: "fixture release candidate preflight", outcome: "completed" }],
    logs: [{ source: "fixture", lines: ["candidate cleanup verified"] }],
    boundaries: boundaries()
  };
}

function expectNormalizationFailure(input: unknown) {
  expect(normalizeReleaseCandidateDetail(input)).toEqual({
    schemaVersion: "1.0",
    ok: false,
    normalization: {
      status: "failed",
      code: "RELEASE_CANDIDATE_DETAIL_INVALID"
    },
    blockers: [{ code: "RELEASE_CANDIDATE_DETAIL_INVALID", category: "normalization" }]
  });
}

describe("release candidate public detail", () => {
  test("accepts only target and addonName for preflight input", () => {
    const input = {
      target: { kind: "fixture", root: "/fixture" },
      addonName: "demo"
    };

    expect(PreflightReleaseCandidateInputSchema.parse(input)).toEqual(input);
    for (const key of [
      "credential",
      "password",
      "token",
      "destination",
      "retention",
      "upload",
      "archive",
      "signing",
      "encryption",
      "build",
      "repair",
      "temporaryPath"
    ]) {
      expect(() => PreflightReleaseCandidateInputSchema.parse({ ...input, [key]: "forbidden" })).toThrow();
    }
    const unknownTargetKey = ["to", "ken"].join("");
    expect(() => PreflightReleaseCandidateInputSchema.parse({
      ...input,
      target: { ...input.target, [unknownTargetKey]: "forbidden" }
    })).toThrow();
    expect(Object.keys(PreflightReleaseCandidateInputSchema.shape).sort()).toEqual(["addonName", "target"]);
  });

  test("requires every exact immutable preflight boundary", () => {
    const expected = boundaries();
    expect(normalizeReleaseCandidateDetail(validSuccess())).toMatchObject({ boundaries: expected });

    for (const key of Object.keys(expected) as Array<keyof ReturnType<typeof boundaries>>) {
      const missing = validSuccess();
      delete missing.boundaries[key];
      expectNormalizationFailure(missing);

      const contradictory = validSuccess();
      contradictory.boundaries[key] = !expected[key];
      expectNormalizationFailure(contradictory);
    }

    const extra = validSuccess();
    extra.boundaries.credentialHandled = false;
    expectNormalizationFailure(extra);
  });

  test("uses the fixed nested-array canonical digest", () => {
    const entries = manifestEntries();
    const expected = createHash("sha256")
      .update(Buffer.from(JSON.stringify([
        "1.0",
        entries.map(({ root, path, bytes, sha256 }) => [root, path, bytes, sha256])
      ]), "utf8"))
      .digest("hex");

    expect(computeReleaseCandidateCombinedDigest(entries)).toBe(expected);
  });

  test("normalizes complete success facts and recomputes top-level success", () => {
    const normalized = normalizeReleaseCandidateDetail(validSuccess());

    expect(normalized).toMatchObject({
      schemaVersion: "1.0",
      ok: true,
      normalization: { status: "valid" },
      operation: { status: "completed" },
      artifactValidation: { status: "passed" },
      cleanup: { status: "verified", attempts: 1, absent: true },
      execution: { kind: "fixture", outcome: "completed" },
      blockers: []
    });
    expect(normalized).not.toHaveProperty("value");
    expect(JSON.stringify(normalized)).not.toContain("dota-release-candidate-");
  });

  test("preserves blocked artifact and cleanup-only failure as independent facts", () => {
    const artifactBlocked = validSuccess();
    const blocker = {
      code: "REQUIRED_PATH_MISSING",
      category: "required-structure",
      disposition: "blocker",
      field: "addon game mode script"
    };
    artifactBlocked.artifactValidation = {
      status: "blocked",
      blockers: [blocker],
      inclusionLedger: artifactBlocked.inclusionLedger,
      scanCoverage: artifactBlocked.scanCoverage
    } as never;
    delete (artifactBlocked as { manifest?: unknown }).manifest;
    artifactBlocked.blockers = [blocker] as never;
    const normalizedBlocked = normalizeReleaseCandidateDetail(artifactBlocked);
    expect(normalizedBlocked).toMatchObject({
      ok: false,
      normalization: { status: "valid" },
      operation: { status: "completed" },
      artifactValidation: { status: "blocked" },
      cleanup: { status: "verified" }
    });

    const cleanupFailed = validSuccess();
    cleanupFailed.cleanup = {
      schemaVersion: "1.0",
      attempted: true,
      attempts: 1,
      status: "failed",
      verified: false,
      code: "CANDIDATE_REMOVAL_FAILED",
      identityMatched: true,
      removed: false,
      absent: false
    } as never;
    cleanupFailed.blockers = [{ code: "CANDIDATE_REMOVAL_FAILED", category: "removal" }] as never;
    expect(normalizeReleaseCandidateDetail(cleanupFailed)).toMatchObject({
      ok: false,
      normalization: { status: "valid" },
      artifactValidation: { status: "passed" },
      cleanup: { status: "failed", code: "CANDIDATE_REMOVAL_FAILED" }
    });
  });

  test("accepts exact lease-invalid cleanup evidence after passed and blocked artifacts", () => {
    for (const artifactStatus of ["passed", "blocked"] as const) {
      const value = validSuccess();
      const cleanupBlocker = { code: "CANDIDATE_CLEANUP_RESULT_INVALID", category: "removal" };
      value.cleanup = {
        schemaVersion: "1.0",
        attempted: true,
        attempts: 1,
        status: "failed",
        verified: false,
        code: "CANDIDATE_CLEANUP_RESULT_INVALID"
      };
      value.blockers = [cleanupBlocker];
      if (artifactStatus === "blocked") {
        const artifactBlocker = {
          code: "REQUIRED_PATH_MISSING",
          category: "required-structure",
          disposition: "blocker",
          field: "addon game mode script"
        };
        value.artifactValidation = {
          status: "blocked",
          blockers: [artifactBlocker],
          inclusionLedger: value.inclusionLedger,
          scanCoverage: value.scanCoverage
        };
        delete value.manifest;
        value.blockers = [artifactBlocker, cleanupBlocker];
      }

      expect(normalizeReleaseCandidateDetail(value)).toMatchObject({
        ok: false,
        normalization: { status: "valid" },
        artifactValidation: { status: artifactStatus },
        cleanup: { status: "failed", code: "CANDIDATE_CLEANUP_RESULT_INVALID" }
      });
    }
  });

  test("deeply clones and freezes every returned domain", () => {
    const input = validSuccess();
    const normalized = normalizeReleaseCandidateDetail(input);
    const before = JSON.stringify(normalized);

    input.warnings.push("changed");
    input.manifest.entries[0]!.path = "game/dota_addons/private/token.txt";
    input.artifactValidation.manifest.entries[0]!.sha256 = "c".repeat(64);
    input.commands[0]!.description = "changed";

    expect(JSON.stringify(normalized)).toBe(before);
    expect(Object.isFrozen(normalized)).toBe(true);
    if ("commands" in normalized) {
      expect(Object.isFrozen(normalized.manifest?.entries)).toBe(true);
      expect(Object.isFrozen(normalized.manifest?.entries[0])).toBe(true);
      expect(Object.isFrozen(normalized.scanCoverage?.text.paths)).toBe(true);
      expect(Object.isFrozen(normalized.commands[0])).toBe(true);
      expect(Object.isFrozen(normalized.boundaries)).toBe(true);
    }
  });

  test("rejects malformed versions, manifest invariants, unsafe paths, and invalid counts", () => {
    const cases: unknown[] = [];
    const unsupported = validSuccess();
    unsupported.schemaVersion = "2.0";
    cases.push(unsupported);

    const alteredDigest = validSuccess();
    alteredDigest.manifest.combinedSha256 = "c".repeat(64);
    cases.push(alteredDigest);

    const unordered = validSuccess();
    unordered.manifest.entries.reverse();
    cases.push(unordered);

    const duplicate = validSuccess();
    duplicate.manifest.entries[1] = { ...duplicate.manifest.entries[0]! };
    duplicate.manifest.combinedSha256 = computeReleaseCandidateCombinedDigest(duplicate.manifest.entries);
    cases.push(duplicate);

    const unsafe = validSuccess();
    unsafe.manifest.entries[0]!.path = "../private/token.txt";
    unsafe.manifest.combinedSha256 = computeReleaseCandidateCombinedDigest(unsafe.manifest.entries);
    cases.push(unsafe);

    const uppercase = validSuccess();
    uppercase.manifest.entries[0]!.sha256 = DIGEST_A.toUpperCase();
    uppercase.manifest.combinedSha256 = computeReleaseCandidateCombinedDigest(uppercase.manifest.entries);
    cases.push(uppercase);

    const fractional = validSuccess();
    fractional.inclusionLedger.matchedFileCount = 1.5;
    cases.push(fractional);

    for (const candidate of cases) expectNormalizationFailure(candidate);
  });

  test("binds paths, manifest entries, and coverage to one addon identity", () => {
    const mixedRoots = validSuccess();
    mixedRoots.paths.contentAddon = "content/dota_addons/other";
    expectNormalizationFailure(mixedRoots);

    const mixedManifest = validSuccess();
    mixedManifest.manifest.entries[0].path = "content/dota_addons/other/maps/demo.vmap";
    mixedManifest.manifest.combinedSha256 = computeReleaseCandidateCombinedDigest(mixedManifest.manifest.entries);
    mixedManifest.artifactValidation.manifest = mixedManifest.manifest;
    mixedManifest.scanCoverage.text.paths[0] = mixedManifest.manifest.entries[0].path;
    mixedManifest.artifactValidation.scanCoverage = mixedManifest.scanCoverage;
    expectNormalizationFailure(mixedManifest);
  });

  test("rejects unknown fields in every versioned evidence domain", () => {
    const candidates = [
      (() => { const value = validSuccess(); value.private = true; return value; })(),
      (() => { const value = validSuccess(); value.operation.private = true; return value; })(),
      (() => { const value = validSuccess(); value.artifactValidation.private = true; return value; })(),
      (() => { const value = validSuccess(); value.manifest.private = true; return value; })(),
      (() => { const value = validSuccess(); value.manifest.entries[0].private = true; return value; })(),
      (() => { const value = validSuccess(); value.inclusionLedger.private = true; return value; })(),
      (() => { const value = validSuccess(); value.scanCoverage.private = true; return value; })(),
      (() => { const value = validSuccess(); value.scanCoverage.text.private = true; return value; })(),
      (() => { const value = validSuccess(); value.cleanup.private = true; return value; })(),
      (() => { const value = validSuccess(); value.paths.private = true; return value; })(),
      (() => { const value = validSuccess(); value.execution.private = true; return value; })(),
      (() => { const value = validSuccess(); value.commands[0].private = true; return value; })(),
      (() => { const value = validSuccess(); value.logs[0].private = true; return value; })()
    ];
    const blocked = validSuccess();
    const blocker = { code: "REQUIRED_PATH_MISSING", category: "required-structure", disposition: "blocker", private: true };
    blocked.blockers = [blocker];
    blocked.artifactValidation = {
      status: "blocked",
      blockers: [blocker],
      inclusionLedger: blocked.inclusionLedger,
      scanCoverage: blocked.scanCoverage
    };
    delete blocked.manifest;
    candidates.push(blocked);

    for (const candidate of candidates) expectNormalizationFailure(candidate);
  });

  test("rejects incomplete coverage and contradictory state combinations", () => {
    const incomplete = validSuccess();
    incomplete.scanCoverage.text.paths.pop();
    incomplete.scanCoverage.text.count = 1;
    incomplete.scanCoverage.totalFileCount = 1;
    expectNormalizationFailure(incomplete);

    const contradictoryCleanup = validSuccess();
    contradictoryCleanup.cleanup.absent = false;
    expectNormalizationFailure(contradictoryCleanup);

    const blockedWithoutBlocker = validSuccess();
    blockedWithoutBlocker.artifactValidation = { status: "blocked", blockers: [] } as never;
    delete (blockedWithoutBlocker as { manifest?: unknown }).manifest;
    blockedWithoutBlocker.blockers = [];
    expectNormalizationFailure(blockedWithoutBlocker);
  });

  test("rejects blocked domain omission and incomplete attempted-cleanup evidence", () => {
    const omittedBlockedEvidence = validSuccess();
    const blocker = {
      code: "REQUIRED_PATH_MISSING",
      category: "required-structure",
      disposition: "blocker",
      field: "addon game mode script"
    };
    omittedBlockedEvidence.artifactValidation = {
      status: "blocked",
      blockers: [blocker]
    };
    delete omittedBlockedEvidence.manifest;
    omittedBlockedEvidence.blockers = [blocker];
    expectNormalizationFailure(omittedBlockedEvidence);

    const incompleteCleanup = validSuccess();
    incompleteCleanup.cleanup = {
      schemaVersion: "1.0",
      attempted: true,
      attempts: 1,
      status: "failed",
      verified: false,
      code: "CANDIDATE_REMOVAL_FAILED"
    };
    incompleteCleanup.blockers = [{ code: "CANDIDATE_REMOVAL_FAILED", category: "removal" }];
    expectNormalizationFailure(incompleteCleanup);
  });

  test("fails closed for getters, proxies, throwing arrays, unknown codes, and thenables", () => {
    const privatePath = ["", "Users", "secret"].join("/");
    const throwingGetter = Object.defineProperty({}, "schemaVersion", {
      get() { throw new Error(`private ${privatePath}`); }
    });
    const proxy = new Proxy(validSuccess(), { get() { throw new Error("private"); } });
    const throwingArray = validSuccess();
    throwingArray.manifest.entries = new Proxy(throwingArray.manifest.entries, {
      get(target, property, receiver) {
        if (property === "0") throw new Error("private");
        return Reflect.get(target, property, receiver);
      }
    });
    const unknownCode = validSuccess();
    unknownCode.operation = { status: "failed", code: "PRIVATE_UNKNOWN_CODE" } as never;
    const thenable = { then() { throw new Error("private"); } };

    for (const candidate of [throwingGetter, proxy, throwingArray, unknownCode, thenable]) {
      expectNormalizationFailure(candidate);
      expect(JSON.stringify(normalizeReleaseCandidateDetail(candidate))).not.toContain("private");
    }
  });

  test("rejects foreign arrays whose length changes during occurrence snapshotting", () => {
    const input = validSuccess();
    const firstEntry = input.manifest.entries[0];
    const originalEntries = [...input.manifest.entries];
    const changingEntries = () => {
      let lengthReads = 0;
      return new Proxy([...originalEntries], {
        get(target, property, receiver) {
          if (property === "length") {
            lengthReads += 1;
            return lengthReads === 1 ? 2 : 0;
          }
          return Reflect.get(target, property, receiver);
        }
      });
    };
    const combinedSha256 = computeReleaseCandidateCombinedDigest([firstEntry]);
    input.manifest = { ...input.manifest, entries: changingEntries(), combinedSha256 };
    input.artifactValidation.manifest = {
      ...input.artifactValidation.manifest,
      entries: changingEntries(),
      combinedSha256
    };
    for (const ledger of [input.inclusionLedger, input.artifactValidation.inclusionLedger]) {
      ledger.expectedFileCount = 1;
      ledger.observedFileCount = 1;
      ledger.matchedFileCount = 1;
    }
    for (const scanCoverage of [input.scanCoverage, input.artifactValidation.scanCoverage]) {
      scanCoverage.totalFileCount = 1;
      scanCoverage.text = { count: 1, paths: [firstEntry.path] };
    }

    expectNormalizationFailure(input);
  });

  test("normalizes equivalent complete execution facts equally while preserving uncertainty", () => {
    const fixture = validSuccess();
    const remote = structuredClone(fixture);
    remote.execution = { kind: "ssh", outcome: "completed", exitCode: 0 } as never;
    const fixtureNormalized = normalizeReleaseCandidateDetail(fixture);
    const remoteNormalized = normalizeReleaseCandidateDetail(remote);
    expect(fixtureNormalized.normalization.status).toBe("valid");
    expect(remoteNormalized.normalization.status).toBe("valid");
    if ("execution" in fixtureNormalized && "execution" in remoteNormalized) {
      expect({ ...remoteNormalized, execution: fixtureNormalized.execution }).toEqual(fixtureNormalized);
    }

    const uncertain = structuredClone(remote);
    uncertain.execution = { kind: "ssh", outcome: "uncertain" } as never;
    uncertain.cleanup = {
      schemaVersion: "1.0",
      attempted: true,
      attempts: 1,
      status: "unknown",
      verified: false,
      code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN"
    } as never;
    uncertain.blockers = [{
      code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN",
      category: "transport"
    }] as never;
    const uncertainNormalized = normalizeReleaseCandidateDetail(uncertain);
    expect(uncertainNormalized).toMatchObject({ ok: false, cleanup: { status: "unknown" } });
    expect(uncertainNormalized).not.toEqual(remoteNormalized);
  });

  test("projects normalized detail through the common success or failure envelope", () => {
    const success = createReleaseCandidateToolResult({
      target: { kind: "fixture", root: "/tmp/dota" },
      operation: "preflight_release_candidate",
      releaseCandidate: validSuccess()
    });
    expect(success.ok).toBe(true);
    expect(success.releaseCandidate).toMatchObject({ ok: true, normalization: { status: "valid" } });

    const failure = createReleaseCandidateToolResult({
      target: { kind: "remote", name: "test", transport: "ssh", host: "private" },
      operation: "preflight_release_candidate",
      releaseCandidate: { schemaVersion: "2.0" }
    });
    expect(failure).toMatchObject({
      ok: false,
      error: { code: "RELEASE_CANDIDATE_DETAIL_INVALID" },
      releaseCandidate: { ok: false, normalization: { status: "failed" } }
    });
  });
});

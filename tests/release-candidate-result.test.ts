import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  computeReleaseCandidateCombinedDigest,
  createReleaseCandidateToolResult,
  normalizeReleaseCandidateDetail
} from "../src/release-candidate-result.js";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function manifestEntries() {
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

function validSuccess() {
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
    if (normalized.normalization.status === "valid") {
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

  test("fails closed for getters, proxies, throwing arrays, unknown codes, and thenables", () => {
    const throwingGetter = Object.defineProperty({}, "schemaVersion", {
      get() { throw new Error("private /Users/secret"); }
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

  test("normalizes equivalent complete execution facts equally while preserving uncertainty", () => {
    const fixture = validSuccess();
    const remote = structuredClone(fixture);
    remote.execution = { kind: "ssh", outcome: "completed", exitCode: 0 } as never;
    const fixtureNormalized = normalizeReleaseCandidateDetail(fixture);
    const remoteNormalized = normalizeReleaseCandidateDetail(remote);
    expect(fixtureNormalized.normalization.status).toBe("valid");
    expect(remoteNormalized.normalization.status).toBe("valid");
    if (fixtureNormalized.normalization.status === "valid" && remoteNormalized.normalization.status === "valid") {
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

import { describe, expect, test } from "vitest";
import { computeReleaseCandidateCombinedDigest } from "../src/release-candidate-result.js";
import { preflightRemoteReleaseCandidate } from "../src/release-candidate-remote.js";
import type { RemoteTarget } from "../src/types.js";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function target(transport: "ssh" | "powershell"): RemoteTarget {
  return {
    kind: "remote",
    name: "private-lab-name",
    transport,
    host: "private.example.test",
    username: "private-user",
    dotaRoot: "C:/Private/Dota"
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

function successPayload() {
  const entries = [
    {
      schemaVersion: "1.0",
      root: "content",
      path: "content/dota_addons/demo/maps/demo.vmap",
      bytes: 7,
      sha256: DIGEST_A
    },
    {
      schemaVersion: "1.0",
      root: "game",
      path: "game/dota_addons/demo/scripts/vscripts/addon_game_mode.lua",
      bytes: 11,
      sha256: DIGEST_B
    }
  ];
  const manifest = {
    schemaVersion: "1.0",
    entries,
    combinedSha256: computeReleaseCandidateCombinedDigest(entries as never)
  };
  const inclusionLedger = {
    schemaVersion: "1.0",
    expectedFileCount: 2,
    observedFileCount: 2,
    matchedFileCount: 2
  };
  const scanCoverage = {
    schemaVersion: "1.0",
    totalFileCount: 2,
    text: { count: 2, paths: entries.map((entry) => entry.path) },
    binary: { count: 0, paths: [] },
    unreadable: { count: 0, paths: [] },
    oversized: { count: 0, paths: [] }
  };
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
    execution: { kind: "remote", outcome: "completed", exitCode: 0 },
    warnings: ["contract evidence only"],
    commands: [{ description: "private raw script", outcome: "completed" }],
    logs: [{ source: "private stdout", lines: ["private payload"] }],
    boundaries: boundaries()
  };
}

function blockedPayload() {
  const payload = successPayload() as any;
  const blocker = {
    code: "REQUIRED_PATH_MISSING",
    category: "required-structure",
    disposition: "blocker",
    field: "addon game mode script"
  };
  delete payload.manifest;
  delete payload.inclusionLedger;
  payload.blockers = [blocker];
  payload.artifactValidation = {
    status: "blocked",
    blockers: [blocker],
    scanCoverage: payload.scanCoverage
  };
  return payload;
}

function semanticProjection(result: Awaited<ReturnType<typeof preflightRemoteReleaseCandidate>>) {
  const detail = structuredClone(result.releaseCandidate);
  if (detail && "execution" in detail) {
    detail.execution.kind = "ssh" as never;
    detail.commands = [];
  }
  return detail;
}

function expectNoPrivateEvidence(result: unknown) {
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "private-lab-name",
    "private.example.test",
    "private-user",
    "C:/Private/Dota",
    "private raw script",
    "private stdout",
    "private payload",
    ["ghp", "abcdefghijklmnopqrstuvwxyz123456"].join("_")
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe("remote release-candidate normalization", () => {
  test.each(["ssh", "powershell"] as const)("normalizes one complete %s document with fixed public evidence", async (transport) => {
    let calls = 0;
    const result = await preflightRemoteReleaseCandidate({
      target: target(transport),
      addonName: "demo",
      executor: async () => {
        calls += 1;
        return { exitCode: 0, stdout: JSON.stringify(successPayload()), stderr: "" };
      }
    });

    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: true,
      target: { kind: "remote", name: "remote-target", transport, host: "redacted" },
      operation: "preflight_release_candidate",
      releaseCandidate: {
        ok: true,
        normalization: { status: "valid" },
        execution: { kind: transport, outcome: "completed", exitCode: 0 },
        cleanup: { status: "verified", absent: true }
      }
    });
    expect(result.commands).toEqual([{
      command: `${transport} remote-target preflight_release_candidate <redacted-script>`,
      exitCode: 0
    }]);
    expect(result.logs).toEqual([{ source: "remote-release-candidate", lines: ["remote evidence normalized"] }]);
    expectNoPrivateEvidence(result);
  });

  test("normalizes equivalent complete SSH and PowerShell evidence identically", async () => {
    const run = (transport: "ssh" | "powershell") => preflightRemoteReleaseCandidate({
      target: target(transport),
      addonName: "demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(successPayload()), stderr: "" })
    });
    const [ssh, powershell] = await Promise.all([run("ssh"), run("powershell")]);
    expect(semanticProjection(ssh)).toEqual(semanticProjection(powershell));
  });

  test("preserves complete blocked artifact and verified cleanup facts", async () => {
    const result = await preflightRemoteReleaseCandidate({
      target: target("ssh"),
      addonName: "demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(blockedPayload()), stderr: "" })
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "RELEASE_CANDIDATE_PREFLIGHT_FAILED" },
      releaseCandidate: {
        normalization: { status: "valid" },
        artifactValidation: { status: "blocked" },
        blockers: [{ code: "REQUIRED_PATH_MISSING" }],
        cleanup: { status: "verified" }
      }
    });
  });

  test.each([
    ["empty", "", "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["whitespace", "  ", "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["prefix", `noise${JSON.stringify(successPayload())}`, "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["suffix", `${JSON.stringify(successPayload())}noise`, "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["multiple", "{}{}", "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["array", "[]", "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["scalar", "true", "REMOTE_RELEASE_CANDIDATE_FRAMING_INVALID"],
    ["malformed", "{not-json}", "REMOTE_RELEASE_CANDIDATE_JSON_INVALID"]
  ])("rejects %s stdout without retry or disclosure", async (_name, stdout, code) => {
    let calls = 0;
    const result = await preflightRemoteReleaseCandidate({
      target: target("ssh"),
      addonName: "demo",
      executor: async () => {
        calls += 1;
        return { exitCode: 0, stdout, stderr: "" };
      }
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: { code },
      releaseCandidate: {
        artifactValidation: { status: "not-reached" },
        cleanup: {
          status: "unknown",
          verified: false,
          code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_UNCERTAIN"
        }
      }
    });
    expectNoPrivateEvidence(result);
  });

  test.each([
    ["version", () => ({ ...successPayload(), schemaVersion: "2.0" }), "REMOTE_RELEASE_CANDIDATE_VERSION_INVALID"],
    ["digest", () => {
      const payload = successPayload() as any;
      payload.manifest.combinedSha256 = "c".repeat(64);
      return payload;
    }, "REMOTE_RELEASE_CANDIDATE_DIGEST_INVALID"],
    ["semantic", () => {
      const payload = successPayload() as any;
      payload.cleanup.absent = false;
      return payload;
    }, "REMOTE_RELEASE_CANDIDATE_SEMANTIC_INVALID"]
  ])("returns a closed %s failure category", async (_name, makePayload, code) => {
    const result = await preflightRemoteReleaseCandidate({
      target: target("powershell"),
      addonName: "demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(makePayload()), stderr: "" })
    });
    expect(result).toMatchObject({ ok: false, error: { code } });
    expectNoPrivateEvidence(result);
  });

  test.each([
    ["nonzero", async () => ({ exitCode: 9, stdout: "private payload", stderr: "private failure" })],
    ["throw", async () => { throw new Error("private exception"); }],
    ["timeout", async () => { throw { signal: "SIGTERM", message: "private timeout" }; }]
  ])("closes %s transport failure with cleanup unknown and one invocation", async (_name, executor) => {
    let calls = 0;
    const result = await preflightRemoteReleaseCandidate({
      target: target("ssh"),
      addonName: "demo",
      executor: async (invocation) => {
        calls += 1;
        return executor(invocation) as never;
      }
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "REMOTE_RELEASE_CANDIDATE_TRANSPORT_FAILED" },
      releaseCandidate: {
        operation: { status: "not-reached" },
        artifactValidation: { status: "not-reached" },
        cleanup: { status: "unknown", verified: false },
        execution: { kind: "ssh", outcome: "uncertain" }
      }
    });
    expect(result.paths).toEqual({});
    expectNoPrivateEvidence(result);
  });
});

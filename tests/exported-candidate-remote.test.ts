import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import {
  EXPORTED_CANDIDATE_BOUNDARIES,
  parseExportedCandidateHandoffManifest,
  type ExportedCandidateHandoffManifest
} from "../src/exported-candidate.js";
import {
  cleanupRemoteExportedCandidate,
  exportRemoteReleaseCandidate
} from "../src/exported-candidate-remote.js";
import {
  buildRemoteCleanupExportedCandidateScript,
  buildRemoteExportedCandidateScript,
  buildRemoteHandoffLeaseProbeScript
} from "../src/exported-candidate-remote-script.js";
import { computeReleaseCandidateCombinedDigest } from "../src/release-candidate-result.js";
import {
  RELEASE_CANDIDATE_BOUNDARIES,
  RELEASE_CANDIDATE_CONTRACT_WARNING
} from "../src/release-candidate-result.js";

const target = {
  kind: "remote" as const,
  name: "private-target",
  transport: "ssh" as const,
  host: "example-host",
  username: "operator",
  dotaRoot: "C:/Dota"
};
const execFileAsync = promisify(execFile);

function handoff(): ExportedCandidateHandoffManifest {
  const entries = [{
    schemaVersion: "1.0" as const,
    root: "game" as const,
    path: "game/dota_addons/demo/addoninfo.txt",
    bytes: 4,
    sha256: "a".repeat(64)
  }];
  const combinedSha256 = computeReleaseCandidateCombinedDigest(entries);
  return {
    schemaVersion: "1.0",
    operation: "export_release_candidate",
    addonName: "demo",
    exportRoot: "C:\\Exports",
    destination: "C:\\Exports\\demo",
    targetKind: "ssh",
    fileCount: 1,
    combinedSha256,
    source: { gameAddon: "game/dota_addons/demo", contentAddon: "content/dota_addons/demo" },
    manifest: { schemaVersion: "1.0", entries, combinedSha256 },
    topology: [
      { kind: "directory", path: "content" },
      { kind: "directory", path: "game" },
      { kind: "directory", path: "game/dota_addons" },
      { kind: "directory", path: "game/dota_addons/demo" },
      { kind: "file", path: "game/dota_addons/demo/addoninfo.txt" }
    ],
    ownership: {
      schemaVersion: "1.0",
      ownershipId: "00000000-0000-4000-8000-000000000000",
      candidateIdentity: { kind: "windows", volumeIdentity: "volume", fileIdentity: "file" }
    },
    boundaries: EXPORTED_CANDIDATE_BOUNDARIES
  };
}

function exportPayload() {
  const manifest = handoff();
  const inclusionLedger = { schemaVersion: "1.0", expectedFileCount: 1, observedFileCount: 1, matchedFileCount: 1 };
  const scanCoverage = {
    schemaVersion: "1.0",
    totalFileCount: 1,
    text: { count: 1, paths: [manifest.manifest.entries[0]!.path] },
    binary: { count: 0, paths: [] },
    unreadable: { count: 0, paths: [] },
    oversized: { count: 0, paths: [] }
  };
  return JSON.stringify({
    schemaVersion: "1.0",
    operation: { status: "completed" },
    artifactValidation: { status: "passed", manifest: manifest.manifest, inclusionLedger, scanCoverage },
    blockers: [],
    ok: true,
    cleanup: { schemaVersion: "1.0", attempted: true, attempts: 1, status: "verified", verified: true, identityMatched: true, removed: true, absent: true },
    paths: { gameAddon: "game/dota_addons/demo", contentAddon: "content/dota_addons/demo" },
    execution: { kind: "remote", outcome: "completed", exitCode: 0 },
    warnings: [RELEASE_CANDIDATE_CONTRACT_WARNING],
    commands: [],
    logs: [],
    boundaries: RELEASE_CANDIDATE_BOUNDARIES,
    scanCoverage,
    manifest: manifest.manifest,
    inclusionLedger,
    export: manifest,
    exportPaths: { exportRoot: manifest.exportRoot, destination: manifest.destination, handoffManifest: `${manifest.destination}.dota-workshop-handoff.v1.json` },
    exportState: { schemaVersion: "1.0", promotionState: "promoted", candidateState: "present" },
    exportCleanup: {
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
    }
  });
}

describe("remote exported candidate", () => {
  test("builds target-native export and cleanup scripts without credential handling or transfer", () => {
    const exportScript = buildRemoteExportedCandidateScript({
      transport: "ssh",
      dotaRoot: "C:/Dota",
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo"
    });
    expect(exportScript).toContain("[IO.Directory]::Move($exportStaging, $destination)");
    expect(exportScript).toContain("Assert-NoReparseAncestry $exportRoot");
    expect(exportScript).toContain("$result.export = $handoff");
    expect(exportScript).toContain("$result.exportState");
    expect(exportScript).toContain("temporaryHandoffAbsent");
    expect(exportScript).not.toContain("-ErrorAction SilentlyContinue");
    expect(exportScript).not.toMatch(/Get-Credential|-Credential|scp|Copy-Item.*ComputerName/u);

    const cleanupScript = buildRemoteCleanupExportedCandidateScript({
      transport: "ssh",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      ownershipId: "00000000-0000-4000-8000-000000000000",
      manifestVersion: "1.0",
      combinedSha256: handoff().combinedSha256,
      dryRun: true
    });
    expect(cleanupScript).toContain("Assert-NoReparseAncestry $destination");
    expect(cleanupScript).toContain("function Get-CanonicalManifestDigest");
    expect(cleanupScript).toContain("Assert-StrictHandoff");
    expect(cleanupScript).toContain("Get-ObservedCandidate");
    expect(cleanupScript).toContain("CreateFileW");
    expect(cleanupScript).toContain("FILE_FLAG_OPEN_REPARSE_POINT");
    expect(cleanupScript).toContain("Invoke-ExportedCandidateCleanup");
    expect(cleanupScript.match(/function Invoke-ExportedCandidateCleanup/gu)).toHaveLength(1);
    expect(cleanupScript).toContain("candidateTombstone");
    expect(cleanupScript).toContain("Remove-Item -LiteralPath $candidateTombstone");
    expect(cleanupScript).toContain("Remove-Item -LiteralPath $handoffTombstone");
    expect(cleanupScript).not.toContain("IDENTITY_BOUND_DELETION_UNAVAILABLE");
    expect(cleanupScript).not.toMatch(/Get-Credential|-Credential|scp/u);
  });

  test.runIf(process.platform === "win32")("binds Windows handoff bytes to one no-follow lease", async () => {
    const root = await mkdtemp(join(tmpdir(), "handoff-lease-"));
    const handoffPath = join(root, "handoff.json");
    const replacementPath = join(root, "replacement.json");
    try {
      await writeFile(handoffPath, "original", "utf8");
      await writeFile(replacementPath, "hostile", "utf8");
      const script = buildRemoteHandoffLeaseProbeScript(handoffPath, replacementPath);
      const output = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script]);
      expect(JSON.parse(output.stdout)).toMatchObject({ replacementBlocked: true, text: "original" });
      expect(await readFile(handoffPath, "utf8")).toBe("original");
      expect(await readFile(replacementPath, "utf8")).toBe("hostile");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("normalizes strict remote export evidence and redacts target details", async () => {
    const result = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: exportPayload(), stderr: "" })
    });
    expect(result).toMatchObject({
      ok: true,
      target: { kind: "remote", host: "redacted", name: "remote-target" },
      manifest: { combinedSha256: handoff().combinedSha256 },
      cleanup: { status: "verified" }
    });
    expect(JSON.stringify(result)).not.toContain("example-host");
    expect(JSON.stringify(result)).not.toContain("operator");
  });

  test("rejects contradictory remote export preflight evidence", async () => {
    const payload = JSON.parse(exportPayload());
    payload.artifactValidation = { status: "blocked", blockers: [{ code: "SOURCE_ENTRY_UNSAFE", category: "source" }], scanCoverage: payload.scanCoverage };
    payload.blockers = [{ code: "SOURCE_ENTRY_UNSAFE", category: "source" }];
    payload.manifest = { schemaVersion: "1.0", entries: [], combinedSha256: computeReleaseCandidateCombinedDigest([]) };
    payload.inclusionLedger = { schemaVersion: "1.0", expectedFileCount: 99, observedFileCount: 0, matchedFileCount: 0 };
    payload.boundaries = { ...RELEASE_CANDIDATE_BOUNDARIES, upload: true };
    const result = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
    });
    expect(result).toMatchObject({ ok: false, error: { code: "REMOTE_EXPORT_SEMANTIC_INVALID" } });
  });

  test.each([
    { exportPaths: null },
    { exportPaths: { exportRoot: "C:\\Other", destination: "C:\\Other\\demo", handoffManifest: "C:\\Other\\demo.dota-workshop-handoff.v1.json" } },
    { exportState: { schemaVersion: "1.0", promotionState: "not-started", candidateState: "absent" } },
    { exportCleanup: { promotionState: "not-started" } }
  ])("rejects contradictory remote export state envelope %#", async (mutation) => {
    const payload = JSON.parse(exportPayload());
    if (mutation.exportCleanup !== undefined) payload.exportCleanup = { ...payload.exportCleanup, ...mutation.exportCleanup };
    else Object.assign(payload, mutation);
    const result = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
    });
    expect(result).toMatchObject({ ok: false, error: { code: "REMOTE_EXPORT_SEMANTIC_INVALID" } });
  });

  test.each(["EXPORT_ROOT_MISSING", "EXPORT_ROOT_PROTECTED", "DESTINATION_OUTSIDE_EXPORT_ROOT"])("preserves early remote export failure %s", async (code) => {
    const payload = JSON.parse(exportPayload());
    payload.ok = false;
    payload.blockers = [{ code, category: "export-isolation" }];
    delete payload.export;
    payload.exportState = { schemaVersion: "1.0", promotionState: "not-started", candidateState: "absent" };
    payload.exportCleanup = {
      schemaVersion: "1.0",
      mode: "export-failure",
      authorized: false,
      attempted: false,
      candidateRemoved: false,
      candidateAbsent: true,
      manifestRemoved: false,
      manifestAbsent: true,
      candidateState: "absent",
      manifestState: "absent",
      stagingRemoved: false,
      stagingAbsent: true,
      temporaryHandoffRemoved: false,
      temporaryHandoffAbsent: true,
      promotionState: "not-started",
      status: "failed",
      code
    };
    const result = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code },
      paths: payload.exportPaths,
      cleanup: { promotionState: "not-started", candidateState: "absent", manifestState: "absent" }
    });
  });

  test("preserves an unowned pre-existing remote destination as unknown", async () => {
    const payload = JSON.parse(exportPayload());
    payload.ok = false;
    payload.blockers = [{ code: "EXPORT_DESTINATION_EXISTS", category: "export-state" }];
    delete payload.export;
    payload.exportState = { schemaVersion: "1.0", promotionState: "not-started", candidateState: "unknown" };
    payload.exportCleanup = {
      schemaVersion: "1.0",
      mode: "export-failure",
      authorized: false,
      attempted: false,
      candidateRemoved: false,
      candidateAbsent: false,
      manifestRemoved: false,
      manifestAbsent: true,
      candidateState: "unknown",
      manifestState: "absent",
      stagingRemoved: false,
      stagingAbsent: true,
      temporaryHandoffRemoved: false,
      temporaryHandoffAbsent: true,
      promotionState: "not-started",
      status: "failed",
      code: "EXPORT_DESTINATION_EXISTS"
    };
    const result = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "EXPORT_DESTINATION_EXISTS" },
      paths: payload.exportPaths,
      cleanup: { candidateState: "unknown", candidateAbsent: false, promotionState: "not-started" }
    });
  });

  test("preserves strict remote export failure paths, state, cleanup, and ownership", async () => {
    const payload = JSON.parse(exportPayload());
    payload.ok = false;
    payload.blockers = [{ code: "HANDOFF_MANIFEST_PUBLICATION_FAILED", category: "export" }];
    payload.exportState = { schemaVersion: "1.0", promotionState: "promoted", candidateState: "present" };
    payload.exportCleanup = {
      schemaVersion: "1.0",
      mode: "export-failure",
      authorized: true,
      attempted: false,
      candidateRemoved: false,
      candidateAbsent: false,
      manifestRemoved: false,
      manifestAbsent: true,
      candidateState: "present",
      manifestState: "absent",
      stagingRemoved: false,
      stagingAbsent: true,
      temporaryHandoffRemoved: true,
      temporaryHandoffAbsent: true,
      promotionState: "promoted",
      status: "failed",
      code: "HANDOFF_MANIFEST_PUBLICATION_FAILED"
    };
    const result = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "HANDOFF_MANIFEST_PUBLICATION_FAILED" },
      paths: payload.exportPaths,
      manifest: { ownership: { ownershipId: handoff().ownership.ownershipId } },
      cleanup: { promotionState: "promoted", candidateState: "present", manifestState: "absent", stagingAbsent: true, temporaryHandoffAbsent: true }
    });
  });

  test("rejects hostile framing and transport uncertainty without fallback", async () => {
    const malformed = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => ({ exitCode: 0, stdout: `${exportPayload()}\n`, stderr: "" })
    });
    expect(malformed).toMatchObject({ ok: false, error: { code: "REMOTE_EXPORT_EVIDENCE_INVALID" } });

    const uncertain = await exportRemoteReleaseCandidate({
      target,
      addonName: "demo",
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      executor: async () => { throw new Error("private transport failure"); }
    });
    expect(uncertain).toMatchObject({ ok: false, error: { code: "REMOTE_EXPORTED_CANDIDATE_TRANSPORT_UNCERTAIN" } });
    expect(JSON.stringify(uncertain)).not.toContain("private transport failure");
  });

  test("normalizes remote dry-run and execute cleanup evidence", async () => {
    const manifest = handoff();
    for (const dryRun of [true, false]) {
      const cleanup = {
        schemaVersion: "1.0",
        mode: dryRun ? "dry-run" : "execute",
        authorized: true,
        attempted: !dryRun,
        candidateRemoved: !dryRun,
        candidateAbsent: !dryRun,
        manifestRemoved: !dryRun,
        manifestAbsent: !dryRun,
        candidateState: dryRun ? "present" : "absent",
        manifestState: dryRun ? "present" : "absent",
        status: "verified"
      };
      const result = await cleanupRemoteExportedCandidate({
        target,
        exportRoot: "C:/Exports",
        destination: "C:/Exports/demo",
        ownershipId: manifest.ownership.ownershipId,
        manifestVersion: "1.0",
        combinedSha256: manifest.combinedSha256,
        dryRun,
        executor: async () => ({
          exitCode: 0,
          stdout: JSON.stringify({
            schemaVersion: "1.0",
            ok: true,
            operation: "cleanup_exported_candidate",
            code: null,
            authorized: true,
            manifest,
            paths: { exportRoot: manifest.exportRoot, destination: manifest.destination, handoffManifest: `${manifest.destination}.dota-workshop-handoff.v1.json` },
            cleanup
          }),
          stderr: ""
        })
      });
      expect(result).toMatchObject({ ok: true, cleanup: { mode: cleanup.mode, status: "verified" } });
    }
  });

  test("rejects unrelated, impossible, and open-key cleanup success evidence", async () => {
    const manifest = handoff();
    const hostile = [
      { manifest: { ...manifest, destination: "D:\\Other\\unrelated" } },
      { cleanup: { schemaVersion: "1.0", mode: "execute", authorized: false, attempted: false, candidateRemoved: false, candidateAbsent: false, manifestRemoved: false, manifestAbsent: false, status: "verified" } },
      { paths: { exportRoot: manifest.exportRoot, destination: manifest.destination, handoffManifest: `${manifest.destination}.dota-workshop-handoff.v1.json`, candidateTombstone: "C:\\Exports\\.dota-workshop-candidate-delete-0123456789abcdef0123456789abcdef" } },
      { extra: true }
    ];
    for (const mutation of hostile) {
      const cleanup = { schemaVersion: "1.0", mode: "execute", authorized: true, attempted: true, candidateRemoved: true, candidateAbsent: true, manifestRemoved: true, manifestAbsent: true, candidateState: "absent", manifestState: "absent", status: "verified" };
      const paths = { exportRoot: manifest.exportRoot, destination: manifest.destination, handoffManifest: `${manifest.destination}.dota-workshop-handoff.v1.json` };
      const payload = { schemaVersion: "1.0", ok: true, operation: "cleanup_exported_candidate", code: null, authorized: true, manifest, paths, cleanup, ...mutation };
      const result = await cleanupRemoteExportedCandidate({
        target,
        exportRoot: "C:/Exports",
        destination: "C:/Exports/demo",
        ownershipId: manifest.ownership.ownershipId,
        manifestVersion: "1.0",
        combinedSha256: manifest.combinedSha256,
        dryRun: false,
        executor: async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: "" })
      });
      expect(result).toMatchObject({ ok: false });
    }
  });

  test("rejects unknown cleanup states with proven removal or absence", async () => {
    const manifest = handoff();
    for (const field of ["candidate", "manifest"] as const) {
      const cleanup = {
        schemaVersion: "1.0",
        mode: "execute",
        authorized: true,
        attempted: true,
        candidateRemoved: field === "candidate",
        candidateAbsent: field === "candidate",
        manifestRemoved: field === "manifest",
        manifestAbsent: field === "manifest",
        candidateState: field === "candidate" ? "unknown" : "present",
        manifestState: field === "manifest" ? "unknown" : "present",
        status: "failed",
        code: "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE"
      };
      const paths = { exportRoot: manifest.exportRoot, destination: manifest.destination, handoffManifest: `${manifest.destination}.dota-workshop-handoff.v1.json` };
      const result = await cleanupRemoteExportedCandidate({
        target,
        exportRoot: "C:/Exports",
        destination: "C:/Exports/demo",
        ownershipId: manifest.ownership.ownershipId,
        manifestVersion: "1.0",
        combinedSha256: manifest.combinedSha256,
        dryRun: false,
        executor: async () => ({ exitCode: 0, stdout: JSON.stringify({ schemaVersion: "1.0", ok: false, operation: "cleanup_exported_candidate", code: cleanup.code, authorized: true, manifest, paths, cleanup }), stderr: "" })
      });
      expect(result).toMatchObject({ ok: false, manifest: null, ownership: null });
    }
  });

  test.each([
    {
      name: "pre-removal failure",
      code: "CANDIDATE_IDENTITY_MISMATCH",
      cleanup: { candidateState: "present", manifestState: "present", candidateRemoved: false, candidateAbsent: false, manifestRemoved: false, manifestAbsent: false },
      extraPaths: {}
    },
    {
      name: "partial removal",
      code: "HANDOFF_IDENTITY_MISMATCH",
      cleanup: { candidateState: "absent", manifestState: "present", candidateRemoved: true, candidateAbsent: true, manifestRemoved: false, manifestAbsent: false },
      extraPaths: {}
    },
    {
      name: "identity mismatch restored",
      code: "CANDIDATE_IDENTITY_MISMATCH",
      cleanup: { candidateState: "present", manifestState: "present", candidateRemoved: false, candidateAbsent: false, manifestRemoved: false, manifestAbsent: false },
      extraPaths: {}
    },
    {
      name: "retained tombstone",
      code: "EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE",
      cleanup: { candidateState: "tombstoned", manifestState: "present", candidateRemoved: false, candidateAbsent: false, manifestRemoved: false, manifestAbsent: false },
      extraPaths: { candidateTombstone: "C:\\Exports\\.dota-workshop-candidate-delete-0123456789abcdef0123456789abcdef" }
    }
  ])("preserves validated evidence for $name", async ({ code, cleanup: state, extraPaths }) => {
    const manifest = handoff();
    const cleanup = {
      schemaVersion: "1.0",
      mode: "execute",
      authorized: true,
      attempted: true,
      status: "failed",
      code,
      ...state
    };
    const paths = { exportRoot: manifest.exportRoot, destination: manifest.destination, handoffManifest: `${manifest.destination}.dota-workshop-handoff.v1.json`, ...extraPaths };
    const result = await cleanupRemoteExportedCandidate({
      target,
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      ownershipId: manifest.ownership.ownershipId,
      manifestVersion: "1.0",
      combinedSha256: manifest.combinedSha256,
      dryRun: false,
      executor: async () => ({ exitCode: 0, stdout: JSON.stringify({ schemaVersion: "1.0", ok: false, operation: "cleanup_exported_candidate", code, authorized: true, manifest, paths, cleanup }), stderr: "" })
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code },
      manifest: { ownership: { ownershipId: manifest.ownership.ownershipId } },
      ownership: { ownershipId: manifest.ownership.ownershipId },
      paths,
      cleanup: state
    });
  });

  test("strictly parses hostile handoff nesting without throwing", () => {
    const valid = handoff();
    expect(parseExportedCandidateHandoffManifest({ ...valid, extra: true })).toBeUndefined();
    expect(parseExportedCandidateHandoffManifest({ ...valid, ownership: { ...valid.ownership, ownershipId: "not-a-uuid" } })).toBeUndefined();
    expect(parseExportedCandidateHandoffManifest({ ...valid, manifest: { ...valid.manifest, entries: [null] } })).toBeUndefined();
    expect(parseExportedCandidateHandoffManifest({ ...valid, topology: [...valid.topology, { kind: "directory", path: "game" }] })).toBeUndefined();
    expect(parseExportedCandidateHandoffManifest({
      ...valid,
      topology: valid.topology.filter((entry) => entry.path !== "game/dota_addons")
    })).toBeUndefined();
  });

  test("rejects ambiguous remote paths before execution", () => {
    for (const path of ["C:/Exports/../Windows/demo", "C:/Exports/demo:stream", "\\\\?\\C:\\Exports\\demo", "C:/Exports/demo."]) {
      expect(() => buildRemoteExportedCandidateScript({ transport: "ssh", dotaRoot: "C:/Dota", addonName: "demo", exportRoot: "C:/Exports", destination: path })).toThrow("REMOTE_EXPORT_PATH_INVALID");
    }
  });

  test.each(["ssh", "powershell"] as const)("preserves destructive %s transport uncertainty", async (transport) => {
    const manifest = handoff();
    const result = await cleanupRemoteExportedCandidate({
      target: { ...target, transport },
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      ownershipId: manifest.ownership.ownershipId,
      manifestVersion: "1.0",
      combinedSha256: manifest.combinedSha256,
      dryRun: false,
      executor: async () => { throw new Error("transport interrupted"); }
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "REMOTE_EXPORTED_CANDIDATE_TRANSPORT_UNCERTAIN" },
      cleanup: { mode: "execute", attempted: false, candidateRemoved: false, manifestRemoved: false }
    });
    expect(result.warnings.join(" ")).toContain("do not retry");
  });
});

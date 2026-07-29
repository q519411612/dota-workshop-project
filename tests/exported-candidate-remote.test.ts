import { describe, expect, test } from "vitest";
import {
  EXPORTED_CANDIDATE_BOUNDARIES,
  type ExportedCandidateHandoffManifest
} from "../src/exported-candidate.js";
import {
  cleanupRemoteExportedCandidate,
  exportRemoteReleaseCandidate
} from "../src/exported-candidate-remote.js";
import {
  buildRemoteCleanupExportedCandidateScript,
  buildRemoteExportedCandidateScript
} from "../src/exported-candidate-remote-script.js";
import { computeReleaseCandidateCombinedDigest } from "../src/release-candidate-result.js";

const target = {
  kind: "remote" as const,
  name: "private-target",
  transport: "ssh" as const,
  host: "example-host",
  username: "operator",
  dotaRoot: "C:/Dota"
};

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
  return JSON.stringify({
    schemaVersion: "1.0",
    ok: true,
    cleanup: { status: "verified" },
    export: manifest,
    exportCleanup: {
      schemaVersion: "1.0",
      mode: "export-failure",
      authorized: true,
      attempted: false,
      candidateRemoved: false,
      candidateAbsent: false,
      manifestRemoved: false,
      manifestAbsent: false,
      stagingRemoved: false,
      stagingAbsent: true,
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
    expect(exportScript).not.toMatch(/Get-Credential|-Credential|scp|Copy-Item.*ComputerName/u);

    const cleanupScript = buildRemoteCleanupExportedCandidateScript({
      exportRoot: "C:/Exports",
      destination: "C:/Exports/demo",
      ownershipId: "00000000-0000-4000-8000-000000000000",
      manifestVersion: "1.0",
      combinedSha256: handoff().combinedSha256,
      dryRun: true
    });
    expect(cleanupScript).toContain("Assert-NoReparseAncestry $destination");
    expect(cleanupScript).toContain("Get-CanonicalManifestDigest $observed");
    expect(cleanupScript).not.toMatch(/Get-Credential|-Credential|scp/u);
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
    expect(uncertain).toMatchObject({ ok: false, error: { code: "REMOTE_EXPORTED_CANDIDATE_TRANSPORT_FAILED" } });
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
        executor: async () => ({ exitCode: 0, stdout: JSON.stringify({ schemaVersion: "1.0", ok: true, operation: "cleanup_exported_candidate", code: null, manifest, cleanup }), stderr: "" })
      });
      expect(result).toMatchObject({ ok: true, cleanup: { mode: cleanup.mode, status: "verified" } });
    }
  });
});


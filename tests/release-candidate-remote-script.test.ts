import { describe, expect, test } from "vitest";
import {
  REMOTE_RELEASE_CANDIDATE_POLICY,
  buildRemoteReleaseCandidateScript
} from "../src/release-candidate-remote-script.js";
import { MAX_SECRET_SCAN_BYTES, RELEASE_METADATA_KEYS } from "../src/release-readiness.js";
import { RELEASE_CANDIDATE_BOUNDARIES } from "../src/release-candidate-result.js";

describe("remote release candidate PowerShell lifecycle", () => {
  const input = {
    dotaRoot: "C:/Steam/steamapps/common/dota 2 beta",
    addonName: "demo_addon"
  } as const;

  test("embeds the shared versioned policy and canonical vectors deterministically", () => {
    const first = buildRemoteReleaseCandidateScript(input);
    const second = buildRemoteReleaseCandidateScript(input);

    expect(first).toBe(second);
    expect(REMOTE_RELEASE_CANDIDATE_POLICY).toEqual({
      schemaVersion: "1.0",
      maxSecretScanBytes: MAX_SECRET_SCAN_BYTES,
      releaseMetadataKeys: RELEASE_METADATA_KEYS,
      boundaries: RELEASE_CANDIDATE_BOUNDARIES,
      canonicalVector: {
        value: [["1.0", "content", "content/dota_addons/demo/maps/demo.vmap", 7, "a".repeat(64)]],
        sha256: "5ad3563c7afd90fba5668732db4b4f78a7c5d00593d11510093a08687373d443"
      }
    });
    expect(first).toContain(`$SchemaVersion = '1.0'`);
    expect(first).toContain(`$MaxSecretScanBytes = ${MAX_SECRET_SCAN_BYTES}`);
    for (const key of RELEASE_METADATA_KEYS) expect(first).toContain(`'${key}'`);
    for (const [key, value] of Object.entries(RELEASE_CANDIDATE_BOUNDARIES)) {
      expect(first).toContain(`${key} = $${value ? "true" : "false"}`);
    }
    expect(first).toContain(REMOTE_RELEASE_CANDIDATE_POLICY.canonicalVector.sha256);
  });

  test("generates one complete target-native lifecycle with finally-owned cleanup", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    for (const fragment of [
      "Assert-SafeSourceTree",
      "Get-SourceInventory",
      "Test-ReleaseReadiness",
      "New-CandidateRoot",
      "Copy-FileStreamed",
      "Get-FileSha256",
      "Assert-SourceStable",
      "Assert-CandidateLedger",
      "Assert-CandidateTopology",
      "Get-CanonicalManifestDigest"
    ]) expect(script).toContain(fragment);
    expect(script).toContain("[IO.FileAttributes]::ReparsePoint");
    expect(script).toContain("[StringComparer]::Ordinal");
    expect(script).toContain("[StringComparison]::OrdinalIgnoreCase");
    expect(script).toContain("finally {");
    expect(script.match(/Remove-Item -LiteralPath \$candidateRoot/g)).toHaveLength(1);
    expect(script).toContain("attempts = 1");
    expect(script).toContain("$result.cleanup.absent = -not (Test-Path -LiteralPath $candidateRoot)");
    expect(script).not.toContain("Get-ChildItem -LiteralPath ([IO.Path]::GetTempPath())");
  });

  test("matches required readiness paths and revalidates source identity at every use", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("resource/addon_' + $AddonName + '_english.txt");
    expect(script).toContain("scripts/npc/herolist.txt");
    expect(script).not.toContain("resource/addon_english.txt");
    expect(script).not.toContain("scripts/npc/npc_heroes.txt");
    for (const requiredText of [
      "addoninfo.txt",
      "scripts/vscripts/addon_game_mode.lua",
      "resource/addon_' + $AddonName + '_english.txt",
      "scripts/npc/herolist.txt",
      "scripts/npc/npc_heroes_custom.txt",
      "scripts/npc/npc_units_custom.txt",
      "scripts/npc/npc_abilities_custom.txt"
    ]) expect(script).toContain(requiredText);
    expect(script).toContain("function Assert-SafeSourceRoot");
    expect(script).toContain("function Assert-SafeSourceFile");
    expect(script.match(/Assert-SafeSourceFile \$file/g)?.length).toBeGreaterThanOrEqual(3);
    expect(script).toContain("Assert-SafeSourceFile $metadataFile; $metadataText");
    expect(script).toContain("SOURCE_IDENTITY_SENSITIVE");
    expect(script).toContain("host|username");
  });

  test("reconciles structural ancestors and preserves canonical single-entry shape", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("@('game', 'game/dota_addons', 'game/dota_addons/' + $AddonName");
    expect(script).toContain("'content', 'content/dota_addons', 'content/dota_addons/' + $AddonName)");
    expect(script).toContain("ConvertTo-Json -InputObject $rows -Depth 4 -Compress");
    expect(script).toContain("ConvertTo-Json -InputObject $expected -Compress");
    expect(script).toContain("ConvertTo-Json -InputObject $observed -Compress");
  });

  test("keeps blocked domains complete and cleanup codes fact-consistent", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("status = 'blocked'; blockers = @($result.blockers); scanCoverage = $result.scanCoverage");
    expect(script).toContain("$result.cleanup.code = 'CANDIDATE_IDENTITY_MISMATCH'");
    expect(script).toContain("function Assert-CandidateRoot");
    expect(script).toContain("Assert-CandidateRoot $candidateRoot $candidateIdentity");
  });

  test("has one compact JSON stdout path and suppresses incidental cmdlet output", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script.match(/ConvertTo-Json -Depth 20 -Compress/g)).toHaveLength(1);
    expect(script.match(/\[Console\]::Out\.Write/g)).toHaveLength(1);
    expect(script).not.toMatch(/Write-(?:Output|Host|Warning|Error|Verbose|Debug)/);
    expect(script).toContain("| Out-Null");
    expect(script).not.toContain("$_.Exception.Message");
    expect(script).not.toContain("$Error[");
    expect(script).not.toContain("$env:USERNAME");
    expect(script).not.toContain("$env:COMPUTERNAME");
  });

  test("keeps files target-local and excludes mutation and release side effects", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).not.toMatch(/\b(?:scp|sftp|rsync|curl|Invoke-WebRequest|Start-BitsTransfer)\b/i);
    expect(script).not.toMatch(/\b(?:Compress-Archive|Expand-Archive|Start-Process|dota2\.exe)\b/i);
    expect(script).not.toMatch(/\b(?:New-PSSession|Get-Credential|CredentialManager|SteamCmd|WorkshopItem)\b/i);
    expect(script).not.toMatch(/\b(?:Set-Content|Add-Content|Out-File|Export-Clixml)\b/i);
    expect(script).not.toContain("-Credential");
    expect(script).not.toContain("-AsJob");
    expect(script).not.toContain("-Persist");
    expect(script).toContain("[IO.FileStream]::new");
  });

  test("emits only semantic relative identities and safe failure codes", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("game/dota_addons/$AddonName");
    expect(script).toContain("content/dota_addons/$AddonName");
    expect(script).toContain("SOURCE_OBSERVATION_FAILED");
    expect(script).not.toContain("gameAddon = $gameAddonRoot");
    expect(script).not.toContain("contentAddon = $contentAddonRoot");
    expect(script).not.toContain("candidateRoot = $candidateRoot");
    expect(script).not.toContain("FullName =");
  });

  test("rejects invalid host inputs before generating any script", () => {
    expect(() => buildRemoteReleaseCandidateScript({ ...input, addonName: "../demo" })).toThrow("INVALID_ADDON_NAME");
    expect(() => buildRemoteReleaseCandidateScript({ ...input, dotaRoot: "" })).toThrow("REMOTE_DOTA_ROOT_REQUIRED");
    expect(() => buildRemoteReleaseCandidateScript({ ...input, dotaRoot: "C:/bad\0root" })).toThrow("REMOTE_DOTA_ROOT_INVALID");
  });
});

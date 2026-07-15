import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  REMOTE_RELEASE_CANDIDATE_POLICY,
  buildRemoteReleaseCandidateScript
} from "../src/release-candidate-remote-script.js";
import {
  MAX_SECRET_SCAN_BYTES,
  RELEASE_METADATA_KEYS,
  RELEASE_SENSITIVE_MATERIAL_RULES
} from "../src/release-readiness.js";
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
    const canonicalValue = [
      "1.0",
      [["content", "content/dota_addons/demo/maps/demo.vmap", 7, "a".repeat(64)]]
    ];
    expect(REMOTE_RELEASE_CANDIDATE_POLICY).toEqual({
      schemaVersion: "1.0",
      maxSecretScanBytes: MAX_SECRET_SCAN_BYTES,
      releaseMetadataKeys: RELEASE_METADATA_KEYS,
      sensitiveMaterialRules: RELEASE_SENSITIVE_MATERIAL_RULES,
      boundaries: RELEASE_CANDIDATE_BOUNDARIES,
      precreationArtifactStatus: "not-reached",
      contractEvidenceWarning: "contract evidence only; real Windows runtime behavior is not proven",
      canonicalVector: {
        value: canonicalValue,
        sha256: createHash("sha256").update(JSON.stringify(canonicalValue), "utf8").digest("hex")
      }
    });
    expect(first).toContain(`$SchemaVersion = '1.0'`);
    expect(first).toContain("$SensitiveMaterialRulesJson = '");
    expect(first).toContain(`$MaxSecretScanBytes = ${MAX_SECRET_SCAN_BYTES}`);
    for (const key of RELEASE_METADATA_KEYS) expect(first).toContain(`'${key}'`);
    for (const [key, value] of Object.entries(RELEASE_CANDIDATE_BOUNDARIES)) {
      expect(first).toContain(`${key} = $${value ? "true" : "false"}`);
    }
    expect(first).toContain(REMOTE_RELEASE_CANDIDATE_POLICY.canonicalVector.sha256);
  });

  test("embeds every categorized shared sensitive-material rule without first-match collapse", () => {
    const script = buildRemoteReleaseCandidateScript(input);
    const start = script.indexOf("function Test-ReleaseReadiness");
    const end = script.indexOf("\nfunction ", start + 1);
    const functionText = script.slice(start, end);

    for (const rule of RELEASE_SENSITIVE_MATERIAL_RULES) {
      expect(script).toContain(`"category":"${rule.category}"`);
    }
    expect(functionText).toContain("foreach ($rule in $SensitiveMaterialRules)");
    expect(functionText).toContain("Add-Blocker 'SENSITIVE_MATERIAL' $rule.category");
    expect(functionText).not.toContain("$patterns = @(");
    expect(functionText).not.toContain("break");
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
    expect(script).toContain("ConvertTo-Json -InputObject $payload -Depth 4 -Compress");
    expect(script).toContain("$payload = [object[]]::new(2)");
    expect(script).toContain("$payload[0] = $SchemaVersion");
    expect(script).toContain("$payload[1] = [object[]]$rows");
    expect(script).toContain("@($entry.root, $entry.path, [long]$entry.bytes, $entry.sha256)");
    expect(script).not.toContain("@($entry.schemaVersion, $entry.root");
    expect(script).toContain("Get-CanonicalManifestDigest $CanonicalVectorEntries");
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

  test("preserves exact lifecycle blockers instead of collapsing exceptions", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("function Stop-ReleaseCandidate");
    for (const code of [
      "SOURCE_ENTRY_UNSAFE",
      "SOURCE_ENTRY_OUTSIDE_ROOT",
      "SOURCE_FILE_IDENTITY_CHANGED",
      "SOURCE_CHANGED_DURING_ASSEMBLY",
      "RELEASE_CANDIDATE_INTEGRITY_MISMATCH",
      "CANDIDATE_LEDGER_MISSING",
      "CANDIDATE_TREE_UNEXPECTED",
      "TEMP_PARENT_NOT_ISOLATED",
      "CANDIDATE_ROOT_NOT_ISOLATED"
    ]) {
      expect(script).toContain(`Stop-ReleaseCandidate '${code}'`);
    }
    expect(script).toContain("REMOTE_LIFECYCLE_INTERNAL_FAILURE");
    expect(script).not.toContain("Add-Blocker 'SOURCE_OBSERVATION_FAILED' 'remote-script'");
  });

  test("binds source reads and cleanup to target-native identities", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("function Get-WindowsFileIdentity");
    expect(script).toContain("fsutil.exe file queryFileID");
    expect(script).toContain("function Assert-SafeSourceAncestors");
    expect(script).toContain("fileIdentity = Get-WindowsFileIdentity $entry.FullName");
    expect(script).toContain("Assert-SafeSourceAncestors $File.sourceRoot $File.source");
    expect(script).toContain("Get-WindowsFileIdentity $File.source");
    expect(script).toContain("function Assert-OwnedCandidateRoot");
    expect(script).toContain("Get-WindowsPathIdentity $CandidateRoot");
    expect(script).not.toContain("Add-Type");
  });

  test("requires bidirectional temp and source disjointness before materialization", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("function Test-PathsDisjoint");
    expect(script).toContain("Test-PathsDisjoint $parent $DotaRoot");
    expect(script).toContain("Test-PathsDisjoint $path $GameRoot");
    expect(script).toContain("Test-PathsDisjoint $path $ContentRoot");
    expect(script).toContain("New-CandidateRoot $dotaRoot $gameAddonRoot $contentAddonRoot");
  });

  test("registers candidate ownership before fallible identity acquisition", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    const createIndex = script.indexOf("[IO.Directory]::CreateDirectory($path)");
    const registerIndex = script.indexOf("$script:candidateRoot = $path", createIndex);
    const identityIndex = script.indexOf("Get-WindowsPathIdentity $path", createIndex);
    expect(createIndex).toBeGreaterThan(0);
    expect(registerIndex).toBeGreaterThan(createIndex);
    expect(identityIndex).toBeGreaterThan(registerIndex);
    expect(script).toContain("$script:candidateCreated = $true");
    expect(script).toContain("CANDIDATE_CLEANUP_IDENTITY_UNAVAILABLE");
    expect(script).toContain("if ($candidateCreated)");
  });

  test("re-inventories exact file and directory topology before success", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("function Assert-SafeSourceDirectory");
    expect(script).toContain("fileIdentity = Get-WindowsFileIdentity $Root");
    expect(script).toContain("function Get-InventoryTopology");
    expect(script).toContain("$finalGameInventory = Get-SourceInventory 'game' $GameRoot");
    expect(script).toContain("$finalContentInventory = Get-SourceInventory 'content' $ContentRoot");
    expect(script).toContain("SOURCE_CHANGED_DURING_ASSEMBLY");
  });

  test("projects the manifest only from a final candidate byte observation", () => {
    const script = buildRemoteReleaseCandidateScript(input);
    const sourceFinalIndex = script.indexOf("Assert-SourceStable $script:allFiles $before");
    const candidateFinalIndex = script.indexOf("$finalEntries = Get-FinalCandidateEntries", sourceFinalIndex);
    const manifestIndex = script.indexOf("entries = @($finalEntries)", candidateFinalIndex);

    expect(script).toContain("function Get-FinalCandidateEntries");
    expect(script).toContain("$candidateHash = Get-HexDigest ($sha.ComputeHash($stream))");
    expect(sourceFinalIndex).toBeGreaterThan(0);
    expect(candidateFinalIndex).toBeGreaterThan(sourceFinalIndex);
    expect(manifestIndex).toBeGreaterThan(candidateFinalIndex);
    expect(script).toContain("Assert-CandidateLedger $script:allFiles $finalEntries");
    expect(script).toContain("Get-CanonicalManifestDigest $finalEntries");
    expect(script).not.toContain("$entries = @(); foreach ($file in $script:allFiles)");
  });

  test("binds final candidate hashing and projection to captured target-native identities", () => {
    const script = buildRemoteReleaseCandidateScript(input);
    const copyStart = script.indexOf("function Copy-FileStreamed");
    const copyEnd = script.indexOf("\nfunction ", copyStart + 1);
    const copyFunction = script.slice(copyStart, copyEnd);
    const observationStart = script.indexOf("function Get-IdentityBoundCandidateObservation");
    const observationEnd = script.indexOf("\nfunction ", observationStart + 1);
    const observationFunction = script.slice(observationStart, observationEnd);
    const beforeProjection = script.indexOf("Assert-CandidateProjectionIdentity", script.indexOf("$finalEntries ="));
    const manifestIndex = script.indexOf("$manifest =", beforeProjection);
    const afterProjection = script.indexOf("Assert-CandidateProjectionIdentity", manifestIndex);

    expect(copyFunction).toContain("$destinationStream = [IO.FileStream]::new($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)");
    expect(copyFunction).not.toContain("[IO.FileShare]::Delete");
    expect(copyFunction).toContain("Get-WindowsPathIdentity $Destination");
    expect(copyFunction.indexOf("Get-WindowsPathIdentity $Destination")).toBeLessThan(copyFunction.indexOf("$destinationStream.Dispose()"));
    expect(script).toContain("$candidateFileIdentities = @{}");
    expect(script).toContain("$candidateFileIdentities[$file.identity] = Copy-FileStreamed");
    expect(observationFunction).toContain("[IO.FileStream]::new($candidate, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)");
    expect(observationFunction).toContain("Get-WindowsPathIdentity $candidate");
    expect(script).toContain("volumeIdentity = $volumeIdentity; fileIdentity = $fileIdentity");
    expect(observationFunction).toContain("Test-IdentityTupleEqual $firstIdentity $ExpectedIdentity");
    expect(observationFunction).toContain("Test-IdentityTupleEqual $secondIdentity $ExpectedIdentity");
    expect(observationFunction).toContain("RELEASE_CANDIDATE_IDENTITY_CHANGED");
    expect(script).toContain("CANDIDATE_ROOT_IDENTITY_CHANGED");
    expect(observationFunction).toContain("$sha.ComputeHash($stream)");
    expect(observationFunction).not.toContain("Get-FileSha256 $candidate");
    expect(script).toContain("function Assert-CandidateProjectionIdentity");
    expect(beforeProjection).toBeGreaterThan(0);
    expect(manifestIndex).toBeGreaterThan(beforeProjection);
    expect(afterProjection).toBeGreaterThan(manifestIndex);
  });

  test("embeds and uses the shared precreation and warning contract", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("$PrecreationArtifactStatus = 'not-reached'");
    expect(script).toContain("$ContractEvidenceWarning = 'contract evidence only; real Windows runtime behavior is not proven'");
    expect(script).toContain("artifactValidation = [ordered]@{ status = $PrecreationArtifactStatus }");
    expect(script).toContain("warnings = @($ContractEvidenceWarning)");
    expect(script).not.toContain("$result.warnings += 'non-text file included'");
    expect(script).toContain("if ($result.artifactValidation.status -eq 'not-reached' -and $candidateCreated)");
  });

  test("rejects reparse aliases and revalidates canonical isolation identities", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("function Assert-NoReparseAncestry");
    expect(script).toContain("Assert-NoReparseAncestry $parent 'TEMP_PARENT_NOT_ISOLATED'");
    expect(script).toContain("Assert-NoReparseAncestry $DotaRoot 'SOURCE_ENTRY_UNSAFE'");
    expect(script).toContain("function New-IsolationLease");
    expect(script).toContain("function Test-IsolationLease");
    expect(script).toContain("tempIdentity = Get-WindowsFileIdentity $parent");
    expect(script).toContain("dotaIdentity = Get-WindowsFileIdentity $DotaRoot");
    expect(script).toContain("Test-IsolationLease $IsolationLease");
  });

  test("proves physical disjointness with target-native ancestor identity chains", () => {
    const script = buildRemoteReleaseCandidateScript(input);

    expect(script).toContain("function Get-WindowsVolumeIdentity");
    expect(script).toContain("mountvol.exe $root /L");
    expect(script).toContain("function Get-WindowsIdentityChain");
    expect(script).toContain("function Test-IdentityChainsEqual");
    expect(script).toContain("function Test-IdentityChainsDisjoint");
    expect(script).toContain("volumeIdentity = $volumeIdentity; fileIdentity = $fileIdentity");
    expect(script).toContain(".volumeIdentity.Equals(");
    expect(script).toContain(".fileIdentity.Equals(");
    expect(script).toContain("tempChain = Get-WindowsIdentityChain $parent");
    expect(script).toContain("dotaChain = Get-WindowsIdentityChain $DotaRoot");
    expect(script).toContain("Test-IdentityChainsDisjoint $tempChain $dotaChain");
    expect(script).toContain("Test-IdentityChainsDisjoint $tempChain $gameChain");
    expect(script).toContain("Test-IdentityChainsDisjoint $tempChain $contentChain");
  });

  test("keeps cleanup lease revalidation side-effect-free", () => {
    const script = buildRemoteReleaseCandidateScript(input);
    const start = script.indexOf("function Test-IsolationLease");
    const end = script.indexOf("\nfunction ", start + 1);
    const functionText = script.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(functionText).toContain("Get-WindowsIdentityChain");
    expect(functionText).toContain("return $false");
    expect(functionText).not.toContain("Stop-ReleaseCandidate");
    expect(functionText).not.toContain("Add-Blocker");
    expect(script).toContain("else { $result.cleanup = [ordered]@{ schemaVersion = $SchemaVersion; attempted = $true; attempts = 1; status = 'failed'; verified = $false; code = 'CANDIDATE_CLEANUP_RESULT_INVALID' } }");
    expect(script).toContain("Add-Blocker $result.cleanup.code 'removal'");
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
    expect(script).toContain("REMOTE_LIFECYCLE_INTERNAL_FAILURE");
    expect(script).not.toContain("SOURCE_OBSERVATION_FAILED");
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

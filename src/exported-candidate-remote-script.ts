import { validateAddonName } from "./addon.js";
import {
  EXPORTED_CANDIDATE_BOUNDARIES,
  EXPORTED_CANDIDATE_HANDOFF_SUFFIX
} from "./exported-candidate.js";
import { buildRemoteReleaseCandidateScript } from "./release-candidate-remote-script.js";

export type RemoteExportScriptInput = Readonly<{
  transport: "ssh" | "powershell";
  dotaRoot: string;
  addonName: string;
  exportRoot: string;
  destination: string;
}>;

export type RemoteCleanupScriptInput = Readonly<{
  exportRoot: string;
  destination: string;
  ownershipId: string;
  manifestVersion: "1.0";
  combinedSha256: string;
  dryRun: boolean;
}>;

export function buildRemoteExportedCandidateScript(input: RemoteExportScriptInput): string {
  if (!validateAddonName(input.addonName).ok) throw new Error("INVALID_ADDON_NAME");
  for (const path of [input.exportRoot, input.destination]) validateRemotePath(path);
  const exportRoot = encodedExpression(input.exportRoot);
  const destination = encodedExpression(input.destination);
  const boundariesJson = JSON.stringify(EXPORTED_CANDIDATE_BOUNDARIES);
  const handoffSuffix = quotePowerShell(EXPORTED_CANDIDATE_HANDOFF_SUFFIX);
  const statements = [
    `    $ExportRootInput = ${exportRoot}; $DestinationInput = ${destination}`,
    "    $exportStaging = $null; $exportPromoted = $false; $temporaryHandoff = $null",
    "    try {",
    "      $exportRoot = [IO.Path]::GetFullPath($ExportRootInput).TrimEnd('\\', '/'); $destination = [IO.Path]::GetFullPath($DestinationInput).TrimEnd('\\', '/')",
    "      if (-not (Test-Path -LiteralPath $exportRoot -PathType Container)) { Stop-ReleaseCandidate 'EXPORT_ROOT_MISSING' 'export-isolation' }",
    "      Assert-NoReparseAncestry $exportRoot 'EXPORT_ROOT_UNSAFE'",
    "      $destinationParent = [IO.Path]::GetDirectoryName($destination).TrimEnd('\\', '/'); if (-not $destinationParent.Equals($exportRoot, [StringComparison]::OrdinalIgnoreCase)) { Stop-ReleaseCandidate 'DESTINATION_OUTSIDE_EXPORT_ROOT' 'export-isolation' }",
    "      if (-not (Test-PathsDisjoint $exportRoot $dotaRoot) -or -not (Test-PathsDisjoint $exportRoot $gameAddonRoot) -or -not (Test-PathsDisjoint $exportRoot $contentAddonRoot)) { Stop-ReleaseCandidate 'EXPORT_ROOT_PROTECTED' 'export-isolation' }",
    `      $handoffPath = $destination + ${handoffSuffix}; if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $handoffPath)) { Stop-ReleaseCandidate 'EXPORT_DESTINATION_EXISTS' 'export-state' }`,
    "      $exportStaging = Join-Path $exportRoot ('.dota-workshop-export-' + [Guid]::NewGuid().ToString('N')); [IO.Directory]::CreateDirectory($exportStaging) | Out-Null",
    "      foreach ($item in @(Get-ChildItem -LiteralPath $candidateRoot -Recurse -Force)) { $relative = Get-SafeRelativePath $candidateRoot $item.FullName; $targetPath = Join-Path $exportStaging $relative; if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseCandidate 'SOURCE_ENTRY_UNSAFE' 'export-staging' $relative }; if ($item.PSIsContainer) { [IO.Directory]::CreateDirectory($targetPath) | Out-Null } elseif ($item -is [IO.FileInfo]) { [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($targetPath)) | Out-Null; Copy-FileStreamed $item.FullName $targetPath | Out-Null } else { Stop-ReleaseCandidate 'SOURCE_ENTRY_UNSAFE' 'export-staging' $relative } }",
    "      foreach ($entry in $manifest.entries) { $stagedPath = Join-Path $exportStaging $entry.path; $stagedItem = Get-Item -LiteralPath $stagedPath -Force; if (-not ($stagedItem -is [IO.FileInfo]) -or ($stagedItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [long]$stagedItem.Length -ne [long]$entry.bytes -or (Get-FileSha256 $stagedPath) -cne $entry.sha256) { Stop-ReleaseCandidate 'STAGING_MANIFEST_MISMATCH' 'export-integrity' $entry.path } }",
    "      if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $handoffPath)) { Stop-ReleaseCandidate 'DESTINATION_STATE_CHANGED' 'export-state' }",
    "      [IO.Directory]::Move($exportStaging, $destination); $exportPromoted = $true",
    "      $destinationIdentity = Get-WindowsPathIdentity $destination; foreach ($entry in $manifest.entries) { $finalPath = Join-Path $destination $entry.path; $finalItem = Get-Item -LiteralPath $finalPath -Force; if (-not ($finalItem -is [IO.FileInfo]) -or ($finalItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [long]$finalItem.Length -ne [long]$entry.bytes -or (Get-FileSha256 $finalPath) -cne $entry.sha256) { Stop-ReleaseCandidate 'PROMOTED_MANIFEST_MISMATCH' 'export-integrity' $entry.path } }",
    `      $exportBoundaries = @(${quotePowerShell(boundariesJson)} | ConvertFrom-Json); $ownership = [ordered]@{ schemaVersion = '1.0'; ownershipId = [Guid]::NewGuid().ToString(); candidateIdentity = [ordered]@{ kind = 'windows'; volumeIdentity = $destinationIdentity.volumeIdentity; fileIdentity = $destinationIdentity.fileIdentity } }; $handoff = [ordered]@{ schemaVersion = '1.0'; operation = 'export_release_candidate'; addonName = $AddonName; exportRoot = $exportRoot; destination = $destination; targetKind = '${input.transport}'; fileCount = $manifest.entries.Count; combinedSha256 = $manifest.combinedSha256; source = [ordered]@{ gameAddon = ('game/dota_addons/' + $AddonName); contentAddon = ('content/dota_addons/' + $AddonName) }; manifest = $manifest; ownership = $ownership; boundaries = $exportBoundaries }`,
    "      $temporaryHandoff = Join-Path $exportRoot ('.dota-workshop-handoff-' + [Guid]::NewGuid().ToString('N') + '.json'); [IO.File]::WriteAllText($temporaryHandoff, (ConvertTo-Json -InputObject $handoff -Depth 30), [Text.UTF8Encoding]::new($false)); [IO.File]::Move($temporaryHandoff, $handoffPath)",
    "      $result.export = $handoff; $result.exportCleanup = [ordered]@{ schemaVersion = '1.0'; mode = 'export-failure'; authorized = $true; attempted = $false; candidateRemoved = $false; candidateAbsent = $false; manifestRemoved = $false; manifestAbsent = $false; stagingRemoved = $false; stagingAbsent = $true; status = 'verified' }",
    "    } finally {",
    "      if ($null -ne $temporaryHandoff -and (Test-Path -LiteralPath $temporaryHandoff)) { Remove-Item -LiteralPath $temporaryHandoff -Force -ErrorAction SilentlyContinue }",
    "      if (-not $exportPromoted -and $null -ne $exportStaging -and (Test-Path -LiteralPath $exportStaging)) { Remove-Item -LiteralPath $exportStaging -Recurse -Force -ErrorAction SilentlyContinue }",
    "    }"
  ];
  return buildRemoteReleaseCandidateScript({
    dotaRoot: input.dotaRoot,
    addonName: input.addonName,
    inspectionStatements: statements
  });
}

export function buildRemoteCleanupExportedCandidateScript(input: RemoteCleanupScriptInput): string {
  for (const path of [input.exportRoot, input.destination]) validateRemotePath(path);
  if (!/^[0-9a-f]{64}$/u.test(input.combinedSha256)) throw new Error("COMBINED_SHA256_INVALID");
  if (!/^[0-9a-f-]{36}$/iu.test(input.ownershipId)) throw new Error("OWNERSHIP_ID_INVALID");
  const exportRoot = encodedExpression(input.exportRoot);
  const destination = encodedExpression(input.destination);
  const expectedBoundaries = quotePowerShell(JSON.stringify(EXPORTED_CANDIDATE_BOUNDARIES));
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    `$ExportRootInput = ${exportRoot}`,
    `$DestinationInput = ${destination}`,
    `$ExpectedOwnershipId = ${quotePowerShell(input.ownershipId)}`,
    `$ExpectedManifestVersion = ${quotePowerShell(input.manifestVersion)}`,
    `$ExpectedCombinedSha256 = ${quotePowerShell(input.combinedSha256)}`,
    `$DryRun = $${input.dryRun ? "true" : "false"}`,
    `$ExpectedBoundariesJson = ${expectedBoundaries}`,
    `$HandoffSuffix = ${quotePowerShell(EXPORTED_CANDIDATE_HANDOFF_SUFFIX)}`,
    "function Get-HexDigest([byte[]]$Bytes) { return -join ($Bytes | ForEach-Object { $_.ToString('x2') }) }",
    "function Get-TextSha256([string]$Text) { $sha = [Security.Cryptography.SHA256]::Create(); try { return Get-HexDigest ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))) } finally { $sha.Dispose() } }",
    "function Get-FileSha256([string]$Path) { $stream = [IO.FileStream]::new($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); $sha = [Security.Cryptography.SHA256]::Create(); try { return Get-HexDigest ($sha.ComputeHash($stream)) } finally { $sha.Dispose(); $stream.Dispose() } }",
    "function Get-WindowsFileIdentity([string]$Path) { $output = @(& fsutil.exe file queryFileID $Path 2>$null); $match = [regex]::Match(($output -join ' '), '0x([0-9A-Fa-f]{32})'); if ($LASTEXITCODE -ne 0 -or -not $match.Success) { throw 'WINDOWS_FILE_IDENTITY_REQUIRED' }; return $match.Groups[1].Value.ToLowerInvariant() }",
    "function Get-WindowsVolumeIdentity([string]$Path) { $root = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Path)); $output = @(& mountvol.exe $root /L 2>$null); $match = [regex]::Match(($output -join ' '), 'Volume\\{([0-9A-Fa-f-]{36})\\}', [Text.RegularExpressions.RegexOptions]::IgnoreCase); if ($LASTEXITCODE -ne 0 -or -not $match.Success) { throw 'WINDOWS_VOLUME_IDENTITY_REQUIRED' }; return $match.Groups[1].Value.ToLowerInvariant() }",
    "function Get-WindowsPathIdentity([string]$Path) { return [ordered]@{ kind = 'windows'; volumeIdentity = Get-WindowsVolumeIdentity $Path; fileIdentity = Get-WindowsFileIdentity $Path } }",
    "function Assert-NoReparseAncestry([string]$Path) { $full = [IO.Path]::GetFullPath($Path); $root = [IO.Path]::GetPathRoot($full); $current = $full.TrimEnd('\\', '/'); while ($true) { $item = Get-Item -LiteralPath $current -Force; if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_POINT_REJECTED' }; if ($current.Equals($root.TrimEnd('\\', '/'), [StringComparison]::OrdinalIgnoreCase)) { break }; $current = [IO.Path]::GetDirectoryName($current).TrimEnd('\\', '/') } }",
    "function Get-CanonicalManifestDigest([object[]]$Entries) { $rows = @(); foreach ($entry in $Entries) { $rows += ,@($entry.root, $entry.path, [long]$entry.bytes, $entry.sha256) }; $payload = [object[]]::new(2); $payload[0] = '1.0'; $payload[1] = [object[]]$rows; return Get-TextSha256 (ConvertTo-Json -InputObject $payload -Depth 4 -Compress) }",
    "$result = [ordered]@{ schemaVersion = '1.0'; ok = $false; operation = 'cleanup_exported_candidate'; code = 'CLEANUP_AUTHORIZATION_FAILED'; cleanup = [ordered]@{ schemaVersion = '1.0'; mode = $(if ($DryRun) { 'dry-run' } else { 'execute' }); authorized = $false; attempted = $false; candidateRemoved = $false; candidateAbsent = $false; manifestRemoved = $false; manifestAbsent = $false; status = 'failed' } }",
    "try {",
    "  $exportRoot = [IO.Path]::GetFullPath($ExportRootInput).TrimEnd('\\', '/'); $destination = [IO.Path]::GetFullPath($DestinationInput).TrimEnd('\\', '/'); if (-not [IO.Path]::GetDirectoryName($destination).TrimEnd('\\', '/').Equals($exportRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'DESTINATION_OUTSIDE_EXPORT_ROOT' }; Assert-NoReparseAncestry $exportRoot; Assert-NoReparseAncestry $destination",
    "  $handoffPath = $destination + $HandoffSuffix; $handoffItem = Get-Item -LiteralPath $handoffPath -Force; if (-not ($handoffItem -is [IO.FileInfo]) -or ($handoffItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'HANDOFF_MANIFEST_INVALID' }; $handoff = [IO.File]::ReadAllText($handoffPath, [Text.UTF8Encoding]::new($false, $true)) | ConvertFrom-Json",
    "  if ($handoff.schemaVersion -cne $ExpectedManifestVersion -or $handoff.exportRoot -cne $exportRoot -or $handoff.destination -cne $destination -or $handoff.ownership.ownershipId -cne $ExpectedOwnershipId -or $handoff.combinedSha256 -cne $ExpectedCombinedSha256 -or (ConvertTo-Json -InputObject $handoff.boundaries -Compress) -cne $ExpectedBoundariesJson) { throw 'CLEANUP_AUTHORIZATION_MISMATCH' }",
    "  $identity = Get-WindowsPathIdentity $destination; if ($handoff.ownership.candidateIdentity.kind -cne 'windows' -or $identity.volumeIdentity -cne $handoff.ownership.candidateIdentity.volumeIdentity -or $identity.fileIdentity -cne $handoff.ownership.candidateIdentity.fileIdentity) { throw 'CANDIDATE_IDENTITY_MISMATCH' }",
    "  $observed = @(); foreach ($entry in $handoff.manifest.entries) { $path = Join-Path $destination $entry.path; $item = Get-Item -LiteralPath $path -Force; if (-not ($item -is [IO.FileInfo]) -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [long]$item.Length -ne [long]$entry.bytes -or (Get-FileSha256 $path) -cne $entry.sha256) { throw 'CANDIDATE_DIGEST_MISMATCH' }; $observed += $entry }; if ((Get-CanonicalManifestDigest $observed) -cne $ExpectedCombinedSha256) { throw 'CANDIDATE_DIGEST_MISMATCH' }",
    "  $result.authorized = $true; $result.manifest = $handoff; $result.cleanup.authorized = $true; if ($DryRun) { $result.ok = $true; $result.code = $null; $result.cleanup.status = 'verified' } else { $result.cleanup.attempted = $true; try { Remove-Item -LiteralPath $destination -Recurse -Force -ErrorAction Stop; $result.cleanup.candidateRemoved = $true } catch {}; try { Remove-Item -LiteralPath $handoffPath -Force -ErrorAction Stop; $result.cleanup.manifestRemoved = $true } catch {}; $result.cleanup.candidateAbsent = -not (Test-Path -LiteralPath $destination); $result.cleanup.manifestAbsent = -not (Test-Path -LiteralPath $handoffPath); $result.ok = $result.cleanup.candidateRemoved -and $result.cleanup.candidateAbsent -and $result.cleanup.manifestRemoved -and $result.cleanup.manifestAbsent; $result.cleanup.status = $(if ($result.ok) { 'verified' } else { 'failed' }); $result.code = $(if ($result.ok) { $null } else { 'EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE' }) }",
    "} catch { $result.code = $(if ($_.Exception.Message -match '^[A-Z0-9_]+$') { $_.Exception.Message } else { 'CLEANUP_AUTHORIZATION_FAILED' }) }",
    "[Console]::Out.Write((ConvertTo-Json -InputObject $result -Depth 40 -Compress))"
  ].join("\n") + "\n";
}

function validateRemotePath(value: string): void {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || /[\r\n]/u.test(value) || !/^(?:[A-Za-z]:[\\/]|\\\\)/u.test(value)) {
    throw new Error("REMOTE_EXPORT_PATH_INVALID");
  }
}

function encodedExpression(value: string): string {
  const encoded = Buffer.from(value, "utf16le").toString("base64");
  return `[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'))`;
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}


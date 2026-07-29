import { validateAddonName } from "./addon.js";
import { EXPORTED_CANDIDATE_BOUNDARIES, EXPORTED_CANDIDATE_HANDOFF_SUFFIX } from "./exported-candidate.js";
import { buildRemoteReleaseCandidateScript } from "./release-candidate-remote-script.js";
const HANDOFF_LEASE_TYPE = String.raw `Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public sealed class DotaWorkshopHandoffLease : IDisposable {
  [StructLayout(LayoutKind.Sequential)]
  private struct BY_HANDLE_FILE_INFORMATION {
    public uint FileAttributes;
    public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastAccessTime;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWriteTime;
    public uint VolumeSerialNumber;
    public uint FileSizeHigh;
    public uint FileSizeLow;
    public uint NumberOfLinks;
    public uint FileIndexHigh;
    public uint FileIndexLow;
  }

  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern SafeFileHandle CreateFileW(string path, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out BY_HANDLE_FILE_INFORMATION information);

  private const uint GENERIC_READ = 0x80000000;
  private const uint FILE_SHARE_READ = 0x00000001;
  private const uint OPEN_EXISTING = 3;
  private const uint FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
  private const uint FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
  private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;

  private readonly SafeFileHandle handle;
  private readonly FileStream stream;
  public string Identity { get; private set; }

  private DotaWorkshopHandoffLease(SafeFileHandle handle, BY_HANDLE_FILE_INFORMATION information) {
    this.handle = handle;
    this.stream = new FileStream(handle, FileAccess.Read, 4096, false);
    this.Identity = information.VolumeSerialNumber.ToString("x8") + ":" + information.FileIndexHigh.ToString("x8") + information.FileIndexLow.ToString("x8");
  }

  public static DotaWorkshopHandoffLease Open(string path) {
    SafeFileHandle handle = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, IntPtr.Zero);
    if (handle.IsInvalid) { int error = Marshal.GetLastWin32Error(); throw new IOException("HANDOFF_HANDLE_OPEN_FAILED", new System.ComponentModel.Win32Exception(error)); }
    BY_HANDLE_FILE_INFORMATION information;
    if (!GetFileInformationByHandle(handle, out information)) { int error = Marshal.GetLastWin32Error(); handle.Dispose(); throw new IOException("HANDOFF_HANDLE_IDENTITY_FAILED", new System.ComponentModel.Win32Exception(error)); }
    if ((information.FileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) != 0) { handle.Dispose(); throw new IOException("HANDOFF_HANDLE_TYPE_INVALID"); }
    return new DotaWorkshopHandoffLease(handle, information);
  }

  public static string GetIdentity(string path) {
    using (DotaWorkshopHandoffLease lease = Open(path)) return lease.Identity;
  }

  public string ReadUtf8() {
    stream.Position = 0;
    using (StreamReader reader = new StreamReader(stream, new System.Text.UTF8Encoding(false, true), true, 4096, true)) return reader.ReadToEnd();
  }

  public void Dispose() { stream.Dispose(); handle.Dispose(); }
}
'@`;
export function buildRemoteExportedCandidateScript(input) {
    if (!validateAddonName(input.addonName).ok)
        throw new Error("INVALID_ADDON_NAME");
    for (const path of [input.exportRoot, input.destination])
        validateRemotePath(path);
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
        "      $exportVolumeRoot = [IO.Path]::GetPathRoot($exportRoot).TrimEnd('\\', '/'); $protectedRoots = @($dotaRoot, $gameAddonRoot, $contentAddonRoot, [Environment]::GetFolderPath('UserProfile'), [IO.Path]::GetTempPath(), $env:SystemRoot) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }; if ($exportRoot.Equals($exportVolumeRoot, [StringComparison]::OrdinalIgnoreCase) -or @($protectedRoots | Where-Object { -not (Test-PathsDisjoint $exportRoot $_) }).Count -gt 0) { Stop-ReleaseCandidate 'EXPORT_ROOT_PROTECTED' 'export-isolation' }; $cursor = $exportRoot; while ($true) { if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { Stop-ReleaseCandidate 'EXPORT_ROOT_REPOSITORY' 'export-isolation' }; $parent = [IO.Path]::GetDirectoryName($cursor); if ([string]::IsNullOrEmpty($parent) -or $parent -eq $cursor) { break }; $cursor = $parent }",
        "      $destinationParent = [IO.Path]::GetDirectoryName($destination).TrimEnd('\\', '/'); if (-not $destinationParent.Equals($exportRoot, [StringComparison]::OrdinalIgnoreCase)) { Stop-ReleaseCandidate 'DESTINATION_OUTSIDE_EXPORT_ROOT' 'export-isolation' }",
        "      if (-not (Test-PathsDisjoint $exportRoot $dotaRoot) -or -not (Test-PathsDisjoint $exportRoot $gameAddonRoot) -or -not (Test-PathsDisjoint $exportRoot $contentAddonRoot)) { Stop-ReleaseCandidate 'EXPORT_ROOT_PROTECTED' 'export-isolation' }",
        `      $handoffPath = $destination + ${handoffSuffix}; if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $handoffPath)) { Stop-ReleaseCandidate 'EXPORT_DESTINATION_EXISTS' 'export-state' }`,
        "      $exportStaging = Join-Path $exportRoot ('.dota-workshop-export-' + [Guid]::NewGuid().ToString('N')); [IO.Directory]::CreateDirectory($exportStaging) | Out-Null",
        "      foreach ($item in @(Get-ChildItem -LiteralPath $candidateRoot -Recurse -Force)) { $relative = Get-SafeRelativePath $candidateRoot $item.FullName; $targetPath = Join-Path $exportStaging $relative; if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseCandidate 'SOURCE_ENTRY_UNSAFE' 'export-staging' $relative }; if ($item.PSIsContainer) { [IO.Directory]::CreateDirectory($targetPath) | Out-Null } elseif ($item -is [IO.FileInfo]) { [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($targetPath)) | Out-Null; Copy-FileStreamed $item.FullName $targetPath | Out-Null } else { Stop-ReleaseCandidate 'SOURCE_ENTRY_UNSAFE' 'export-staging' $relative } }",
        "      $stagingTopology = @(); foreach ($item in @(Get-ChildItem -LiteralPath $exportStaging -Recurse -Force)) { $relative = (Get-SafeRelativePath $exportStaging $item.FullName).Replace('\\', '/'); if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseCandidate 'STAGING_TOPOLOGY_UNSAFE' 'export-integrity' $relative }; $kind = $(if ($item.PSIsContainer) { 'directory' } elseif ($item -is [IO.FileInfo]) { 'file' } else { Stop-ReleaseCandidate 'STAGING_TOPOLOGY_UNSAFE' 'export-integrity' $relative }); $stagingTopology += [ordered]@{ kind = $kind; path = $relative } }; $stagingTopology = @($stagingTopology | Sort-Object -Property path -CaseSensitive); $stagingFiles = @($stagingTopology | Where-Object { $_.kind -ceq 'file' } | ForEach-Object { $_.path }); $manifestFiles = @($manifest.entries | ForEach-Object { $_.path }); if ((ConvertTo-Json $stagingFiles -Compress) -cne (ConvertTo-Json $manifestFiles -Compress)) { Stop-ReleaseCandidate 'STAGING_MANIFEST_MISMATCH' 'export-integrity' }; foreach ($entry in $manifest.entries) { $stagedPath = Join-Path $exportStaging $entry.path; $stagedItem = Get-Item -LiteralPath $stagedPath -Force; if (-not ($stagedItem -is [IO.FileInfo]) -or ($stagedItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [long]$stagedItem.Length -ne [long]$entry.bytes -or (Get-FileSha256 $stagedPath) -cne $entry.sha256) { Stop-ReleaseCandidate 'STAGING_MANIFEST_MISMATCH' 'export-integrity' $entry.path } }",
        "      if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $handoffPath)) { Stop-ReleaseCandidate 'DESTINATION_STATE_CHANGED' 'export-state' }",
        "      [IO.Directory]::Move($exportStaging, $destination); $exportPromoted = $true",
        "      $destinationIdentity = Get-WindowsPathIdentity $destination; $finalTopology = @(); foreach ($item in @(Get-ChildItem -LiteralPath $destination -Recurse -Force)) { $relative = (Get-SafeRelativePath $destination $item.FullName).Replace('\\', '/'); if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseCandidate 'PROMOTED_TOPOLOGY_UNSAFE' 'export-integrity' $relative }; $kind = $(if ($item.PSIsContainer) { 'directory' } elseif ($item -is [IO.FileInfo]) { 'file' } else { Stop-ReleaseCandidate 'PROMOTED_TOPOLOGY_UNSAFE' 'export-integrity' $relative }); $finalTopology += [ordered]@{ kind = $kind; path = $relative } }; $finalTopology = @($finalTopology | Sort-Object -Property path -CaseSensitive); if ((ConvertTo-Json $finalTopology -Compress) -cne (ConvertTo-Json $stagingTopology -Compress)) { Stop-ReleaseCandidate 'PROMOTED_MANIFEST_MISMATCH' 'export-integrity' }; foreach ($entry in $manifest.entries) { $finalPath = Join-Path $destination $entry.path; $finalItem = Get-Item -LiteralPath $finalPath -Force; if (-not ($finalItem -is [IO.FileInfo]) -or ($finalItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [long]$finalItem.Length -ne [long]$entry.bytes -or (Get-FileSha256 $finalPath) -cne $entry.sha256) { Stop-ReleaseCandidate 'PROMOTED_MANIFEST_MISMATCH' 'export-integrity' $entry.path } }",
        `      $exportBoundaries = @(${quotePowerShell(boundariesJson)} | ConvertFrom-Json); $ownership = [ordered]@{ schemaVersion = '1.0'; ownershipId = [Guid]::NewGuid().ToString(); candidateIdentity = [ordered]@{ kind = 'windows'; volumeIdentity = $destinationIdentity.volumeIdentity; fileIdentity = $destinationIdentity.fileIdentity } }; $handoff = [ordered]@{ schemaVersion = '1.0'; operation = 'export_release_candidate'; addonName = $AddonName; exportRoot = $exportRoot; destination = $destination; targetKind = '${input.transport}'; fileCount = $manifest.entries.Count; combinedSha256 = $manifest.combinedSha256; source = [ordered]@{ gameAddon = ('game/dota_addons/' + $AddonName); contentAddon = ('content/dota_addons/' + $AddonName) }; manifest = $manifest; topology = $finalTopology; ownership = $ownership; boundaries = $exportBoundaries }`,
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
export function buildRemoteCleanupExportedCandidateScript(input) {
    for (const path of [input.exportRoot, input.destination])
        validateRemotePath(path);
    if (!/^[0-9a-f]{64}$/u.test(input.combinedSha256))
        throw new Error("COMBINED_SHA256_INVALID");
    if (!/^[0-9a-f-]{36}$/iu.test(input.ownershipId))
        throw new Error("OWNERSHIP_ID_INVALID");
    const exportRoot = encodedExpression(input.exportRoot);
    const destination = encodedExpression(input.destination);
    const expectedBoundaries = quotePowerShell(JSON.stringify(EXPORTED_CANDIDATE_BOUNDARIES));
    return [
        "$ErrorActionPreference = 'Stop'",
        "$ProgressPreference = 'SilentlyContinue'",
        `$ExportRootInput = ${exportRoot}`,
        `$DestinationInput = ${destination}`,
        `$ExpectedOwnershipId = ${quotePowerShell(input.ownershipId)}`,
        `$ExpectedTargetKind = ${quotePowerShell(input.transport)}`,
        `$ExpectedManifestVersion = ${quotePowerShell(input.manifestVersion)}`,
        `$ExpectedCombinedSha256 = ${quotePowerShell(input.combinedSha256)}`,
        `$DryRun = $${input.dryRun ? "true" : "false"}`,
        `$ExpectedBoundariesJson = ${expectedBoundaries}`,
        `$HandoffSuffix = ${quotePowerShell(EXPORTED_CANDIDATE_HANDOFF_SUFFIX)}`,
        HANDOFF_LEASE_TYPE,
        "$handoffLease = $null",
        "function Get-HexDigest([byte[]]$Bytes) { return -join ($Bytes | ForEach-Object { $_.ToString('x2') }) }",
        "function Get-TextSha256([string]$Text) { $sha = [Security.Cryptography.SHA256]::Create(); try { return Get-HexDigest ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))) } finally { $sha.Dispose() } }",
        "function Get-FileSha256([string]$Path) { $stream = [IO.FileStream]::new($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); $sha = [Security.Cryptography.SHA256]::Create(); try { return Get-HexDigest ($sha.ComputeHash($stream)) } finally { $sha.Dispose(); $stream.Dispose() } }",
        "function Get-WindowsFileIdentity([string]$Path) { $output = @(& fsutil.exe file queryFileID $Path 2>$null); $match = [regex]::Match(($output -join ' '), '0x([0-9A-Fa-f]{32})'); if ($LASTEXITCODE -ne 0 -or -not $match.Success) { throw 'WINDOWS_FILE_IDENTITY_REQUIRED' }; return $match.Groups[1].Value.ToLowerInvariant() }",
        "function Get-WindowsVolumeIdentity([string]$Path) { $root = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Path)); $output = @(& mountvol.exe $root /L 2>$null); $match = [regex]::Match(($output -join ' '), 'Volume\\{([0-9A-Fa-f-]{36})\\}', [Text.RegularExpressions.RegexOptions]::IgnoreCase); if ($LASTEXITCODE -ne 0 -or -not $match.Success) { throw 'WINDOWS_VOLUME_IDENTITY_REQUIRED' }; return $match.Groups[1].Value.ToLowerInvariant() }",
        "function Get-WindowsPathIdentity([string]$Path) { return [ordered]@{ kind = 'windows'; volumeIdentity = Get-WindowsVolumeIdentity $Path; fileIdentity = Get-WindowsFileIdentity $Path } }",
        "function Assert-NoReparseAncestry([string]$Path) { $full = [IO.Path]::GetFullPath($Path); $root = [IO.Path]::GetPathRoot($full); $current = $full.TrimEnd('\\', '/'); while ($true) { $item = Get-Item -LiteralPath $current -Force; if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_POINT_REJECTED' }; if ($current.Equals($root.TrimEnd('\\', '/'), [StringComparison]::OrdinalIgnoreCase)) { break }; $current = [IO.Path]::GetDirectoryName($current).TrimEnd('\\', '/') } }",
        "function Get-CanonicalManifestDigest([object[]]$Entries) { $rows = @(); foreach ($entry in $Entries) { $rows += ,@($entry.root, $entry.path, [long]$entry.bytes, $entry.sha256) }; $payload = [object[]]::new(2); $payload[0] = '1.0'; $payload[1] = [object[]]$rows; return Get-TextSha256 (ConvertTo-Json -InputObject $payload -Depth 4 -Compress) }",
        "function Assert-ExactKeys([object]$Value, [string[]]$Keys) { if ($null -eq $Value) { throw 'HANDOFF_MANIFEST_INVALID' }; $actual = @($Value.PSObject.Properties.Name | Sort-Object -CaseSensitive); $expected = @($Keys | Sort-Object -CaseSensitive); if ((ConvertTo-Json $actual -Compress) -cne (ConvertTo-Json $expected -Compress)) { throw 'HANDOFF_MANIFEST_INVALID' } }",
        "function Test-SafeRelativePath([string]$Value) { if ([string]::IsNullOrEmpty($Value) -or $Value.StartsWith('/') -or $Value.EndsWith('/') -or $Value.Contains('\\')) { return $false }; foreach ($segment in $Value.Split('/')) { if ([string]::IsNullOrEmpty($segment) -or $segment -eq '.' -or $segment -eq '..' -or $segment.Contains(':')) { return $false } }; return $true }",
        "function Get-ObservedCandidate([string]$Root) { $entries = @(); $topology = @(); $folded = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase); $prefix = $Root.TrimEnd('\\', '/') + [IO.Path]::DirectorySeparatorChar; foreach ($item in @(Get-ChildItem -LiteralPath $Root -Recurse -Force | Sort-Object -Property FullName -CaseSensitive)) { $full = [IO.Path]::GetFullPath($item.FullName); if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'CANDIDATE_TOPOLOGY_MISMATCH' }; $relative = $full.Substring($prefix.Length).Replace('\\', '/'); if (-not (Test-SafeRelativePath $relative) -or -not $folded.Add($relative)) { throw 'CANDIDATE_TOPOLOGY_MISMATCH' }; if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'CANDIDATE_TOPOLOGY_MISMATCH' }; if ($item.PSIsContainer) { $topology += [ordered]@{ kind = 'directory'; path = $relative } } elseif ($item -is [IO.FileInfo]) { $parts = $relative.Split('/'); if ($parts[0] -cne 'game' -and $parts[0] -cne 'content') { throw 'CANDIDATE_TOPOLOGY_MISMATCH' }; $topology += [ordered]@{ kind = 'file'; path = $relative }; $entries += [ordered]@{ schemaVersion = '1.0'; root = $parts[0]; path = $relative; bytes = [long]$item.Length; sha256 = Get-FileSha256 $full } } else { throw 'CANDIDATE_TOPOLOGY_MISMATCH' } }; $entries = @($entries | Sort-Object -Property path -CaseSensitive); $topology = @($topology | Sort-Object -Property path -CaseSensitive); return [ordered]@{ manifest = [ordered]@{ schemaVersion = '1.0'; entries = $entries; combinedSha256 = Get-CanonicalManifestDigest $entries }; topology = $topology } }",
        "function Assert-StrictHandoff([object]$Handoff, [string]$ExportRoot, [string]$Destination) { Assert-ExactKeys $Handoff @('schemaVersion','operation','addonName','exportRoot','destination','targetKind','fileCount','combinedSha256','source','manifest','topology','ownership','boundaries'); if ($Handoff.schemaVersion -cne '1.0' -or $Handoff.operation -cne 'export_release_candidate' -or $Handoff.addonName -cnotmatch '^[a-z][a-z0-9_]{0,63}$' -or $Handoff.targetKind -notin @('ssh','powershell') -or $Handoff.exportRoot -cne $ExportRoot -or $Handoff.destination -cne $Destination -or $Handoff.combinedSha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'HANDOFF_MANIFEST_INVALID' }; Assert-ExactKeys $Handoff.source @('gameAddon','contentAddon'); if ($Handoff.source.gameAddon -cne ('game/dota_addons/' + $Handoff.addonName) -or $Handoff.source.contentAddon -cne ('content/dota_addons/' + $Handoff.addonName)) { throw 'HANDOFF_MANIFEST_INVALID' }; Assert-ExactKeys $Handoff.manifest @('schemaVersion','entries','combinedSha256'); $previous = $null; $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase); foreach ($entry in @($Handoff.manifest.entries)) { Assert-ExactKeys $entry @('schemaVersion','root','path','bytes','sha256'); if ($entry.schemaVersion -cne '1.0' -or $entry.root -notin @('game','content') -or -not (Test-SafeRelativePath $entry.path) -or -not $entry.path.StartsWith($entry.root + '/', [StringComparison]::Ordinal) -or [long]$entry.bytes -lt 0 -or $entry.sha256 -cnotmatch '^[0-9a-f]{64}$' -or -not $seen.Add($entry.path) -or ($null -ne $previous -and [StringComparer]::Ordinal.Compare($previous, $entry.path) -ge 0)) { throw 'HANDOFF_MANIFEST_INVALID' }; $previous = $entry.path }; if ([int]$Handoff.fileCount -ne @($Handoff.manifest.entries).Count -or (Get-CanonicalManifestDigest @($Handoff.manifest.entries)) -cne $Handoff.combinedSha256 -or $Handoff.manifest.combinedSha256 -cne $Handoff.combinedSha256) { throw 'HANDOFF_MANIFEST_INVALID' }; $previous = $null; $topologySeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase); foreach ($entry in @($Handoff.topology)) { Assert-ExactKeys $entry @('kind','path'); if ($entry.kind -notin @('directory','file') -or -not (Test-SafeRelativePath $entry.path) -or -not $topologySeen.Add($entry.path) -or ($null -ne $previous -and [StringComparer]::Ordinal.Compare($previous, $entry.path) -ge 0)) { throw 'HANDOFF_MANIFEST_INVALID' }; $previous = $entry.path }; Assert-ExactKeys $Handoff.ownership @('schemaVersion','ownershipId','candidateIdentity'); Assert-ExactKeys $Handoff.ownership.candidateIdentity @('kind','volumeIdentity','fileIdentity'); if ($Handoff.ownership.schemaVersion -cne '1.0' -or $Handoff.ownership.ownershipId -cnotmatch '^[0-9a-fA-F-]{36}$' -or $Handoff.ownership.candidateIdentity.kind -cne 'windows' -or [string]::IsNullOrWhiteSpace($Handoff.ownership.candidateIdentity.volumeIdentity) -or [string]::IsNullOrWhiteSpace($Handoff.ownership.candidateIdentity.fileIdentity)) { throw 'HANDOFF_MANIFEST_INVALID' } }",
        "function Assert-TopologyParents([object]$Handoff) { $kinds = @{}; foreach ($entry in @($Handoff.topology)) { $kinds[$entry.path] = $entry.kind }; $paths = @($Handoff.topology | ForEach-Object { $_.path }) + @($Handoff.manifest.entries | ForEach-Object { $_.path }); foreach ($path in $paths) { $parts = $path.Split('/'); for ($index = 1; $index -lt $parts.Count; $index += 1) { $parent = [string]::Join('/', $parts[0..($index - 1)]); if ($kinds[$parent] -cne 'directory') { throw 'HANDOFF_MANIFEST_INVALID' } } } }",
        "function Test-CandidateSnapshot([string]$Path, [object]$Identity, [object]$Expected) { try { $actualIdentity = Get-WindowsPathIdentity $Path; if ($actualIdentity.volumeIdentity -cne $Identity.volumeIdentity -or $actualIdentity.fileIdentity -cne $Identity.fileIdentity) { return $false }; $actual = Get-ObservedCandidate $Path; return (ConvertTo-Json $actual -Depth 20 -Compress) -ceq (ConvertTo-Json $Expected -Depth 20 -Compress) } catch { return $false } }",
        "function Invoke-ExportedCandidateCleanup([Collections.IDictionary]$Result, [string]$ExportRoot, [string]$Destination, [string]$HandoffPath, [DotaWorkshopHandoffLease]$HandoffLease, [string]$HandoffIdentity, [object]$CandidateIdentity, [object]$ExpectedSnapshot) { $Result.cleanup.attempted = $true; $candidateTombstone = Join-Path $ExportRoot ('.dota-workshop-candidate-delete-' + [Guid]::NewGuid().ToString('N')); $handoffTombstone = Join-Path $ExportRoot ('.dota-workshop-handoff-delete-' + [Guid]::NewGuid().ToString('N') + '.json'); try { Assert-NoReparseAncestry $Destination; if (-not (Test-CandidateSnapshot $Destination $CandidateIdentity $ExpectedSnapshot)) { throw 'CANDIDATE_IDENTITY_MISMATCH' }; [IO.Directory]::Move($Destination, $candidateTombstone); $Result.paths.candidateTombstone = $candidateTombstone; $Result.cleanup.candidateState = 'tombstoned'; if (-not (Test-CandidateSnapshot $candidateTombstone $CandidateIdentity $ExpectedSnapshot)) { throw 'CANDIDATE_IDENTITY_MISMATCH' }; Remove-Item -LiteralPath $candidateTombstone -Recurse -Force -ErrorAction Stop; $Result.paths.Remove('candidateTombstone') | Out-Null; $Result.cleanup.candidateRemoved = $true; $Result.cleanup.candidateAbsent = $true; $Result.cleanup.candidateState = 'absent' } catch { if (Test-Path -LiteralPath $candidateTombstone) { try { if (-not (Test-CandidateSnapshot $candidateTombstone $CandidateIdentity $ExpectedSnapshot) -or (Test-Path -LiteralPath $Destination)) { throw 'CANDIDATE_RESTORE_UNSAFE' }; [IO.Directory]::Move($candidateTombstone, $Destination); if (-not (Test-CandidateSnapshot $Destination $CandidateIdentity $ExpectedSnapshot)) { throw 'CANDIDATE_RESTORE_UNSAFE' }; $Result.paths.Remove('candidateTombstone') | Out-Null; $Result.cleanup.candidateState = 'present' } catch { $Result.cleanup.candidateState = 'tombstoned' } } elseif (Test-CandidateSnapshot $Destination $CandidateIdentity $ExpectedSnapshot) { $Result.cleanup.candidateState = 'present' } else { $Result.cleanup.candidateState = 'unknown' }; $Result.code = $(if ($_.Exception.Message -match '^[A-Z0-9_]+$') { $_.Exception.Message } else { 'EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE' }) }; if ($Result.cleanup.candidateState -ne 'absent') { $Result.cleanup.status = 'failed'; return } }; $HandoffLease.Dispose(); try { if ([DotaWorkshopHandoffLease]::GetIdentity($HandoffPath) -cne $HandoffIdentity) { throw 'HANDOFF_IDENTITY_MISMATCH' }; [IO.File]::Move($HandoffPath, $handoffTombstone); $Result.paths.handoffTombstone = $handoffTombstone; $Result.cleanup.manifestState = 'tombstoned'; if ([DotaWorkshopHandoffLease]::GetIdentity($handoffTombstone) -cne $HandoffIdentity) { throw 'HANDOFF_IDENTITY_MISMATCH' }; Remove-Item -LiteralPath $handoffTombstone -Force -ErrorAction Stop; $Result.paths.Remove('handoffTombstone') | Out-Null; $Result.cleanup.manifestRemoved = $true; $Result.cleanup.manifestAbsent = $true; $Result.cleanup.manifestState = 'absent' } catch { if (Test-Path -LiteralPath $handoffTombstone) { try { if ([DotaWorkshopHandoffLease]::GetIdentity($handoffTombstone) -cne $HandoffIdentity -or (Test-Path -LiteralPath $HandoffPath)) { throw 'HANDOFF_RESTORE_UNSAFE' }; [IO.File]::Move($handoffTombstone, $HandoffPath); if ([DotaWorkshopHandoffLease]::GetIdentity($HandoffPath) -cne $HandoffIdentity) { throw 'HANDOFF_RESTORE_UNSAFE' }; $Result.paths.Remove('handoffTombstone') | Out-Null; $Result.cleanup.manifestState = 'present' } catch { $Result.cleanup.manifestState = 'tombstoned' } } elseif (Test-Path -LiteralPath $HandoffPath) { $Result.cleanup.manifestState = 'present' } else { $Result.cleanup.manifestState = 'unknown' }; $Result.code = $(if ($_.Exception.Message -match '^[A-Z0-9_]+$') { $_.Exception.Message } else { 'EXPORTED_CANDIDATE_CLEANUP_INCOMPLETE' }) }; $Result.cleanup.status = 'failed'; return }; $Result.ok = $true; $Result.code = $null; $Result.cleanup.status = 'verified' }",
        "$result = [ordered]@{ schemaVersion = '1.0'; ok = $false; operation = 'cleanup_exported_candidate'; code = 'CLEANUP_AUTHORIZATION_FAILED'; paths = [ordered]@{}; cleanup = [ordered]@{ schemaVersion = '1.0'; mode = $(if ($DryRun) { 'dry-run' } else { 'execute' }); authorized = $false; attempted = $false; candidateRemoved = $false; candidateAbsent = $false; manifestRemoved = $false; manifestAbsent = $false; candidateState = 'unknown'; manifestState = 'unknown'; status = 'failed' } }",
        "try {",
        "  $exportRoot = [IO.Path]::GetFullPath($ExportRootInput).TrimEnd('\\', '/'); $destination = [IO.Path]::GetFullPath($DestinationInput).TrimEnd('\\', '/'); if (-not [IO.Path]::GetDirectoryName($destination).TrimEnd('\\', '/').Equals($exportRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'DESTINATION_OUTSIDE_EXPORT_ROOT' }; Assert-NoReparseAncestry $exportRoot; Assert-NoReparseAncestry $destination; $volumeRoot = [IO.Path]::GetPathRoot($exportRoot).TrimEnd('\\', '/'); $protectedRoots = @([Environment]::GetFolderPath('UserProfile'), [IO.Path]::GetTempPath(), $env:SystemRoot) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }; if ($exportRoot.Equals($volumeRoot, [StringComparison]::OrdinalIgnoreCase) -or @($protectedRoots | Where-Object { $full = [IO.Path]::GetFullPath($_).TrimEnd('\\', '/'); $exportRoot.Equals($full, [StringComparison]::OrdinalIgnoreCase) -or $exportRoot.StartsWith($full + '\\', [StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($exportRoot + '\\', [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0) { throw 'EXPORT_ROOT_PROTECTED' }",
        "  $handoffPath = $destination + $HandoffSuffix; $result.paths = [ordered]@{ exportRoot = $exportRoot; destination = $destination; handoffManifest = $handoffPath }; $handoffLease = [DotaWorkshopHandoffLease]::Open($handoffPath); $handoffIdentity = $handoffLease.Identity; $handoff = $handoffLease.ReadUtf8() | ConvertFrom-Json; Assert-StrictHandoff $handoff $exportRoot $destination; Assert-TopologyParents $handoff",
        "  if ($handoff.schemaVersion -cne $ExpectedManifestVersion -or $handoff.targetKind -cne $ExpectedTargetKind -or $handoff.ownership.ownershipId -cne $ExpectedOwnershipId -or $handoff.combinedSha256 -cne $ExpectedCombinedSha256 -or (ConvertTo-Json -InputObject $handoff.boundaries -Compress) -cne $ExpectedBoundariesJson) { throw 'CLEANUP_AUTHORIZATION_MISMATCH' }",
        "  $identity = Get-WindowsPathIdentity $destination; if ($handoff.ownership.candidateIdentity.kind -cne 'windows' -or $identity.volumeIdentity -cne $handoff.ownership.candidateIdentity.volumeIdentity -or $identity.fileIdentity -cne $handoff.ownership.candidateIdentity.fileIdentity) { throw 'CANDIDATE_IDENTITY_MISMATCH' }",
        "  $observed = Get-ObservedCandidate $destination; if ((ConvertTo-Json $observed.manifest -Depth 20 -Compress) -cne (ConvertTo-Json $handoff.manifest -Depth 20 -Compress) -or (ConvertTo-Json $observed.topology -Depth 20 -Compress) -cne (ConvertTo-Json $handoff.topology -Depth 20 -Compress)) { throw 'CANDIDATE_DIGEST_MISMATCH' }",
        "  $result.authorized = $true; $result.manifest = $handoff; $result.cleanup.authorized = $true; $result.cleanup.candidateState = 'present'; $result.cleanup.manifestState = 'present'; if ($DryRun) { $result.ok = $true; $result.code = $null; $result.cleanup.status = 'verified' } else { Invoke-ExportedCandidateCleanup $result $exportRoot $destination $handoffPath $handoffLease $handoffIdentity $identity $observed }",
        "} catch { $result.code = $(if ($_.Exception.Message -match '^[A-Z0-9_]+$') { $_.Exception.Message } else { 'CLEANUP_AUTHORIZATION_FAILED' }) }",
        "finally { if ($null -ne $handoffLease) { $handoffLease.Dispose() } }",
        "[Console]::Out.Write((ConvertTo-Json -InputObject $result -Depth 40 -Compress))"
    ].join("\n") + "\n";
}
export function buildRemoteHandoffLeaseProbeScript(handoffPath, replacementPath) {
    validateRemotePath(handoffPath);
    validateRemotePath(replacementPath);
    return [
        "$ErrorActionPreference = 'Stop'",
        HANDOFF_LEASE_TYPE,
        `$handoffPath = ${encodedExpression(handoffPath)}`,
        `$replacementPath = ${encodedExpression(replacementPath)}`,
        "$backupPath = $handoffPath + '.lease-probe-backup'",
        "$lease = [DotaWorkshopHandoffLease]::Open($handoffPath)",
        "$replacementBlocked = $false",
        "try { try { [IO.File]::Replace($replacementPath, $handoffPath, $backupPath, $true) } catch { $replacementBlocked = $true }; $text = $lease.ReadUtf8(); [Console]::Out.Write((ConvertTo-Json -Compress -InputObject ([ordered]@{ replacementBlocked = $replacementBlocked; text = $text; identity = $lease.Identity }))) } finally { $lease.Dispose() }"
    ].join("\n") + "\n";
}
function validateRemotePath(value) {
    const segments = value.split(/[\\/]/u);
    if (typeof value !== "string"
        || value.length === 0
        || value.includes("\0")
        || /[\r\n]/u.test(value)
        || !/^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/u.test(value)
        || /^\\\\[?.][\\/]/u.test(value)
        || segments.some((segment, index) => segment === "." || segment === ".." || (index > 0 && segment.includes(":")) || /[ .]$/u.test(segment))) {
        throw new Error("REMOTE_EXPORT_PATH_INVALID");
    }
}
function encodedExpression(value) {
    const encoded = Buffer.from(value, "utf16le").toString("base64");
    return `[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'))`;
}
function quotePowerShell(value) {
    return `'${value.replaceAll("'", "''")}'`;
}

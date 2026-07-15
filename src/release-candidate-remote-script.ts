import { createHash } from "node:crypto";
import { validateAddonName } from "./addon.js";
import { RELEASE_CANDIDATE_BOUNDARIES } from "./release-candidate-result.js";
import { MAX_SECRET_SCAN_BYTES, RELEASE_METADATA_KEYS } from "./release-readiness.js";

const CANONICAL_VECTOR_VALUE = [[
  "1.0",
  "content",
  "content/dota_addons/demo/maps/demo.vmap",
  7,
  "a".repeat(64)
]] as const;

export const REMOTE_RELEASE_CANDIDATE_POLICY = Object.freeze({
  schemaVersion: "1.0" as const,
  maxSecretScanBytes: MAX_SECRET_SCAN_BYTES,
  releaseMetadataKeys: RELEASE_METADATA_KEYS,
  boundaries: RELEASE_CANDIDATE_BOUNDARIES,
  canonicalVector: Object.freeze({
    value: CANONICAL_VECTOR_VALUE,
    sha256: createHash("sha256").update(JSON.stringify(CANONICAL_VECTOR_VALUE), "utf8").digest("hex")
  })
});

export type RemoteReleaseCandidateScriptInput = Readonly<{
  dotaRoot: string;
  addonName: string;
}>;

export function buildRemoteReleaseCandidateScript(input: RemoteReleaseCandidateScriptInput): string {
  const validation = validateAddonName(input.addonName);
  if (!validation.ok) throw new Error("INVALID_ADDON_NAME");
  if (typeof input.dotaRoot !== "string" || input.dotaRoot.trim().length === 0) {
    throw new Error("REMOTE_DOTA_ROOT_REQUIRED");
  }
  if (input.dotaRoot.includes("\0") || /[\r\n]/.test(input.dotaRoot)) {
    throw new Error("REMOTE_DOTA_ROOT_INVALID");
  }

  const metadataKeys = RELEASE_METADATA_KEYS.map(quotePowerShell).join(", ");
  const boundaries = Object.entries(RELEASE_CANDIDATE_BOUNDARIES)
    .map(([key, value]) => `${key} = $${value ? "true" : "false"}`)
    .join("; ");
  const canonicalJson = JSON.stringify(CANONICAL_VECTOR_VALUE);

  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "$InformationPreference = 'SilentlyContinue'",
    `$SchemaVersion = '1.0'`,
    `$MaxSecretScanBytes = ${MAX_SECRET_SCAN_BYTES}`,
    `$ReleaseMetadataKeys = @(${metadataKeys})`,
    `$CanonicalVectorJson = ${quotePowerShell(canonicalJson)}`,
    `$CanonicalVectorSha256 = '${REMOTE_RELEASE_CANDIDATE_POLICY.canonicalVector.sha256}'`,
    `$DotaRootInput = ${quotePowerShell(input.dotaRoot)}`,
    `$AddonName = ${quotePowerShell(input.addonName)}`,
    "function Get-HexDigest([byte[]]$Bytes) { return -join ($Bytes | ForEach-Object { $_.ToString('x2') }) }",
    "function Get-TextSha256([string]$Text) { $sha = [Security.Cryptography.SHA256]::Create(); try { return Get-HexDigest ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))) } finally { $sha.Dispose() } }",
    "function Get-FileSha256([string]$Path) { $stream = [IO.FileStream]::new($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); $sha = [Security.Cryptography.SHA256]::Create(); try { return Get-HexDigest ($sha.ComputeHash($stream)) } finally { $sha.Dispose(); $stream.Dispose() } }",
    "function Copy-FileStreamed([string]$Source, [string]$Destination) { $sourceStream = [IO.FileStream]::new($Source, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); $destinationStream = [IO.FileStream]::new($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None); try { $buffer = [byte[]]::new(131072); while (($read = $sourceStream.Read($buffer, 0, $buffer.Length)) -gt 0) { $destinationStream.Write($buffer, 0, $read) }; $destinationStream.Flush($true) } finally { $destinationStream.Dispose(); $sourceStream.Dispose() } }",
    "function Test-ContainedPath([string]$Root, [string]$Path) { $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar); $pathFull = [IO.Path]::GetFullPath($Path); return $pathFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) }",
    "function Get-SafeRelativePath([string]$Root, [string]$Path) { if (-not (Test-ContainedPath $Root $Path)) { throw 'SOURCE_ENTRY_OUTSIDE_ROOT' }; return $Path.Substring($Root.TrimEnd('\\', '/').Length).TrimStart('\\', '/').Replace('\\', '/') }",
    "function Get-Identity([string]$RootKind, [string]$Relative) { return ($RootKind + '/dota_addons/' + $AddonName + $(if ($Relative.Length -gt 0) { '/' + $Relative } else { '' })) }",
    "function Add-Blocker([string]$Code, [string]$Category, [string]$Path = '', [string]$Field = '') { $item = [ordered]@{ code = $Code; category = $Category; disposition = 'blocker' }; if ($Path.Length -gt 0) { $item.path = $Path }; if ($Field.Length -gt 0) { $item.field = $Field }; $script:result.blockers += $item }",
    "function Assert-SafeSourceTree([string]$Root) { $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase); foreach ($entry in @(Get-ChildItem -LiteralPath $Root -Recurse -Force)) { if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'SOURCE_ENTRY_UNSAFE' }; if (-not ($entry.PSIsContainer -or $entry -is [IO.FileInfo])) { throw 'SOURCE_ENTRY_UNSAFE' }; $relative = Get-SafeRelativePath $Root $entry.FullName; if (-not $seen.Add($relative)) { throw 'SOURCE_IDENTITY_COLLISION' } } }",
    "function Get-SourceInventory([string]$RootKind, [string]$Root) { $files = @(); $directories = @(); foreach ($entry in @(Get-ChildItem -LiteralPath $Root -Recurse -Force)) { $relative = Get-SafeRelativePath $Root $entry.FullName; $identity = Get-Identity $RootKind $relative; if ($entry.PSIsContainer) { $directories += [ordered]@{ root = $RootKind; relative = $relative; identity = $identity; source = $entry.FullName } } elseif ($entry -is [IO.FileInfo]) { $files += [ordered]@{ root = $RootKind; relative = $relative; identity = $identity; source = $entry.FullName; bytes = [long]$entry.Length } } else { throw 'SOURCE_ENTRY_UNSAFE' } }; return [ordered]@{ files = @($files); directories = @($directories) } }",
    "function Test-RequiredPath([string]$Path, [string]$Kind, [string]$Field) { if (-not (Test-Path -LiteralPath $Path)) { Add-Blocker 'REQUIRED_PATH_MISSING' 'required-structure' '' $Field; return }; $item = Get-Item -LiteralPath $Path -Force; $matches = $(if ($Kind -eq 'directory') { $item.PSIsContainer } else { -not $item.PSIsContainer }); if (-not $matches) { Add-Blocker 'REQUIRED_PATH_WRONG_KIND' 'required-structure' '' $Field } }",
    "function Test-ReleaseReadiness([string]$GameRoot, [string]$ContentRoot, [object[]]$Files) { Test-RequiredPath $GameRoot 'directory' 'game addon root'; Test-RequiredPath $ContentRoot 'directory' 'content addon root'; $addonInfo = Join-Path $GameRoot 'addoninfo.txt'; Test-RequiredPath $addonInfo 'file' 'addon metadata'; Test-RequiredPath (Join-Path $GameRoot 'scripts/vscripts/addon_game_mode.lua') 'file' 'lua entry'; Test-RequiredPath (Join-Path $GameRoot 'resource/addon_english.txt') 'file' 'localization file'; Test-RequiredPath (Join-Path $ContentRoot 'maps') 'directory' 'content maps directory'; Test-RequiredPath (Join-Path $GameRoot 'scripts/npc/npc_heroes_custom.txt') 'file' 'hero list'; Test-RequiredPath (Join-Path $GameRoot 'scripts/npc/npc_heroes.txt') 'file' 'hero data'; Test-RequiredPath (Join-Path $GameRoot 'scripts/npc/npc_units_custom.txt') 'file' 'unit support file'; Test-RequiredPath (Join-Path $GameRoot 'scripts/npc/npc_abilities_custom.txt') 'file' 'ability support file'; if (Test-Path -LiteralPath $addonInfo) { try { $metadataText = [IO.File]::ReadAllText($addonInfo, [Text.UTF8Encoding]::new($false, $true)); foreach ($key in $ReleaseMetadataKeys) { $match = [regex]::Match($metadataText, '\"' + [regex]::Escape($key) + '\"\\s+\"([^\"]*)\"', [Text.RegularExpressions.RegexOptions]::IgnoreCase); if (-not $match.Success) { Add-Blocker 'METADATA_MISSING' 'metadata' '' $key } elseif (@('', 'changeme', 'change me', 'placeholder', 'tbd', 'todo', 'unknown', 'your name') -contains $match.Groups[1].Value.Trim().ToLowerInvariant()) { Add-Blocker 'METADATA_PLACEHOLDER' 'metadata' '' $key } } } catch { Add-Blocker 'REQUIRED_TEXT_UNREADABLE' 'unreadable-required-text' 'game/dota_addons/' + $AddonName + '/addoninfo.txt' } }; $textExtensions = @('.cfg', '.css', '.ini', '.js', '.json', '.kv', '.lua', '.md', '.ps1', '.ts', '.tsx', '.txt', '.vdf', '.xml', '.yaml', '.yml'); $requiredText = @('game/dota_addons/' + $AddonName + '/addoninfo.txt', 'game/dota_addons/' + $AddonName + '/scripts/vscripts/addon_game_mode.lua', 'game/dota_addons/' + $AddonName + '/resource/addon_english.txt'); foreach ($file in $Files) { $extension = [IO.Path]::GetExtension($file.relative).ToLowerInvariant(); if ($textExtensions -notcontains $extension) { $result.scanCoverage.binary.paths += $file.identity; $result.warnings += 'non-text file included'; continue }; if ($file.bytes -gt $MaxSecretScanBytes) { $result.scanCoverage.oversized.paths += $file.identity; if ($requiredText -contains $file.identity) { Add-Blocker 'REQUIRED_TEXT_OVERSIZED' 'oversized-required-text' $file.identity }; continue }; try { $content = [IO.File]::ReadAllText($file.source, [Text.UTF8Encoding]::new($false, $true)); $result.scanCoverage.text.paths += $file.identity; $patterns = @('-----BEGIN [A-Z ]*PRIVATE KEY-----', 'gh[pousr]_[A-Za-z0-9_]{20,}', '\\bsteam_(?:password|token|secret|apikey|api_key)\\b', '(?:\\b|_)(?:password|passwd|pwd)\\b\\s*[:=]', '\\b(?:token|api[_-]?key|secret)\\b\\s*[:=]'); foreach ($pattern in $patterns) { if ([regex]::IsMatch($content, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { Add-Blocker 'SENSITIVE_MATERIAL' 'sensitive-material' $file.identity; break } } } catch { $result.scanCoverage.unreadable.paths += $file.identity; if ($requiredText -contains $file.identity) { Add-Blocker 'REQUIRED_TEXT_UNREADABLE' 'unreadable-required-text' $file.identity } } }; foreach ($name in @('text', 'binary', 'unreadable', 'oversized')) { $paths = @($result.scanCoverage[$name].paths); [Array]::Sort($paths, [StringComparer]::Ordinal); $result.scanCoverage[$name].paths = $paths; $result.scanCoverage[$name].count = $paths.Count }; $result.scanCoverage.totalFileCount = $Files.Count }",
    "function New-CandidateRoot { $parent = [IO.Path]::GetTempPath(); $leaf = 'dota-workshop-rc-' + [Guid]::NewGuid().ToString('N'); $path = Join-Path $parent $leaf; [IO.Directory]::CreateDirectory($path) | Out-Null; return [ordered]@{ path = $path; identity = $leaf } }",
    "function Assert-SourceStable([object[]]$Files, [Collections.IDictionary]$Before) { foreach ($file in $Files) { $afterBytes = [long](Get-Item -LiteralPath $file.source -Force).Length; $afterHash = Get-FileSha256 $file.source; if ($afterBytes -ne $Before[$file.identity].bytes -or $afterHash -ne $Before[$file.identity].sha256) { throw 'SOURCE_CHANGED_DURING_ASSEMBLY' } } }",
    "function Assert-CandidateLedger([object[]]$Files, [object[]]$Entries) { if ($Files.Count -ne $Entries.Count) { throw 'CANDIDATE_TREE_MISMATCH' }; for ($index = 0; $index -lt $Files.Count; $index += 1) { if ($Files[$index].identity -ne $Entries[$index].path) { throw 'CANDIDATE_LEDGER_MISSING' } } }",
    "function Assert-CandidateTopology([object[]]$Directories, [string]$CandidateRoot) { foreach ($directory in $Directories) { $candidate = Join-Path $CandidateRoot $directory.identity; if (-not (Test-Path -LiteralPath $candidate -PathType Container)) { throw 'CANDIDATE_TREE_MISSING' } }; $expected = @($Directories.identity + $script:allFiles.identity); [Array]::Sort($expected, [StringComparer]::Ordinal); $observed = @(); foreach ($item in @(Get-ChildItem -LiteralPath $CandidateRoot -Recurse -Force)) { $observed += (Get-SafeRelativePath $CandidateRoot $item.FullName).Replace('\\', '/') }; [Array]::Sort($observed, [StringComparer]::Ordinal); if (($expected | ConvertTo-Json -Compress) -ne ($observed | ConvertTo-Json -Compress)) { throw 'CANDIDATE_TREE_UNEXPECTED' } }",
    "function Get-CanonicalManifestDigest([object[]]$Entries) { $rows = @(); foreach ($entry in $Entries) { $rows += ,@($entry.schemaVersion, $entry.root, $entry.path, [long]$entry.bytes, $entry.sha256) }; return Get-TextSha256 ($rows | ConvertTo-Json -Depth 4 -Compress) }",
    "if ((Get-TextSha256 $CanonicalVectorJson) -ne $CanonicalVectorSha256) { throw 'CANDIDATE_MANIFEST_PROJECTION_FAILED' }",
    `$result = [ordered]@{ schemaVersion = $SchemaVersion; operation = [ordered]@{ status = 'not-reached' }; artifactValidation = [ordered]@{ status = 'not-reached' }; blockers = @(); cleanup = [ordered]@{ schemaVersion = $SchemaVersion; attempted = $false; attempts = 0; status = 'not-reached'; verified = $false }; paths = [ordered]@{ gameAddon = "game/dota_addons/$AddonName"; contentAddon = "content/dota_addons/$AddonName" }; execution = [ordered]@{ kind = 'remote'; outcome = 'completed'; exitCode = 0 }; warnings = @(); commands = @(); logs = @(); boundaries = [ordered]@{ ${boundaries} }; scanCoverage = [ordered]@{ schemaVersion = $SchemaVersion; totalFileCount = 0; text = [ordered]@{ count = 0; paths = @() }; binary = [ordered]@{ count = 0; paths = @() }; unreadable = [ordered]@{ count = 0; paths = @() }; oversized = [ordered]@{ count = 0; paths = @() } } }`,
    "$candidateRoot = $null",
    "$candidateIdentity = $null",
    "try {",
    "  if ($AddonName -notmatch '^[a-z][a-z0-9_]{0,63}$') { Add-Blocker 'INVALID_ADDON_NAME' 'input' }",
    "  $dotaRoot = [IO.Path]::GetFullPath($DotaRootInput)",
    "  $gameAddonRoot = Join-Path $dotaRoot ('game/dota_addons/' + $AddonName)",
    "  $contentAddonRoot = Join-Path $dotaRoot ('content/dota_addons/' + $AddonName)",
    "  if (-not (Test-ContainedPath $dotaRoot $gameAddonRoot)) { Add-Blocker 'GAME_ADDON_ROOT_OUTSIDE_DOTA_ROOT' 'isolation' }",
    "  if (-not (Test-ContainedPath $dotaRoot $contentAddonRoot)) { Add-Blocker 'CONTENT_ADDON_ROOT_OUTSIDE_DOTA_ROOT' 'isolation' }",
    "  Test-RequiredPath $gameAddonRoot 'directory' 'game addon root'",
    "  Test-RequiredPath $contentAddonRoot 'directory' 'content addon root'",
    "  if ($result.blockers.Count -eq 0) { Assert-SafeSourceTree $gameAddonRoot; Assert-SafeSourceTree $contentAddonRoot; $gameInventory = Get-SourceInventory 'game' $gameAddonRoot; $contentInventory = Get-SourceInventory 'content' $contentAddonRoot; $script:allFiles = @($gameInventory.files + $contentInventory.files); $allDirectories = @($gameInventory.directories + $contentInventory.directories); [Array]::Sort($script:allFiles, [Collections.Generic.Comparer[object]]::Create([Comparison[object]]{ param($left, $right) [StringComparer]::Ordinal.Compare($left.identity, $right.identity) })); Test-ReleaseReadiness $gameAddonRoot $contentAddonRoot $script:allFiles }",
    "  if ($result.blockers.Count -gt 0) { $result.artifactValidation = [ordered]@{ status = 'blocked'; blockers = @($result.blockers); scanCoverage = $result.scanCoverage } } else {",
    "    $created = New-CandidateRoot; $candidateRoot = $created.path; $candidateIdentity = $created.identity",
    "    $before = @{}; foreach ($file in $script:allFiles) { $before[$file.identity] = [ordered]@{ bytes = [long](Get-Item -LiteralPath $file.source -Force).Length; sha256 = Get-FileSha256 $file.source } }",
    "    foreach ($directory in $allDirectories) { [IO.Directory]::CreateDirectory((Join-Path $candidateRoot $directory.identity)) | Out-Null }",
    "    $entries = @(); foreach ($file in $script:allFiles) { $destination = Join-Path $candidateRoot $file.identity; [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null; Copy-FileStreamed $file.source $destination; $candidateBytes = [long](Get-Item -LiteralPath $destination -Force).Length; $candidateHash = Get-FileSha256 $destination; if ($candidateBytes -ne $before[$file.identity].bytes -or $candidateHash -ne $before[$file.identity].sha256) { throw 'RELEASE_CANDIDATE_INTEGRITY_MISMATCH' }; $entries += [ordered]@{ schemaVersion = $SchemaVersion; root = $file.root; path = $file.identity; bytes = $candidateBytes; sha256 = $candidateHash } }",
    "    Assert-SourceStable $script:allFiles $before; Assert-CandidateLedger $script:allFiles $entries; Assert-CandidateTopology $allDirectories $candidateRoot",
    "    $manifest = [ordered]@{ schemaVersion = $SchemaVersion; entries = @($entries); combinedSha256 = Get-CanonicalManifestDigest $entries }",
    "    $ledger = [ordered]@{ schemaVersion = $SchemaVersion; expectedFileCount = $script:allFiles.Count; observedFileCount = $entries.Count; matchedFileCount = $entries.Count }",
    "    $result.manifest = $manifest; $result.inclusionLedger = $ledger; $result.artifactValidation = [ordered]@{ status = 'passed'; manifest = $manifest; inclusionLedger = $ledger; scanCoverage = $result.scanCoverage }; $result.operation = [ordered]@{ status = 'completed' }",
    "  }",
    "} catch {",
    "  if ($result.blockers.Count -eq 0) { Add-Blocker 'SOURCE_OBSERVATION_FAILED' 'remote-script' }",
    "  if ($result.artifactValidation.status -eq 'not-reached') { $result.artifactValidation = [ordered]@{ status = 'blocked'; blockers = @($result.blockers) } }",
    "} finally {",
    "  if ($null -ne $candidateRoot -and $null -ne $candidateIdentity) { $result.cleanup = [ordered]@{ schemaVersion = $SchemaVersion; attempted = $true; attempts = 1; status = 'failed'; verified = $false; code = 'CANDIDATE_REMOVAL_FAILED'; identityMatched = $false; removed = $false; absent = $false }; $leafMatched = ([IO.Path]::GetFileName($candidateRoot) -ceq $candidateIdentity); $result.cleanup.identityMatched = $leafMatched; if ($leafMatched) { try { Remove-Item -LiteralPath $candidateRoot -Recurse -Force -ErrorAction Stop; $result.cleanup.removed = $true } catch { $result.cleanup.removed = $false }; $result.cleanup.absent = -not (Test-Path -LiteralPath $candidateRoot); if ($result.cleanup.removed -and $result.cleanup.absent) { $result.cleanup.status = 'verified'; $result.cleanup.verified = $true; $result.cleanup.Remove('code') | Out-Null } elseif ($result.cleanup.removed) { $result.cleanup.code = 'CANDIDATE_ABSENCE_UNVERIFIED' } }; if (-not $result.cleanup.verified) { Add-Blocker $result.cleanup.code 'removal' } }",
    "}",
    "$result.ok = ($result.operation.status -eq 'completed' -and $result.artifactValidation.status -eq 'passed' -and $result.blockers.Count -eq 0 -and $result.cleanup.status -eq 'verified')",
    "[Console]::Out.Write(($result | ConvertTo-Json -Depth 20 -Compress))"
  ].join("\n");
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

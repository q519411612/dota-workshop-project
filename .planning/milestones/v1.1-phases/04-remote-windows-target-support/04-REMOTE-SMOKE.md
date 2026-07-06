# Remote Windows Smoke Evidence

**Date:** 2026-07-03
**Status:** Passed for remote discovery, interactive Workshop Tools launch, and generated addon Workshop Tools open evidence

## Scope

This smoke pass used a user-provided Windows target with Dota 2 Workshop Tools installed. Credentials, hostnames, private IP addresses, and account details are intentionally not recorded.

## Evidence

- Remote SSH executed PowerShell commands successfully with the Windows OpenSSH default shell configured as PowerShell.
- Remote Dota root was verified with required Workshop Tools paths:
  - `game/bin/win64/dota2.exe`
  - `game/bin/win64/vconsole2.exe`
  - `game/dota_addons`
  - `content/dota_addons`
- Direct remote `Start-Process` launch returned PID evidence but the process exited before Workshop Tools wrote Dota-side evidence. This showed that service-session process launch is not sufficient for desktop Workshop Tools validation.
- `launchMode: "interactiveTask"` launched through a temporary Windows Scheduled Task with `LogonType Interactive` and Steam `-applaunch 570`.
- Interactive launch evidence requires a matching Dota process created after the scheduled task start time, so stale processes from earlier launches are not accepted.
- Interactive launch produced desktop-session `dota2.exe` command-line evidence for:
  - `-tools -addon overthrow +dota_launch_custom_game overthrow forest_solo`
  - `-tools -addon mcp_smoke_20260703_0439`
- The generated addon `mcp_smoke_20260703_0439` had remote game/content roots, `addoninfo.txt`, and `scripts/vscripts/addon_game_mode.lua`.
- The generated addon Lua marker line was present:

```text
[DOTA_WORKSHOP_MCP] addon loaded: mcp_smoke_20260703_0439
```

- Workshop Tools wrote generated-addon scoped artifacts during interactive launch:
  - `tools_asset_info.bin`
  - `tools_thumbnail_cache.sqlite3`
  - `tools_thumbnail_cache.sqlite3-shm`
  - `tools_thumbnail_cache.sqlite3-wal`

## Remaining Runtime Limit

Readable Steam logs and scanned Dota files did not expose the generated Lua `Activate()` marker. The generated addon also uses the minimal template map metadata and does not include a compiled custom map. Runtime marker validation therefore remains dependent on either a readable Workshop Tools console/log source or a compiled map/runtime path that reaches Lua.

This does not reduce the v1 remote launch claim: remote discovery, remote addon creation/inspection, remote command evidence, and remote desktop-session Workshop Tools launch were verified. Validation still correctly refuses to report marker success without marker evidence.

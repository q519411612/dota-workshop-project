# Runtime Marker Remote Smoke Evidence

**Date:** 2026-07-03
**Status:** Passed

## Scope

This smoke pass used a user-provided Windows target with Dota 2 Workshop Tools installed. Credentials, hostnames, private IP addresses, and account details are intentionally not recorded.

## Setup

- Generated addon used for smoke: `mcp_v11_marker_20260703`.
- The addon Lua entry point printed `[DOTA_WORKSHOP_MCP] addon loaded: mcp_v11_marker_20260703` from `Activate()`.
- Dota runtime was launched through the remote adapter with:
  - `launchMode: "interactiveTask"`
  - `runtimeMode: "game"`
  - `consoleLog: true`
  - map: `dota`

## Evidence

- Runtime launch command evidence included:

```text
-novid -addon mcp_v11_marker_20260703 +dota_launch_custom_game mcp_v11_marker_20260703 dota -console -condebug
```

- The command intentionally omitted `-tools`.
- Remote log discovery read `game/dota/console.log`.
- `validate_addon` returned success with evidence:

```text
found validation marker for mcp_v11_marker_20260703
```

- The Dota console log contained:

```text
[VScript] [DOTA_WORKSHOP_MCP] addon loaded: mcp_v11_marker_20260703
```

- The same console log also contained addon runtime evidence:

```text
[Server] SV:  addon='mcp_v11_marker_20260703'
```

## Conclusion

The v1.1 runtime marker loop is verified: the MCP server can launch a generated addon in game runtime mode, enable readable Dota console logging, discover the console log remotely, and validate the generated Lua marker from a prefixed Dota console line.

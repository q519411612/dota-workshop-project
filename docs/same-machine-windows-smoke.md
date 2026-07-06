# Same-Machine Windows Smoke Evidence Runbook

This runbook is for the optional evidence path where the MCP server runs directly on the same Windows machine that has Dota 2 Workshop Tools installed.

## Purpose

The local verifier proves that the evidence artifact is well formed and sanitized. It does not prove real Windows runtime success by itself. Real runtime success requires sanitized Dota console or log lines that contain the expected `[DOTA_WORKSHOP_MCP]` markers from an actual custom game launch.

## Local Harness Check

Build the project and run the harness verifier:

```bash
npm run build
npm run verify:same-machine-smoke
```

Expected local meaning:

- `status: "harness_ready"` means the schema, verifier, and runbook are ready.
- `runtimeEvidence: "pending"` means real same-machine Windows evidence has not been collected.
- This status is not a runtime validation pass.

## Same-Machine Windows Collection

On the Windows machine, run the plugin MCP server from the repository checkout and use the existing MCP workflow to create, launch, and validate a small playable smoke addon. Use only sanitized evidence in any artifact committed or shared for review.

Required evidence categories:

- MCP server command category, without private working directory values.
- Addon name and map name.
- Successful create, inspect, launch, and validate operation names.
- Sanitized launch command category, without account, machine, or private path values.
- Sanitized console or log lines containing `[DOTA_WORKSHOP_MCP]` runtime markers.
- Explicit boundaries confirming no Workshop upload, Steam login capture, Steam Guard handling, encryption, signing, credential storage, or remote Windows connection.

Do not store:

- Steam credentials, Steam Guard material, GitHub tokens, Windows passwords, private keys, or remote credentials.
- Windows usernames, account names, hostnames, private machine names, or private host data.
- Private absolute paths from the Windows machine.
- Raw console logs if they include private data.

## Artifact Status

Use `harness_ready` when only the local verifier/runbook/schema readiness has been proven.

Use `runtime_pending` when the workflow is prepared but real same-machine runtime evidence is externally blocked or not yet collected.

Use `runtime_passed` only when sanitized real Windows console or log marker lines are present.

## Sanitized Artifact Shape

Use placeholders for paths and categories:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-07-07T00:00:00.000Z",
  "target": {
    "kind": "same-machine-windows",
    "identity": "sanitized"
  },
  "status": "runtime_passed",
  "addonName": "local_smoke_demo",
  "mapName": "dota",
  "operations": ["create_addon", "inspect_addon", "launch_custom_game", "validate_addon"],
  "evidence": ["same-machine MCP server launched on Windows", "Dota custom game launch returned log evidence"],
  "warnings": [],
  "blockers": [],
  "boundaries": [
    "no Workshop upload attempted",
    "no Steam login captured",
    "no Steam Guard handling captured",
    "no content encryption performed",
    "no package signing performed",
    "no credentials stored",
    "no remote Windows connection attempted"
  ],
  "paths": {
    "dotaRoot": "<sanitized-dota-root>",
    "consoleLog": "<sanitized-console-log>"
  },
  "commands": [
    {
      "command": "<sanitized-local-node-command>"
    }
  ],
  "logs": [
    {
      "source": "sanitized console log",
      "lines": [
        "[VScript] [DOTA_WORKSHOP_MCP] addon loaded: local_smoke_demo",
        "[VScript] [DOTA_WORKSHOP_MCP] win condition reached: local_smoke_demo"
      ]
    }
  ]
}
```

Verify a saved artifact:

```bash
npm run build
node ./dist/verify-same-machine-smoke.js <sanitized-artifact-json>
```

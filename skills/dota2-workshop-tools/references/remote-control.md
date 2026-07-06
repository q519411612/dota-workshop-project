# Remote Windows Control

Use this reference when the Dota 2 Workshop Tools target is a Windows machine controlled from another host.

## Supported Channels

v1 supports command execution through:

- SSH to Windows.
- PowerShell Remoting.

Remote desktop or screen automation is out of scope for the primary v1 path.

## Same Logical Tools

Remote Windows should use the same MCP operations as local Windows:

- `discover_environment`
- `validate_target`
- `create_addon`
- `inspect_addon`
- `inspect_workshop_preflight`
- `dry_run_release_report`
- `link_addon`
- `launch_tools`
- `launch_custom_game`
- `run_playable_smoke`
- `cleanup_playable_smoke`
- `read_console_or_logs`
- `validate_addon`

The target object should select the adapter. The agent should not choose separate user-facing workflows for local and remote.

Remote preflight inspection uses the same `inspect_workshop_preflight` operation as fixture and local targets. It checks addon layout, Panorama directories, TypeScript-to-Lua marker files, React marker files, and publishing blockers through remote command evidence; it does not launch Dota, run build tools, perform Workshop upload, or handle credentials.

Remote release readiness uses the same `dry_run_release_report` operation as fixture and local targets. It checks package candidate files, publish-facing addon metadata, and sensitive information markers through remote command evidence. It does not create archives, encrypt content, run toolchains, log into Steam, upload to Workshop, or store credentials.

## Interactive Launches

When SSH or PowerShell Remoting starts commands outside the logged-in desktop session, `dota2.exe` may return process evidence and then exit before Workshop Tools initializes. For real Workshop Tools desktop validation, call `launch_tools` or `launch_custom_game` with:

```json
{
  "launchMode": "interactiveTask"
}
```

This mode uses a temporary Windows Scheduled Task with `LogonType Interactive` and launches Steam with `-applaunch 570` plus the requested Workshop Tools arguments. Treat it as an explicit mode, not a fallback from failed process launch.

For repeatable playable smoke on remote Windows, pass the same target object to `run_playable_smoke` and include:

```json
{
  "launchMode": "interactiveTask"
}
```

The workflow still validates runtime markers from logs. A completed interactive launch task is not validation success by itself.

If a repeat smoke is blocked by a previous smoke Dota process, call `cleanup_playable_smoke` with the same remote target and the previous smoke `addonName`. Use `dryRun: true` first to inspect matches. Use `dryRun: false` only after confirming the returned command-line evidence is scoped to the requested addon. Cleanup does not stop Steam and does not delete addon files.

## Evidence Requirements

Remote command results must include:

- Remote target identity without secrets.
- Command or script invoked.
- Exit code.
- Stdout and stderr.
- Resolved paths.
- Whether files were generated on the remote host or copied there.

If remote execution fails, return the remote failure. Do not fall back to local behavior.

## Secrets

Never write host credentials, Steam credentials, passwords, tokens, private keys, or machine-specific secrets into project files. Use environment variables, user shell configuration, or runtime MCP configuration outside the repository.

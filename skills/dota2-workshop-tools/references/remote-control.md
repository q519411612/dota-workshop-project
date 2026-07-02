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
- `link_addon`
- `launch_tools`
- `launch_custom_game`
- `read_console_or_logs`
- `validate_addon`

The target object should select the adapter. The agent should not choose separate user-facing workflows for local and remote.

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

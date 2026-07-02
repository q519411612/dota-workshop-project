# Project Research - Architecture

## Recommended Architecture

Use a layered plugin architecture:

```text
Plugin package
  Skill layer
    SKILL.md
    references/addon-layout.md
    references/workshop-tools.md
    references/minimal-template.md
    references/troubleshooting.md
  MCP server layer
    tools/
    adapters/
    validators/
  Template layer
    assets/templates/minimal-addon/
  Test and verification layer
    unit tests
    fixture tests
    Windows smoke tests
```

## Component Boundaries

### Skill

Purpose:

- Teach the agent the Dota 2 Workshop Tools workflow.
- Route actions to MCP tools when environment control is needed.
- Keep large reference details out of `SKILL.md` and behind progressive disclosure.

Does not:

- Execute commands.
- Guess Windows paths.
- Hide MCP failures.

### MCP server

Purpose:

- Expose deterministic tools.
- Validate inputs and target configuration.
- Run local or remote Windows operations.
- Return structured results with logs and explicit errors.

Does not:

- Decide game design.
- Generate large gameplay systems in v1.
- Use screen scraping as the primary strategy.

### Target adapters

Local Windows adapter:

- Runs commands directly on the host where Dota 2 Workshop Tools is installed.
- Reads registry and Steam library files.
- Starts `dota2.exe` and `vconsole2.exe`.
- Reads files and logs from local disk.

Remote Windows adapter:

- Runs equivalent commands through SSH or PowerShell Remoting.
- Copies or syncs addon files when needed.
- Reuses the same validators and result schema.

### Template generator

Purpose:

- Create the smallest addon structure that can be launched.
- Keep generated files deterministic.
- Insert a validation marker in Lua so logs can prove the addon loaded.

Initial output should be intentionally small:

```text
game/dota_addons/<addon>/
  addoninfo.txt
  scripts/vscripts/addon_game_mode.lua
  scripts/npc/herolist.txt
  scripts/npc/npc_heroes_custom.txt
content/dota_addons/<addon>/
  maps/<map>.vmap or a documented dependency on an existing test map
```

Exact file list must be verified against current Workshop Tools.

## Data Flow

### Local Windows

1. User asks to create or validate an addon.
2. Skill guides the agent to call MCP.
3. MCP validates addon name and target configuration.
4. Local adapter discovers Dota install root.
5. Template generator writes addon files into the Dota addon trees.
6. Launch tool starts Workshop Tools with addon arguments.
7. Validation tool starts or checks a custom game launch.
8. Log reader returns structured evidence.

### Remote Windows

1. User chooses or configures a remote target.
2. MCP validates the connection.
3. Remote adapter discovers Dota install root on the remote machine.
4. Files are generated remotely or synced to the remote addon trees.
5. Remote commands launch tools and validation.
6. Logs are read remotely and returned through MCP.

## Suggested MCP Tools

```text
discover_environment(target)
validate_target(target)
create_addon(target, addon_name, template)
inspect_addon(target, addon_name)
link_addon(target, source_path, addon_name)
launch_tools(target, addon_name)
launch_custom_game(target, addon_name, map_name)
read_console_or_logs(target, addon_name, since)
validate_addon(target, addon_name, map_name)
```

## Result Shape

Every MCP tool should return structured results:

```json
{
  "ok": true,
  "target": "local",
  "operation": "launch_tools",
  "evidence": [],
  "warnings": [],
  "paths": {},
  "commands": [],
  "logs": []
}
```

On failure:

```json
{
  "ok": false,
  "error": {
    "code": "DOTA_INSTALL_NOT_FOUND",
    "message": "Dota 2 install root was not found on target windows-local."
  },
  "evidence": [],
  "commands": []
}
```

## Build Order Implications

1. Define plugin skeleton and skill references.
2. Implement MCP input schemas and result schemas.
3. Implement environment discovery.
4. Implement minimal addon template generation in a test fixture.
5. Implement local Windows adapter.
6. Implement remote command adapter.
7. Add launch and validation tools.
8. Run Windows smoke tests with a real Dota 2 install.

This order keeps the project testable before requiring real Workshop Tools.

## Sources

- `https://github.com/bmddota/barebones`
- `https://github.com/XavierCHN/x-template`

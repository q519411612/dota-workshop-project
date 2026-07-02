# Project Research - Features

## Feature Categories

### Skill guidance

Table stakes:

- Trigger reliably for Dota 2 Workshop Tools, Dota 2 custom games, addon templates, Lua gamemode work, Panorama UI, and Workshop Tools troubleshooting.
- Explain the split between `game/dota_addons/<addon>` and `content/dota_addons/<addon>`.
- Direct the agent to inspect existing addon structure before editing.
- Tell the agent when to use MCP tools instead of guessing paths or commands.
- Include references for addon layout, Lua gamemode entry points, KeyValues/KV3 metadata, launch validation, and known pitfalls.

Differentiators:

- Provide compact recipes for "minimal runnable addon", "add simple ability", "add simple UI", and "run validation".
- Include a decision tree for local Windows vs remote Windows.
- Include known Dota-specific failure diagnosis from logs and console output.

Anti-features:

- A huge embedded Dota API encyclopedia in `SKILL.md`.
- Forcing one project architecture for every custom game.
- Auto-repairing generated code without surfacing the underlying Workshop Tools error.

### MCP environment discovery

Table stakes:

- Detect whether the server is running on Windows.
- Locate Dota 2 install root.
- Verify `game/bin/win64/dota2.exe` exists.
- Verify `game/bin/win64/vconsole2.exe` exists when console launch is requested.
- Verify `game/dota_addons` and `content/dota_addons` directories exist.
- Return explicit failures when Steam/Dota/Workshop Tools are missing.

Differentiators:

- Read Steam registry entries on Windows.
- Read Steam `libraryfolders.vdf` to find alternate library paths.
- Support user-provided install root override.
- Report Dota build metadata if available.

Anti-features:

- Guessing install paths without verification.
- Continuing with a fake path because it "looks standard".

### MCP addon creation

Table stakes:

- Validate addon names with Dota-safe rules, such as lowercase letters, digits, and underscores.
- Create minimal `game/dota_addons/<addon>` structure.
- Create minimal `content/dota_addons/<addon>` structure when map/content validation is in scope.
- Generate `addoninfo.txt`.
- Generate `scripts/vscripts/addon_game_mode.lua`.
- Generate minimal NPC/KV files only if required by the runnable template.
- Refuse to overwrite existing addons unless explicitly requested.

Differentiators:

- Optionally clone or adapt a minimal starter template.
- Generate a smoke-test command or marker log line that validation can search for.
- Preserve existing addon metadata format when modifying an addon.

Anti-features:

- Copying a large starter kit into every new addon.
- Generating gameplay systems before the basic launch loop is proven.

### MCP launch and validation

Table stakes:

- Launch Workshop Tools for an addon.
- Launch a custom game map when a map name is provided.
- Start or locate console/log output.
- Report process start success separately from game validation success.
- Read logs or console output and return clear error text.

Differentiators:

- Wait for expected log markers from generated Lua.
- Detect common startup failures such as missing addon, bad map, invalid metadata, or Lua syntax error.
- Capture a concise validation transcript for later review.

Anti-features:

- Claiming success merely because `dota2.exe` started.
- Depending on screen scraping as the first validation method.

### Remote Windows control

Table stakes:

- Use the same logical MCP tool names for local and remote targets.
- Execute remote commands through SSH or PowerShell Remoting.
- Copy or sync generated addon files to the Windows target when needed.
- Return command stdout, stderr, exit code, and classified failure.

Differentiators:

- Support multiple named targets.
- Support a dry-run mode that prints exact remote commands.
- Cache environment discovery per target with explicit invalidation.

Anti-features:

- Separate user-facing workflows for local and remote targets.
- Hidden fallback from remote failure to local behavior.

## v1 Feature Recommendation

Include in v1:

- Skill with concise workflow and references.
- Plugin shell.
- MCP environment discovery.
- MCP local Windows adapter.
- MCP remote Windows adapter over SSH/PowerShell Remoting with minimal command execution.
- Minimal addon generation.
- Workshop Tools launch.
- Custom game launch candidate.
- Log/console readback.
- Validation result with explicit success/failure.

Defer to v2:

- React Panorama generation.
- TypeScript-to-Lua pipeline.
- Excel/KV data workflow.
- Ability/item/unit generators.
- Publishing to Workshop.
- UI automation.
- Rich gameplay loops.

## Sources

- `https://github.com/bmddota/barebones`
- `https://github.com/XavierCHN/x-template`

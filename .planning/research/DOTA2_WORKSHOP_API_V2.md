# Dota 2 Workshop API Research for v2

**Date:** 2026-07-03
**Scope:** Playable Gameplay Loop MVP only
**Status:** Ready for v2 planning

## Research Boundary

This research only covers APIs and file formats needed to generate and validate a minimal playable Dota 2 custom game prototype from the existing v1.1 runtime marker loop. It does not attempt to document the complete Dota 2 API.

## Source Priority and Evidence

| Source | Result | Evidence Level |
|--------|--------|----------------|
| Existing project research | Reused addon layout, entry point, launch, metadata, and v1.1 console log findings from `.planning/research/SUMMARY.md` and Phase 5 artifacts. | Verified in project |
| Local Dota 2 install on this macOS host | No `dota 2 beta` install was found under `/Volumes`; several system directories denied access. | Not available |
| Valve Developer Community | `developer.valvesoftware.com` returned an Anubis bot challenge for raw scripting pages. | Official source inaccessible to automation |
| ModDota API docs | `https://docs.moddota.com/lua_server/` and `https://docs.moddota.com/lua_server_enums/` were readable. | Community API dump |
| Barebones template | `bmddota/barebones` `source2` branch was readable. | Community template evidence |
| x-template | `XavierCHN/x-template` `master` branch was readable. | Community template evidence |

## Runtime Entry Points

Observed template evidence:

- Barebones uses `game/dota_addons/<addon>/scripts/vscripts/addon_game_mode.lua`.
- Barebones defines `Precache(context)` and `Activate()`.
- Barebones `Activate()` constructs the game mode object and calls its initialization method.
- x-template TypeScript emits `Activate` and `Precache` into the Lua global environment.

v2 implementation basis:

- Generate `scripts/vscripts/addon_game_mode.lua`.
- Keep `Precache(context)` and `Activate()` as the only required runtime entry points.
- Keep v1.1 startup marker in `Activate()` initialization path.
- Add gameplay markers inside the initialized game mode object.

## GameRules and Gameplay APIs

Readable API evidence from ModDota:

| API | Evidence | v2 Use |
|-----|----------|--------|
| `GameRules:GetGameModeEntity()` | Returns the game mode entity. | Get an entity for a think loop. |
| `CBaseEntity:SetContextThink(name, func, interval)` | Sets a think function on an entity. | Drive a minimal score/win tick without bundling a Timers library. |
| `ListenToGameEvent(event, handler, context)` | Registers a listener for a game event from script. | Listen to `game_rules_state_change` and `entity_killed`. |
| `GameRules:State_Get()` | Gets current GameRules state. | Start the round when gameplay is in progress. |
| `GameRules:SetGameWinner(team)` | Makes the specified team win. | End the minimal loop. |
| `GameRules:SetCustomGameTeamMaxPlayers(team, count)` | Sets whether a team is selectable during setup. | Keep the generated prototype to a minimal player footprint. |
| `CreateUnitByName(name, vector, findClearSpace, owner, unitOwner, team)` | Creates a DOTA unit by name. | Candidate spawn marker for the minimal loop. |
| `PrecacheUnitByNameSync(name, context, seed)` | Precaches a DOTA unit by name. | Candidate precache for spawned unit. |

Enums from ModDota:

- `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS = 10`
- `DOTA_TEAM_GOODGUYS = 2`
- `DOTA_TEAM_BADGUYS = 3`

Template evidence:

- Barebones registers `game_rules_state_change` and `entity_killed` through `ListenToGameEvent`.
- Barebones routes `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS` to `OnGameInProgress()`.
- Barebones uses `GameRules:SetCustomGameTeamMaxPlayers(...)` during setup.

## Runtime Markers and Logs

v1.1 verified evidence:

- Non-tools runtime launch with `+dota_launch_custom_game <addon> dota -console -condebug` writes `game/dota/console.log`.
- Lua `print(...)` appears in that log with Dota prefixes such as `[VScript]`.
- Marker matching must be substring based because Dota adds prefixes.

v2 marker plan:

- Preserve `[DOTA_WORKSHOP_MCP] addon loaded: <addon>`.
- Add `[DOTA_WORKSHOP_MCP] gamemode initialized: <addon>`.
- Add `[DOTA_WORKSHOP_MCP] round started: <addon>`.
- Add `[DOTA_WORKSHOP_MCP] target spawned: <addon>`.
- Add `[DOTA_WORKSHOP_MCP] score updated: <addon>`.
- Add `[DOTA_WORKSHOP_MCP] win condition reached: <addon>`.

The v2 validator can reuse the existing `validate_addon` marker mechanism, extended to accept multiple expected markers.

## Addon Metadata and KV Files

Observed metadata formats:

- Barebones uses classic KeyValues `addoninfo.txt` with `AddonInfo`, `TeamCount`, `maps`, `IsPlayable`, and per-map `MaxPlayers` blocks.
- x-template uses KV3 `addoninfo.txt` with `IsPlayable`, `DefaultMap = "dota"`, `maps = ["dota"]`, `MinPlayers`, `MaxPlayers`, and `map_options`.

v2 implementation basis:

- Preserve the current project convention of generating classic KeyValues for fixture stability.
- Include `DefaultMap`, `maps`, `MinPlayers`, and `MaxPlayers`.
- Continue generating `herolist.txt`, `npc_heroes_custom.txt`, localization, and content map directory.
- Add `npc_units_custom.txt` only when using a custom unit definition. For v2 MVP, unit spawn uses a Dota unit name candidate and does not rely on unverified custom unit KV.

## Candidate APIs Requiring Real Runtime Validation

The 2026-07-04 remote Windows runtime smoke on a user-provided target validated the original candidate gameplay loop on the stock `dota` map:

- `Vector(0, 0, 256)` was accepted as the spawn position constructor.
- `CreateUnitByName("npc_dota_creep_badguys_melee", Vector(0, 0, 256), ...)` spawned a unit and emitted `target spawned: <addon> npc_dota_creep_badguys_melee`.
- `SetContextThink` emitted repeated score markers after `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`.
- `GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)` executed after the target score and the win-condition marker was written.
- `GameRules:EnableCustomGameSetupAutoLaunch(true)`, `SetCustomGameSetupAutoLaunchDelay(0)`, `LockCustomGameSetupTeamAssignment(true)`, `SetHeroSelectionTime(0)`, `SetStrategyTime(0)`, `SetShowcaseTime(0)`, and `SetPreGameTime(0)` were accepted by the runtime and helped the stock `dota` map reach game-in-progress without manual UI automation.

Rejected by runtime smoke:

- `GameRules:SetCustomGameForceHero("npc_dota_hero_lina")` caused a Lua runtime error in the tested Dota runtime and must not be used as a stable v2 implementation basis.

Remaining candidates for later custom-map work:

- Whether a custom map should replace the origin-based spawn point with named map entities.
- Whether a later hero-selection flow should use a different, currently verified API instead of `SetCustomGameForceHero`.

The generated code should not hide failures. If candidate spawn or runtime APIs fail, Dota console logs and marker absence should expose the failure.

## Map Dependency Findings

Can be validated on `dota` map:

- Lua `Activate()` marker.
- Game mode initialization marker.
- GameRules state listener registration.
- Console log marker readback through `game/dota/console.log`.
- Think-loop driven score and win markers.
- Origin-based built-in creep spawn marker.

Requires a custom map or later map-specific work:

- Map entity based spawn points.
- Lane, wave, objective, trigger, and region logic.
- Custom navigation/pathing assertions.
- Spawn groups or Hammer-authored entity references.

## Deferred v2.x Scope

Explicitly defer:

- Complex AI.
- Panorama UI and React Panorama.
- TypeScript-to-Lua.
- Excel-to-KV.
- Custom ability, item, hero, and full unit generators.
- Workshop publishing and encryption.
- UI automation as the primary control path.

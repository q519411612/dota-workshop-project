# Phase 5 Discussion Log

## Inputs

- User requested v1.1 to close the real Windows Lua runtime marker validation loop.
- v1 remote smoke showed Workshop Tools opening and addon artifact writes, but not Lua marker evidence.

## Investigation

- Added an experiment marker addon on a user-provided remote Windows target.
- Confirmed `-tools` launch plus `+dota_launch_custom_game` opens tooling context and writes addon cache files but does not provide marker evidence.
- Confirmed `-condebug` creates `game/dota/console.log`.
- Confirmed non-tools custom game launch with `+dota_launch_custom_game <addon> dota -console -condebug` reaches Lua runtime and writes `[VScript] [DOTA_WORKSHOP_MCP] addon loaded: <addon>` to `console.log`.
- Confirmed `InitLogFile` and `AppendToLogFile` are deprecated on the current target; console printing is the supported evidence path.

## Selected Approach

Add explicit runtime launch options to `launch_custom_game` and validate marker substrings in readable console logs.

## Rejected Approaches

- Treating Workshop Tools asset cache writes as runtime validation evidence.
- Depending on deprecated Lua log-file APIs.
- Requiring a compiled custom map before closing this validation gap.

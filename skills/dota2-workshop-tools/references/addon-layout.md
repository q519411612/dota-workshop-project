# Dota 2 Addon Layout

Use this reference when deciding where Dota 2 custom game files belong.

## Roots

Dota 2 custom games use two addon roots under the Dota install root:

```text
game/dota_addons/<addon_name>
content/dota_addons/<addon_name>
```

The `game` tree is for runtime files loaded by Dota. The `content` tree is for source assets, maps, Panorama source files, particles, materials, and other Workshop content.

## Runtime Files

Place these under `game/dota_addons/<addon_name>`:

```text
addoninfo.txt
scripts/vscripts/addon_game_mode.lua
scripts/npc/herolist.txt
scripts/npc/npc_heroes_custom.txt
resource/addon_<addon_name>_english.txt
```

The Lua entry point for v1 is `scripts/vscripts/addon_game_mode.lua`. It should define `Precache(context)` and `Activate()`, and emit a stable validation marker during startup.

## Content Files

Place source assets under `content/dota_addons/<addon_name>`. A map source normally lives under:

```text
content/dota_addons/<addon_name>/maps/<map_name>.vmap
```

The v1 template may create the content root without a real compiled map when fixture validation is running outside Windows. Real Workshop validation must report missing maps as an explicit failure instead of pretending the addon is runnable.

## Safety Rules

- Validate addon names before writing. Use lowercase letters, digits, and underscores.
- Inspect both roots before editing an existing addon.
- Refuse overwrite when either root already exists unless replacement is explicitly requested.
- Report `game` and `content` paths separately in tool results.

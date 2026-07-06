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
scripts/npc/npc_units_custom.txt
scripts/npc/npc_abilities_custom.txt
resource/addon_<addon_name>_english.txt
```

The Lua entry point is `scripts/vscripts/addon_game_mode.lua`. It should define `Precache(context)` and `Activate()`, emit a stable validation marker during startup, and for the playable template emit gameplay markers from the minimal Lua loop.

`npc_units_custom.txt` and `npc_abilities_custom.txt` may contain a minimal unit/ability scaffold. Treat those KV files as generation evidence; runtime ability behavior needs separate Lua or engine validation work.

## Content Files

Place source assets under `content/dota_addons/<addon_name>`. A map source normally lives under:

```text
content/dota_addons/<addon_name>/maps/<map_name>.vmap
```

The template may create the content root without a real compiled map when fixture validation is running outside Windows. Runtime marker validation can use a launchable stock map such as `dota`; custom map validation must report missing maps as an explicit failure instead of pretending the addon is runnable.

`prepare_custom_map` copies the installed template source:

```text
content/dota_addons/addon_template/maps/template_map.vmap
```

to the selected addon map path, verifies the copied source contains `info_player_start_goodguys` and `info_player_start_badguys`, and compiles it with:

```text
game/bin/win64/resourcecompiler.exe
```

The expected compiled output is reported under:

```text
game/dota_addons/<addon_name>/maps/<map_name>.vpk
```

This template-derived path does not edit binary `.vmap` spawn coordinates. Treat Hammer entity editing and generated maps from scratch as separate work.

## Preflight Evidence

Use `inspect_workshop_preflight` when the task is to inspect readiness before adding UI, toolchain, or publishing work. The tool reports:

- Runtime layout evidence for `addoninfo.txt`, Lua entry, localization, hero data, unit data, and ability data.
- Content layout evidence for the addon root and map directory.
- Panorama source evidence under `content/dota_addons/<addon_name>/panorama`.
- Panorama runtime directory evidence under `game/dota_addons/<addon_name>/panorama`.
- Toolchain marker evidence for files such as `package.json`, `tsconfig.json`, `tsconfig.tstl.json`, `vite.config.*`, and `webpack.config.js`.
- Publishing blocker warnings for credentials, encryption, and Workshop upload.

Preflight is inspection only. It does not generate XML, CSS, JavaScript, React Panorama projects, TypeScript-to-Lua output, encrypted content, or Workshop uploads.

## Dry-Run Release Evidence

Use `dry_run_release_report` when the task is to decide whether an addon is ready for manual release review. The tool reports:

- Package candidate evidence for the game addon root, content addon root, Lua entry, localization file, map directory, and NPC KV support files.
- Metadata evidence or blockers for `addonSteamAppID`, `addontitle`, `addonAuthor`, and `addonDescription` in `addoninfo.txt`.
- Redacted sensitive information blockers for obvious token, password, Steam credential, GitHub token, private key, or host credential markers in text-like addon files.
- Boundary warnings for Steam login, content encryption, Workshop upload, and runtime validation.

The dry-run report can fail with release blockers. A passing dry run still does not publish, upload, encrypt, create archives, or prove runtime validation.

## Safety Rules

- Validate addon names before writing. Use lowercase letters, digits, and underscores.
- Inspect both roots before editing an existing addon.
- Refuse overwrite when either root already exists unless replacement is explicitly requested.
- Report `game` and `content` paths separately in tool results.

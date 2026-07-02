# Project Research - Pitfalls

## Pitfall: Treating process start as validation

Problem:

`dota2.exe` can start successfully while the addon fails to load, a map is missing, Lua has syntax errors, or metadata is invalid.

Prevention:

- Separate `launch_tools` from `validate_addon`.
- Require log or console evidence for validation.
- Insert a known startup marker in generated Lua and search for it.

## Pitfall: Hardcoding Dota install paths

Problem:

Steam libraries may live outside `C:\Program Files`, and users may have multiple Steam libraries.

Prevention:

- Read Windows registry entries for Dota app 570 when local.
- Read Steam `libraryfolders.vdf` when registry lookup is insufficient.
- Allow explicit install root override.
- Fail fast when the resolved path does not contain expected binaries and addon directories.

## Pitfall: Confusing `game` and `content` trees

Problem:

Lua/KV files and source assets/maps live in different trees. Writing files to the wrong tree can make the addon look present but fail at runtime or compile time.

Prevention:

- Model both roots explicitly.
- Make the template generator write each file to an intentional root.
- Add `inspect_addon` to report what exists in each tree.

## Pitfall: Overbuilding the first template

Problem:

Starter projects include many libraries, UI systems, particles, examples, and build scripts. Copying all of that makes v1 harder to validate.

Prevention:

- Generate the smallest runnable addon.
- Defer ability/item/unit/UI generators.
- Treat Barebones and x-template as reference sources, not as blobs to copy.

## Pitfall: Format drift in `addoninfo.txt`

Problem:

Observed templates use both classic KeyValues and KV3-like metadata. A generator that assumes the wrong format may break current Workshop Tools or existing projects.

Prevention:

- Preserve format when editing existing addons.
- Detect current Workshop Tools-created output during Windows smoke testing.
- Add fixture tests for both known formats.

## Pitfall: UI automation becoming the primary control path

Problem:

Desktop automation is fragile across resolution, language, focus, and Workshop Tools updates.

Prevention:

- Prefer process launch, filesystem checks, command execution, and log reading.
- Use UI automation only for later cases where no deterministic interface exists.

## Pitfall: Remote target ambiguity

Problem:

If the user is on Mac and Dota is on Windows, it is easy to accidentally generate files locally and launch commands remotely.

Prevention:

- Every tool takes an explicit target.
- Every result echoes the target, resolved Dota root, and command location.
- Remote operations either generate files on the remote host or explicitly sync them before launch.

## Pitfall: Silent fallback behavior

Problem:

For tool automation, fallback can hide incorrect assumptions and produce false success.

Prevention:

- Let missing paths, missing binaries, failed remoting, bad addon names, and launch failures return explicit errors.
- Do not invent alternate paths after a failed verified path unless the user requested discovery.
- Include attempted commands and paths in error evidence.

## Pitfall: Official docs are not always accessible to automation

Problem:

Valve Developer Community pages were inaccessible via curl during research because they returned an Anubis challenge.

Prevention:

- Keep research source confidence labels.
- Prefer generated target-machine probes for volatile details.
- Let the skill point users to official pages for manual reading, but do not treat inaccessible pages as scraped evidence.

## Sources

- `https://github.com/bmddota/barebones`
- `https://github.com/XavierCHN/x-template`

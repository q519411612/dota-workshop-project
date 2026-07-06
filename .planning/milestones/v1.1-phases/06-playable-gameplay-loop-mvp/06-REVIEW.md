# Phase 6 Review: Playable Gameplay Loop MVP

## Scope

Reviewed the v2 research artifacts, planning updates, TypeScript source, generated build output, tests, README, and skill references for the playable gameplay loop MVP.

## Findings

### Finding 1: Secret scan initially omitted untracked files

**Severity:** Medium
**Status:** Resolved

The first strict secret scan used `git ls-files`, which only scans tracked files. Phase 6 added new research and planning files before commit, so that command did not cover the full pending changeset.

**Resolution:**

- Re-ran the strict secret scan with `git ls-files --cached --others --exclude-standard`.
- The tracked and untracked scan passed with no private keys, common tokens, credential assignments, or private IP patterns.

## Re-Review

No open findings remain after the verification scan correction.

## Post-Smoke Review

Reviewed the real Windows gameplay smoke changes on 2026-07-04: playable template runtime setup, remote log reading, fixture tests, documentation updates, and planning evidence.

### Finding 2: Remote validation log window was too narrow for gameplay markers

**Severity:** Medium
**Status:** Resolved

The first real v2 smoke produced score and win markers, but `validate_addon` initially failed because remote log discovery read only the last 200 lines from `game/dota/console.log`. Dota startup and GC logs pushed early addon/gamemode/round markers out of that window before later gameplay markers appeared.

**Resolution:**

- Increased explicit remote log reads to 2000 lines.
- Updated remote auto-discovery so `game/dota/console.log` uses the wider 2000-line window while auxiliary Steam/overlay logs stay at 200 lines.
- Added remote fixture assertions for both log-read command paths.
- Re-ran validation against the real smoke addon; all required gameplay markers passed.

### Finding 3: Forced hero API was not stable in current runtime

**Severity:** Medium
**Status:** Resolved

Diagnostic runtime smoke showed `GameRules:SetCustomGameForceHero("npc_dota_hero_lina")` caused a Lua runtime error in the tested current Dota runtime. The error occurred before event listener and think-loop registration, preventing gameplay markers.

**Resolution:**

- Removed `SetCustomGameForceHero` from the stable playable template.
- Kept short setup and pre-game GameRules configuration that the diagnostic smoke accepted.
- Recorded the rejected API in research and phase smoke evidence.

## Verification Reviewed

- `git diff --check` passed.
- `npm run typecheck` passed.
- `npm test` passed with 44 tests after post-smoke fixes.
- `npm run build` passed.
- Plugin validation passed.
- Skill validation passed.
- Strict secret scan covered tracked and untracked files.
- Real Windows `validate_addon` passed for `v2_smoke_20260704_0003` with addon loaded, gamemode initialized, round started, score updated, and win condition markers.

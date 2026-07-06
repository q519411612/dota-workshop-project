# Review: Minimal Runtime Ability Proof

status: clean
date: 2026-07-07

## Scope Review

- The change stays on the existing unit ability scaffold contract and adds only an explicit proof option.
- The generated proof file is deterministic and repository-safe.
- Smoke marker expectations are opt-in and do not change the default scaffold smoke behavior.
- The implementation does not upload, sign, encrypt, publish, log in to Steam, mutate global install state, connect to Windows, or store credentials.

## Findings

- No blocking issues found.

## Residual Risk

- A generated ability proof harness does not prove runtime execution by itself.
- Real runtime ability proof remains pending until a Windows Dota run spawns the proof unit and sanitized logs contain the expected ability proof markers.

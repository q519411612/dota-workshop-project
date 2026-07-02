# Project Instructions

## Project Focus

This repository builds a plugin for AI-assisted Dota 2 Workshop Tools workflows. The first milestone is a thin vertical slice: a focused skill, an MCP server, a minimal Dota 2 addon template, and Windows validation through Workshop Tools logs or console evidence.

Read these planning files before implementation work:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/research/SUMMARY.md`

## Scope Discipline

- Keep v1 focused on plugin packaging, skill guidance, MCP schemas, minimal addon generation, local Windows validation, and remote Windows command execution.
- Defer TypeScript-to-Lua, React Panorama, Excel-to-KV, Workshop publishing, gameplay generators, and UI automation unless the roadmap is updated first.
- Do not silently fall back when Windows discovery, remote execution, launch, or validation fails. Return explicit errors with command/path evidence.

## Implementation Rules

- Code identifiers and user-facing API names must be English.
- Add comments only when they clarify non-obvious logic; comments should be Chinese.
- Prefer deterministic filesystem, process, command, and log operations over desktop UI automation.
- Keep local Windows and remote Windows behind the same MCP tool contracts.
- Every MCP result should include target, operation, success state, evidence, warnings, paths, commands, and logs when applicable.
- Never store GitHub tokens, remote credentials, Steam credentials, machine passwords, or private host data in the repository.

## Validation

- Schema, fixture, and template tests should run on macOS without a Dota install.
- Windows smoke tests must verify real Dota paths before launching tools.
- Launch success is not validation success. Validation requires expected log or console evidence.
- Before closing implementation work, run an independent review pass and record what was verified.

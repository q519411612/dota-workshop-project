# Phase 13: Panorama Toolchain Boundary and Publishing Preflight MVP - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning
**Mode:** Auto-selected from autonomous roadmap instruction

<domain>
## Phase Boundary

Add an inspection-only preflight surface for addon readiness across Panorama directories, TypeScript-to-Lua/React toolchain markers, and publishing blockers. The phase must report evidence and warnings; it must not generate UI, run build tools, accept credentials, encrypt content, upload to Workshop, or claim runtime validation.

</domain>

<decisions>
## Implementation Decisions

- The MCP tool name is `inspect_workshop_preflight`.
- The tool accepts the existing target contract plus `addonName`.
- The result uses the existing `ToolResult` shape and records categories through evidence, warnings, paths, commands, and logs.
- Missing optional Panorama/toolchain files are evidence or warnings, not fatal errors.
- Invalid addon names, missing fixture/local roots, and missing remote `dotaRoot` are fatal errors before reads or commands.
- Publishing preflight is local metadata/blocker inspection only; it never accepts or stores credentials and never uploads content.
- Real Windows validation should inspect an existing generated addon tree remotely and does not need to launch Dota.

</decisions>

<code_context>
## Existing Code Insights

- `src/addon.ts` owns addon path conventions and local inspection patterns.
- `src/remote.ts` owns remote PowerShell command construction, parsing, and evidence wrapping.
- `src/schemas.ts`, `src/server.ts`, and `src/tools.ts` expose MCP contracts.
- `tests/addon.test.ts`, `tests/remote-operations.test.ts`, and `tests/smoke.test.ts` provide patterns for fixture, remote command, and dispatcher coverage.
- `src/map.ts` is the closest precedent for local/remote command parity with explicit path evidence.

</code_context>

<specifics>
## Specific Ideas

- Add `src/preflight.ts` for local/fixture preflight and remote preflight orchestration.
- Check addon roots, `addoninfo.txt`, Lua entry, localization, `scripts/npc` support files, content map directory, and Panorama directories.
- Detect toolchain markers such as `package.json`, `tsconfig.json`, `tsconfig.tstl.json`, `vite.config.*`, and React package references without running tools.
- Always report publishing blockers for credentials, encryption, and Workshop upload as deferred behavior.
- Add tests proving no command is constructed for invalid remote input.

</specifics>

<deferred>
## Deferred Ideas

- Generating Panorama XML/CSS/JavaScript.
- React Panorama application scaffolding.
- TypeScript-to-Lua compilation or templates.
- Workshop publishing, encryption, Steam credential handling, or upload automation.
- UI automation for Workshop Tools publishing dialogs.

</deferred>

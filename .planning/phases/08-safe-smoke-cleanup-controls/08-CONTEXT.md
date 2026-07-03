# Phase 8 Context: Safe Smoke Cleanup Controls

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an explicit MCP cleanup operation for repeat playable smoke workflows. The operation should inspect or stop only Dota-related processes whose command line explicitly references the requested smoke addon name. It must work through the existing target contract for fixture/local/remote targets and must not be called automatically by `run_playable_smoke`.

</domain>

<decisions>
## Implementation Decisions

### Tool Shape
- Add `cleanup_playable_smoke` as a separate MCP operation.
- Use `addonName` as required input because process matching must be scoped to a known smoke addon.
- Use `dryRun` as the inspect-only switch; default execute mode stops matched process IDs after inspection.
- Keep `run_playable_smoke` unchanged except documentation that users may call cleanup explicitly before repeat runs.

### Safety Contract
- Match only Dota-related process names: `dota2.exe`, `dota2cfg.exe`, and `vconsole2.exe`.
- Require the command line to contain the requested addon name, not only a process name.
- Never target Steam processes.
- Never delete addon files or directories.
- Return no-match as auditable success with evidence, not as an error.

### Target and Secrets
- Reuse the existing fixture/local/remote target schema.
- Do not persist private target hostnames, accounts, passwords, tokens, Steam credentials, private keys, or private network data.
- Fixture tests may use reserved sample hostnames such as `dota.example.test`.

### Result Contract
- Return target, operation, `ok`, evidence, warnings, paths, commands, and logs for success and failure.
- Preserve remote command stdout, stderr, exit code, and attempted command on failure.
- Include warnings that cleanup does not delete generated addon files and does not stop Steam.

### the agent's Discretion
- Add a small `src/cleanup.ts` module if it keeps launch and remote modules focused.
- Reuse `runRemoteCommand` for remote execution.
- Use PowerShell process enumeration scripts for both local and remote command construction so tests can compare one safety model.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/07-repeatable-playable-smoke-workflow/07-VERIFICATION.md` - records `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND` and manual addon-scoped process stop.
- `.planning/phases/07-repeatable-playable-smoke-workflow/07-REVIEW.md` - records cleanup as explicit future design, not automatic broad cleanup.
- `src/smoke.ts` - current repeatable smoke orchestration and transcript behavior.
- `src/remote.ts` - remote command execution and interactive launch PowerShell pattern.
- `src/launch.ts` - local command construction and result shape patterns.
- `src/schemas.ts`, `src/tools.ts`, `src/server.ts` - MCP contract exposure points.

</canonical_refs>

<deferred>
## Deferred Ideas

- Automatic cleanup of all Dota/Steam processes.
- Deleting generated smoke addon files.
- Custom map spawn point validation.
- Richer gameplay objective generation.
- UI automation.
- Workshop publishing.
- TypeScript-to-Lua, React Panorama, and Excel-to-KV support.

</deferred>

---

*Phase: 08-safe-smoke-cleanup-controls*
*Context gathered: 2026-07-04*

# Phase 8: Safe Smoke Cleanup Controls - Specification

**Created:** 2026-07-04
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 10 locked

## Goal

Repeated playable smoke runs can explicitly inspect or stop only known Dota smoke processes whose command line matches a requested smoke addon name, without deleting files or silently changing `run_playable_smoke`.

## Background

Phase 7 made `run_playable_smoke` repeatable, but real Windows validation found a stale smoke Dota process could cause a later remote `interactiveTask` launch to fail with `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND`. The successful manual recovery stopped only the previous smoke Dota process by matching its smoke addon command line. No cleanup MCP operation exists today, and Phase 7 intentionally left process cleanup out of scope.

## Requirements

1. **Explicit MCP cleanup**: The MCP server exposes `cleanup_playable_smoke` as a separate operation.
   - Current: No cleanup tool exists; users must diagnose stale smoke processes manually.
   - Target: `cleanup_playable_smoke` is registered in schemas, dispatcher, and server metadata.
   - Acceptance: Tool-name and dispatcher tests prove `cleanup_playable_smoke` is callable independently from `run_playable_smoke`.

2. **Unified target contract**: Cleanup uses the existing target schema for fixture, local, and remote targets.
   - Current: Local and remote launch paths share schemas, but no cleanup contract exists.
   - Target: Cleanup accepts `{ target, addonName, dryRun? }` without a remote-only input shape.
   - Acceptance: Schema tests accept fixture/local/remote targets and reject malformed target input.

3. **Addon validation**: Cleanup rejects unsafe addon names before command construction.
   - Current: Addon validation exists for generation, inspection, launch, and validation operations.
   - Target: Cleanup uses the same addon-name validation and returns `INVALID_ADDON_NAME` evidence.
   - Acceptance: Invalid addon-name tests return no commands and include rejected-name evidence.

4. **Dry-run inspection**: Cleanup can report matching processes without stopping them.
   - Current: No inspect-only process cleanup mode exists.
   - Target: `dryRun: true` constructs an inspect command and reports matching candidate process evidence.
   - Acceptance: Fixture tests prove dry-run command evidence does not contain `Stop-Process` or kill commands.

5. **Scoped execute cleanup**: Execute mode stops only Dota-related processes that explicitly match the addon command line.
   - Current: Manual cleanup used addon command-line matching; no reusable implementation exists.
   - Target: Execute cleanup filters by Dota process names and the requested addon name before stopping matched process IDs.
   - Acceptance: Local and remote command-construction tests prove commands match `dota2.exe`, `dota2cfg.exe`, or `vconsole2.exe`, require addon command-line evidence, and do not target Steam.

6. **No destructive file cleanup**: Cleanup does not delete generated addon files or target directories.
   - Current: Phase 7 leaves generated files for inspection.
   - Target: Cleanup only inspects or stops matching processes.
   - Acceptance: Command tests show no `Remove-Item`, file deletion command, or addon path deletion appears in cleanup scripts.

7. **Auditable result shape**: Cleanup returns the standard MCP result fields.
   - Current: Other tools return target, operation, success state, evidence, warnings, paths, commands, and logs.
   - Target: Cleanup returns the same shape for success, no-match, and failure.
   - Acceptance: Contract tests assert target, operation, commands, evidence, warnings, paths, and logs are present.

8. **No-match evidence**: No matching process is explicitly reported.
   - Current: Manual diagnosis can leave ambiguity about whether cleanup happened.
   - Target: A no-match target state is returned as successful inspection with evidence that no matching Dota smoke process was found.
   - Acceptance: Tests prove no-match output is `ok: true` and includes no-match evidence.

9. **Remote failure evidence**: Remote command failure returns remote command details.
   - Current: Remote command helpers already surface failures for other operations.
   - Target: Cleanup preserves remote stdout, stderr, exit code, and command evidence on failure.
   - Acceptance: Tests prove remote executor failure returns `REMOTE_COMMAND_FAILED` evidence under `cleanup_playable_smoke`.

10. **Documentation**: Repeat smoke docs explain when and how to run cleanup.
    - Current: Troubleshooting mentions manual process cleanup after `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND`.
    - Target: README and skill references describe dry-run and execute cleanup before rerunning smoke, with safety boundaries.
    - Acceptance: Documentation includes cleanup examples and states that cleanup is explicit, addon-scoped, non-file-deleting, and non-Steam-killing.

## Boundaries

**In scope:**
- New explicit `cleanup_playable_smoke` MCP operation.
- Dry-run and execute cleanup modes.
- Addon-name validation before command construction.
- Fixture/local/remote target contract support.
- Dota process command-line matching against the requested addon name.
- Standard result evidence including commands, logs, paths, and warnings.
- README and skill-reference cleanup workflow documentation.

**Out of scope:**
- Automatic cleanup inside `run_playable_smoke` - cleanup must remain deliberate.
- Killing all Dota processes - process selection must be addon-scoped.
- Killing Steam - Steam process control is outside this cleanup boundary.
- Deleting generated smoke addon files - file cleanup is separate and deferred.
- Custom map spawn points - unrelated to process cleanup.
- Complex gameplay objectives - unrelated to cleanup controls.
- UI automation and Workshop publishing - still deferred.

## Constraints

- Code identifiers, MCP operation names, and configuration keys must be English.
- Comments in code, if needed, must be Chinese and limited to non-obvious logic.
- Local and remote cleanup must share the same user-facing contract.
- Cleanup failure must be explicit; no silent fallback or heuristic broad kill is allowed.
- No real target hostnames, credentials, tokens, Steam credentials, private keys, or private network data may be written to repository files.

## Acceptance Criteria

- [ ] `cleanup_playable_smoke` is exposed through schema, dispatcher, and server registration.
- [ ] Invalid addon names fail before command construction.
- [ ] Local dry-run cleanup command reports matching Dota processes without stopping them.
- [ ] Local execute cleanup command stops only matched Dota process IDs for the requested addon.
- [ ] Remote dry-run cleanup command reports matching Dota processes without stopping them.
- [ ] Remote execute cleanup command stops only matched Dota process IDs for the requested addon.
- [ ] No-match cleanup returns explicit no-match evidence.
- [ ] Remote command failure returns command, stdout, stderr, exit code, and failure evidence.
- [ ] `run_playable_smoke` does not invoke cleanup automatically.
- [ ] README and skill references document the explicit cleanup workflow.

## Edge Coverage

**Coverage:** 6/6 applicable edges resolved - 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| invalid input | R3 | covered | Invalid addon names return `INVALID_ADDON_NAME` before commands are built. |
| no-op state | R8 | covered | No matching process is a successful inspection with explicit evidence. |
| remote failure | R9 | covered | Remote executor failure preserves command evidence and error logs. |
| destructive boundary | R6 | covered | Cleanup scripts contain no file deletion operations. |
| overbroad process match | R5 | covered | Process selection requires Dota process name and addon command-line match. |
| implicit side effect | R1 | covered | `run_playable_smoke` remains unchanged except documentation describing optional explicit cleanup. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved - 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT run cleanup automatically from `run_playable_smoke`. | R1 | resolved | verification: test |
| MUST NOT stop Steam processes. | R5 | resolved | verification: test |
| MUST NOT broad-kill all Dota processes without addon command-line matching. | R5 | resolved | verification: test |
| MUST NOT delete generated addon files or directories. | R6 | resolved | verification: test |
| MUST NOT persist private target or credential data in docs or fixtures. | R10 | resolved | verification: judgment |

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.94  | 0.75  | met    | Explicit operation and safety boundary are named. |
| Boundary Clarity    | 0.92  | 0.70  | met    | Auto cleanup, broad kills, Steam, and file deletion are out of scope. |
| Constraint Clarity  | 0.86  | 0.65  | met    | Target contract, result shape, and safety constraints are specified. |
| Acceptance Criteria | 0.90  | 0.70  | met    | Testable schema, command, failure, and docs checks are listed. |
| **Ambiguity**       | 0.10  | <=0.20| met    | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today and what failed in v2.1? | `run_playable_smoke` exists; stale smoke process caused `INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND`. |
| 2 | Simplifier | What is the irreducible cleanup scope? | Inspect or stop only known Dota smoke processes matching the requested addon name. |
| 3 | Boundary Keeper | What must remain out of scope? | No automatic cleanup, no file deletion, no Steam stop, no broad Dota kill. |
| 4 | Failure Analyst | What would make cleanup unsafe or unverifiable? | Missing addon validation, no dry-run, no no-match evidence, or hidden remote failure details. |

---

*Phase: 08-safe-smoke-cleanup-controls*
*Spec created: 2026-07-04*
*Next step: plan and implement explicit cleanup controls.*

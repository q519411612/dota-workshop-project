# Phase 4: Remote Windows Target Support - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers remote Windows command-backed equivalents for environment discovery and launch operations through SSH or PowerShell Remoting. It does not require storing or inventing real credentials.

</domain>

<decisions>
## Implementation Decisions

### Remote Contract
- **D-01:** Remote targets use the same logical MCP tools as local targets where possible.
- **D-02:** Remote commands must return stdout, stderr, exit code, command evidence, and target metadata.
- **D-03:** Remote failure must never fall back to local behavior.

### Credential Handling
- **D-04:** Repository files must not contain credentials, tokens, keys, private host data, or Steam secrets.

### Verification
- **D-05:** Fixture executor tests can validate command generation and failure classification until real remote target access is provided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/REQUIREMENTS.md` — Remote and launch requirements.
- `.planning/ROADMAP.md` — Phase 4 success criteria.
- `skills/dota2-workshop-tools/references/remote-control.md` — Remote execution rules.
- `skills/dota2-workshop-tools/references/troubleshooting.md` — Remote failure handling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/remote.ts` already wraps SSH and PowerShell command evidence.
- `src/launch.ts` should provide reusable launch command construction after Phase 3.

### Established Patterns
- Use injected executors in tests; default executors run real commands only when configured.

### Integration Points
- MCP `discover_environment`, `launch_tools`, and `launch_custom_game` should support remote targets.

</code_context>

<deferred>
## Deferred Ideas

Real remote smoke validation waits for user-provided remote target configuration.

</deferred>

---

*Phase: 4-Remote Windows Target Support*
*Context gathered: 2026-07-03*

# Phase 3: Local Windows Workshop Validation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers local Windows target discovery, launch command construction, and log-based validation behavior. It must remain testable on macOS through fixtures and dry-run execution.

</domain>

<decisions>
## Implementation Decisions

### Discovery
- **D-01:** Support explicit Dota install root overrides first.
- **D-02:** Support deterministic Steam library discovery from environment-provided Steam roots and `libraryfolders.vdf`.
- **D-03:** Missing binaries or addon roots return explicit failures with checked paths.

### Launch
- **D-04:** Build Workshop Tools launch commands from verified target paths.
- **D-05:** Keep launch success separate from validation success.

### Validation
- **D-06:** Validation succeeds only when expected marker/log evidence is present.
- **D-07:** Fixture log validation on macOS is acceptable evidence for implementation; real Windows smoke remains manual until a target is provided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/REQUIREMENTS.md` — Environment, launch, and validation requirements.
- `.planning/ROADMAP.md` — Phase 3 success criteria.
- `skills/dota2-workshop-tools/references/launch-flow.md` — Candidate launch commands and validation rules.
- `skills/dota2-workshop-tools/references/troubleshooting.md` — Failure classifications.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/environment.ts` already validates required Dota paths.
- `src/result.ts` provides structured results.

### Established Patterns
- Tests use fixtures and explicit injected inputs to avoid real Dota dependencies.

### Integration Points
- MCP tools should expose launch and validation through the same result shape.

</code_context>

<deferred>
## Deferred Ideas

Real Windows smoke execution waits for a Windows machine with Dota 2 Workshop Tools installed.

</deferred>

---

*Phase: 3-Local Windows Workshop Validation*
*Context gathered: 2026-07-03*

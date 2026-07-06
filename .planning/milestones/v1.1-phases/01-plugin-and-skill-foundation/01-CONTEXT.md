# Phase 1: Plugin and Skill Foundation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the project-local plugin foundation: a valid plugin manifest, a focused Dota 2 Workshop Tools skill, and progressively loaded references for addon layout, minimal templates, launch validation, remote control, and troubleshooting. It does not implement the MCP server yet.

</domain>

<decisions>
## Implementation Decisions

### Plugin Shape
- **D-01:** Use the repository root as the plugin root with `.codex-plugin/plugin.json`, `skills/`, and later MCP/server assets added in place.
- **D-02:** Keep Phase 1 manifest references limited to files that exist now. Add MCP manifest wiring when the MCP server exists.
- **D-03:** Use `dota-workshop-tools` as the plugin and skill-oriented package identity.

### Skill Guidance
- **D-04:** Keep `SKILL.md` concise and use progressive disclosure through `references/`.
- **D-05:** The skill must explicitly route environment discovery, addon creation, launch, log reading, validation, and remote command execution to MCP tools instead of guessed paths or commands.
- **D-06:** The skill must mark v2 workflows as deferred: TypeScript-to-Lua, React Panorama projects, Excel-to-KV, gameplay generators, and Workshop publishing.

### Reference Set
- **D-07:** Ship five Phase 1 references: addon layout, minimal template, launch flow, remote control, and troubleshooting.
- **D-08:** References should encode the project safety rules: explicit targets, no silent fallback, validation by evidence, and no credentials in the repository.

### the agent's Discretion
- The exact manifest metadata and wording may use standard plugin conventions as long as validation passes and all referenced files exist.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/PROJECT.md` — Core value, constraints, and key decisions.
- `.planning/REQUIREMENTS.md` — Phase 1 requirement IDs and acceptance criteria.
- `.planning/ROADMAP.md` — Phase boundary and success criteria.

### Research
- `.planning/research/STACK.md` — Recommended plugin-first stack and expected layout.
- `.planning/research/ARCHITECTURE.md` — Skill, MCP, adapter, and template boundaries.
- `.planning/research/FEATURES.md` — Skill guidance and anti-features.
- `.planning/research/PITFALLS.md` — Failure modes the skill must prevent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No source assets existed before this phase. The repository only contained README, AGENTS instructions, and planning docs.

### Established Patterns
- Planning documents use `.planning/phases/<padded-phase>-<slug>/` with `CONTEXT`, `PLAN`, and `SUMMARY` artifacts.
- Plugin validation should follow `.codex-plugin/plugin.json` conventions from the local plugin creator reference.

### Integration Points
- The plugin root is the repository root.
- The skill lives under `skills/dota2-workshop-tools/`.
- MCP configuration will be added later after the server package exists.

</code_context>

<specifics>
## Specific Ideas

Use a small, deterministic v1 guidance set that helps agents create and validate one minimal Dota 2 custom game addon before expanding to larger gameplay systems.

</specifics>

<deferred>
## Deferred Ideas

- MCP server implementation belongs to Phase 2 and later.
- Local Windows launch and validation belong to Phase 3.
- Remote Windows execution belongs to Phase 4.

</deferred>

---

*Phase: 1-Plugin and Skill Foundation*
*Context gathered: 2026-07-03*

# Phase 2: MCP Contract and Addon Template - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the TypeScript MCP server contract and a fixture-tested minimal Dota 2 addon generator/inspector. It must run on macOS without a Dota install and must not launch Workshop Tools yet.

</domain>

<decisions>
## Implementation Decisions

### Tool Contract
- **D-01:** Expose one logical target model for local and remote Windows operations.
- **D-02:** Every operation result must include `ok`, `target`, `operation`, `evidence`, `warnings`, `paths`, `commands`, and `logs`.
- **D-03:** Failed operations must include stable error codes and actionable messages.

### Addon Template
- **D-04:** Validate addon names with lowercase letters, digits, and underscores.
- **D-05:** Generate both `game/dota_addons/<addon>` and `content/dota_addons/<addon>` roots.
- **D-06:** Include `addoninfo.txt`, `scripts/vscripts/addon_game_mode.lua`, minimal NPC KV files, localization, and a content map directory.
- **D-07:** Refuse overwrite when either addon root exists unless replacement is explicit.

### Runtime Shape
- **D-08:** Use TypeScript/Node.js with schema validation and testable core modules.
- **D-09:** Keep real target execution behind adapters so fixture tests can run on macOS.

### the agent's Discretion
- The exact internal module split and test framework can follow standard TypeScript practices as long as commands are deterministic and validation passes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/REQUIREMENTS.md` — MCP and addon requirement IDs.
- `.planning/ROADMAP.md` — Phase 2 success criteria.
- `.planning/phases/01-plugin-and-skill-foundation/01-CONTEXT.md` — Plugin and skill decisions.

### Research
- `.planning/research/STACK.md` — TypeScript/Node MCP recommendation.
- `.planning/research/ARCHITECTURE.md` — Suggested MCP tools and result shape.
- `.planning/research/FEATURES.md` — Addon creation requirements and anti-features.
- `.planning/research/PITFALLS.md` — Addon layout, overwrite, metadata, and fallback risks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/dota2-workshop-tools/references/minimal-template.md` defines the minimal file list and validation marker.
- `skills/dota2-workshop-tools/references/addon-layout.md` defines the two-root addon layout.

### Established Patterns
- Phase summaries record verification commands and outcomes.
- Plugin manifest should reference MCP only after server config exists.

### Integration Points
- `.mcp.json` should be added after a runnable server entry point exists.
- Tests should validate generated fixtures without Dota installed.

</code_context>

<specifics>
## Specific Ideas

The first MCP slice should prove the contract and generation logic before Windows launch behavior. Local and remote adapters can initially expose explicit unsupported or command-evidence behavior without hiding failures.

</specifics>

<deferred>
## Deferred Ideas

- Real local Windows discovery and launch evidence belongs to Phase 3.
- Real remote launch validation belongs to Phase 4.

</deferred>

---

*Phase: 2-MCP Contract and Addon Template*
*Context gathered: 2026-07-03*

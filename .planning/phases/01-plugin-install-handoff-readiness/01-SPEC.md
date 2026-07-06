# Phase 1: Plugin Readiness Verifier — Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Operators can run `npm run verify:plugin` after build and get deterministic pass/fail evidence that the plugin package, MCP config, skill references, and documented tool lists are ready for handoff.

## Background

The repository already has `.codex-plugin/plugin.json`, `.mcp.json`, `package.json`, `skills/dota2-workshop-tools/SKILL.md`, `README.md`, TypeScript MCP code, and built `dist/` output. There is no single local command that proves these pieces still agree. Current inspection found one drift example: the skill's MCP tool contract mentions `link_addon`, but the implemented `toolNames` registry does not expose that tool.

## Requirements

1. **Local verifier command**: Add a repository-local plugin readiness command.
   - Current: Setup commands cover install, test, typecheck, and build, but no plugin readiness command exists.
   - Target: `npm run verify:plugin` runs against the current repository and returns pass/fail evidence.
   - Acceptance: The script exits zero on the corrected repository and exits non-zero for a fixture with readiness blockers.

2. **Manifest and entrypoint verification**: Verify package, plugin, MCP, and built entrypoints.
   - Current: Manifest values exist but are not checked together by a dedicated verifier.
   - Target: The verifier checks `.codex-plugin/plugin.json`, `.mcp.json`, `package.json`, skill directory, MCP server command, package bin, and built `dist/index.js`.
   - Acceptance: Tests cover missing manifest and bad MCP entrypoint blockers.

3. **Skill reference verification**: Verify skill `references/*.md` mentions point to real files.
   - Current: References are maintained manually.
   - Target: The verifier extracts skill reference paths and blocks when any referenced file is missing.
   - Acceptance: Tests cover a missing skill reference blocker.

4. **Tool contract drift verification**: Verify documentation lists match implemented MCP tools.
   - Current: README and skill tool lists can drift from `toolNames`.
   - Target: The verifier compares README and skill documented tool lists with `toolNames`.
   - Acceptance: Tests cover extra documented tools and missing documented tools.

5. **Operator handoff documentation**: Document how to run the readiness gate.
   - Current: README setup explains build and MCP config but not a plugin readiness gate.
   - Target: README includes a handoff readiness section with `npm run build` and `npm run verify:plugin`.
   - Acceptance: README contains both commands and repeats the no-credentials boundary.

6. **Local-only safety boundary**: Keep v1.4 strictly local.
   - Current: Earlier slices use remote Windows for runtime validation.
   - Target: The verifier does not open network connections, run Windows commands, install plugins globally, publish packages, or accept credentials.
   - Acceptance: Review confirms the verifier reads only repository files and uses no credential, upload, install, or remote execution inputs.

## Boundaries

**In scope:**

- Local repository verifier.
- `npm run verify:plugin` script.
- Fixture/unit tests for verifier pass and drift failures.
- README and skill tool-list corrections.
- GSD verification, review, and summary artifacts.

**Out of scope:**

- Global plugin installation — this phase verifies handoff readiness only.
- Registry publishing or package upload — distribution remains a later decision.
- Archive creation, signing, or encryption — v1.4 is not packaging output.
- Steam login, Workshop upload, Steam Guard, or publish-state mutation — unrelated to plugin handoff readiness.
- Windows smoke — v1.3 already collected real Windows runtime evidence and this slice is local-only.

## Constraints

- Code identifiers and API names are English.
- Comments, if needed, are Chinese.
- No silent fallback: missing files, malformed JSON, or tool-list drift are blockers.
- The verifier must not require Dota 2, Steam, Windows, network access, or private credentials.
- Graphify freshness files remain uncommitted.

## Acceptance Criteria

- [ ] `npm run verify:plugin` exists.
- [ ] The verifier exits non-zero for manifest, entrypoint, reference, and tool-list drift blockers in tests.
- [ ] The verifier exits zero for the corrected repository after `npm run build`.
- [ ] README documents the handoff readiness command and no-credentials boundary.
- [ ] The skill MCP tool contract no longer documents nonexistent tools and includes every implemented tool.
- [ ] Local verification and strict secret scan pass before commit.

## Edge Coverage

**Coverage:** 5/5 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| malformed input | R2 | covered | Tests include invalid or missing manifest/config blockers. |
| missing dependency | R3 | covered | Tests include missing skill reference blocker. |
| drift | R4 | covered | Tests include extra and missing documented tool blockers. |
| command failure | R1 | covered | CLI exits non-zero when blockers exist. |
| safety boundary | R6 | covered | Review verifies no network, install, credential, upload, or Windows execution path. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not store credentials, tokens, private keys, private hosts, or passwords. | R6 | resolved | verification: test |
| Must not perform global plugin installation. | R6 | resolved | verification: judgment |
| Must not publish packages or create upload artifacts. | R6 | resolved | verification: judgment |
| Must not perform Steam login, encryption, Workshop upload, or publish-state mutation. | R6 | resolved | verification: judgment |
| Must not silently ignore missing files, malformed JSON, or tool-list drift. | R1-R4 | resolved | verification: test |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.92 | 0.75 | met | Command and pass/fail evidence are explicit. |
| Boundary Clarity | 0.94 | 0.70 | met | Local-only handoff verifier; no install/publish/upload. |
| Constraint Clarity | 0.88 | 0.65 | met | No credentials, no network, no Windows dependency. |
| Acceptance Criteria | 0.86 | 0.70 | met | Tests and commands are concrete. |
| Ambiguity | 0.10 | <=0.20 | met | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Manifests, MCP config, skill, README, and tool registry exist but lack one verifier. |
| 2 | Simplifier | What is the smallest useful handoff slice? | Local verifier plus README guidance, no installer or publisher. |
| 3 | Boundary Keeper | What must stay out? | Global install, package publish, Steam/Workshop/upload/credential behavior. |
| 4 | Failure Analyst | What broken version would matter? | Documented tools drift from `toolNames`, missing refs, bad entrypoints, silent pass on blockers. |

---

*Phase: 01-plugin-install-handoff-readiness*
*Spec created: 2026-07-06*
*Next step: implement 01-01 plan*

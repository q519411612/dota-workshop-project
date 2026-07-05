# Phase 13: Panorama Toolchain Boundary and Publishing Preflight MVP - Specification

**Created:** 2026-07-06
**Ambiguity score:** 0.13 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Agents can inspect an addon for Panorama, toolchain, and publishing readiness boundaries without generating UI, running unsupported toolchains, storing credentials, encrypting content, or uploading to Workshop.

## Background

The project now generates playable addons, validates runtime markers, prepares custom maps, adds score objectives, and scaffolds custom unit/ability KV files. The skill and planning docs still defer Panorama generation, TypeScript-to-Lua, React Panorama, publishing, and encryption. Before implementing those larger workflows, the next smallest useful slice is a deterministic preflight operation that reports current addon readiness and blockers. This gives agents a safe way to answer "what is present and what is still unsupported?" on fixture, local Windows, and remote Windows targets.

## Requirements

1. **Preflight tool contract**: Expose `inspect_workshop_preflight` through schemas, dispatcher, MCP server registration, and tool-name discovery.
   - Current: Agents can inspect addon roots but cannot inspect Panorama/toolchain/publishing boundary readiness.
   - Target: Callers can invoke one preflight operation for fixture, local, and remote targets.
   - Acceptance: Tests prove the schema parses, `toolNames` includes `inspect_workshop_preflight`, and `handleTool` routes it.

2. **Validation before inspection**: Validate addon names and target roots before filesystem reads or remote command construction.
   - Current: Existing tools validate addon names individually, but no preflight contract exists.
   - Target: Unsafe addon names, missing local roots, and missing remote `dotaRoot` fail with explicit errors and evidence.
   - Acceptance: Fixture/local/remote tests prove invalid input fails before reads or commands.

3. **Addon layout evidence**: Report deterministic runtime and content layout evidence for generated addons.
   - Current: `inspect_addon` reports roots, Lua markers, unit/ability scaffold evidence, placement, and objective evidence.
   - Target: Preflight reports required runtime files, content roots, map directories, localization, metadata, unit/ability support files, and clear missing-file evidence.
   - Acceptance: Fixture tests assert evidence and paths for present and missing layout files.

4. **Panorama boundary evidence**: Report Panorama source/runtime directory and file evidence without generating UI.
   - Current: Docs mention Panorama as deferred, but tools cannot inspect Panorama readiness.
   - Target: Preflight checks expected Panorama directories under game and content addon roots and reports whether XML, CSS, or JavaScript files are present.
   - Acceptance: Tests cover absent Panorama directories and manually-created Panorama files.

5. **Toolchain boundary evidence**: Report TypeScript-to-Lua and React Panorama marker evidence without generating or running those toolchains.
   - Current: TypeScript-to-Lua and React Panorama are deferred.
   - Target: Preflight detects marker files such as `package.json`, `tsconfig.json`, `tsconfig.tstl.json`, and Panorama package markers when present, and reports them as inspection evidence or warnings.
   - Acceptance: Tests prove marker detection does not invoke `npm`, compilers, bundlers, or generators.

6. **Publishing preflight blockers**: Report publishing readiness blockers without credentials, encryption, or upload behavior.
   - Current: Publishing is deferred because it involves account, metadata, key, and upload concerns.
   - Target: Preflight checks local metadata and asset prerequisites that can be inspected safely, and always reports that Steam credentials, encryption, and Workshop upload are out of scope.
   - Acceptance: Tests assert publishing blockers are returned and no credential fields are accepted or persisted.

7. **Remote parity**: Remote preflight uses the same logical result contract as local preflight.
   - Current: Remote tools use PowerShell scripts and return command/path/log evidence for addon creation, inspection, map preparation, and smoke.
   - Target: Remote preflight returns the same evidence categories and explicit errors through the existing SSH/PowerShell adapter.
   - Acceptance: Remote command-construction tests assert preflight script content, command suppression on invalid input, and parsed evidence.

8. **Documentation and scope fence**: README and skill references explain preflight scope and deferred behavior.
   - Current: Docs list Panorama/toolchain/publishing as deferred but do not provide a preflight workflow.
   - Target: Docs explain `inspect_workshop_preflight`, expected evidence, warnings, and boundaries.
   - Acceptance: Documentation mentions `inspect_workshop_preflight`, Panorama inspection, TypeScript-to-Lua/React marker inspection, publishing blockers, and deferred generation/upload behavior.

## Boundaries

**In scope:**

- One MCP operation: `inspect_workshop_preflight`.
- Fixture, local, and remote target support through the existing target contract.
- Addon layout, Panorama directory/file, toolchain marker, and publishing blocker inspection.
- Explicit warnings for unsupported generation, build, encryption, credential, and upload behavior.
- Fixture tests, remote command tests, documentation, and real Windows remote inspection evidence.

**Out of scope:**

- Generating Panorama XML, CSS, JavaScript, or layout manifests.
- React Panorama project creation, bundling, or validation.
- TypeScript-to-Lua project templates, compilation, or Lua output validation.
- Steam login, credential handling, Workshop upload, encryption, publishing metadata mutation, or remote UI automation.
- Treating preflight as runtime validation; runtime success still requires launch and log evidence.

## Constraints

- Keep local Windows and remote Windows behind the same MCP tool contract.
- Every result must include target, operation, success state, evidence, warnings, paths, commands, and logs when applicable.
- Do not accept, read, write, echo, or persist Steam credentials, GitHub tokens, remote credentials, publishing keys, or private host data.
- Let missing files and unsupported workflows surface as explicit evidence or errors; do not silently infer readiness.
- The feature must run on macOS fixture tests without Dota installed.

## Acceptance Criteria

- [ ] `inspect_workshop_preflight` is exposed through schemas, dispatcher, server registration, and tool-name discovery.
- [ ] Invalid addon names and missing roots fail before reads or remote command construction.
- [ ] Fixture preflight reports runtime/content layout evidence and missing-file evidence.
- [ ] Fixture preflight reports Panorama directory/file evidence when absent and when manually present.
- [ ] Fixture preflight reports toolchain marker evidence without invoking external build tools.
- [ ] Publishing preflight blockers are reported without accepting or storing credentials.
- [ ] Remote preflight command construction and parsed evidence match the local evidence categories.
- [ ] Real Windows remote preflight inspects a real addon tree and returns command/path evidence.
- [ ] README and skill references document the preflight workflow and deferred behavior.

## Edge Coverage

**Coverage:** 6/6 applicable edges resolved - 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| invalid input | R2 | covered | Invalid addon and missing root inputs must fail before reads or commands. |
| unsupported workflow | R4/R5/R6 | covered | Unsupported generation, build, encryption, and upload behavior must be warnings/evidence only. |
| credential safety | R6 | covered | No credential fields are accepted or persisted; secret scan verifies repository hygiene. |
| remote parity | R7 | covered | Remote tests assert command construction and parsed evidence categories. |
| missing files | R3/R4/R6 | covered | Missing files are explicit evidence, not silent success. |
| runtime confusion | R6/R8 | covered | Docs and evidence state preflight is not runtime validation. |

## Prohibitions (must-NOT)

**Coverage:** 6/6 applicable prohibitions resolved - 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| Must not generate Panorama UI files. | R4/R8 | resolved | verification: test |
| Must not run TypeScript-to-Lua, React, npm, bundlers, or compilers. | R5 | resolved | verification: test |
| Must not accept or store Steam credentials, publishing keys, remote credentials, or private host data. | R6 | resolved | verification: test |
| Must not upload to Workshop or encrypt content. | R6/R8 | resolved | verification: judgment |
| Must not treat preflight success as runtime validation success. | R6/R8 | resolved | verification: judgment |
| Must not silently mark missing files as publish-ready. | R3/R6 | resolved | verification: test |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.91 | 0.75 | met | One inspection/preflight tool with defined evidence categories. |
| Boundary Clarity | 0.93 | 0.70 | met | UI generation, toolchain execution, upload, encryption, and credentials are excluded. |
| Constraint Clarity | 0.84 | 0.65 | met | Shared target contract, result shape, no credentials, fixture-first tests. |
| Acceptance Criteria | 0.88 | 0.70 | met | Schema, layout, Panorama, toolchain, publishing, remote, Windows, docs checks are concrete. |
| Ambiguity | 0.13 | <=0.20 | met | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Addon inspection exists; Panorama/toolchain/publishing preflight does not. |
| 2 | Simplifier | What is the smallest useful slice? | One inspection-only preflight operation. |
| 3 | Boundary Keeper | What is not part of this slice? | No UI generation, toolchain execution, credentials, encryption, upload, or UI automation. |
| 4 | Failure Analyst | What would invalidate success? | Credential leakage, remote drift, silent readiness claims, or preflight confused with runtime validation. |

---

*Phase: 13-panorama-toolchain-boundary-and-publishing-preflight-mvp*
*Spec created: 2026-07-06*

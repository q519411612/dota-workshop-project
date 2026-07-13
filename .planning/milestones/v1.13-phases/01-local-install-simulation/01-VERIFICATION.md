# Verification: Local Install Simulation

status: passed
date: 2026-07-07

## Commands

- `npm test -- tests/install-simulation.test.ts`
  - Result: passed.
  - Evidence: 1 test file passed, 5 tests passed.
- Red test check before implementation:
  - Result: failed as expected.
  - Evidence: `verify:install-simulation` script was missing and `../src/install-simulation.js` did not exist.
- `npm run build`
  - Result: passed.
- `npm run verify:install-simulation`
  - Result: passed.
  - Evidence: reported isolated simulation root, manifest/MCP/package/dist/skill checks, unchanged selected environment variables, no global install, and cleanup removal.
- `git diff --check && npm test -- tests/install-simulation.test.ts && npm run typecheck && npm test && npm run build && npm run verify:install-simulation && npm run verify:rc && npm run verify:handoff && npm run verify:milestone`
  - Result: passed.
  - Evidence: full test suite passed with 18 test files and 143 tests; install simulation, RC, handoff, and milestone gates returned `ok: true`.

## Local Evidence

- The simulation creates a temporary plugin layout outside the repository source tree.
- The layout includes `.codex-plugin/plugin.json`, `.mcp.json`, `package.json`, `dist/index.js`, and the Dota Workshop skill file.
- Consumer checks validate manifest paths, MCP command and args, package bin, dist entrypoint, and skill presence.
- Cleanup removes the simulation root by default.
- Tests prove selected environment variables remain unchanged across simulation.
- Sensitive-material blockers report category and relative path without including matched values.

## Traceability

| Requirement | Status | Evidence |
|---|---|---|
| INSTALL-01 | passed | `verify:install-simulation` runs the built CLI and returns the structured result contract. |
| INSTALL-02 | passed | Tests copy the required install-facing files into an isolated temporary root and remove it. |
| INSTALL-03 | passed | Manifest, MCP, package, dist, and skill checks pass; missing dist evidence is unique by code and path. |
| INSTALL-04 | passed | Selected environment variables remain unchanged and cleanup succeeds on success and blocker paths. |
| INSTALL-05 | passed | The audit regression covers `.yaml`, `.yml`, `.YAML`, and `.YML` at the copied skill metadata path without value leakage. |
| INSTALL-06 | passed | Targeted RED reproduced skipped YAML and duplicate evidence; targeted GREEN passed 9 tests, with full gates delegated to Phase 2 verification. |

## Audit Regression

- RED evidence: four YAML/YML variants returned `ok: true`, and the missing-dist code/path pair appeared twice.
- GREEN evidence: `npm test -- tests/install-simulation.test.ts` passed 9/9 after extension normalization and local blocker uniqueness.
- The current milestone authority is `.planning/v1.13-MILESTONE-AUDIT.md`; `npm run verify:milestone` remains an older closeout regression command.

## Boundary

- No global install was performed.
- No user config directory was written.
- No package publish, registry publish, archive creation, signing, encryption, Workshop upload, Steam login, Steam Guard handling, remote Windows connection, Dota runtime work, network access, or UI automation was performed.

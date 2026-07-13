# Phase 1: Local Install Simulation - Spec

**Status:** Ready for implementation
**Date:** 2026-07-07

## Intent

Prove the plugin can be consumed from an isolated temporary layout before any global install or broader handoff. The verifier should exercise the install-facing structure and report path isolation, cleanup, and sensitive-material safety without mutating the user's environment.

## Functional Contract

- `npm run verify:install-simulation` executes a built local verifier.
- The verifier creates a temporary simulation root outside the repository.
- The simulation layout includes `.codex-plugin/plugin.json`, `.mcp.json`, `package.json`, `dist/index.js`, and `skills/dota2-workshop-tools/SKILL.md`.
- The verifier checks manifest paths, MCP entrypoint, package bin, skill presence, and dist entrypoint presence from the simulated layout.
- The verifier scans copied text inputs for credential-like or private target material and reports blockers without matched values.
- The verifier removes the simulation root by default and reports cleanup evidence.

## Boundary Contract

- No global plugin installation.
- No writes to user config directories.
- No environment mutation.
- No package publishing or registry publishing.
- No archive creation.
- No package signing.
- No content encryption.
- No Workshop upload.
- No Steam login or Steam Guard handling.
- No remote Windows connection.
- No Dota runtime work, network access, or UI automation.

## Acceptance Checks

- Tests prove successful install simulation output.
- Tests prove missing required files produce blockers.
- Tests prove temporary path isolation and cleanup removal.
- Tests prove selected environment variables remain unchanged.
- Tests prove sensitive values are blocked without leaking the matched value.
- Verification artifacts record local-only behavior and no global install.

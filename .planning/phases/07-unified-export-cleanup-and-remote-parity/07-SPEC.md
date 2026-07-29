# Phase 7 Spec: Unified Export Cleanup and Remote Parity

**Goal:** Expose export and strict cleanup through one normalized MCP contract across fixture, local Windows, SSH, and PowerShell Remoting.

## Ambiguity Report

Goal 0.98, boundary 0.96, constraint 0.95, acceptance 0.96. **Weighted ambiguity:** 0.04.

## Locked Requirements

- Add exactly two operations: `export_release_candidate` and `cleanup_exported_candidate`.
- Cleanup requires target, export root, destination, ownership identifier, manifest version, combined SHA-256, and explicit dry-run/execute mode.
- Cleanup revalidates the external handoff and complete retained candidate before mutation.
- Dry-run and execute return distinguishable evidence; dry-run performs zero writes.
- Execute deletes only the exact candidate and exact handoff manifest and proves both absent.
- Remote execution is one target-native lifecycle per operation. No candidate byte crosses to the MCP host.
- Remote JSON is hostile unknown input; the host normalizer recomputes invariants and success.
- Transport uncertainty, malformed output, identity drift, or any mismatch fails without retry or fallback.

## Acceptance Criteria

1. Four target kinds expose equivalent normalized export and cleanup semantics.
2. Dry-run authorization success leaves candidate and handoff unchanged.
3. Execute succeeds only with all exact assertions and reports separate absence evidence.
4. Every stale, replaced, mismatched, hostile, or interrupted scenario refuses broad deletion.


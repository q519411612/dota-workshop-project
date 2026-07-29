---
phase: 07-unified-export-cleanup-and-remote-parity
plan: 01
subsystem: mcp-export-cleanup
requirements-completed: [HAND-03, CLEN-01, CLEN-02, CLEN-03, CLEN-04, CLEN-05]
completed: 2026-07-29
status: complete
---

# MCP Export and Strict Cleanup Summary

Registered independent `export_release_candidate` and `cleanup_exported_candidate` tools with exact schemas and a common result envelope containing target, operation, evidence, warnings, paths, commands, logs, manifest, ownership, and cleanup state.

Cleanup dry-run performs full authorization without mutation. Execute requires exact canonical paths, handoff identity and bytes, ownership ID, manifest version, topology, candidate identity, and combined digest. It uses no-replace tombstones, immediate identity/content revalidation, exact removal, absence proof, and safe restoration or truthful partial-state evidence on failure.

The implementation follows the approved v1.14 practical filesystem threat boundary documented in Phase 7 Spec.

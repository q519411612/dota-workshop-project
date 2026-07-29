---
phase: 06-safe-retained-candidate-export
plan: 02
subsystem: exported-candidate
requirements-completed: [EXPT-01, INTG-03]
completed: 2026-07-29
status: complete
---

# Node Export and Atomic Promotion Summary

Added the independent fixture/local `export_release_candidate` lifecycle without changing `preflight_release_candidate`. Promotion and handoff publication use target-native atomic no-replace operations, followed by identity, topology, manifest, and combined-digest verification.

macOS/Linux explicitly probe the compiler prerequisite before staging; Windows uses native move semantics. Race, promotion, source-mutation, candidate-mutation, digest, and publication failures are covered by fixture tests. Preflight source files and public behavior remain unchanged.

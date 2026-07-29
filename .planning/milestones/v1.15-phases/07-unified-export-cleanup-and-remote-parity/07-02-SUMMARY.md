---
phase: 07-unified-export-cleanup-and-remote-parity
plan: 02
subsystem: remote-export-cleanup
requirements-completed: [HAND-04, CLEN-06]
completed: 2026-07-29
status: complete
---

# Remote Target Parity Summary

Implemented target-native SSH and PowerShell Remoting export and cleanup scripts. Candidate bytes remain on the target Windows machine; no download, transfer, fallback target, credential input, or private-host persistence is performed.

The MCP host treats framed remote JSON as hostile input and strictly reconciles paths, state, cleanup, authorization, handoff presence, topology, digests, and exact-key envelopes. Ordinary failures preserve stable codes and canonical state evidence; malformed or contradictory payloads fail closed.

Fixture, local adapter, SSH, and PowerShell routing and normalized contract semantics are covered. Real Windows export and cleanup runtime behavior remains explicitly unverified.

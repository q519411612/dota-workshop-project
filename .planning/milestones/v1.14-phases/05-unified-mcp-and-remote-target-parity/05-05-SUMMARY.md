---
phase: 05-unified-mcp-and-remote-target-parity
plan: 05
subsystem: remote-evidence-normalization
tags: [typescript, hostile-json, sanitization, remote, tdd]

requires:
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 02
    provides: Strict release-candidate detail normalizer and recomputed invariant authority
  - phase: 05-unified-mcp-and-remote-target-parity
    plan: 04
    provides: One-shot SSH and PowerShell release-candidate executor with closed raw outcomes
provides:
  - Exact single-document remote stdout framing and hostile JSON rejection
  - Sanitized SSH and PowerShell result envelopes with recomputed semantic success
  - Explicit transport, framing, parsing, version, digest, semantic, and configuration failure closure
affects: [05-06, target-parity, mcp-preflight]

tech-stack:
  added: []
  patterns: [private invocation public evidence split, one-shot remote normalization, uncertainty without fallback]

key-files:
  created: [src/release-candidate-remote.ts, tests/release-candidate-remote.test.ts]
  modified: []

key-decisions:
  - "Remote stdout must be one compact JSON object whose exact parsed serialization matches the complete stdout."
  - "Transport or evidence uncertainty is final, exposes cleanup as unknown, and never retries or invokes a local lifecycle."
  - "Pre-invocation configuration rejection preserves its closed executor code and does not claim cleanup uncertainty."
  - "Target, command, log, and execution metadata are rebuilt from fixed public values before normalization."

patterns-established:
  - "Only complete zero-exit payloads can preserve proven artifact and cleanup domains."
  - "Whole-detail disclosure auditing rejects private target values, absolute paths, and credential-shaped content."

requirements-completed: [RCCL-04]

duration: 10min
completed: 2026-07-16
status: complete
---

# Phase 5 Plan 05: Hostile Remote Normalization Summary

**Remote release-candidate evidence now crosses the transport boundary only after exact framing, strict shared normalization, invariant recomputation, and whole-result disclosure checks.**

## Accomplishments

- Added `preflightRemoteReleaseCandidate` as the private remote normalization layer over the existing one-shot SSH and PowerShell executor.
- Required exactly one compact JSON object with no whitespace, prefix, suffix, second value, array, scalar, or malformed framing.
- Replaced untrusted execution, command, and log fields with fixed transport-aware public metadata before passing the payload through `normalizeReleaseCandidateDetail`.
- Returned closed sanitized categories for transport failure, framing rejection, JSON parsing, unsupported version, digest inconsistency, semantic invalidity, and pre-invocation configuration rejection.
- Preserved complete valid blocked artifact and verified cleanup facts while converting incomplete transport or payload evidence into cleanup-unknown failure without manifest or artifact claims.
- Proved one executor invocation, no retry, no local lifecycle fallback, no speculative cleanup command, and no disclosure of host, username, Dota root, raw script, stdout, stderr, exception, private path, or credential-shaped values.

## TDD Evidence

- RED commit `46e1994` failed because the remote normalization module did not exist.
- GREEN commit `0762f43` added exact framing, hostile parsing, strict normalization, fixed public evidence, failure categories, parity coverage, and no-fallback behavior.
- Review RED commit `6312111` proved pre-invocation configuration rejection was incorrectly reported as cleanup-unknown transport failure.
- Review GREEN commit `aedeaf0` preserved the closed configuration code and omitted unproven lifecycle facts.

## Independent Review

- Confirmed empty, whitespace, prefix, suffix, multiple-value, array, scalar, and malformed output never reaches semantic normalization.
- Confirmed unsupported versions, invalid digests, incomplete coverage, unsafe paths, contradictory cleanup, unknown codes, missing fields, and supplied success narration cannot produce public success.
- Confirmed nonzero exits, exceptions, and timeout/signal-shaped uncertainty invoke the executor once and return cleanup unknown without retry or cleanup commands.
- Confirmed invalid addon names, missing Dota roots, and unsafe destinations fail before invocation with their explicit configuration code.
- Confirmed equivalent SSH and PowerShell documents normalize to identical substantive detail apart from transport execution metadata.
- Confirmed every public envelope field and nested detail is free of private invocation values and raw transport output.
- Final review result: no unresolved confirmed issue.

## Verification Evidence

- Final focused remote/result suite: 79/79 passed across six files.
- Final repository suite: 275/275 passed across 25 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `verify:plugin`, `verify:same-machine-smoke`, `verify:source-snapshot`, `verify:install-simulation`, `verify:rc`, `verify:handoff`, and historical `verify:milestone`: passed.
- `git diff --check`: passed.
- Generated Phase 5 distribution files were removed after verification.
- Immutable Phase 5 graph baseline and cached graph exclusion guards passed before every commit.

## Security and Scope Review

- No Steam login, Workshop item mutation, upload, credential handling, persistent archive, signing, encryption, compilation, source repair, file transfer, game launch, or real Windows runtime claim was added.
- No remote failure triggers fixture/local assembly, retry, evidence repair, or speculative cleanup.
- macOS fixture and injected transport contract evidence remains the approved completion basis.
- User-owned `.planning/graphs/` modifications remain untouched, unstaged, and outside every commit.

## Self-Check: PASSED

- Both declared source and test artifacts exist.
- RED `46e1994` precedes GREEN `0762f43`; review RED `6312111` precedes review GREEN `aedeaf0`.
- `requirements-completed` contains only `RCCL-04`, with no competing summary owner.
- The worktree contains only the preserved user-owned graph modifications.

---
*Phase: 05-unified-mcp-and-remote-target-parity*
*Completed: 2026-07-16*

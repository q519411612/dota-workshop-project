# Architecture Research

**Domain:** Temporary Dota Workshop addon release-candidate assembly and validation
**Researched:** 2026-07-15
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         MCP Surface                          │
│  server registration → Zod input → handleTool dispatcher     │
└──────────────────────────────┬───────────────────────────────┘
                              │ target.kind
            ┌─────────────────┤─────────────────┐
            │                                 │
┌────────────▼────────────┐       ┌───────────────▼───────────────┐
│ Fixture / Local Adapter       │       │ Remote Windows Adapter            │
│ Node filesystem implementation│       │ PowerShell script + executor       │
└───────────────┬───────────────┘       └───────────────┬───────────────┘
               │                                   │
               └─────────────────┬─────────────────┘
                                   │ same payload contract
┌───────────────────────────────────▼────────────────────────┐
│                    Candidate Policy and Model                 │
│ required roots │ metadata fields │ secret rules │ blockers    │
│ manifest entries │ cleanup state │ immutable boundaries          │
└────────────────────────────────────┬────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────┐
│                     ToolResult Transformation                 │
│ target │ operation │ ok/error │ evidence/warnings/paths       │
│ commands/logs │ structured candidate details                     │
└──────────────────────────────────────────────────────────────┘
```

The operation should be named `preflight_release_candidate`: it is distinct from the existing inspection-only `inspect_workshop_preflight` and source-only `dry_run_release_report`. The name makes the new mutation boundary explicit: it creates a temporary filesystem candidate, but never creates a persistent package or changes Steam/Workshop state.

### Component Responsibilities

| Component | Status | Responsibility | Typical Implementation |
|-----------|--------|----------------|------------------------|
| Release-candidate input schema | New | Accept only `target` and `addonName`; keep temporary path selection internal | `PreflightReleaseCandidateInputSchema` in `src/schemas.ts` |
| Candidate policy and payload model | New | Define stable blocker codes, required structure, metadata fields, text scan limits, manifest entries, cleanup state, and boundaries | Exported TypeScript types/constants in `src/release-candidate.ts` or a small adjacent policy module |
| Fixture/local candidate assembler | New | Resolve roots, prove isolation, reject links/non-regular entries, copy both trees, validate the candidate, hash files, and clean up | Node `fs/promises`, `crypto.createHash`, and `path`; no shell command |
| Remote candidate adapter | New | Run equivalent logic on the remote Windows target and parse one JSON payload | `preflightRemoteReleaseCandidate` plus a PowerShell script builder in `src/remote.ts` |
| MCP result detail support | Modified | Preserve machine-readable manifest, blockers, cleanup state, and boundaries instead of flattening them into evidence strings | Add optional structured `details` to `ToolResult` and result builders |
| MCP server/dispatcher | Modified | Register, validate, dispatch, and advertise the new operation | `src/server.ts`, `src/tools.ts`, `src/schemas.ts` |
| Existing preflight policy | Modified/refactored | Reuse metadata and secret classifications without calling the old dry-run operation or duplicating rules | Move shared constants/pure checks out of `src/preflight.ts`; retain old behavior |
| Tool/docs drift checks | Modified | Keep README, skill tool list, examples, and plugin verifier aligned with `toolNames` | Existing plugin/example tests and operator docs |
| `inspect_workshop_preflight` | Unchanged behavior | Continue inspection-only layout/toolchain reporting | Do not route candidate assembly through it |
| `dry_run_release_report` | Unchanged behavior | Continue source readiness reporting without candidate creation | Share pure policy only |
| Source snapshot/install simulation | Unchanged behavior | Supply proven patterns for hashing, link rejection, isolation, and `finally` cleanup | Reuse concepts, not their project-specific entry lists |

## Recommended Project Structure

```text
src/
├── release-candidate.ts       # Shared model, policy, local/fixture lifecycle
├── preflight.ts               # Existing inspections; imports shared pure policy
├── remote.ts                  # Existing adapter plus remote candidate script/parser
├── schemas.ts                 # New operation input schema and inferred type
├── types.ts                   # Optional structured result details
├── result.ts                  # Pass structured details through builders
├── tools.ts                   # Tool name and target-kind dispatch seam
└── server.ts                  # Public MCP registration
tests/
├── release-candidate.test.ts  # Lifecycle, blockers, manifest, cleanup fixtures
├── remote-operations.test.ts  # Remote command/payload/failure contract
├── result.test.ts             # Structured detail preservation
├── plugin.test.ts             # Tool-list drift
└── examples.test.ts           # Schema-valid fixture workflow
examples/workflows/
└── fixture-release-candidate-preflight.json
```

### Structure Rationale

- **`release-candidate.ts`:** The candidate lifecycle is a cohesive new domain operation, not another branch inside the already mixed inspection/dry-run module. Keeping model, policy, and local implementation together makes the cleanup invariant visible.
- **`preflight.ts`:** Extract only pure shared policy such as metadata keys, placeholder classification, supported text extensions, and redacted secret categories. Candidate assembly must not invoke `dryRunReleaseReport`, because that would flatten blockers and scan source state instead of the assembled artifact.
- **`remote.ts`:** The current repository intentionally keeps remote PowerShell script builders and parsers in the target adapter. Preserve that seam for v1.14; splitting all remote scripts is unrelated refactoring.
- **Tests:** Put lifecycle tests in a dedicated file. Contract parity is demonstrated by the same expected payload semantics, not by pretending Node and PowerShell share a filesystem implementation.

## Architectural Patterns

### Pattern 1: Shared Contract, Target-Native Execution

**What:** Fixture and local targets call one Node implementation. Remote targets execute a PowerShell implementation on Windows. Both return the same `ReleaseCandidateDetails` JSON shape and stable blocker codes.

**When to use:** Operations must inspect or mutate files that exist only on the selected target.

**Trade-offs:** This avoids remote file transfer and a Node-on-Windows prerequisite, but the two implementations can drift. Control drift by injecting policy values into the generated PowerShell script from TypeScript constants and by testing identical semantic payload fixtures. Do not copy credentials or addon trees back to the MCP host.

```typescript
type ReleaseCandidateDetails = {
  schemaVersion: "1.0";
  addonName: string;
  manifest: { files: CandidateFile[] };
  blockers: CandidateBlocker[];
  cleanup: { attempted: boolean; removed: boolean };
  boundaries: string[];
};
```

### Pattern 2: Fail-Closed Temporary Workspace

**What:** Create exactly one target-local temporary root, validate canonical separation from both source roots, and perform cleanup in `finally`. Any missing cleanup evidence is a failure, and verified cleanup failure takes precedence over an otherwise successful candidate.

**When to use:** A validation operation temporarily copies material that may include release-blocking data.

**Trade-offs:** The candidate is not available after return. That is intentional for this milestone: evidence and hashes are the product. Returning a path marked as removed is still useful audit evidence; it must never be described as a reusable artifact.

```typescript
const candidateRoot = await createIsolatedCandidateRoot();
try {
  await validateSourcesBeforeCopy();
  await copyTreesWithoutFollowingLinks();
  return await validateAndHashCandidate();
} finally {
  await removeAndVerifyCandidateRoot();
}
```

### Pattern 3: Validate Before Copy, Revalidate While Copying

**What:** Require both addon roots, canonicalize each root, recursively reject symbolic links, Windows reparse points/junctions, sockets, devices, and paths resolving outside the expected root before any file is copied. Copy through an explicit directory walker using regular-file copies, not an unconstrained recursive copy. Recheck each entry at copy time.

**When to use:** Input trees are user-controlled and the candidate boundary must not import data outside them.

**Trade-offs:** This is more code than `cp({ recursive: true })`, but it prevents link dereference and makes unsupported file types explicit. A separate pre-scan also avoids copying known sensitive material into the candidate. Concurrent hostile source mutation cannot be made perfectly atomic with ordinary path APIs, so immediate `lstat`/canonical containment checks before each copy are the appropriate fail-closed boundary for this local tool.

### Pattern 4: Canonical, Path-Independent Manifest

**What:** Manifest entries use normalized forward-slash paths relative to the candidate root, byte length, root kind (`game` or `content`), and lowercase SHA-256. Sort by relative path using ordinal comparison. Exclude timestamps, absolute source paths, temporary paths, hostnames, and target names from the deterministic manifest.

**When to use:** The same source trees should produce byte-for-byte equivalent manifest content on macOS fixtures and Windows targets.

**Trade-offs:** File mode and modification time are deliberately absent because they are not stable across NTFS/APFS and are not required to identify content. The enclosing tool response may contain operational paths and command evidence, but those fields are not part of the manifest identity.

### Pattern 5: Structured Blockers, Summarized Evidence

**What:** Put blocker code, category, safe relative path, and field in structured details. Evidence contains counts and lifecycle facts. Never put matched secret values, file contents, remote private data, or resolved link targets into blockers, evidence, warnings, logs, or command stdout.

**When to use:** Callers need both human-readable MCP output and deterministic machine decisions.

**Trade-offs:** Extending `ToolResult` with optional details changes a shared type but is backward compatible for existing operations. Encoding the manifest only as evidence strings would be smaller initially but would make hash consumers parse prose and cannot represent cleanup rigorously.

## Data Flow

### Request Flow

```text
MCP request: preflight_release_candidate(target, addonName)
    ↓
server schema validation
    ↓
handleTool validates again and selects adapter by target.kind
    ├─ fixture/local → Node candidate lifecycle
    └─ remote        → runRemoteCommand(PowerShell candidate lifecycle)
                               ↓
                       parse JSON payload exactly once
    ↓
common payload-to-ToolResult transform
    ↓
structuredContent: target + operation + status + evidence + paths
                   + commands/logs + manifest + blockers + cleanup + boundaries
```

### Candidate and Cleanup Lifecycle

```text
Validate addon name and target root
    ↓
Resolve game/dota_addons/<addon> and content/dota_addons/<addon>
    ↓
Create target-local temporary root
    ↓
Prove temp root is outside both source trees and neither source is inside temp
    ↓
Traverse both sources without following links/reparse points
    ├─ missing/unsafe/non-regular/sensitive/metadata blocker → record safe blocker
    └─ safe → copy to candidate/game/dota_addons/<addon>
                    and candidate/content/dota_addons/<addon>
    ↓
Validate assembled structure and metadata
    ↓
Enumerate candidate regular files → normalized sort → SHA-256 + bytes
    ↓
Build immutable payload and boundary evidence
    ↓
finally: recursively remove temp root → verify absence
    ├─ removed → cleanup.removed=true
    └─ remains → RELEASE_CANDIDATE_CLEANUP_FAILED and ok=false
```

The lifecycle must clean up after success, expected blockers, parseable operational failures, and thrown exceptions. If temporary-root creation itself fails, return an explicit creation error with `cleanup.attempted: false`; do not claim cleanup. If creation succeeds, `cleanup.attempted` must always be true.

### Key Data Flows

1. **Policy flow:** Shared TypeScript constants define required metadata, placeholder values, text extensions, size limits, secret categories, required candidate structure, and boundary statements. The remote script builder serializes safe values from those constants where practical so local and remote decisions do not evolve independently.
2. **Filesystem flow:** Both source roots are inputs; the only writes are beneath a newly created target-local temp root and its eventual deletion. Source roots are never modified.
3. **Evidence flow:** Local operations return no commands. Remote operations preserve the full SSH/PowerShell command evidence and stdout/stderr logs already supplied by `runRemoteCommand`, while the parsed JSON becomes structured details. Sensitive values must never be emitted by the remote script.
4. **Failure flow:** Invalid input fails before temp creation or command execution. Remote command failure remains remote. Malformed remote JSON becomes `REMOTE_RELEASE_CANDIDATE_PARSE_FAILED`. Candidate blockers become `RELEASE_CANDIDATE_BLOCKED`. Cleanup residue becomes `RELEASE_CANDIDATE_CLEANUP_FAILED`. There is no adapter fallback.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Typical addon | Sequential sorted traversal and streaming SHA-256 are sufficient and easiest to audit |
| Large addon | Keep hashing streaming; cap text scanning by policy and report every skipped file as a warning; avoid holding file bytes in memory |
| Very large addon | Add explicit file/byte limits only as a later requirement, with blocker codes; do not introduce silent sampling or partial manifests |

### Scaling Priorities

1. **First bottleneck:** Duplicate disk I/O from pre-scan, copy, and hash. Correctness is more important than speed in preflight; if needed, hash during explicit copy and verify the destination hash rather than adding concurrency.
2. **Second bottleneck:** Large remote JSON manifests. Keep stdout to compact JSON and never embed contents. Do not truncate manifest entries because completeness is the release evidence.

## Anti-Patterns

### Anti-Pattern 1: Extend `dry_run_release_report` In Place

**What people do:** Add temp copying and cleanup side effects to the existing source inspection operation.

**Why it's wrong:** It changes an established non-copying contract, obscures the new mutation boundary, and makes old examples misleading.

**Do this instead:** Register a dedicated `preflight_release_candidate` operation and share only pure policy checks.

### Anti-Pattern 2: Flatten the Manifest Into Evidence Strings

**What people do:** Append `path hash` lines to `evidence` and return no structured manifest or cleanup object.

**Why it's wrong:** Callers must parse prose, cannot reliably distinguish blocker categories, and cannot prove full cleanup state.

**Do this instead:** Add backward-compatible structured result details and keep evidence as a summary.

### Anti-Pattern 3: Recursive Copy Before Link and Isolation Checks

**What people do:** Call `cp -Recurse` or Node recursive `cp`, then inspect the destination.

**Why it's wrong:** Links or junctions may import files outside the addon roots before validation, and sensitive external material may enter the candidate.

**Do this instead:** Traverse with `lstat`/reparse-point checks before and during an explicit copy.

### Anti-Pattern 4: Treat Skipped Sensitive Scans as Success

**What people do:** Warn for unsupported or oversized files and still declare the candidate clean.

**Why it's wrong:** A warning is not evidence that sensitive content is absent. This violates the fail-closed milestone goal.

**Do this instead:** Define a strict inclusion/scan policy. Unsupported file types may be included and hashed if binary content is legitimate, but text-like files over the scan limit or unreadable files must block unless the requirement explicitly classifies them as safe binary assets. Never silently omit files from the manifest.

### Anti-Pattern 5: Leave the Candidate for Debugging

**What people do:** Skip cleanup on failure so an operator can inspect the directory.

**Why it's wrong:** The user selected a temporary candidate, and failed candidates may contain sensitive or invalid material.

**Do this instead:** Always remove and verify. Return hashes, safe paths, blocker categories, commands, and logs as debugging evidence.

### Anti-Pattern 6: Reimplement Policy as Unrelated PowerShell Literals

**What people do:** Maintain separate metadata lists, secret categories, error strings, and manifest path rules inside a large hand-written remote script.

**Why it's wrong:** Existing local and remote dry-run code already shows the drift risk of duplicated policy.

**Do this instead:** Generate remote policy arrays and regexes from shared TypeScript definitions, keep a versioned payload schema, and test the remote script contract against local semantic fixtures.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Local filesystem | Node target-native access | Fixture and local use identical logic; no Windows launch requirement because this operation is filesystem-only |
| Remote Windows filesystem | Existing SSH or PowerShell Remoting executor | Execute one self-contained PowerShell lifecycle and return compact JSON; no file transfer to the MCP host |
| Steam / Workshop | No integration | Boundary evidence must state no login, item mutation, upload, signing, encryption, or credential handling |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `server.ts` ↔ `schemas.ts` | Zod registration shape | Mirror existing double-validation convention; add the same operation fields in both places |
| `server.ts` ↔ `tools.ts` | Operation name and `handleTool` | Add the name to `toolNames`; plugin tests will force README and skill lists to follow |
| `tools.ts` ↔ local candidate service | Direct async call | Fixture and local stay on the same implementation branch |
| `tools.ts` ↔ remote adapter | Direct async call selected only by `target.kind` | Remote failure must never call local service |
| Candidate service ↔ `preflight.ts` | Shared pure policy imports | Do not compose through the existing `ToolResult`-returning operation |
| Candidate payload ↔ `result.ts` | Common transformer/builders | Preserve details on both success and failure, including blockers and cleanup |
| Remote script ↔ remote parser | Versioned compact JSON | Validate required payload fields; a zero exit code with invalid JSON is still failure |
| `toolNames` ↔ docs/examples | Existing drift verification | Add fixture example and update README, skill, remote reference, operator runbook |

## Recommended Build Order

1. **Freeze the public contract.** Add the input schema, payload/detail types, stable error codes, deterministic manifest definition, cleanup semantics, and result-detail passthrough tests. This prevents local and remote implementations from inventing different outputs.
2. **Extract pure policy.** Move metadata, placeholder, text classification, sensitive-category, and required-structure rules from `preflight.ts` without changing existing dry-run behavior. Run existing preflight tests to prove no regression.
3. **Implement the fixture/local lifecycle.** Start with missing roots, unsafe temp isolation, top-level and nested symlinks, non-regular entries, sensitive content, invalid metadata, deterministic sorting/hashes, success cleanup, blocker cleanup, and forced cleanup-failure tests.
4. **Wire the MCP surface.** Register `preflight_release_candidate` in schema/server/tools and add dispatcher/result-contract tests. At this point the macOS fixture completion path is end-to-end.
5. **Implement remote parity.** Generate the PowerShell lifecycle from shared policy, parse the versioned payload, preserve command/log evidence, and test command failure, malformed JSON, blockers, success, and cleanup failure with injected executors.
6. **Add parity and boundary tests.** Assert local and mocked remote payloads use identical codes, path normalization, manifest ordering, SHA-256 format, boundaries, and cleanup states. Explicitly assert no upload/login/package commands appear.
7. **Update examples and operator guidance.** Add the fixture workflow and update tool lists only after the contract is stable; existing plugin/example drift checks then protect the public interface.
8. **Run independent review.** Focus on link/junction handling, path containment, exception cleanup, secret redaction, remote stdout parsing, and absence of silent fallback before milestone closure.

This order minimizes risk by proving the data contract and safety invariants on deterministic fixtures before adding transport-specific command construction.

## Sources

- Repository `src/schemas.ts`, `src/server.ts`, and `src/tools.ts` — current MCP registration and target dispatch seams (HIGH confidence)
- Repository `src/types.ts` and `src/result.ts` — current common evidence contract and structured-detail gap (HIGH confidence)
- Repository `src/preflight.ts` and `src/remote.ts` — current local/remote release policy, PowerShell execution, JSON parsing, and no-fallback behavior (HIGH confidence)
- Repository `src/source-snapshot.ts` and `tests/source-snapshot.test.ts` — deterministic sorted relative paths, SHA-256 evidence, and redaction patterns (HIGH confidence)
- Repository `src/install-simulation.ts` and `tests/install-simulation.test.ts` — temporary workspace, canonical isolation, symbolic-link rejection, and verified `finally` cleanup patterns (HIGH confidence)
- Repository `src/addon.ts` and addon/preflight/remote tests — addon root construction, name validation, metadata layout, and fixture/local/remote contract expectations (HIGH confidence)
- `.planning/PROJECT.md` — v1.14 goal, constraints, explicit exclusions, and completion boundary (HIGH confidence)

---
*Architecture research for: v1.14 Workshop Addon Release Candidate Preflight*
*Researched: 2026-07-15*

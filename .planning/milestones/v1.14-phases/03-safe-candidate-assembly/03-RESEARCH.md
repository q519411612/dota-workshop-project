# Phase 3: Safe Candidate Assembly - Research

**Researched:** 2026-07-15
**Domain:** Deterministic temporary filesystem assembly and immutable-source validation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Validation and creation ordering
- Validate the addon name, target root, game addon root, and content addon root before creating any candidate directory.
- Return explicit structured blockers for invalid or missing inputs; do not create partial candidates and do not fall back to another target.
- Keep `dry_run_release_report` inspection-only and introduce a separate candidate lifecycle seam for later MCP integration.
- Candidate creation is permitted only after canonical containment proves the temporary root is outside the Dota root, both addon roots, and the repository.

### Traversal and candidate layout
- Use explicit deterministic traversal rather than recursive-copy heuristics so every entry is classified before use.
- Include every regular file, hidden file, and empty directory without ignore-file, extension, timestamp, or generated-file filtering.
- Preserve exactly the `game/dota_addons/<addon>` and `content/dota_addons/<addon>` layout under one isolated temporary root.
- Treat candidate paths as normalized relative identities; absolute paths and parent traversal are blockers.

### Filesystem safety and source stability
- Reject symbolic links, junction/reparse-point equivalents exposed by the adapter, special or unknown entries, canonical escapes, and case-folded collisions without dereferencing or repair.
- Revalidate entry type and containment immediately before reading or copying; detect source changes during assembly and fail explicitly rather than retrying into mixed state.
- Never compile, generate, repair, rename, or otherwise modify either source tree.
- Provide injectable filesystem seams only where required for deterministic mutation and failure tests; production behavior remains strict.

### Shared readiness policy
- Reuse or extract the established required-structure, addon metadata, placeholder, and redacted sensitive-material policy instead of maintaining a divergent candidate-only copy.
- Block unsafe or unscannable required text inputs with safe relative-path/category evidence and never expose matched sensitive values.
- Keep boundary evidence explicit: no Steam login, Workshop mutation or upload, credentials, archive, signing, encryption, game launch, or runtime validation.
- Phase completion relies on macOS fixtures and adapter-contract tests; no real Windows claim is introduced here.

### the agent's Discretion
- Internal module and helper names may follow existing TypeScript conventions, provided responsibilities remain separated between pure policy, traversal/assembly, and result normalization.
- Test fixtures and fault-injection shapes may be chosen for clarity as long as tests observe a failing RED state before production implementation.

### Deferred Ideas (OUT OF SCOPE)
- Deterministic manifest entries, combined digest, full inclusion-ledger reconciliation, scan-coverage accounting, and cleanup precedence belong to Phase 4.
- MCP registration, fixture/local/SSH/PowerShell normalization, strict remote JSON parsing, and no-fallback parity belong to Phase 5.
- Persistent candidates, archives, signing, encryption, credentials, Steam/Workshop actions, upload/download, compilation, source repair, and mandatory real Windows evidence remain outside v1.14.
</user_constraints>

## Summary

Phase 3 should add one internal, callback-scoped candidate assembly service and one pure shared readiness-policy module. The assembler should validate the addon name, Dota target root, both addon roots, repository boundary, and temporary parent before calling `mkdtemp`; then explicitly enumerate, classify, normalize, collision-check, revalidate, and copy every accepted entry into the fixed two-root layout. This follows the locked phase boundary and avoids changing the public MCP surface before Phase 5. [VERIFIED: `.planning/phases/03-safe-candidate-assembly/03-CONTEXT.md`, `.planning/ROADMAP.md`, current `src/preflight.ts`]

The existing implementation contains useful but insufficient precedents. `install-simulation.ts` already demonstrates `lstat`, `realpath`, isolation checks, redacted blockers, and `finally` cleanup, but its recursive `cp` occurs after a pre-scan and its temporary directory is created before source validation; neither ordering may be copied directly into this phase. `source-snapshot.ts` demonstrates ordinal sorting, normalized relative paths, and SHA-256, while `preflight.ts` owns the current structure, metadata, placeholder, and sensitive-material behavior that must be extracted behind characterization tests without changing `dry_run_release_report`. [VERIFIED: current `src/install-simulation.ts`, `src/source-snapshot.ts`, `src/preflight.ts`, focused test run 27/27]

Plan the work in TDD-sized units: characterize and extract shared readiness policy first; introduce path identity and adapter classification tests second; then implement prevalidation and explicit traversal/copy with deterministic mutation injection; finally run focused and full gates and compare `dry_run_release_report` results before and after the refactor. Do not add dependencies, public schemas, remote commands, manifests, or cleanup payload semantics in this phase. [VERIFIED: phase CONTEXT deferred scope, `package.json`, project AGENTS.md]

**Primary recommendation:** Implement `withAssembledReleaseCandidate(input, inspect, dependencies?)` as the only candidate lifetime seam, with a pure `evaluateReleaseReadiness` policy shared by the existing dry run and the new assembler. [VERIFIED: phase CONTEXT lifecycle and shared-policy decisions; repository callback-free state verified by `rg`]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RCOP-02 | Input and source-root blockers precede candidate creation. | Prevalidation state machine and `mkdtemp` spy tests prove zero candidate creation for every invalid/missing input. [VERIFIED: `.planning/REQUIREMENTS.md`] |
| RCFS-01 | Candidate is target-local, temporary, canonical, and outside prohibited roots. | Canonical temporary-parent validation plus post-creation canonical recheck; no alternative target fallback. [VERIFIED: `.planning/REQUIREMENTS.md`, phase CONTEXT] |
| RCFS-02 | Preserve both fixed addon layouts, all regular/hidden files, and empty directories. | Explicit sorted walker and callback inspection tests use hidden files, extensionless files, generated-looking names, and empty directories. [VERIFIED: `.planning/REQUIREMENTS.md`, phase CONTEXT] |
| RCFS-03 | Reject links, reparse points, special/unknown entries, escapes, unsafe identities, and case collisions. | Adapter entry-kind contract, canonical containment checks, normalized relative identity validator, and invariant case-fold collision map. [VERIFIED: `.planning/REQUIREMENTS.md`, phase CONTEXT] |
| RCFS-04 | Reuse structure, metadata, placeholder, and redacted sensitive-material blockers. | Extract pure policy from `preflight.ts`, preserve dry-run characterization, and exercise identical policy fixtures through both callers. [VERIFIED: current `src/preflight.ts`, `tests/preflight.test.ts`] |
| RCFS-05 | Detect changes during assembly without writing or repairing source. | Per-entry before/immediate/after observations, final topology rewalk, injected mutation checkpoints, and whole-tree before/after test snapshots. [VERIFIED: `.planning/REQUIREMENTS.md`, phase CONTEXT] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Addon/root/readiness policy | Domain policy | Filesystem adapter | Pure decisions own stable codes and categories; adapter only supplies observations and bytes. [VERIFIED: phase CONTEXT] |
| Path normalization and collision detection | Domain policy | Filesystem adapter | Candidate identities must be host-independent inputs to copy decisions. [VERIFIED: RCFS-03] |
| Source traversal and candidate assembly | Local domain service | Filesystem adapter | The service sequences validation, classification, copying, mutation checks, inspection, and removal. [VERIFIED: phase CONTEXT] |
| Candidate lifetime inspection | Local domain service | Test callback | A callback permits inspection while the temporary tree exists without returning a persistent artifact. [VERIFIED: phase CONTEXT specifics and deferred persistent candidates] |
| Existing dry-run compatibility | Existing preflight service | Shared policy | The old operation retains its output while delegating pure checks to the extracted policy. [VERIFIED: RCOP-02 and phase CONTEXT] |
| MCP/remote result normalization | Deferred Phase 5 | — | Phase 5 uniquely owns public registration and target parity. [VERIFIED: `.planning/ROADMAP.md`] |

## Project Constraints (from AGENTS.md)

- Preserve the v1 thin-slice scope and do not introduce TypeScript-to-Lua, React Panorama, Excel-to-KV, publishing, gameplay generation, or UI automation. [VERIFIED: `AGENTS.md`]
- Fail explicitly with path/command evidence; do not silently fall back when discovery, execution, launch, or validation fails. [VERIFIED: `AGENTS.md`]
- Use English identifiers and user-facing API names; add only non-obvious Chinese comments. [VERIFIED: `AGENTS.md`]
- Prefer deterministic filesystem/process operations over UI automation. [VERIFIED: `AGENTS.md`]
- Keep local and remote targets behind the same eventual MCP contract, while Phase 3 implements only the local/fixture domain seam. [VERIFIED: `AGENTS.md`, phase CONTEXT]
- Preserve the common evidence-bearing result expectations and never store credentials or private host data. [VERIFIED: `AGENTS.md`]
- Make schema, fixture, and template tests run on macOS without Dota; do not treat launch as validation. [VERIFIED: `AGENTS.md`]
- Run an independent review before closing implementation work. [VERIFIED: `AGENTS.md`]
- Use TDD for the change, keep explicit errors, and avoid fallback, heuristic post-processing, automatic repair, or silent recovery. [VERIFIED: root AGENTS instructions and phase CONTEXT]
- Preserve all user-owned `.planning/graphs/` modifications and exclude them from commits. [VERIFIED: task instruction and `git status --short`]
- State the implementation method before coding; if a decision is ambiguous, high-risk, or high-impact, obtain approval first. The locked CONTEXT resolves Phase 3 product choices, so planning should escalate only a genuinely new decision. [VERIFIED: root AGENTS instructions and task autonomy instruction]
- Keep planning artifacts specification-only; do not place implementation code in a plan, and implement iteratively from explicit requirements rather than by intuition. [VERIFIED: root AGENTS instructions]
- Split work into low-coupling, independently verifiable units; if the same workflow recurs three times, capture it as a skill instead of duplicating it. [VERIFIED: root AGENTS instructions]
- Maintain the early-project minimum of runnable, verifiable, and reversible work, emphasizing critical paths and high-risk boundaries. [VERIFIED: root AGENTS instructions]
- For defects encountered during implementation, reproduce first, then fix and verify; keep implementation and independent review separate. [VERIFIED: root AGENTS instructions]
- Never run `/init`; comments must explain only non-obvious logic in Chinese, must not narrate development progress, and should identify concepts rather than line numbers. [VERIFIED: root AGENTS instructions]
- Do not use development-progress labels or AI product names in code comments, commit messages, or PR text. [VERIFIED: root AGENTS instructions]

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard Here |
|-------------|---------|---------|-------------------|
| Node.js built-ins: `node:fs/promises`, `node:path`, `node:os` | Project requires `>=20`; local runtime v26.3.0 | `lstat`, `readdir`, `realpath`, `mkdtemp`, `mkdir`, `copyFile`, `rm`, containment and relative identity | Already used by adjacent filesystem services and sufficient without a new package. [VERIFIED: `package.json`, runtime probe, current source] |
| TypeScript | 5.9.3 installed | Domain types, discriminated entry classifications, injectable adapter seams | Current project compiler and conventions. [VERIFIED: `package-lock.json`, `package.json`] |
| Vitest | 3.2.6 installed | RED/GREEN fixture tests, spies, injected mutation/failure tests | Existing test framework; focused baseline is 27/27. [VERIFIED: `package-lock.json`, test run] |

### Supporting

| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| `validateAddonName` | Current repository function | Reject unsafe addon names before filesystem work | First validation in candidate assembly. [VERIFIED: `src/addon.ts`, `src/preflight.ts`] |
| Existing result/blocker conventions | Current repository types | Stable code/message/path/category domain failures | Use in the internal domain result without modifying the public `ToolResult` contract yet. [VERIFIED: `src/result.ts`, `src/types.ts`, phase CONTEXT] |
| Extracted readiness policy | New internal module | Required structure, metadata, placeholders, safe secret classifications | Called by both `dry_run_release_report` and candidate assembly. [VERIFIED: RCFS-04, phase CONTEXT] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit sorted traversal plus `copyFile` | `cp({ recursive: true })` | Recursive copy cannot expose a per-entry classify/revalidate gate and is forbidden by the locked decision. [VERIFIED: phase CONTEXT; current `install-simulation.ts` uses `cp` only as a precedent to avoid here] |
| Callback-scoped candidate lifetime | Return candidate path/handle | Returning the path permits persistence and makes ownership ambiguous; persistence is deferred. [VERIFIED: phase CONTEXT] |
| Pure extracted readiness policy | Call `dryRunReleaseReport` from assembler | The dry-run operation flattens blockers into prose and has its own operation/result semantics; it must remain inspection-only. [VERIFIED: current `src/preflight.ts`, phase CONTEXT] |
| Narrow injectable adapter/checkpoints | Broad virtual filesystem abstraction | A broad abstraction increases surface area; only classification, creation/copy/removal, canonicalization, and deterministic mutation checkpoints require injection. [VERIFIED: phase CONTEXT discretion] |

**Installation:** None. No new package is required or permitted by the task. [VERIFIED: task instruction, current standard-library coverage]

## Package Legitimacy Audit

Not applicable: Phase 3 installs no external packages. [VERIFIED: task instruction and Standard Stack]

## Architecture Patterns

### System Architecture Diagram

```text
Candidate request
      |
      v
Pure input validation ---- blocker ----> return (mkdtemp calls = 0)
      |
      v
Canonical root + temp-parent validation ---- blocker ----> return (mkdtemp calls = 0)
      |
      v
Shared readiness policy ---- blocker ----> return (mkdtemp calls = 0 or explicit policy state)
      |
      v
Create isolated candidate -> canonical recheck -> explicit sorted walk
      |                                            |
      |                                  classify + normalize + collide
      |                                            |
      |                                  immediate revalidation
      |                                            |
      +-------------------------------> mkdir/copyFile fixed layout
                                                   |
                                                   v
                                    callback inspects candidate
                                                   |
                                                   v
                                    final topology/source checks
                                                   |
                                                   v
                                      remove temporary candidate
```

The graph is a lifecycle boundary, not a public MCP route; Phase 5 will add schema/dispatcher/server connections. [VERIFIED: `.planning/ROADMAP.md`]

### Recommended Project Structure

```text
src/
├── release-readiness.ts    # Pure structure, metadata, placeholder, secret policy
├── release-candidate.ts    # Path policy, adapter contract, local/fixture assembly lifecycle
└── preflight.ts            # Existing operations; delegates pure checks without output drift
tests/
├── release-readiness.test.ts
├── release-candidate.test.ts
└── preflight.test.ts
```

This split keeps pure policy, stateful traversal/assembly, and existing result normalization separate as required by CONTEXT.md. [VERIFIED: phase CONTEXT discretion]

### Pattern 1: Precreation Validation Gate

**What:** Complete all name/root/type/existence/canonical temporary-parent checks before the first `mkdtemp` call. The candidate child must then be canonicalized and rechecked before any directory layout or file is created beneath it. [VERIFIED: RCOP-02, RCFS-01, phase CONTEXT]

**Planning consequence:** Write parameterized RED tests that inject an `mkdtemp` spy for invalid addon name, missing target root, nonexistent target root, non-directory target, missing game root, missing content root, unsafe temporary parent, and repository overlap; every case asserts zero calls. [VERIFIED: requirement categories]

### Pattern 2: Normalized Relative Identity Before Destination Paths

**What:** Build identities from root provenance (`game` or `content`) plus forward-slash relative segments. Reject empty unsafe segments, `.`, `..`, absolute identities, platform-absolute variants, and separator ambiguity before calling `join`. Compare a locale-independent case-fold key for every directory and file identity and block the complete operation on any collision. [VERIFIED: RCFS-02, RCFS-03, phase CONTEXT]

**Planning consequence:** Keep the normalized identity separate from absolute source/candidate paths. Never validate by string-prefix comparison; use `relative(parent, child)` plus canonical paths. [VERIFIED: current `install-simulation.ts` containment helper and phase CONTEXT]

### Pattern 3: Classify, Revalidate, Copy, Observe Again

**What:** For every sorted entry, use `lstat`-style non-dereferencing classification, reject links/reparse/special/unknown, verify canonical containment, record a stable observation, reclassify immediately before `mkdir` or `copyFile`, and observe again after copy. Rewalk both source trees after assembly to detect added, removed, renamed, or retyped entries. [VERIFIED: RCFS-03, RCFS-05, phase CONTEXT]

**Observation fields:** Use adapter-provided kind plus available stable stat identity such as size, modification time at nanosecond precision, device, inode/file identifier, and canonical path. Phase 4 will add source-before/source-after/candidate SHA-256 equality, so Phase 3 must not claim byte-integrity manifest completion. [VERIFIED: RCFS-05 versus RCIN-01 phase ownership in `.planning/REQUIREMENTS.md`]

### Pattern 4: Callback-Scoped Temporary Candidate

**What:** Invoke a caller-supplied inspection callback only after both roots are fully assembled and stable. Remove the candidate in `finally`; never return it as a usable artifact. Surface removal errors explicitly, while leaving versioned cleanup evidence and cleanup-precedence semantics to Phase 4. [VERIFIED: phase CONTEXT specifics and deferred cleanup scope]

**Planning consequence:** Tests inspect hidden files, binary bytes, fixed layout, and empty directories inside the callback, then assert the path is absent after return. A callback throw must still trigger removal and explicit failure. [VERIFIED: no-persistent-candidate boundary]

### Pattern 5: Characterization-Preserving Policy Extraction

**What:** Move release metadata keys, placeholder classification, required paths, text classification, scan limit, and secret labels/patterns into pure functions. Preserve the current evidence strings, warning ordering, blocker counts, and `ToolResult` shape in `dryRunReleaseReport`. [VERIFIED: current `src/preflight.ts`, `tests/preflight.test.ts`]

**Planning consequence:** First add characterization cases for complete metadata, missing metadata, placeholders, sensitive redaction, oversized required text, and unsafe traversal. Only then extract. The new candidate service consumes structured policy findings; the old dry run renders those findings into its existing strings. [VERIFIED: RCFS-04 and TDD instruction]

### Anti-Patterns to Avoid

- **Create-then-validate:** It violates RCOP-02 even if the empty directory is later removed. [VERIFIED: RCOP-02]
- **Pre-scan followed by recursive `cp`:** The entry can change between scan and copy, and copy has no per-entry rejection hook. [VERIFIED: phase CONTEXT]
- **Trusting `Dirent`:** Treat directory enumeration as names only and classify via the adapter immediately before use. [VERIFIED: locked revalidation decision]
- **`startsWith` containment:** `/safe/root-other` passes a lexical prefix test; use canonical paths and `relative`. [VERIFIED: existing `isPathInside` pattern in `install-simulation.ts`]
- **`localeCompare` for ordering/collisions:** Locale-dependent behavior conflicts with deterministic identities; use ordinal string comparison and invariant lowercasing. [VERIFIED: `source-snapshot.ts` uses ordinal comparison; requirements exclude locale from later manifest identity]
- **Skipping files by extension/name/time:** Phase 3 must include all regular files; extensions are relevant only to readiness scanning, never inclusion. [VERIFIED: RCFS-02]
- **Retrying after mutation:** A retry can produce a mixed snapshot; return `SOURCE_CHANGED_DURING_ASSEMBLY`. [VERIFIED: phase CONTEXT]
- **Logging exception contents wholesale:** Filesystem errors may contain private absolute paths; normalize to stable code, safe field/category, and relative path. [VERIFIED: redaction requirement and AGENTS.md]
- **Changing public `ToolResult` now:** Structured MCP details and operation registration are Phase 5 scope. [VERIFIED: `.planning/ROADMAP.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filesystem recursion | Shell `find`, globbing, ignore parsing, or recursive-copy filters | Explicit `readdir` + adapter `lstat` + sorted entry names | Preserves hidden/empty entries and classifies every entry. [VERIFIED: phase CONTEXT] |
| Containment | Prefix/regex path checks | `realpath` plus `path.relative`/`isAbsolute` | Matches existing safe containment precedent. [VERIFIED: `install-simulation.ts`] |
| Temporary naming | Timestamp/random string concatenation | `mkdtemp` under a prevalidated target-local parent | Existing repository and Node-standard mechanism. [VERIFIED: `install-simulation.ts`] |
| Secret evidence | Value snippets or regex match text | Existing stable secret category and safe relative path | Required redaction behavior already exists. [VERIFIED: `preflight.ts`, `tests/preflight.test.ts`] |
| Metadata parser expansion | Full KeyValues parser or automatic repair | Preserve the current quoted key/value readiness parser for the established contract | RCFS-04 requires consistency, not a parser migration. [VERIFIED: `preflight.ts`] |
| Source stability recovery | Retry, recopy, or repair | One fail-closed observation sequence and explicit source-changed blocker | Locked decision forbids mixed-state retry. [VERIFIED: phase CONTEXT] |

**Key insight:** The hard part is sequencing and evidence, not copying bytes; the plan must make illegal states unrepresentable before any destination write. [VERIFIED: phase requirements and current precedents]

## Common Pitfalls

### Pitfall 1: Candidate Created Before All Root Checks
**What goes wrong:** An invalid request leaves observable temporary state and fails RCOP-02. [VERIFIED: RCOP-02]
**Why it happens:** `install-simulation.ts` currently creates its root before canonical repository validation, so copying that orchestration order is unsafe for this phase. [VERIFIED: current source]
**How to avoid:** Spy on `mkdtemp` in every invalid-input test and keep creation behind one validated state transition. [VERIFIED: TDD requirement]
**Warning signs:** A path to `mkdtemp` is reachable before both addon roots are classified as canonical directories. [VERIFIED: required ordering]

### Pitfall 2: Empty Directories Disappear
**What goes wrong:** File-only traversal reproduces bytes but not the complete source tree. [VERIFIED: RCFS-02]
**Why it happens:** Existing `source-snapshot.ts` collects files only, and `preflight.ts` traverses only files for scans. [VERIFIED: current source]
**How to avoid:** Emit directory entries during traversal and create every accepted directory, including roots and empty leaves. [VERIFIED: phase CONTEXT]
**Warning signs:** Tests compare only file lists or hashes and never call `readdir` on an empty candidate directory. [VERIFIED: RCFS-02]

### Pitfall 3: Case Collision Detected After Partial Copy
**What goes wrong:** macOS fixture behavior can differ from Windows and a partial candidate exists before failure. [VERIFIED: RCFS-03 and macOS contract gate]
**Why it happens:** Collision detection is performed during destination creation rather than during the pre-copy identity inventory. [VERIFIED: phase ordering constraints]
**How to avoid:** Inventory and collision-check both full trees before creating candidate content; then recheck identities during copy for mutation. [VERIFIED: phase CONTEXT]
**Warning signs:** The collision map is local to a directory or populated only after `copyFile`. [VERIFIED: fixed candidate identity requirement]

### Pitfall 4: Source Mutation Escapes a One-Time Scan
**What goes wrong:** Candidate files come from different source states or a newly introduced unsafe entry is missed. [VERIFIED: RCFS-05]
**Why it happens:** A safe pre-scan is treated as an atomic snapshot. [VERIFIED: `.planning/research/PITFALLS.md`]
**How to avoid:** Add deterministic checkpoints before revalidation, before copy, after copy, and before final rewalk; inject mutations at each checkpoint. [VERIFIED: phase CONTEXT discretion]
**Warning signs:** Tests mutate only before assembly begins or only compare source after completion. [VERIFIED: RCFS-05]

### Pitfall 5: Shared Policy Changes Dry-Run Output
**What goes wrong:** Phase 3 closes RCFS-04 but regresses the established operation that RCOP-01 later promises to preserve. [VERIFIED: RCOP-01, RCFS-04]
**Why it happens:** Structured policy findings are rendered differently or warning/blocker order changes during extraction. [VERIFIED: current prose-based output]
**How to avoid:** Snapshot exact results for representative fixtures before extraction and use a compatibility renderer for the old operation. [VERIFIED: tests currently assert exact evidence fragments]
**Warning signs:** Existing `tests/preflight.test.ts` assertions are weakened or rewritten to accept new output. [VERIFIED: TDD regression discipline]

### Pitfall 6: Sensitive Evidence Leaks Through Exceptions
**What goes wrong:** A blocker is redacted, but a thrown message, log, or absolute path exposes source details or matched content. [VERIFIED: RCFS-04, AGENTS.md]
**Why it happens:** Raw `Error.message` is forwarded as evidence. [VERIFIED: common filesystem error shape observable in Node APIs; use only as a planning risk]
**How to avoid:** Map failures at the boundary to stable codes and safe fields; test `JSON.stringify(result)` against injected secrets and private roots. [VERIFIED: existing sensitive serialization tests]
**Warning signs:** Results contain source file contents, link targets, or unfiltered adapter stderr. [VERIFIED: task boundary]

## Code Examples

### Safe Precreation State Transition

```typescript
type ValidatedAssemblyInput = {
  addonName: string;
  dotaRoot: string;
  gameRoot: string;
  contentRoot: string;
  tempParent: string;
};

const validated = await validateAssemblyInput(input, adapter);
if (!validated.ok) return validated;

return await withCandidateRoot(validated.value, adapter, inspect);
```

This shape ensures candidate creation accepts only a validated input type. [VERIFIED: derived from locked creation ordering and existing discriminated result conventions]

### Ordinal Traversal with Reclassification

```typescript
const names = (await adapter.readDirectory(sourceDirectory)).sort(compareOrdinal);
for (const name of names) {
  const identity = normalizeCandidateIdentity(rootKind, parentIdentity, name);
  const first = await adapter.classify(sourcePath);
  assertAcceptedEntry(identity, first, collisions);
  const immediate = await adapter.classify(sourcePath);
  assertUnchanged(identity, first, immediate);
  await copyAcceptedEntry(sourcePath, candidatePath, immediate, adapter);
  const after = await adapter.classify(sourcePath);
  assertUnchanged(identity, immediate, after);
}
```

The adapter contract must expose `reparse` separately when the target adapter can observe it; no rejected kind is dereferenced. [VERIFIED: phase CONTEXT]

### Candidate Lifetime

```typescript
const candidateRoot = await adapter.createCandidateRoot(validated.tempParent);
try {
  await assertCandidateIsolation(candidateRoot, validated);
  await assembleBothRoots(candidateRoot, validated, adapter);
  await assertSourcesStable(validated, adapter);
  return await inspect(candidateRoot);
} finally {
  await adapter.removeCandidateRoot(candidateRoot);
}
```

Phase 4 should replace the minimal removal outcome with versioned cleanup evidence and precedence rules without changing this lifetime shape. [VERIFIED: Phase 4 roadmap ownership]

## Prescriptive TDD Matrix

| RED test group | Required assertions | Requirement |
|----------------|---------------------|-------------|
| Input gate | Invalid addon, absent/invalid target root, absent/non-directory game/content roots, unsafe temp parent each produce stable structured blocker and `mkdtemp` count 0. [VERIFIED: requirements] | RCOP-02 |
| Isolation | Temp parent inside Dota, either source, repository, or canonical alias blocks; safe external parent creates exactly one candidate; post-create canonical escape blocks before layout copy. [VERIFIED: requirements] | RCFS-01 |
| Complete layout | Regular binary, extensionless, dotfile, generated-looking file, nested empty directory, and both roots appear under exact fixed prefixes; enumeration order does not change result. [VERIFIED: requirements] | RCFS-02 |
| Unsafe entries | Symlink, injected reparse/junction, FIFO/socket/special, unknown kind, canonical escape, absolute identity, `..`, backslash ambiguity, and case-only collision each block with safe relative identity and no dereference/repair. [VERIFIED: requirements] | RCFS-03 |
| Shared readiness | Existing missing structure, metadata missing, placeholder, secret category, oversized required text, unreadable required text fixtures produce the same policy findings; serialized result omits secret value. [VERIFIED: RCFS-04 and phase CONTEXT] | RCFS-04 |
| Compatibility | Exact representative `dryRunReleaseReport` results before/after extraction remain equal, including warning/evidence order and blocker count. [VERIFIED: preserve behavior constraint] | RCFS-04 |
| Mutation | Add/remove/rename/retype file, mutate metadata around copy, replace directory with link, and alter source during callback each return source-changed or unsafe-entry blocker; no retry occurs. [VERIFIED: RCFS-05] | RCFS-05 |
| Immutability | Before/after source inventories and bytes are identical for success and every injected destination failure; adapter records no write path under either source root. [VERIFIED: RCFS-05] | RCFS-05 |
| Lifetime boundary | Candidate exists only inside callback and is absent after success/callback failure; no persistent path is advertised. Formal cleanup evidence is deferred. [VERIFIED: phase CONTEXT] | RCFS-01, RCFS-05 |

Run each new test first and retain evidence of the expected RED failure before production implementation, as explicitly required by CONTEXT.md. [VERIFIED: phase CONTEXT discretion]

## State of the Art

| Existing Repository Approach | Phase 3 Approach | Impact |
|-----------------------------|------------------|--------|
| `install-simulation.ts` pre-scans then calls recursive `cp`. [VERIFIED: current source] | Explicit entry walker with immediate reclassification and `copyFile`. [VERIFIED: locked decision] | Enables per-entry safety and mutation failures. [VERIFIED: RCFS-03/05] |
| `preflight.ts` stores readiness logic and renders prose directly. [VERIFIED: current source] | Pure structured policy plus compatibility renderer. [VERIFIED: RCFS-04] | One readiness authority without dry-run behavior drift. [VERIFIED: phase CONTEXT] |
| `source-snapshot.ts` records files only. [VERIFIED: current source] | Assembly inventory records directories as well as files. [VERIFIED: RCFS-02] | Empty directories are preserved. [VERIFIED: RCFS-02] |
| Public `ToolResult` has no structured details. [VERIFIED: `src/types.ts`] | Keep Phase 3 domain result internal. [VERIFIED: Phase 5 scope] | Avoids premature MCP contract expansion. [VERIFIED: roadmap] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations are derived from locked context, current repository code/tests, and milestone requirements. | — | — |

## Open Questions

None requiring product input. The following implementation choices are already delegated to the agent and should be resolved prescriptively in planning: use a narrow filesystem adapter with deterministic lifecycle checkpoints; use a callback-scoped candidate; and keep Phase 3 results internal until Phase 5. [VERIFIED: phase CONTEXT discretion and roadmap]

## Validation Architecture

Omitted because `.planning/config.json` explicitly sets `workflow.nyquist_validation` to `false`. TDD and the phase quality gates still apply under the direct task and CONTEXT.md instructions. [VERIFIED: `.planning/config.json`, task instruction]

## Environment Availability

No external service, Dota installation, Windows host, or new CLI is required. Node v26.3.0, npm 11.16.0, TypeScript 5.9.3, and Vitest 3.2.6 are available locally; the focused baseline passed 27/27 tests on macOS. [VERIFIED: local probes and focused test run]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Operation accepts no credentials and performs no login. [VERIFIED: v1.14 boundary] |
| V3 Session Management | No | No session exists in Phase 3. [VERIFIED: phase scope] |
| V4 Access Control | No external authorization | Filesystem containment restricts reads/writes to approved roots and the candidate. [VERIFIED: RCFS-01/03/05] |
| V5 Input Validation | Yes | Existing addon-name validation, canonical root/type validation, normalized relative identities, explicit entry-kind allowlist, and structured blockers. [VERIFIED: requirements] |
| V6 Cryptography | No in Phase 3 | Hash reconciliation belongs to Phase 4; signing/encryption are prohibited. [VERIFIED: roadmap and boundary] |

### Known Threat Patterns for Filesystem Assembly

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal/canonical escape | Tampering / Information Disclosure | Normalize relative identity, reject absolute/parent traversal, canonicalize, and verify containment before use. [VERIFIED: RCFS-03] |
| Symlink/junction/reparse substitution | Tampering / Information Disclosure | Non-dereferencing classification plus immediate revalidation; reject every link/reparse kind. [VERIFIED: RCFS-03] |
| TOCTOU source mutation | Tampering | Stable observations, lifecycle checkpoints, immediate revalidation, final rewalk, fail without retry. [VERIFIED: RCFS-05] |
| Case-fold collision | Tampering | Global invariant fold-key map before copy. [VERIFIED: RCFS-03] |
| Secret disclosure in evidence | Information Disclosure | Return category and safe relative identity only; serialization tests include injected secret/private paths. [VERIFIED: RCFS-04] |
| Candidate residue | Information Disclosure | Callback-scoped lifetime and `finally` removal; Phase 4 adds formal verified cleanup semantics. [VERIFIED: milestone boundary and roadmap] |

## Quality Gates for the Planner

1. Run focused RED/GREEN tests for each task; do not write implementation before its failing test. [VERIFIED: task and CONTEXT instructions]
2. Run `npm test -- --run tests/release-readiness.test.ts tests/release-candidate.test.ts tests/preflight.test.ts tests/install-simulation.test.ts tests/source-snapshot.test.ts tests/result.test.ts` after candidate-domain work. [VERIFIED: existing Vitest script and expected new test files]
3. Run `npm test`, `npm run typecheck`, and `npm run build` before the phase commit. [VERIFIED: `package.json` quality commands]
4. Compare representative serialized `dry_run_release_report` outputs before and after policy extraction. [VERIFIED: preserve behavior constraint]
5. Search changed code for `cp(`, recursive-copy flags, source-tree writes, compile/build subprocesses, credential fields, upload/archive/sign/encrypt behavior, and raw exception forwarding. Any hit must be explained or removed. [VERIFIED: scope boundaries]
6. Independently review containment, link/reparse rejection, source mutation, redaction, candidate lifetime, and `.planning/graphs/` exclusion before closure. [VERIFIED: AGENTS.md and task instruction]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/03-safe-candidate-assembly/03-CONTEXT.md` — locked lifecycle, traversal, safety, readiness, and deferred-scope decisions. [VERIFIED: repository]
- `.planning/REQUIREMENTS.md` — RCOP-02 and RCFS-01 through RCFS-05 acceptance boundaries and unique traceability. [VERIFIED: repository]
- `.planning/ROADMAP.md` — Phase 3 goal and Phase 4/5 ownership boundaries. [VERIFIED: repository]
- `AGENTS.md` — implementation, scope, evidence, credential, validation, and independent-review constraints. [VERIFIED: repository]
- `src/preflight.ts` and `tests/preflight.test.ts` — current dry-run readiness behavior and redaction contract. [VERIFIED: repository]
- `src/install-simulation.ts` and `tests/install-simulation.test.ts` — current isolation, link rejection, containment, and temporary-lifetime precedents. [VERIFIED: repository]
- `src/source-snapshot.ts` and `tests/source-snapshot.test.ts` — current normalized ordering, hashing, and relative evidence precedents. [VERIFIED: repository]
- `src/result.ts`, `src/types.ts`, and `tests/result.test.ts` — current common result envelope and absence of structured candidate details. [VERIFIED: repository]
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, and `.planning/research/SUMMARY.md` — milestone-level architecture and risk analysis. [VERIFIED: repository]
- Focused Vitest run on 2026-07-15 — 4 files and 27 tests passed. [VERIFIED: local command output]

### Graph Context

- `.planning/graphs/graph.json` was 217 hours and 32 commits stale, and capability queries returned no nodes; no recommendation relies on graph results. [VERIFIED: `gsd-tools graphify status/query`]

### Secondary and Tertiary

- None. No external dependency or unsettled framework question required web research. [VERIFIED: Standard Stack and locked scope]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed versions and existing use were verified locally. [VERIFIED: package lock and runtime probes]
- Architecture: HIGH — locked context and current filesystem services define the seams. [VERIFIED: repository]
- Pitfalls: HIGH — each risk maps to a requirement, current implementation gap, or milestone research finding. [VERIFIED: repository]

**Research date:** 2026-07-15
**Valid until:** 2026-08-14; repository changes to `preflight.ts`, `install-simulation.ts`, or Phase 3 CONTEXT should trigger refresh. [VERIFIED: stable local stack; validity period is research metadata]

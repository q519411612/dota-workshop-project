# Stack Research

**Domain:** Temporary Dota Workshop addon release-candidate assembly and preflight
**Researched:** 2026-07-15
**Confidence:** HIGH for repository integration and installed versions; MEDIUM for minimum-runtime portability until Windows contract tests run

## Recommendation

Do not add a production dependency for v1.14. The repository already contains every required primitive: Node filesystem and crypto APIs, the MCP TypeScript SDK, Zod schemas, a normalized `ToolResult`, fixture/local/remote target routing, and Vitest. The new capability should be a dedicated operation built from those primitives, not an extension of `dry_run_release_report` and not a new packaging subsystem.

The key stack change is internal factoring. Extract reusable release metadata, sensitive-scan, deterministic manifest, path-containment, symbolic-link rejection, and cleanup verification helpers so the new candidate operation and current read-only checks do not drift. Keep the local/fixture implementation in TypeScript; keep remote Windows behind the existing PowerShell command adapter and normalize its JSON payload into the same result contract.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | `>=20` (existing engine contract) | Temporary directory creation, safe traversal/copy, cleanup, path isolation, byte reads, SHA-256 | Already required and cross-platform. `node:fs/promises`, `node:path`, `node:os`, and `node:crypto` cover the complete local/fixture candidate lifecycle without another package. |
| TypeScript | `5.9.3` resolved | Candidate domain types, manifest/blocker models, target-specific orchestration | Matches the existing ESM codebase and lets the dedicated operation share the current `Target` and `ToolResult` contracts. |
| MCP TypeScript SDK | `1.29.0` resolved from `^1.20.0` | Register the dedicated release-candidate preflight tool and return structured results | The current `McpServer.registerTool` API already accepts Zod input schemas and supports `structuredContent` plus `isError`; no protocol or transport addition is needed. |
| Zod | `3.25.76` | Validate the operation input and target discriminated union | The installed version satisfies the SDK's `^3.25 || ^4.0` peer range and already defines the project's fixture/local/remote contract. |
| Existing PowerShell command adapter | Existing project contract | Execute equivalent assembly and validation on remote Windows | Remote targets do not run the local Node process. Extend the current generated PowerShell script pattern and JSON payload parser instead of introducing a second remote transport or persistent helper installation. |

### Node Standard-Library APIs

| API | Purpose | Required usage |
|-----|---------|----------------|
| `fs.promises.mkdtemp`, `os.tmpdir` | Create an isolated candidate root | Allow an injected temporary parent in tests; never create the candidate inside either source addon tree. |
| `fs.promises.lstat`, `realpath`, `readdir({ withFileTypes: true })` | Fail-closed source traversal | Reject every symbolic link before copying, prove resolved source paths remain within the expected addon root, and sort directory entries explicitly. |
| `fs.promises.mkdir`, `copyFile` | Assemble the two candidate trees | Copy only regular files after validation. Prefer explicit traversal over opaque recursive copy so symlink rejection, evidence, and file-selection rules are auditable. |
| `path.resolve`, `relative`, `isAbsolute`, `sep` | Path-containment proof and portable manifest paths | Apply the same strict containment pattern already proven by local install simulation; normalize manifest paths to `/`. |
| `fs.promises.readFile`, `crypto.createHash("sha256")` | Hash exact candidate bytes | Hash the copied candidate, not only the source, and sort entries by normalized relative path before returning the manifest. |
| `fs.promises.rm({ recursive: true, force: true })`, followed by existence check | Candidate cleanup | Run from `finally`; report cleanup failure as a blocker. `force` must not be treated as evidence that removal succeeded. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | `3.2.6` resolved from `^3.2.4` | macOS fixture completion gate | Cover success, deterministic ordering/hash, missing roots/files, placeholder metadata, sensitive content, symlinks, source/candidate escape, copy failure, cleanup success/failure, and remote payload normalization. |
| `@types/node` | `22.20.0` resolved | Type coverage for Node built-ins | Compatible with the APIs already used by the repository. No type package change is required for v1.14. |
| PowerShell script fixtures/executor stubs | Existing test pattern | Validate local/remote tool-contract parity without a real Windows host | Assert emitted command intent and parsed evidence; do not claim real Windows execution from these tests. |

## Integration Points

| Existing area | v1.14 change |
|---------------|--------------|
| `src/preflight.ts` | Reuse or extract metadata and sensitive-content policies. Preserve `dry_run_release_report` behavior; do not silently route it to candidate assembly. |
| `src/source-snapshot.ts` | Reuse the deterministic normalized-path, byte-count, SHA-256 manifest pattern conceptually. Generalize shared helpers only if their contracts remain domain-neutral. |
| `src/install-simulation.ts` | Reuse the proven `lstat`/`realpath` containment, isolated temp root, `finally` cleanup, and post-removal verification patterns. Candidate-specific code should not depend on plugin-install types. |
| `src/schemas.ts` | Add a dedicated input schema using the existing `TargetSchema` and `addonName`; keep it strict enough that unsupported upload/archive options are rejected rather than ignored. |
| `src/tools.ts` and `src/server.ts` | Add one explicit tool name, dispatcher branch, registration, title, description, and structured result handling. |
| `src/remote.ts` | Add a remote operation that emits fail-closed PowerShell, parses a versioned candidate payload, preserves command/log evidence, and returns explicit parse/cleanup failures. |
| `src/types.ts` / `src/result.ts` | Keep the top-level `ToolResult` envelope. Put manifest, blockers, and cleanup facts into typed structured evidence or an additive operation payload if requirements demand machine-readable detail; do not encode all new facts only as prose strings. |

## Installation

No package installation is recommended.

```bash
# Keep the current lockfile; v1.14 needs no new runtime or development dependency.
npm ci
```

Do not upgrade dependencies as part of this milestone unless an implementation test proves a current version blocks the required contract. Registry checks on 2026-07-15 found newer major releases of TypeScript and Vitest, but v1.14 does not need their features and should avoid unrelated upgrade risk.

## Alternatives Considered

| Recommended | Alternative | Why the alternative is not appropriate for v1.14 |
|-------------|-------------|---------------------------------------------------|
| Explicit standard-library traversal and `copyFile` | `fs.promises.cp({ recursive: true })` | Recursive copy is shorter, but explicit traversal makes symlink rejection, file inclusion, ordering, and evidence deterministic before bytes are copied. This is important because Node 20 is still the minimum engine contract. |
| Built-in `crypto.createHash("sha256")` | Hashing package or external `sha256sum`/`certutil` | Adds dependency or platform branching without adding capability. The existing source snapshot already proves the Node hash path. |
| `mkdtemp` plus verified `rm` in `finally` | `tmp`, `tempy`, or `fs-extra` | The lifecycle is small and already implemented successfully in local install simulation; another abstraction would hide evidence and cleanup semantics. |
| Existing generated PowerShell remote operation | `robocopy`, `7-Zip`, `tar`, or a permanently installed remote helper | These add host prerequisites, archive behavior, or deployment state outside the agreed fixture-gated scope. |
| Dedicated MCP operation | Extending `dry_run_release_report` | The user explicitly chose a new operation. Assembly mutates a temporary directory and has cleanup evidence, unlike the existing read-only report. |
| Shared policy helpers | Copying metadata/secret regexes into a new module and another PowerShell script independently | Duplicated policy will drift. One canonical policy model should drive local behavior and remote script generation where practical. |

## What NOT to Add

| Avoid | Why | Use instead |
|-------|-----|-------------|
| Steamworks SDK, SteamCMD, Workshop upload clients | They imply login, item mutation, upload, and credential handling, all outside v1.14. | Candidate assembly and preflight evidence only. |
| Archive libraries (`archiver`, ZIP/TAR helpers), signing, encryption | The milestone explicitly requires a temporary inspectable directory, not a persistent distributable. | Preserve the two addon trees under an isolated temporary root. |
| Glob/walk/copy convenience libraries | Node APIs already cover the small deterministic traversal; convenience defaults can follow links or obscure ordering. | Explicit sorted traversal with `lstat` and containment checks. |
| Secret-manager or generic DLP dependency | No credentials are accepted, and current project scanners already define the release boundary. | Refactor current bounded scanners and return redacted blocker categories/paths only. |
| Database, cache, or persistent candidate registry | A candidate is single-operation temporary state and must be cleaned up. | Return manifest and cleanup evidence in the MCP result. |
| UI automation | Candidate assembly is a deterministic filesystem operation. | Node locally and the existing command-oriented Windows adapter remotely. |
| Silent skip of unreadable, oversized, non-text, or unsupported entries | A release candidate cannot be declared clean when checks were not performed. | Define explicit warning versus blocker policy in requirements and fail closed for anything that prevents required validation. |

## Stack Patterns by Target

**Fixture and local Windows:**

- Use one TypeScript candidate engine with an injected source root, temporary parent, and filesystem seam for deterministic tests.
- Preserve source layout as `game/dota_addons/<addon>` and `content/dota_addons/<addon>` under the candidate root.
- Validate the copied candidate before cleanup, then clean in `finally` and return both validation and cleanup evidence.

**Remote Windows:**

- Use the current remote executor and generated PowerShell pattern; do not require Node or this plugin to be installed remotely.
- Produce a versioned JSON payload with the same manifest fields, blocker codes, paths, warnings, and cleanup facts as the TypeScript engine.
- Treat non-zero command exit, invalid JSON, incomplete payload, candidate escape, or unverified cleanup as explicit failure; never fall back to the local fixture implementation.

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `@modelcontextprotocol/sdk@1.29.0` | `zod@3.25.76` | SDK metadata declares `zod: ^3.25 || ^4.0`; the current pair is compatible. |
| Node `>=20` | Current filesystem/crypto plan | All selected APIs exist in Node 20. Explicit traversal avoids relying on recursive-copy policy as the safety boundary. |
| TypeScript `5.9.3` | `@types/node@22.20.0` | This is the existing passing build configuration; no v1.14-only language feature is required. |
| Vitest `3.2.6` | Node `>=20` project contract | Continue the current fixture suite and executor-stub approach. |
| Remote PowerShell implementation | Existing SSH/PowerShell transports | Real Windows is not the completion gate, so only contract parity may be claimed in v1.14 unless separate runtime evidence is collected. |

## Sources

- Repository `package.json` and `package-lock.json` — declared and resolved versions, checked 2026-07-15 (direct project evidence).
- Current implementation in `src/preflight.ts`, `src/source-snapshot.ts`, `src/install-simulation.ts`, `src/schemas.ts`, `src/tools.ts`, `src/server.ts`, `src/remote.ts`, `src/types.ts`, and `src/result.ts` — integration and existing capability evidence (direct project evidence).
- [Node.js 20 File System documentation](https://nodejs.org/docs/latest-v20.x/api/fs.html) — `mkdtemp`, `lstat`, `readdir`, `cp`, and `rm` contracts (official documentation; research seam classified the available web-fetch route LOW, conclusions cross-checked against current repository usage).
- [Node.js 20 Crypto documentation](https://nodejs.org/docs/latest-v20.x/api/crypto.html) — `createHash` and SHA-256 (official documentation; same route classification).
- [MCP TypeScript SDK v1.29.0 server documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md) — `registerTool`, input/output schemas, `structuredContent`, and `isError` (official tagged source; same route classification).
- [MCP TypeScript SDK v1.29.0 package/README](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.29.0) — Zod peer compatibility and local stdio use (official tagged source; same route classification).
- Installed `zod@3.25.76` declarations and tests — `discriminatedUnion` and strict object APIs (locked package evidence).
- npm registry metadata queried 2026-07-15 — current release awareness only; newer major versions were intentionally not recommended.

## Open Stack Questions

- Requirements must decide whether skipped non-text secret scanning is a warning or a blocker for an otherwise valid binary addon asset. The stack does not require a new binary scanner, but the operation must not claim such files were scanned.
- Requirements must define whether cleanup failure overrides an otherwise valid candidate. The recommended fail-closed answer is yes.
- If future requirements demand retaining or uploading the candidate, that is a separate milestone requiring a different lifecycle and threat model; it must not be smuggled into this temporary preflight operation.

---
*Stack research for: v1.14 Workshop Addon Release Candidate Preflight*
*Researched: 2026-07-15*

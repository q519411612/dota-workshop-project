# Pitfalls Research

**Domain:** Temporary Dota Workshop addon release-candidate assembly and preflight through a unified MCP contract
**Researched:** 2026-07-15
**Confidence:** HIGH for repository-specific integration and fixture/local behavior; MEDIUM for Windows reparse-point implementation details until exercised by Windows contract tests

## Critical Pitfalls

### Pitfall 1: Treating a Pre-Scan as an Atomic Safety Guarantee

**What goes wrong:**
The operation scans the source tree, decides it is safe, and later copies the same paths. A file, directory, or link can change between those actions. The candidate can then contain bytes that were never scanned, a link target outside the addon root, or a different file than the manifest describes. Hashing only the source makes the mismatch invisible.

**Why it happens:**
The existing install simulation demonstrates recursive safety inspection followed by `cp`, which is adequate for its controlled repository fixture but is not a strong release-candidate boundary under concurrent source mutation. A two-pass design looks rigorous while leaving a time-of-check/time-of-use gap.

**How to avoid:**
Use an explicit sorted walker and re-run `lstat`, entry-type validation, canonical-containment validation, and file identity/size checks immediately before each `copyFile`. Copy only regular files. Hash the destination bytes after copying, or hash during copy and verify the destination hash before accepting the entry. Record a stable source observation and fail with a source-changed blocker when post-copy size, identity, or bytes disagree. Do not retry or silently rescan into success, because that can create a candidate from several different source states.

Fixture tests should inject mutation between inspection and copy: regular file to symlink, file content replacement, directory replacement, and file deletion. Every case must fail, clean up, and omit unsafe values from evidence.

**Warning signs:**
- The design has distinct `scanTree()` and opaque recursive `cp()` calls.
- Manifest hashes are calculated before candidate assembly.
- Copy errors are caught and converted into warnings or skipped entries.
- A concurrent mutation test sometimes passes with a different manifest instead of returning a stable blocker.

**Phase to address:**
Phase 4 — Fixture/local candidate lifecycle. Freeze the fail-closed copy invariant before MCP and remote wiring.

---

### Pitfall 2: Symlink or Windows Reparse-Point Escape

**What goes wrong:**
A symbolic link, junction, mount point, or other reparse point inside either addon root resolves outside the root. A recursive copy follows it and imports unrelated or sensitive files into the temporary candidate. Checking only top-level roots or inspecting the destination after copying is too late.

**Why it happens:**
POSIX symlinks are visible through `lstat`, but Windows junctions and other reparse points do not always look identical across Node and PowerShell APIs. Local and remote implementations can therefore enforce different boundaries. Directory-entry APIs can also report a directory while the path changes before use.

**How to avoid:**
Reject links and reparse-point entries recursively before their contents are read or copied. For Node, use `lstat` plus `realpath` containment and recheck at copy time. For PowerShell, explicitly reject entries carrying the reparse-point attribute and validate resolved/canonical paths rather than relying only on string prefixes. Reject non-regular filesystem objects. Never include the resolved external target in evidence; report only a safe root-relative path and category.

Test top-level and nested file links, directory links, relative links, and mocked Windows junction/reparse payloads. Contract tests must prove fixture/local and remote return the same blocker category even if platform details differ.

**Warning signs:**
- `fs.cp({ recursive: true })`, `Copy-Item -Recurse`, or `robocopy` is the safety boundary.
- Only `Dirent.isSymbolicLink()` is checked.
- Containment uses `startsWith(root)`.
- Remote scripts never mention reparse points or junctions.
- Error evidence contains a link target or private external path.

**Phase to address:**
Phase 4 for Node traversal and fixtures; Phase 5 — Remote parity for PowerShell reparse-point enforcement and semantic parity tests.

---

### Pitfall 3: Incorrect Path Normalization and Containment

**What goes wrong:**
Sibling prefixes, `..`, mixed separators, drive-relative paths, case differences, UNC paths, trailing separators, or Unicode/case normalization cause an unsafe candidate location or source path to pass a lexical check. Alternatively, valid Windows paths are rejected only on the remote adapter. Absolute temp or host-specific paths leak into the deterministic manifest.

**Why it happens:**
The project spans APFS/macOS fixtures and NTFS/Windows targets. A simple string prefix is not a containment proof, and POSIX case sensitivity does not model Windows path comparison. Manifest identity and operational evidence also have different path requirements but are easy to conflate.

**How to avoid:**
Define two separate policies:

1. Operational containment uses target-native absolute/canonical paths and a relative-path test that rejects absolute results, `..`, and sibling prefixes. Candidate and both source roots must be mutually separated as specified.
2. Manifest paths are candidate-root-relative, use `/`, contain no empty, `.` or `..` segments, and are sorted by a documented ordinal comparison. They never include drive letters, UNC hosts, temp prefixes, target names, or source absolute paths.

Add a shared table of path-contract cases and run it against Node and remote payload normalization. Do not lower-case manifest paths as a repair; instead detect case-colliding entries and fail because they cannot be represented consistently across targets.

**Warning signs:**
- Containment is implemented with `candidate.startsWith(source)`.
- Tests cover only `/tmp/root/child`.
- Manifest paths contain `C:`, backslashes, the fixture root, or the remote host.
- Case-colliding paths produce different manifests on macOS and Windows.
- Code normalizes after sorting rather than before sorting and collision checks.

**Phase to address:**
Phase 3 — Public contract and shared policy, with target parity verified again in Phase 5.

---

### Pitfall 4: Partial Copy Presented as a Valid Candidate

**What goes wrong:**
One root, directory, or file fails to copy, but the operation continues, hashes what is present, and returns success or only a warning. The manifest is internally correct for an incomplete candidate and therefore falsely appears auditable.

**Why it happens:**
Best-effort file utilities commonly skip unreadable or disappearing entries. Existing source snapshot collection tolerates absent optional paths, while a release candidate requires complete inclusion of every allowed source file and both addon roots. Reusing the permissive behavior changes the meaning of success.

**How to avoid:**
Freeze an inclusion ledger before copying: every accepted source regular file must end in exactly one candidate entry, and every candidate entry must map to exactly one accepted source entry. Missing required roots, unreadable entries, copy failures, destination collisions, unexpected destination entries, and count/byte/hash mismatches are blockers. Never emit a manifest labeled complete after any copy blocker. Always clean the partial candidate.

Tests should force failure on the first, middle, and final file and assert `ok=false`, exact blocker codes, no completeness claim, and verified cleanup.

**Warning signs:**
- `catch { warnings.push(...) }` surrounds copy or read operations.
- Manifest length is never compared with the accepted-source ledger.
- Success is calculated only from metadata and secret blockers.
- Missing `game` or `content` roots produce an empty manifest.

**Phase to address:**
Phase 4 — Fixture/local candidate lifecycle.

---

### Pitfall 5: Nondeterministic or Host-Bound Manifest Identity

**What goes wrong:**
Repeated runs over identical bytes produce different manifests because entries inherit filesystem enumeration order, native separators, absolute paths, timestamps, temp names, modes, hostnames, locale-aware sorting, or target labels. Duplicate/case-colliding paths may overwrite or reorder each other.

**Why it happens:**
The existing source snapshot has deterministic sorted relative paths and SHA-256, but it also includes intentionally variable metadata such as generation time and commit identity. Copying that whole model into the candidate manifest would make target-independent candidate identity impossible.

**How to avoid:**
Define the deterministic manifest as only schema version plus normalized root kind/path, exact byte length, and lowercase SHA-256 for every copied regular file. Normalize before ordinal sorting. Keep candidate path, source path, timestamps, target, commands, logs, and cleanup facts in the enclosing operation result, outside manifest identity. Decide and test how the two roots are namespaced so identical relative paths cannot collide.

Run the same fixture twice under different temp parents and creation orders and require byte-for-byte equal manifest serialization. Feed a mocked remote payload with reversed enumeration and require the same normalized result.

**Warning signs:**
- The manifest contains `generatedAt`, candidate root, source root, drive letter, target name, or `mtime`.
- Code relies on `readdir` order or locale-sensitive sorting.
- Hashes cover source bytes but not assembled destination bytes.
- Fixture and remote schemas call different fields deterministic.

**Phase to address:**
Phase 3 for the identity contract; Phase 4 for deterministic fixture proof; Phase 5 for remote parity.

---

### Pitfall 6: Sensitive Values Leak Through Evidence or Operational Errors

**What goes wrong:**
The scanner correctly blocks a sensitive file but reproduces the matched value, source line, resolved link target, full private source path, remote stdout, exception message, or command argument in `evidence`, `warnings`, `paths`, `commands`, or `logs`. Cleanup failures can preserve the material on disk as well.

**Why it happens:**
The existing dry-run and install-simulation tests protect matched content, but the new operation adds candidate paths, hashes, remote JSON, PowerShell errors, and copy exceptions. `runRemoteCommand` preserves stdout/stderr, so a remote script that writes diagnostic file content can bypass the structured blocker redaction.

**How to avoid:**
Return only stable blocker code, category, field, and normalized candidate/source-relative path. Never return the match, line, contents, resolved external target, private host details, or raw exception text that can embed them. Remote scripts must write exactly one compact sanitized JSON payload to stdout and keep stderr sanitized. Sanitize the complete serialized `ToolResult`, not only blockers, with synthetic canary tests spanning evidence, warnings, paths, commands, logs, and errors.

Hashes are identifiers, not proof that evidence is safe; include hashes only for accepted candidate entries, not rejected sensitive files unless the requirements explicitly justify that disclosure.

**Warning signs:**
- Blockers include a `value`, `line`, `match`, or `resolvedTarget` property.
- Exceptions are copied verbatim into `ToolError.message`.
- PowerShell uses `Write-Host` or emits file content before JSON.
- Remote command evidence embeds user-controlled addon file contents.
- Tests inspect only `evidence.join()` rather than serializing the whole result.

**Phase to address:**
Phase 3 for evidence schema; Phase 4 for local canary tests; Phase 5 for remote stdout/stderr and command redaction tests.

---

### Pitfall 7: Cleanup Failure Is Hidden or Cleanup Is Skipped on Failure

**What goes wrong:**
The operation reports a valid candidate even though the temporary directory remains, or it skips cleanup after a blocker, copy exception, parse failure, or remote command error. `rm(..., force: true)` is treated as proof without checking absence. A failed candidate containing sensitive material persists on the target.

**Why it happens:**
Cleanup is often secondary to validation and can be lost when returns occur inside `try`. The current install simulation has a good `finally` pattern, but temp-root creation happens before its `try`, cleanup can be disabled, and cleanup exceptions are not independently modeled. Those semantics must not be copied unchanged into a mandatory temporary-candidate contract.

**How to avoid:**
Create a lifecycle state model: before temp creation `attempted=false`; after creation every exit path enters cleanup; cleanup removal is followed by an existence check; any residue or unverifiable removal sets `ok=false` with a cleanup-specific error that takes precedence over candidate validity while preserving earlier blockers. Catch and sanitize cleanup errors so a thrown cleanup does not prevent a result. Do not expose a cleanup-disable option in the MCP schema.

Tests must cover success, validation blockers, copy exceptions, hashing exceptions, result-building exceptions, forced removal failure, and remote malformed payload after remote temp creation. The remote script itself must clean in `finally`; the host parser cannot clean a remote path.

**Warning signs:**
- Multiple returns occur before the `finally` block.
- `cleanup.removed` is set from the return value of `rm` rather than an absence check.
- The public input accepts `cleanup: false` or a persistent destination.
- Remote cleanup is assumed because the SSH command exited.
- Cleanup failure is only a warning while `ok=true`.

**Phase to address:**
Phase 4 for lifecycle semantics and injected failure tests; Phase 5 for remote cleanup payload and transport-failure behavior.

---

### Pitfall 8: Local and Remote Implementations Drift Behind One Tool Name

**What goes wrong:**
Fixture/local and remote targets share `preflight_release_candidate` but disagree on required metadata, sensitive categories, file types, byte limits, path normalization, manifest ordering, blocker codes, cleanup precedence, or boundaries. A target change then changes whether the same addon is publish-ready.

**Why it happens:**
Node and generated PowerShell cannot share executable filesystem code. The existing remote dry-run implementation parses a loose payload with optional fields and duplicates behavior in a script, which makes semantic drift easy and malformed success payloads easy to accept.

**How to avoid:**
Define a versioned, strict shared payload and policy constants first. Generate safe PowerShell literals from shared constants where practical. Validate remote JSON structure and semantics, not only `JSON.parse`: schema version, required fields, normalized paths, hash format, blocker/cleanup consistency, and success invariants must all pass. A zero exit code with missing or invalid JSON is failure. Remote failure never falls back to fixture/local execution.

Use a target-neutral fixture matrix and assert equivalent normalized payloads for local execution and mocked remote output. Add explicit regression tests for every policy constant and stable error code.

**Warning signs:**
- PowerShell contains independent hard-coded metadata and regex lists.
- Remote parser uses `parsed.foo ?? defaultSuccessValue`.
- New local blockers have no remote test.
- A remote parse failure returns only generic success evidence.
- Documentation claims real Windows validation from mocked executor tests.

**Phase to address:**
Phase 3 for shared versioned contract; Phase 5 for remote implementation, strict parsing, and parity tests.

---

### Pitfall 9: Source Mutation by a Supposedly Read-Only Preflight

**What goes wrong:**
Candidate assembly writes metadata, normalizes files, generates compiled assets, changes permissions, touches timestamps, or creates staging directories inside `game/dota_addons/<addon>` or `content/dota_addons/<addon>`. Cleanup can then remove or overwrite source material if path isolation is wrong.

**Why it happens:**
Packaging workflows often prepare sources in place for convenience. Existing addon generation operations legitimately write source trees, so reusing them inside preflight would silently change the new operation's contract.

**How to avoid:**
The only permitted writes are under a newly created candidate temp root. Do not call addon generation, compiler, formatter, metadata repair, or existing write-oriented workflows. Snapshot source metadata/hash observations before and after injected test runs and assert unchanged source bytes and directory inventory on success and failure. Prove the temp root is outside both sources and neither source is inside the temp root before any copy or cleanup.

**Warning signs:**
- Preflight invokes `createAddon`, resource compiler, build scripts, or metadata-writing helpers.
- Destination arguments can be supplied by the caller.
- Tests verify candidate output but never verify source invariance.
- Cleanup calls `rm` using a path derived from a source path.

**Phase to address:**
Phase 4 — Fixture/local lifecycle, with boundary assertions repeated in Phase 5 for emitted remote commands.

---

### Pitfall 10: False Success from Incomplete Validation

**What goes wrong:**
`ok=true` means only that a command ran or a candidate was copied. Required metadata can still be missing, sensitive scanning can be skipped, manifest coverage can be incomplete, cleanup can be unverified, or a remote payload can be malformed. Launch success and command exit zero are confused with release readiness.

**Why it happens:**
The common `ToolResult` currently has no typed details for manifest, blockers, and cleanup. Evidence strings are convenient but cannot enforce consistency. Existing remote parsing accepts optional payload fields and defaults missing success evidence.

**How to avoid:**
Specify success invariants in the shared result contract: both roots assembled; required structure and metadata valid; no blockers; every included file represented exactly once; every SHA-256 valid; all required sensitive scans completed under explicit policy; cleanup attempted and verified removed; all immutable boundaries present; payload schema valid. Compute top-level success from these facts rather than trusting a remote `ok` boolean. Preserve structured details on both success and failure.

Add negative contract tests that remove one required fact at a time from local and mocked remote payloads. Each must fail with a stable error rather than default missing data.

**Warning signs:**
- `ok` is copied directly from remote JSON.
- Cleanup, blockers, or manifest exist only in prose evidence.
- Oversized text scanning creates a warning but success still claims sensitive-content validation.
- The operation reports a candidate path as usable after cleanup.
- Tests assert only `operation` and one evidence string.

**Phase to address:**
Phase 3 — Public schema and success invariants; enforced end-to-end in Phases 4 and 5.

---

### Pitfall 11: Oversized or Binary Files Create a Scan/Memory Trap

**What goes wrong:**
Large maps, compiled resources, media, or other binary assets are loaded entirely into memory, decoded as UTF-8, or silently omitted. Conversely, a large text-like configuration file exceeds the current one-megabyte scan limit, is only warned about, and the candidate is declared clean. Remote JSON can become huge if file contents or unbounded diagnostics are embedded.

**Why it happens:**
Dota addons legitimately contain binary assets, while current sensitive scanning is extension-based and intentionally skips non-text and oversized text. That policy is acceptable for a dry-run report but conflicts with a strict claim that the assembled candidate has passed sensitive-content validation.

**How to avoid:**
Separate inclusion from scanning. Every regular file is copied and hashed with streaming or bounded-memory I/O and appears in the manifest. Binary-classified files may be accepted without text decoding only under an explicit documented policy; evidence must say what validation occurred without claiming content scanning. Text-like files that cannot be fully scanned because of size or read failure must block v1.14 rather than warn. Define explicit maximum file/count/total-byte policies only if requirements need them; exceeding a limit must be a blocker, never silent truncation or sampling.

Test zero-byte, boundary-size, over-limit text, large binary, invalid UTF-8 text-like, unreadable, and large manifest cases. Remote payloads contain only metadata, hashes, categories, and safe relative paths.

**Warning signs:**
- `readFile()` is used for all hashing and scanning regardless of size.
- Non-text or oversized files disappear from the manifest.
- Warning text says a required scan was skipped while `ok=true`.
- Remote stdout grows with file contents rather than file count.

**Phase to address:**
Phase 3 for explicit inclusion/scan policy; Phase 4 for bounded-memory implementation and fixtures; Phase 5 for remote parity.

---

### Pitfall 12: Scope Creep Turns Preflight into Publishing

**What goes wrong:**
The operation begins retaining archives, invoking Workshop/Steam tooling, accepting credentials, generating upload configuration, signing/encrypting, compiling assets, or repairing metadata. It becomes externally mutating and impossible to validate safely with the selected macOS fixture gate.

**Why it happens:**
Once a candidate exists, upload and convenience fixes look like small adjacent additions. Existing `dry_run_release_report` and publishing language can also tempt implementers to extend an established tool rather than create the dedicated boundary selected by the user.

**How to avoid:**
Keep input limited to target and validated addon name. Register a dedicated operation; share only pure policy with the existing dry run. Return immutable boundary statements and test that generated local/remote commands contain no Steam login, Workshop mutation/upload, archive, signing, encryption, compiler, or credential-handling intent. Candidate retention, packaging, repair, and upload require later requirements and a new threat model.

**Warning signs:**
- Schema gains credentials, Workshop item ID, upload notes, archive path, retain flag, or signing options.
- Commands reference SteamCMD, Workshop APIs, resource compilation, ZIP/TAR, or credential stores.
- Candidate output is described as a persistent package.
- Existing dry-run behavior gains filesystem side effects.

**Phase to address:**
Phase 3 — Public contract and explicit boundaries; Phase 6 — integration/docs/audit confirms the boundary remains intact.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse opaque recursive copy after a pre-scan | Small implementation | TOCTOU and link escape; no exact inclusion ledger | Never for the release-candidate boundary |
| Put manifest/blockers/cleanup only in evidence strings | Avoids extending `ToolResult` | Callers parse prose; false success cannot be rejected structurally | Never for this operation |
| Maintain separate Node and PowerShell policy literals | Fast remote implementation | Target-dependent readiness decisions and error codes | Never; generate or parity-test shared policy |
| Treat skipped text scans as warnings | Keeps large fixtures green | “Sensitive-content validated” becomes false | Never for required text-like scans |
| Hash sources rather than copied candidate | Avoids second read | Manifest does not identify the assembled artifact | Never |
| Keep failed candidates for debugging | Easier manual inspection | Sensitive residue and broken temporary contract | Never in v1.14 |
| Add retry/rescan after source change | May overcome transient errors | Candidate can combine multiple source states and hides races | Never; fail explicitly |
| Read all assets into memory | Simpler code | Memory spikes on legitimate addon binaries | Only tiny test fixtures, never production path |
| Reuse `dry_run_release_report` as orchestrator | Shares existing checks quickly | Changes its no-copy contract and flattens structured blockers | Never; share pure policy only |
| Mock remote Windows and call it runtime validation | No Windows host needed | Misleading completion evidence | Contract parity only; explicitly label it |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MCP registration | Add dispatcher logic but omit schema/server/tool-list/docs entries | Add the dedicated operation through schema, registration, dispatcher, examples, and drift tests as one contract change |
| `ToolResult` builders | Drop operation-specific details on failure | Add backward-compatible structured details and preserve them in both success and failure builders |
| Existing dry-run policy | Call the `ToolResult`-returning dry run from candidate assembly | Extract pure metadata/sensitive policy; preserve old operation behavior |
| Fixture/local routing | Give fixture a simplified fake implementation | Run fixture and local through the same Node lifecycle with injected roots/seams |
| Remote executor | Assume exit code zero means semantic success | Strictly parse and validate versioned sanitized JSON; reject missing/inconsistent fields |
| SSH/PowerShell logs | Preserve arbitrary stdout/stderr from a script that can echo contents | Make the script emit one sanitized JSON payload and sanitize operational errors |
| Windows filesystem | Check only symbolic-link type | Reject all relevant reparse-point/junction entries and verify target-native containment |
| Source snapshot helper | Copy the whole manifest model including generated time and Git data | Reuse normalized sorting/hash concepts only; candidate identity excludes host/time/source state |
| Install simulation helper | Copy its optional cleanup and recursive `cp` semantics | Reuse isolation and verified-finally patterns, then strengthen copy and mandatory-cleanup semantics |
| Docs/examples | Advertise the returned path as an artifact | State that the path is audit evidence for a directory that has been verified removed |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Whole-file reads for hashing | High memory, slow GC, remote timeouts | Stream SHA-256 and bounded text scanning | A single map/media asset approaches process memory limits or many files hash concurrently |
| Unbounded parallel copy/hash | Descriptor exhaustion, disk thrash, nondeterministic error order | Use sequential traversal initially or explicitly bounded concurrency with stable reporting | Addons with hundreds/thousands of files or slow remote disks |
| Repeated full-tree passes | Long preflight duration and larger race window | Keep correctness-first explicit traversal; if optimized, hash during copy then verify destination without weakening checks | Large addon trees where scan + copy + destination re-read dominates runtime |
| Manifest contents in remote stdout | Transport truncation and parse failures | Compact JSON with path/bytes/hash only; never file contents | Thousands of entries or verbose per-file diagnostics |
| Locale-aware path sorting | Different output and expensive collation | Normalize then use documented ordinal comparison | Cross-host parity and case/non-ASCII path sets |
| Silent manifest truncation | Fast response but incomplete audit | Set explicit blocking limits if needed; never omit entries | Payload approaches transport/output limits |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Following links/reparse points | Imports data outside addon roots | Reject before read/copy, revalidate at use, and return only safe relative paths |
| String-prefix containment | Candidate or source escape via sibling/mixed path forms | Use canonical target-native relative containment and case-collision tests |
| Logging matched values or external targets | Leaks credentials/private host data | Return category/code/field/safe path only; serialize-canary test the whole result |
| Leaving a failed candidate | Sensitive or invalid bytes persist | Mandatory verified cleanup in every post-creation outcome |
| Source mutation | Damages working addon or masks missing metadata | Writes only under isolated temp root; assert source inventory/hashes unchanged |
| Blind remote payload trust | Forged/incomplete success or policy drift | Versioned schema and recomputed success invariants |
| Skipping oversized text scans | Sensitive values can pass while operation claims clean | Block unscannable required text-like files |
| Accepting caller-controlled temp destinations | Cleanup can target unsafe locations | Keep temp placement internal and prove isolation before writes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Calling the removed temp directory a deliverable | User tries to upload a path that no longer exists | Describe manifest/evidence as output and path as verified-removed lifecycle evidence |
| Mixing blockers and warnings | User cannot tell whether release readiness passed | Stable structured blocker codes; warnings only for facts that do not invalidate required checks |
| Reporting only the first failure | Repeated fix/run cycles | Collect safe independent policy blockers while still failing immediately on unsafe traversal/copy conditions |
| Generic “preflight failed” errors | Cannot distinguish metadata, isolation, copy, scan, parse, or cleanup failures | Stable error code plus safe relative path/category and lifecycle state |
| Claiming Windows validation from mocks | Overstates confidence | Say fixture gate passed and local/remote contract parity was tested; reserve runtime claims for real evidence |
| Hiding cleanup precedence | User sees valid manifest and assumes success despite residue | Cleanup failure forces `ok=false` and is prominent while preserving earlier validation facts |

## "Looks Done But Isn't" Checklist

- [ ] **Dedicated MCP surface:** Schema, server registration, dispatcher, tool list, structured content, docs, and fixture example all expose the same operation.
- [ ] **Exact candidate coverage:** Both `game/dota_addons/<addon>` and `content/dota_addons/<addon>` exist, every accepted regular file is copied exactly once, and no unexpected destination entry exists.
- [ ] **Destination identity:** SHA-256 and byte counts cover copied candidate bytes, not only source bytes.
- [ ] **Determinism:** Different temp parents, source creation order, and mocked remote enumeration yield byte-for-byte identical manifest identity.
- [ ] **TOCTOU resistance:** Mutation between inspection and copy fails explicitly; it never produces a mixed-state success.
- [ ] **Link safety:** Nested symlinks and Windows reparse/junction cases are blocked before reading or copying their targets.
- [ ] **Path safety:** Sibling prefixes, traversal, drive/UNC forms, mixed separators, case collisions, and candidate/source nesting are rejected or normalized by contract.
- [ ] **Sensitive evidence:** Synthetic canary values and external link targets are absent from the fully serialized result, including commands and logs.
- [ ] **Large-file policy:** Binary files remain included and hashed; unscannable required text-like files block instead of disappearing or warning into success.
- [ ] **Source invariance:** Source inventories, bytes, and environment remain unchanged after success and every injected failure.
- [ ] **Mandatory cleanup:** Success, blockers, exceptions, parse failures, and forced removal failures all have truthful cleanup state; residue forces failure.
- [ ] **Remote parity:** Versioned mocked PowerShell payloads match local blocker codes, path format, ordering, hash format, boundaries, and cleanup precedence.
- [ ] **No silent fallback:** Remote execution or parse failure cannot invoke fixture/local assembly.
- [ ] **No publishing creep:** No login, Workshop mutation/upload, archive, signing, encryption, credentials, compilation, persistent candidate, or metadata repair is accepted or invoked.
- [ ] **Evidence claim:** macOS fixtures are described as the completion gate; no real Windows result is claimed without real sanitized Windows evidence.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| TOCTOU or partial-copy bug found before release | MEDIUM | Disable success path, add injected filesystem seam and mutation fixtures, implement per-entry revalidation and exact inclusion ledger, regenerate manifests |
| Symlink/reparse escape with possible exposure | HIGH | Stop operation use, remove all known candidates, rotate any potentially exposed credentials outside the repo workflow, replace recursive copy, add nested platform cases, review logs for leakage |
| Nondeterministic manifest | MEDIUM | Version the corrected manifest schema, remove host/time fields from identity, normalize before ordinal sort, add cross-target golden fixtures |
| Sensitive value leaked in result | HIGH | Stop emitting affected evidence, remove/sanitize stored artifacts and logs, rotate affected external credentials, add whole-result canary tests, narrow error serialization |
| Cleanup residue | MEDIUM | Fail the operation, perform addon-scoped manual removal only after path verification, add cleanup-failure state and injected removal tests; do not broaden cleanup paths |
| Local/remote policy drift | MEDIUM | Freeze one semantic fixture matrix, consolidate constants/script generation, reject old/incomplete payload versions, rerun parity tests |
| Source mutation | HIGH | Stop preflight, compare with version control or backups, restore only verified source files, isolate all writes, add before/after source hashes |
| Scope creep merged into dry run | MEDIUM | Revert side effects from the existing contract, extract pure shared policy, register the dedicated operation, update docs and drift tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| False success / weak structured contract | Phase 3: Contract and shared policy | Remove each required payload fact in turn; local and remote normalization must fail with stable codes |
| Path normalization and containment | Phase 3, enforced in Phases 4-5 | Shared path-case matrix covers traversal, sibling prefixes, separators, case collisions, drive/UNC, and manifest-relative rules |
| Deterministic manifest identity | Phase 3, proven in Phase 4 | Same bytes under shuffled creation order and different temp parents serialize identically |
| Sensitive evidence model | Phase 3, proven in Phases 4-5 | Whole-result canary assertions cover blockers, errors, paths, commands, stdout/stderr, and logs |
| Oversized/binary inclusion and scanning policy | Phase 3, implemented in Phase 4 | Boundary-size text and large binary fixtures prove exact inclusion and fail-closed scan behavior |
| TOCTOU | Phase 4: Fixture/local lifecycle | Inject replacement/deletion/link mutation at copy boundary; all fail and clean up |
| Symlink and non-regular escape | Phase 4, remote extension in Phase 5 | Nested link/device fixtures plus mocked junction/reparse cases return equivalent blocker category |
| Partial copy | Phase 4 | Fail copy at first/middle/last file; no completeness claim and cleanup verified |
| Source mutation | Phase 4 | Compare source inventory and content hashes before/after every success/failure fixture |
| Cleanup failure | Phase 4, remote extension in Phase 5 | Inject remove failure and verify residue forces `ok=false`; remote payload cannot claim removal without required state |
| Local/remote drift | Phase 5: Remote parity and MCP integration | One semantic fixture matrix validates local result and strict mocked PowerShell payloads |
| Remote false success and silent fallback | Phase 5 | Zero exit with malformed/incomplete JSON fails; executor failure never calls local implementation |
| Public surface/docs drift | Phase 6: Integration, examples, and independent audit | Tool-list/example/schema drift tests and end-to-end fixture call pass |
| Scope creep | Phase 3 and Phase 6 | Schema and command assertions exclude credentials, upload, archive, signing, encryption, compile, retention, and repair behavior |

## Recommended Roadmap Emphasis

The roadmap should not start with remote PowerShell or documentation. The public payload, success invariants, path model, manifest identity, scan policy, and immutable boundaries must be frozen first. The fixture/local lifecycle should then prove exact-copy and mandatory-cleanup behavior with injected failures. Only after those invariants pass should the remote adapter duplicate target-native filesystem behavior behind strict versioned parsing. A final integration/audit phase should verify MCP/docs drift and explicitly review the generated remote command for publishing creep and sensitive-output leaks.

## Sources

- Repository `.planning/PROJECT.md` — v1.14 goals, explicit boundaries, fixture completion gate, and no-silent-fallback constraint (HIGH confidence).
- Repository `.planning/research/STACK.md` — standard-library traversal/hash/cleanup choices, binary-scan open question, and target stack constraints (HIGH confidence).
- Repository `.planning/research/ARCHITECTURE.md` — dedicated-operation boundary, versioned payload, fail-closed workspace, target-native execution, and recommended build order (HIGH confidence).
- Repository `src/install-simulation.ts` and `tests/install-simulation.test.ts` — current canonical containment, recursive link checks, isolated temp root, sensitive-value redaction, and verified cleanup patterns; also shows why pre-scan plus recursive copy and optional cleanup must be strengthened (HIGH confidence).
- Repository `src/source-snapshot.ts` and `tests/source-snapshot.test.ts` — current relative-path sorting, SHA-256 coverage, source-only scanning, and deterministic fixture patterns (HIGH confidence).
- Repository `src/preflight.ts` and `tests/preflight.test.ts` — current metadata rules, extension/size-based sensitive scanning, warning behavior for skipped files, and dry-run evidence contract (HIGH confidence).
- Repository `src/remote.ts` and `tests/remote-operations.test.ts` — current PowerShell adapter, command evidence, loose JSON parsing, and remote dry-run contract seam (HIGH confidence).
- Repository `src/types.ts`, `src/result.ts`, `src/tools.ts`, `src/schemas.ts`, and `src/server.ts` — common `ToolResult`, registration/dispatch seams, and current absence of typed operation details (HIGH confidence).
- [Node.js 20 File system documentation](https://nodejs.org/docs/latest-v20.x/api/fs.html) — `lstat`, `realpath`, `readdir`, `copyFile`, `mkdtemp`, and `rm` behavior (official reference already cross-checked in stack research; MEDIUM confidence for platform-specific behavior until Windows tests).
- [Microsoft file attribute constants documentation](https://learn.microsoft.com/windows/win32/fileio/file-attribute-constants) — reparse-point file attribute semantics relevant to junction rejection (official reference; MEDIUM confidence until implemented and tested through the project's PowerShell adapter).

---
*Pitfalls research for: v1.14 Workshop Addon Release Candidate Preflight*
*Researched: 2026-07-15*

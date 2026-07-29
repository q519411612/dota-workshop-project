# Operator Runbook

This runbook is the safe handoff path for using the Dota Workshop Tools plugin from this repository. It assumes the plugin source has been cloned locally and does not require Dota 2 for fixture checks.

## Local Readiness

Run these before using or handing off the plugin:

```bash
npm install
npm run build
npm run verify:plugin
npm run verify:install-simulation
npm run verify:rc
npm run verify:handoff
npm run verify:milestone
npm test
```

`npm run verify:plugin` checks the plugin manifest, MCP config, package entrypoint, built server entrypoint, skill references, and documented MCP tool lists.

`npm run verify:install-simulation` creates an isolated temporary plugin layout, validates the install-facing manifest, skill, MCP config, package entrypoint, and built dist entrypoint, then removes the temporary layout. It does not perform a global install, write user config, mutate environment variables, upload, sign, encrypt, publish, or contact Windows targets.

`npm run verify:rc` is the local release-candidate gate. It runs plugin readiness, schema/example validation, typecheck, tests, build, repository hygiene scanning, and publishing boundary checks. It is not upload automation and does not log into Steam, upload to Workshop, encrypt content, sign packages, run Windows smoke, or contact remote targets.

`npm run verify:handoff` is the local release handoff gate. It reuses `verify:rc`, records the current commit, checks the plugin manifest, MCP config, package entrypoints, skill references, workflow examples, README, and this runbook, and reports explicit release boundaries. It does not upload to Workshop, log into Steam, handle Steam Guard, encrypt content, sign packages, store credentials, or connect to remote Windows.

`npm run verify:milestone` is the local milestone closeout gate for release notes review. It reuses `verify:handoff`, summarizes v1.2-v1.7 goals, commit SHAs, delivery summaries, verification status, documentation status, release boundaries, and remaining non-blocking items. It does not upload to Workshop, log into Steam, handle Steam Guard, encrypt content, sign packages, store credentials, connect to remote Windows, or require Dota 2, Steam, Workshop Tools, Windows, network access, or remote target credentials.

Keep machine-specific target details runtime-only. Do not store Steam account secrets, GitHub tokens, Windows passwords, private keys, remote host details, or private target data in repository files.

## Fixture Workflow

Use fixture targets for local dry checks that do not need Dota 2 or Windows:

1. Run `npm run build`.
2. Use `examples/workflows/fixture-create-addon.json` with `create_addon`.
3. Use `examples/workflows/fixture-preflight.json` with `inspect_workshop_preflight`.
4. Use `examples/workflows/fixture-release-dry-run.json` with `dry_run_release_report`.
5. Use `examples/workflows/fixture-release-candidate-preflight.json` with `preflight_release_candidate`.
6. Use `examples/workflows/fixture-release-candidate-export.json` only with a new isolated export root and absent destination.
7. Use `examples/workflows/fixture-exported-candidate-cleanup.json` in dry-run mode before any execute cleanup.

Fixture workflows are useful for checking generated file layout, metadata blockers, publishing boundaries, and sensitive information scanning. They do not prove runtime behavior.

## Optional Remote Smoke

Use `examples/workflows/remote-playable-smoke.template.json` only as a template. Replace placeholder target values at runtime through your MCP client or shell environment, not by committing private machine details.

Recommended order:

1. Build locally with `npm run build`.
2. Verify the plugin with `npm run verify:plugin`, `npm run verify:install-simulation`, `npm run verify:rc`, `npm run verify:handoff`, and `npm run verify:milestone`.
3. Discover or validate the Windows target outside repository files.
4. Run `run_playable_smoke` with `launchMode: "interactiveTask"` when the remote command session is not the logged-in desktop session.
5. Review the transcript for create, inspect, launch, and marker validation results.

Process launch is not validation success. Runtime success requires expected marker evidence from readable Dota console or log output.

## Cleanup

Cleanup must be explicit and addon-scoped.

1. Run `cleanup_playable_smoke` with `dryRun: true` for the known smoke addon name.
2. Confirm every matched process command line belongs to that addon.
3. Run `cleanup_playable_smoke` with `dryRun: false` only for confirmed matches.

The cleanup workflow does not stop Steam, does not delete generated addon files, and does not target unrelated Dota processes.

## Preflight and Release Review

Use `inspect_workshop_preflight` to inspect addon layout, Panorama boundaries, toolchain markers, and publishing blockers.

Use `dry_run_release_report` for release/package review after addon files exist. It checks package candidate files, publish-facing metadata, and obvious sensitive material.

These checks are dry-run review steps. They do not create archives, sign packages, encrypt content, authenticate accounts, mutate Workshop state, or upload to Workshop.

## Release Candidate Evidence

Call `preflight_release_candidate` with only `target` and `addonName` when the source addon trees are already complete. Fixture and local targets run the production Node lifecycle. SSH and PowerShell Remoting run one target-native lifecycle; remote failure is final and never falls back locally.

Read the structured result in this order:

1. `artifactValidation` and `blockers` describe the source/candidate evidence that was strictly proven.
2. `manifest`, `inclusionLedger`, and `scanCoverage` must be complete and internally consistent for artifact success.
3. `cleanup` must show exactly one attempt, identity match, removal, and verified absence for overall success.
4. `boundaries` must retain every prohibited-operation statement.

The manifest plus verified cleanup proof is the deliverable; no candidate remains to upload. Do not describe a deleted candidate path as upload-ready. The two-root layout is not an official Valve upload payload.

Fixture, local-adapter, mocked SSH, and mocked PowerShell results are contract evidence. This evidence does not prove real Windows reparse, canonicalization, transport, or cleanup behavior. Real Windows evidence is optional supporting evidence, not the v1.14 completion gate.

Remote authorization is external runtime configuration. `preflight_release_candidate` never accepts, loads, stores, prompts for, or synthesizes credentials. It does not log into Steam, create or modify Workshop items, upload, create persistent archives, sign, encrypt, launch Dota, validate runtime behavior, compile or convert addon source, repair metadata, retain candidates, or transfer addon files.

## Retained Candidate Handoff

`export_release_candidate` is separate from temporary preflight. It requires `target`, `addonName`, `exportRoot`, and `destination`. The export root must already exist on the target, and the destination must be an absent direct child. Existing targets, protected roots, repository paths, Dota paths, path escape, symbolic links, junctions, reparse points, case-fold collisions, and unknown entry types are blockers.

Success retains the candidate and creates a versioned sibling handoff manifest. Record the returned destination, ownership identifier, manifest version, complete topology, and combined SHA-256 together. They are audit evidence for later cleanup, not remote credentials.

Run `cleanup_exported_candidate` with `dryRun: true`. Proceed to execute mode only when the result says authorization passed. Windows authorization requires one no-follow handoff handle that binds the bytes read to the captured file identity and remains leased through candidate mutation; lease failure stops before mutation. Execute mode revalidates the complete parent-closed topology and object identities, removes the candidate before the handoff, and restores an intact tombstone when removal fails. When restoration cannot be proven, the failure result preserves the manifest, ownership, canonical paths, tombstone path, and explicit `present`, `tombstoned`, `absent`, or `unknown` states. Do not retry with wider paths or altered evidence. Remote transport uncertainty still means both object states are unknown and automatic retry is prohibited.

Remote candidates stay on the target Windows machine. The operations do not download, archive, compress, sign, encrypt, upload, or claim official Valve upload compatibility. Mocked target results are contract evidence and do not prove real Windows reparse, canonicalization, promotion, or cleanup behavior.

## Troubleshooting

- If plugin readiness fails, fix the reported blocker and rerun `npm run verify:plugin`.
- If remote discovery fails, fix the runtime target configuration outside the repository.
- If launch succeeds but markers are missing, inspect logs before claiming validation.
- If a repeat smoke is blocked by a stale process, use explicit dry-run cleanup for the known addon name.

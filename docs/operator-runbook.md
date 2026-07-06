# Operator Runbook

This runbook is the safe handoff path for using the Dota Workshop Tools plugin from this repository. It assumes the plugin source has been cloned locally and does not require Dota 2 for fixture checks.

## Local Readiness

Run these before using or handing off the plugin:

```bash
npm install
npm run build
npm run verify:plugin
npm run verify:rc
npm test
```

`npm run verify:plugin` checks the plugin manifest, MCP config, package entrypoint, built server entrypoint, skill references, and documented MCP tool lists.

`npm run verify:rc` is the local release-candidate gate. It runs plugin readiness, schema/example validation, typecheck, tests, build, repository hygiene scanning, and publishing boundary checks. It is not upload automation and does not log into Steam, upload to Workshop, encrypt content, sign packages, run Windows smoke, or contact remote targets.

Keep machine-specific target details runtime-only. Do not store Steam account secrets, GitHub tokens, Windows passwords, private keys, remote host details, or private target data in repository files.

## Fixture Workflow

Use fixture targets for local dry checks that do not need Dota 2 or Windows:

1. Run `npm run build`.
2. Use `examples/workflows/fixture-create-addon.json` with `create_addon`.
3. Use `examples/workflows/fixture-preflight.json` with `inspect_workshop_preflight`.
4. Use `examples/workflows/fixture-release-dry-run.json` with `dry_run_release_report`.

Fixture workflows are useful for checking generated file layout, metadata blockers, publishing boundaries, and sensitive information scanning. They do not prove runtime behavior.

## Optional Remote Smoke

Use `examples/workflows/remote-playable-smoke.template.json` only as a template. Replace placeholder target values at runtime through your MCP client or shell environment, not by committing private machine details.

Recommended order:

1. Build locally with `npm run build`.
2. Verify the plugin with `npm run verify:plugin` and `npm run verify:rc`.
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

## Troubleshooting

- If plugin readiness fails, fix the reported blocker and rerun `npm run verify:plugin`.
- If remote discovery fails, fix the runtime target configuration outside the repository.
- If launch succeeds but markers are missing, inspect logs before claiming validation.
- If a repeat smoke is blocked by a stale process, use explicit dry-run cleanup for the known addon name.

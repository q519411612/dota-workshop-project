# Phase 6 Research: Safe Retained Candidate Export

## Reuse Map

- Extract or wrap v1.14 pure policy authorities instead of copying the 2,000-line lifecycle.
- Keep temporary preflight orchestration untouched; introduce export-specific orchestration around shared inventory, observation, materialization, manifest, and scan functions.
- Use `fsPromises.mkdtemp` under the canonical export root, exclusive writes, opened-handle hashing, `fsPromises.rename`, and post-rename `realpath`/identity checks.
- Derive the handoff path as `<destination>.dota-workshop-handoff.v1.json`; create its temporary form exclusively under the export root and rename it only after candidate promotion and final verification.
- Use a UUID ownership identifier plus canonical destination identity. The identifier is evidence, not a secret.

## Failure Precedence

1. Input and isolation failure: no created state, cleanup `not-reached`.
2. Staging failure: validate and remove only owned staging/temp-manifest state.
3. Promotion failure before destination appears: clean owned staging.
4. Ambiguous promotion or post-promotion failure: report destination state explicitly; never recursively delete it as fallback cleanup.
5. Handoff publication failure after proven candidate promotion: overall failure with retained-candidate state reported and no destructive rollback.

## Key Risk

The export lifecycle must not call the public temporary preflight and then copy from its deleted path. Shared lower-level authorities are required so preflight and export remain separate lifecycle compositions over the same validation policy.


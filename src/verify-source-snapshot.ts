#!/usr/bin/env node
import { generateSourceSnapshotManifest } from "./source-snapshot.js";

async function main() {
  const result = await generateSourceSnapshotManifest({
    verification: [
      { command: "npm run verify:source-snapshot", ok: true }
    ]
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  createHarnessReadySameMachineSmokeArtifact,
  verifySameMachineSmokeEvidence
} from "./same-machine-smoke.js";

async function main() {
  const artifactPath = process.argv[2];
  const artifact = artifactPath
    ? JSON.parse(await readFile(artifactPath, "utf8")) as unknown
    : createHarnessReadySameMachineSmokeArtifact();
  const result = verifySameMachineSmokeEvidence(artifact);

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

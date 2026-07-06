#!/usr/bin/env node
import { verifyReleaseCandidate } from "./rc.js";

const result = await verifyReleaseCandidate({ root: process.cwd() });

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}

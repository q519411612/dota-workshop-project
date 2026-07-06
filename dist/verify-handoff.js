#!/usr/bin/env node
import { verifyReleaseHandoff } from "./handoff.js";
const result = await verifyReleaseHandoff({ root: process.cwd() });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
    process.exitCode = 1;
}

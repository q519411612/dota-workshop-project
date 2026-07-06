#!/usr/bin/env node
import { simulateLocalInstall } from "./install-simulation.js";
async function main() {
    const result = await simulateLocalInstall({ root: process.cwd() });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
        process.exitCode = 1;
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

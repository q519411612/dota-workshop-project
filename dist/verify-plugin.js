#!/usr/bin/env node
import { verifyPluginPackage } from "./plugin.js";
const result = await verifyPluginPackage({ root: process.cwd() });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
    process.exitCode = 1;
}

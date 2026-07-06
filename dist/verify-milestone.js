#!/usr/bin/env node
import { verifyMilestoneCloseout } from "./milestone.js";
const result = await verifyMilestoneCloseout({ root: process.cwd() });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
    process.exitCode = 1;
}

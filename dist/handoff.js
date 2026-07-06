import { spawn } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { verifyReleaseCandidate } from "./rc.js";
const COMMIT_COMMAND = "git rev-parse HEAD";
const REQUIRED_EXAMPLES = [
    "fixture-create-addon.json",
    "fixture-preflight.json",
    "fixture-release-dry-run.json",
    "remote-playable-smoke.template.json"
];
const BOUNDARIES = [
    {
        label: "no real Workshop upload",
        ok: true,
        evidence: "Handoff readiness only reports boundaries and delegates unsafe automation detection to verify:rc."
    },
    {
        label: "no Steam login",
        ok: true,
        evidence: "The handoff command performs local file, git, and RC checks only."
    },
    {
        label: "no Steam Guard handling",
        ok: true,
        evidence: "The handoff command has no account or authentication workflow."
    },
    {
        label: "no content encryption",
        ok: true,
        evidence: "The handoff command does not build, transform, encrypt, or package addon content."
    },
    {
        label: "no package signing",
        ok: true,
        evidence: "The handoff command does not create or sign distribution packages."
    },
    {
        label: "no credential or private target storage",
        ok: true,
        evidence: "The handoff report uses repository-relative paths and RC blocker labels without secret values."
    },
    {
        label: "no remote Windows connection",
        ok: true,
        evidence: "The handoff command does not use SSH, PowerShell Remoting, or MCP target operations."
    }
];
const REQUIRED_README_COVERAGE = [
    "npm run build",
    "npm run verify:plugin",
    "npm run verify:rc",
    "npm run verify:handoff",
    "docs/operator-runbook.md",
    "local-only"
];
const REQUIRED_RUNBOOK_COVERAGE = [
    "npm install",
    "npm run build",
    "npm run verify:plugin",
    "npm run verify:rc",
    "npm run verify:handoff",
    "Fixture Workflow",
    "Optional Remote Smoke",
    "Cleanup",
    "credentials",
    "private target"
];
export async function verifyReleaseHandoff(input = {}) {
    const root = input.root ?? process.cwd();
    const releaseCandidateVerifier = input.releaseCandidateVerifier ?? ((args) => verifyReleaseCandidate(args));
    const commandRunner = input.commandRunner ?? runShellCommand;
    const evidence = [];
    const warnings = [];
    const blockers = [];
    const commitResult = await commandRunner(COMMIT_COMMAND, { cwd: root });
    const commitSha = commitResult.exitCode === 0 ? commitResult.stdout.trim() : "";
    if (commitSha) {
        evidence.push(`handoff commit resolved: ${commitSha}`);
    }
    else {
        blockers.push({
            code: "HANDOFF_COMMIT_UNAVAILABLE",
            message: "Unable to resolve current commit SHA.",
            command: COMMIT_COMMAND
        });
    }
    const releaseCandidate = await releaseCandidateVerifier({ root });
    if (releaseCandidate.ok) {
        evidence.push("handoff RC preflight passed");
    }
    else {
        blockers.push(...releaseCandidate.blockers.map((blocker) => copyRcBlocker(blocker, root)));
    }
    warnings.push(...releaseCandidate.warnings.map((warning) => sanitizeText(warning, root)));
    const delivery = await buildDeliveryChecklist(root, blockers);
    const docBlockers = await checkDocumentationCoverage(root);
    blockers.push(...docBlockers);
    if (docBlockers.length === 0) {
        evidence.push("handoff documentation coverage passed");
    }
    const boundaries = {
        ok: BOUNDARIES.every((item) => item.ok),
        items: BOUNDARIES
    };
    evidence.push("handoff release boundaries recorded");
    return {
        ok: blockers.length === 0,
        commit: {
            sha: commitSha,
            command: COMMIT_COMMAND
        },
        verification: {
            releaseCandidate: {
                ok: releaseCandidate.ok,
                commands: releaseCandidate.commands.map((command) => sanitizeCommandResult(command, root)),
                blockers: releaseCandidate.blockers.map((blocker) => copyRcBlocker(blocker, root))
            }
        },
        delivery: {
            ok: delivery.every((item) => item.ok),
            items: delivery
        },
        boundaries,
        evidence,
        warnings,
        blockers,
        paths: {
            pluginManifest: ".codex-plugin/plugin.json",
            mcpConfig: ".mcp.json",
            packageJson: "package.json",
            readme: "README.md",
            operatorRunbook: "docs/operator-runbook.md",
            skill: "skills/dota2-workshop-tools/SKILL.md",
            examples: "examples/workflows"
        }
    };
}
async function buildDeliveryChecklist(root, blockers) {
    const items = [];
    const packageJsonPath = "package.json";
    const packageJson = await readPackageJson(root, packageJsonPath, blockers);
    items.push(await requiredFileItem(root, ".codex-plugin/plugin.json", "plugin manifest", blockers));
    items.push(await requiredFileItem(root, ".mcp.json", "MCP config", blockers));
    items.push(await requiredFileItem(root, packageJsonPath, "package JSON", blockers));
    items.push(await requiredFileItem(root, "dist/index.js", "built MCP server entrypoint", blockers));
    items.push(scriptItem(packageJson, packageJsonPath, "package bin", "bin.dota-workshop-mcp", "./dist/index.js", blockers));
    items.push(scriptItem(packageJson, packageJsonPath, "verify:plugin script", "scripts.verify:plugin", "node ./dist/verify-plugin.js", blockers));
    items.push(scriptItem(packageJson, packageJsonPath, "verify:rc script", "scripts.verify:rc", "node ./dist/verify-rc.js", blockers));
    items.push(scriptItem(packageJson, packageJsonPath, "verify:handoff script", "scripts.verify:handoff", "node ./dist/verify-handoff.js", blockers));
    items.push(await requiredFileItem(root, "skills/dota2-workshop-tools/SKILL.md", "skill file", blockers));
    items.push(await skillReferenceItem(root, blockers));
    items.push(await requiredFileItem(root, "README.md", "README", blockers));
    items.push(await requiredFileItem(root, "docs/operator-runbook.md", "operator runbook", blockers));
    items.push(await workflowExamplesItem(root, blockers));
    return items;
}
async function readPackageJson(root, relPath, blockers) {
    try {
        const content = await readFile(join(root, relPath), "utf8");
        return JSON.parse(content);
    }
    catch {
        blockers.push({
            code: "HANDOFF_PACKAGE_JSON_INVALID",
            message: "package.json is missing or invalid JSON.",
            file: relPath
        });
        return undefined;
    }
}
async function requiredFileItem(root, relPath, label, blockers) {
    try {
        await access(join(root, relPath));
        return {
            label,
            path: relPath,
            ok: true,
            evidence: [`${relPath} exists`]
        };
    }
    catch {
        blockers.push({
            code: "HANDOFF_REQUIRED_FILE_MISSING",
            message: `Required handoff file is missing: ${relPath}`,
            file: relPath
        });
        return {
            label,
            path: relPath,
            ok: false,
            evidence: [`${relPath} is missing`]
        };
    }
}
function scriptItem(packageJson, relPath, label, selector, expected, blockers) {
    const actual = readPackageSelector(packageJson, selector);
    const ok = actual === expected;
    if (!ok) {
        blockers.push({
            code: "HANDOFF_PACKAGE_ENTRY_INVALID",
            message: `${selector} must be ${expected}.`,
            file: relPath
        });
    }
    return {
        label,
        path: relPath,
        ok,
        evidence: ok ? [`${selector} is ${expected}`] : [`${selector} is ${actual || "(missing)"}`]
    };
}
async function skillReferenceItem(root, blockers) {
    const skillPath = "skills/dota2-workshop-tools/SKILL.md";
    let content = "";
    try {
        content = await readFile(join(root, skillPath), "utf8");
    }
    catch {
        return {
            label: "skill references",
            path: skillPath,
            ok: false,
            evidence: ["skill file is missing"]
        };
    }
    const references = [...new Set([...content.matchAll(/`(references\/[^`]+\.md)`/g)].map((match) => match[1]))];
    const missing = [];
    for (const reference of references) {
        const normalized = normalize(reference);
        const relPath = toPosix(join("skills/dota2-workshop-tools", normalized));
        try {
            await access(join(root, relPath));
        }
        catch {
            missing.push(relPath);
            blockers.push({
                code: "HANDOFF_SKILL_REFERENCE_MISSING",
                message: `Skill reference is missing: ${reference}`,
                file: relPath
            });
        }
    }
    return {
        label: "skill references",
        path: "skills/dota2-workshop-tools/references",
        ok: missing.length === 0,
        evidence: missing.length === 0 ? [`skill references found: ${references.length}`] : missing.map((path) => `${path} is missing`)
    };
}
async function workflowExamplesItem(root, blockers) {
    const examplesPath = "examples/workflows";
    let names = [];
    try {
        names = (await readdir(join(root, examplesPath))).filter((name) => name.endsWith(".json")).sort();
    }
    catch {
        blockers.push({
            code: "HANDOFF_EXAMPLES_MISSING",
            message: "Workflow examples directory is missing.",
            file: examplesPath
        });
    }
    const missing = REQUIRED_EXAMPLES.filter((name) => !names.includes(name));
    for (const name of missing) {
        blockers.push({
            code: "HANDOFF_EXAMPLE_MISSING",
            message: `Required workflow example is missing: ${name}`,
            file: `${examplesPath}/${name}`
        });
    }
    return {
        label: "workflow examples",
        path: examplesPath,
        ok: missing.length === 0 && names.length > 0,
        evidence: missing.length === 0 ? [`workflow examples found: ${names.length}`] : missing.map((name) => `${name} is missing`)
    };
}
async function checkDocumentationCoverage(root) {
    const blockers = [];
    await checkCoverageFile(root, "README.md", "README", REQUIRED_README_COVERAGE, blockers);
    await checkCoverageFile(root, "docs/operator-runbook.md", "Operator runbook", REQUIRED_RUNBOOK_COVERAGE, blockers);
    return blockers;
}
async function checkCoverageFile(root, relPath, label, requiredTerms, blockers) {
    let content = "";
    try {
        content = await readFile(join(root, relPath), "utf8");
    }
    catch {
        blockers.push({
            code: "HANDOFF_DOC_MISSING",
            message: `${label} is missing.`,
            file: relPath
        });
        return;
    }
    const normalized = content.toLowerCase();
    for (const term of requiredTerms) {
        if (!normalized.includes(term.toLowerCase())) {
            blockers.push({
                code: "HANDOFF_DOC_COVERAGE_MISSING",
                message: `${label} is missing coverage: ${term}`,
                file: relPath
            });
        }
    }
}
function readPackageSelector(packageJson, selector) {
    if (!packageJson)
        return "";
    if (selector === "bin.dota-workshop-mcp")
        return packageJson.bin?.["dota-workshop-mcp"] ?? "";
    if (selector === "scripts.verify:plugin")
        return packageJson.scripts?.["verify:plugin"] ?? "";
    if (selector === "scripts.verify:rc")
        return packageJson.scripts?.["verify:rc"] ?? "";
    if (selector === "scripts.verify:handoff")
        return packageJson.scripts?.["verify:handoff"] ?? "";
    return "";
}
function copyRcBlocker(blocker, root) {
    return {
        code: blocker.code,
        message: sanitizeText(blocker.message, root),
        file: blocker.file ? sanitizeText(blocker.file, root) : undefined,
        rule: blocker.rule,
        command: blocker.command
    };
}
function sanitizeCommandResult(command, root) {
    return {
        ...command,
        stdout: sanitizeText(command.stdout, root),
        stderr: sanitizeText(command.stderr, root)
    };
}
function sanitizeText(value, root) {
    return value.split(root).join("<repo>");
}
async function runShellCommand(command, options) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
        const child = spawn(command, {
            cwd: options.cwd,
            shell: true,
            stdio: ["ignore", "pipe", "pipe"]
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        child.on("close", (code) => {
            resolve({
                command,
                exitCode: code ?? 1,
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: Buffer.concat(stderr).toString("utf8"),
                durationMs: Date.now() - startedAt
            });
        });
        child.on("error", (error) => {
            resolve({
                command,
                exitCode: 1,
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: `${Buffer.concat(stderr).toString("utf8")}${error.message}`,
                durationMs: Date.now() - startedAt
            });
        });
    });
}
function toPosix(path) {
    return path.split(sep).join("/");
}

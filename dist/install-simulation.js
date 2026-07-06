import { access, cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
const REQUIRED_ENTRIES = [
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "package.json",
    "dist/index.js",
    "skills/dota2-workshop-tools"
];
const TEXT_EXTENSIONS = new Set([".json", ".md", ".js", ".ts", ".txt"]);
const SENSITIVE_PATTERNS = [
    { category: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
    { category: "token", pattern: /\b(?:token|api[_-]?key|secret)(?:[_-]?[A-Za-z0-9]+)?\b\s*[:=]\s*["']?(?:gh[pousr]_|sk-|[A-Za-z0-9_/-]{20,})/i },
    { category: "credential", pattern: /\b(?:credential|password|passwd|pwd)(?:[_-]?[A-Za-z0-9]+)?\b\s*[:=]\s*["']?(?:steam_|[A-Za-z0-9_/-]{12,})/i },
    { category: "private windows path", pattern: /\b[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/]+/ },
    { category: "private unix path", pattern: /\/Users\/[^/\s]+/ },
    { category: "private host path", pattern: /\\\\[A-Za-z0-9.-]+\\[A-Za-z0-9.$_-]+/ }
];
export async function simulateLocalInstall(input = {}) {
    const root = resolve(input.root ?? process.cwd());
    const tempParent = resolve(input.tempParent ?? tmpdir());
    const cleanupEnabled = input.cleanup ?? true;
    const beforeEnvironment = selectedEnvironment();
    const evidence = [];
    const warnings = [];
    const blockers = [];
    const simulationRoot = await createSimulationRoot(tempParent);
    const paths = {
        root,
        tempParent,
        simulationRoot,
        pluginManifest: join(simulationRoot, ".codex-plugin/plugin.json"),
        mcpConfig: join(simulationRoot, ".mcp.json"),
        packageJson: join(simulationRoot, "package.json"),
        distIndex: join(simulationRoot, "dist/index.js"),
        skill: join(simulationRoot, "skills/dota2-workshop-tools/SKILL.md")
    };
    const cleanup = {
        attempted: cleanupEnabled,
        removed: false
    };
    try {
        if (isPathInside(simulationRoot, root)) {
            blockers.push({
                code: "SIM_ROOT_NOT_ISOLATED",
                message: "Install simulation root must not be inside the repository source tree.",
                path: "simulationRoot"
            });
        }
        else {
            evidence.push("install simulation root is isolated");
        }
        await copySimulationEntries(root, simulationRoot, blockers);
        await checkConsumerContract(simulationRoot, blockers, evidence);
        await scanSimulationForSensitiveMaterial(simulationRoot, blockers);
        if (sameEnvironment(beforeEnvironment, selectedEnvironment())) {
            evidence.push("selected environment variables unchanged");
        }
        else {
            blockers.push({
                code: "SIM_ENVIRONMENT_MUTATED",
                message: "Install simulation changed selected environment variables."
            });
        }
        evidence.push("global install not performed");
    }
    finally {
        if (cleanupEnabled) {
            await rm(simulationRoot, { recursive: true, force: true });
            cleanup.removed = !(await pathExists(simulationRoot));
            if (cleanup.removed) {
                evidence.push("cleanup removed simulation root");
            }
            else {
                blockers.push({
                    code: "SIM_CLEANUP_FAILED",
                    message: "Install simulation root still exists after cleanup.",
                    path: "simulationRoot"
                });
            }
        }
    }
    return {
        ok: blockers.length === 0,
        evidence,
        warnings,
        blockers,
        paths,
        cleanup
    };
}
async function createSimulationRoot(tempParent) {
    await mkdir(tempParent, { recursive: true });
    return await mkdtemp(join(tempParent, "dota-plugin-install-"));
}
async function copySimulationEntries(root, simulationRoot, blockers) {
    for (const entry of REQUIRED_ENTRIES) {
        const source = join(root, entry);
        const destination = join(simulationRoot, entry);
        if (!(await pathExists(source))) {
            blockers.push(missingEntryBlocker(entry));
            continue;
        }
        await mkdir(dirname(destination), { recursive: true });
        await cp(source, destination, { recursive: true });
    }
}
function missingEntryBlocker(entry) {
    if (entry === "dist/index.js") {
        return {
            code: "SIM_DIST_INDEX_MISSING",
            message: "Simulation source is missing the built dist entrypoint.",
            path: entry
        };
    }
    return {
        code: "SIM_REQUIRED_ENTRY_MISSING",
        message: "Simulation source is missing a required plugin entry.",
        path: entry
    };
}
async function checkConsumerContract(simulationRoot, blockers, evidence) {
    const manifest = await readJson(join(simulationRoot, ".codex-plugin/plugin.json"), ".codex-plugin/plugin.json", blockers);
    if (manifest) {
        evidence.push("plugin manifest exists in simulation");
        const value = asRecord(manifest);
        if (value.skills === "./skills/") {
            evidence.push("plugin manifest points skills to ./skills/");
        }
        else {
            blockers.push({
                code: "SIM_PLUGIN_SKILLS_PATH_INVALID",
                message: "Plugin manifest must point skills to ./skills/.",
                path: ".codex-plugin/plugin.json"
            });
        }
        if (value.mcpServers === "./.mcp.json") {
            evidence.push("plugin manifest points MCP servers to ./.mcp.json");
        }
        else {
            blockers.push({
                code: "SIM_PLUGIN_MCP_CONFIG_INVALID",
                message: "Plugin manifest must point mcpServers to ./.mcp.json.",
                path: ".codex-plugin/plugin.json"
            });
        }
    }
    const mcpConfig = await readJson(join(simulationRoot, ".mcp.json"), ".mcp.json", blockers);
    if (mcpConfig) {
        const server = asRecord(asRecord(asRecord(mcpConfig).mcpServers)["dota-workshop-tools"]);
        const args = Array.isArray(server.args) ? server.args.filter((arg) => typeof arg === "string") : [];
        if (server.command === "node" && args.length === 1 && args[0] === "./dist/index.js") {
            evidence.push("MCP config points to node ./dist/index.js");
        }
        else {
            blockers.push({
                code: "SIM_MCP_ENTRYPOINT_INVALID",
                message: "MCP config must point to node ./dist/index.js.",
                path: ".mcp.json"
            });
        }
    }
    const packageJson = await readJson(join(simulationRoot, "package.json"), "package.json", blockers);
    if (packageJson) {
        const bin = asRecord(asRecord(packageJson).bin);
        if (bin["dota-workshop-mcp"] === "./dist/index.js") {
            evidence.push("package bin points to ./dist/index.js");
        }
        else {
            blockers.push({
                code: "SIM_PACKAGE_BIN_INVALID",
                message: "Package bin must point dota-workshop-mcp to ./dist/index.js.",
                path: "package.json"
            });
        }
    }
    await checkRequiredFile(simulationRoot, "dist/index.js", "SIM_DIST_INDEX_MISSING", "dist entrypoint exists in simulation", blockers, evidence);
    await checkRequiredFile(simulationRoot, "skills/dota2-workshop-tools/SKILL.md", "SIM_SKILL_MISSING", "skill file exists in simulation", blockers, evidence);
}
async function readJson(path, relativePath, blockers) {
    try {
        return JSON.parse(await readFile(path, "utf8"));
    }
    catch {
        blockers.push({
            code: "SIM_JSON_INVALID_OR_MISSING",
            message: "Simulation JSON file is missing or invalid.",
            path: relativePath
        });
        return undefined;
    }
}
async function checkRequiredFile(simulationRoot, relativePath, code, evidenceLine, blockers, evidence) {
    if (await pathExists(join(simulationRoot, relativePath))) {
        evidence.push(evidenceLine);
        return;
    }
    blockers.push({
        code,
        message: "Simulation is missing a required file.",
        path: relativePath
    });
}
async function scanSimulationForSensitiveMaterial(simulationRoot, blockers) {
    const files = await listFiles(simulationRoot);
    for (const file of files) {
        if (!isTextFile(file)) {
            continue;
        }
        const content = await readFile(file, "utf8");
        const category = sensitiveCategory(content);
        if (category) {
            blockers.push({
                code: "SIM_SENSITIVE_MATERIAL_FOUND",
                message: "Simulation input contains sensitive material.",
                path: toRelativePath(simulationRoot, file),
                category
            });
        }
    }
}
async function listFiles(root) {
    const files = [];
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(path));
        }
        else if (entry.isFile()) {
            files.push(path);
        }
    }
    return files;
}
function isTextFile(path) {
    return TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf(".")));
}
function sensitiveCategory(content) {
    return SENSITIVE_PATTERNS.find((entry) => entry.pattern.test(content))?.category;
}
function selectedEnvironment() {
    return {
        CODEX_HOME: process.env.CODEX_HOME,
        HOME: process.env.HOME,
        PATH: process.env.PATH
    };
}
function sameEnvironment(left, right) {
    return Object.keys(left).every((key) => left[key] === right[key]);
}
function isPathInside(child, parent) {
    const rel = relative(parent, child);
    return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}
function toRelativePath(root, path) {
    return relative(root, path).split(sep).join("/");
}
async function pathExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

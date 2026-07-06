import { access, readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { toolNames } from "./tools.js";
const EXPECTED_MCP_SERVER = "dota-workshop-tools";
const EXPECTED_MCP_COMMAND = "node";
const EXPECTED_MCP_ARGS = ["./dist/index.js"];
const EXPECTED_BIN = "./dist/index.js";
export async function verifyPluginPackage(input = {}) {
    const root = input.root ?? process.cwd();
    const evidence = [];
    const warnings = [];
    const blockers = [];
    const paths = {
        root,
        pluginManifest: join(root, ".codex-plugin/plugin.json"),
        mcpConfig: join(root, ".mcp.json"),
        packageJson: join(root, "package.json"),
        distIndex: join(root, "dist/index.js"),
        readme: join(root, "README.md"),
        skill: join(root, "skills/dota2-workshop-tools/SKILL.md"),
        skillRoot: join(root, "skills/dota2-workshop-tools")
    };
    const pluginManifest = await readJsonFile(paths.pluginManifest, "PLUGIN_MANIFEST", blockers);
    if (pluginManifest) {
        evidence.push("plugin manifest exists");
        checkPluginManifest(pluginManifest, paths.pluginManifest, blockers, evidence);
    }
    const mcpConfig = await readJsonFile(paths.mcpConfig, "MCP_CONFIG", blockers);
    if (mcpConfig) {
        evidence.push("MCP config exists");
        checkMcpConfig(mcpConfig, paths.mcpConfig, blockers, evidence);
    }
    const packageJson = await readJsonFile(paths.packageJson, "PACKAGE_JSON", blockers);
    if (packageJson) {
        evidence.push("package.json exists");
        checkPackageJson(packageJson, paths.packageJson, blockers, evidence);
    }
    await checkFileExists(paths.distIndex, "DIST_INDEX_MISSING", "built server entrypoint exists", blockers, evidence);
    const readme = await readTextFile(paths.readme, "README", blockers);
    if (readme) {
        evidence.push("README exists");
        checkToolList("README", paths.readme, extractMarkdownToolList(readme, "## MCP Tools"), blockers, evidence);
    }
    const skill = await readTextFile(paths.skill, "SKILL", blockers);
    if (skill) {
        evidence.push("skill file exists");
        await checkSkillReferences(skill, paths.skillRoot, blockers, evidence);
        checkToolList("SKILL", paths.skill, extractSkillToolList(skill), blockers, evidence);
    }
    return {
        ok: blockers.length === 0,
        evidence,
        warnings,
        blockers,
        paths
    };
}
async function readJsonFile(path, label, blockers) {
    const content = await readTextFile(path, label, blockers);
    if (!content)
        return undefined;
    try {
        return JSON.parse(content);
    }
    catch {
        blockers.push({
            code: `${label}_INVALID_JSON`,
            message: `${path} is not valid JSON.`,
            file: path
        });
        return undefined;
    }
}
async function readTextFile(path, label, blockers) {
    try {
        return await readFile(path, "utf8");
    }
    catch {
        blockers.push({
            code: `${label}_MISSING`,
            message: `${path} is missing.`,
            file: path
        });
        return undefined;
    }
}
async function checkFileExists(path, code, evidenceLine, blockers, evidence) {
    try {
        await access(path);
        evidence.push(evidenceLine);
    }
    catch {
        blockers.push({
            code,
            message: `${path} is missing.`,
            file: path
        });
    }
}
function checkPluginManifest(manifest, file, blockers, evidence) {
    const value = asRecord(manifest);
    const skills = typeof value.skills === "string" ? value.skills : "";
    const mcpServers = typeof value.mcpServers === "string" ? value.mcpServers : "";
    if (skills !== "./skills/") {
        blockers.push({
            code: "PLUGIN_SKILLS_PATH_INVALID",
            message: "Plugin manifest must point skills to ./skills/.",
            file,
            expected: ["./skills/"],
            actual: [skills]
        });
    }
    else {
        evidence.push("plugin skills path points to ./skills/");
    }
    if (mcpServers !== "./.mcp.json") {
        blockers.push({
            code: "PLUGIN_MCP_CONFIG_INVALID",
            message: "Plugin manifest must point mcpServers to ./.mcp.json.",
            file,
            expected: ["./.mcp.json"],
            actual: [mcpServers]
        });
    }
    else {
        evidence.push("plugin mcpServers points to ./.mcp.json");
    }
}
function checkMcpConfig(config, file, blockers, evidence) {
    const value = asRecord(config);
    const servers = asRecord(value.mcpServers);
    const server = asRecord(servers[EXPECTED_MCP_SERVER]);
    const command = typeof server.command === "string" ? server.command : "";
    const args = Array.isArray(server.args) ? server.args.filter((arg) => typeof arg === "string") : [];
    if (command !== EXPECTED_MCP_COMMAND || !sameList(args, EXPECTED_MCP_ARGS)) {
        blockers.push({
            code: "MCP_ENTRYPOINT_INVALID",
            message: "MCP config must run node ./dist/index.js.",
            file,
            expected: [EXPECTED_MCP_COMMAND, ...EXPECTED_MCP_ARGS],
            actual: [command, ...args]
        });
    }
    else {
        evidence.push("MCP config points to node ./dist/index.js");
    }
}
function checkPackageJson(packageJson, file, blockers, evidence) {
    const value = asRecord(packageJson);
    const bin = asRecord(value.bin);
    const binTarget = typeof bin["dota-workshop-mcp"] === "string" ? bin["dota-workshop-mcp"] : "";
    const scripts = asRecord(value.scripts);
    const verifyScript = typeof scripts["verify:plugin"] === "string" ? scripts["verify:plugin"] : "";
    if (binTarget !== EXPECTED_BIN) {
        blockers.push({
            code: "PACKAGE_BIN_INVALID",
            message: "Package bin must point dota-workshop-mcp to ./dist/index.js.",
            file,
            expected: [EXPECTED_BIN],
            actual: [binTarget]
        });
    }
    else {
        evidence.push("package bin points to ./dist/index.js");
    }
    if (verifyScript !== "node ./dist/verify-plugin.js") {
        blockers.push({
            code: "PACKAGE_VERIFY_SCRIPT_INVALID",
            message: "package.json must define verify:plugin as node ./dist/verify-plugin.js.",
            file,
            expected: ["node ./dist/verify-plugin.js"],
            actual: [verifyScript]
        });
    }
    else {
        evidence.push("package verify:plugin script exists");
    }
}
async function checkSkillReferences(skillContent, skillRoot, blockers, evidence) {
    const references = [...new Set([...skillContent.matchAll(/`(references\/[^`]+\.md)`/g)].map((match) => match[1]))];
    for (const reference of references) {
        const normalized = normalize(reference);
        const referencePath = join(skillRoot, normalized);
        try {
            await access(referencePath);
        }
        catch {
            blockers.push({
                code: "SKILL_REFERENCE_MISSING",
                message: `Skill reference is missing: ${reference}`,
                file: referencePath
            });
        }
    }
    if (!blockers.some((blocker) => blocker.code === "SKILL_REFERENCE_MISSING")) {
        evidence.push("skill references exist");
    }
}
function checkToolList(label, file, documentedTools, blockers, evidence) {
    const expected = [...toolNames];
    const extra = documentedTools.filter((tool) => !expected.includes(tool));
    const missing = expected.filter((tool) => !documentedTools.includes(tool));
    for (const tool of extra) {
        blockers.push({
            code: `${label}_TOOL_EXTRA`,
            message: `${label} documents unknown MCP tool: ${tool}`,
            file,
            expected,
            actual: documentedTools
        });
    }
    for (const tool of missing) {
        blockers.push({
            code: `${label}_TOOL_MISSING`,
            message: `${label} is missing documented MCP tool: ${tool}`,
            file,
            expected,
            actual: documentedTools
        });
    }
    if (extra.length === 0 && missing.length === 0) {
        evidence.push(`${label === "README" ? "README" : "skill"} tool list matches toolNames`);
    }
}
function extractMarkdownToolList(content, heading) {
    const section = extractSection(content, heading);
    return extractBacktickedBullets(section);
}
function extractSkillToolList(content) {
    const start = content.indexOf("Expected v1 operations:");
    if (start < 0)
        return [];
    const afterStart = content.slice(start);
    const end = afterStart.indexOf("\n\nEvery result");
    return extractBacktickedBullets(end >= 0 ? afterStart.slice(0, end) : afterStart);
}
function extractSection(content, heading) {
    const start = content.indexOf(heading);
    if (start < 0)
        return "";
    const afterStart = content.slice(start);
    const nextHeading = afterStart.slice(heading.length).search(/\n## /);
    return nextHeading >= 0 ? afterStart.slice(0, heading.length + nextHeading) : afterStart;
}
function extractBacktickedBullets(content) {
    return [...content.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
}
function sameList(actual, expected) {
    return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

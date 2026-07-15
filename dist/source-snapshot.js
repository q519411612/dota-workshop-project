import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, sep } from "node:path";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const SOURCE_PATHS = [
    ".codex-plugin",
    ".mcp.json",
    ".planning/PROJECT.md",
    ".planning/ROADMAP.md",
    ".planning/phases",
    ".planning/research",
    "AGENTS.md",
    "README.md",
    "docs",
    "examples",
    "package-lock.json",
    "package.json",
    "skills",
    "src",
    "tests",
    "tsconfig.build.json",
    "tsconfig.json"
];
const REQUIRED_PATHS = [
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "docs",
    "examples",
    "package.json",
    "skills",
    "src",
    "tests"
];
const BOUNDARIES = [
    "no archive created",
    "no package signing performed",
    "no content encryption performed",
    "no package publish performed",
    "no registry publish performed",
    "no Workshop upload attempted",
    "no Steam login captured",
    "no Steam Guard handling captured",
    "no credentials stored",
    "no remote Windows connection attempted",
    "no global install performed"
];
const TEXT_EXTENSIONS = new Set([
    ".json",
    ".md",
    ".ts",
    ".js",
    ".txt",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".cfg",
    ".lua",
    ".kv"
]);
const SENSITIVE_PATTERNS = [
    { category: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
    { category: "token", pattern: /\b(?:token|api[_-]?key|secret)\b\s*[:=]\s*["']?(?:gh[pousr]_|sk-|[A-Za-z0-9_/-]{20,})/i },
    { category: "credential", pattern: /\b(?:credential|password|passwd|pwd)\b\s*[:=]\s*["']?(?:steam_|[A-Za-z0-9_/-]{12,})/i },
    { category: "private windows path", pattern: /\b[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/]+/ },
    { category: "private unix path", pattern: /\/Users\/[^/\s]+/ },
    { category: "private host path", pattern: /\\\\[A-Za-z0-9.-]+\\[A-Za-z0-9.$_-]+/ }
];
export async function generateSourceSnapshotManifest(input = {}) {
    const root = input.root ?? process.cwd();
    const packageJson = await readPackageJson(root);
    const blockers = [];
    const requirementsSource = await resolveRequirementsSource(root);
    await appendMissingRequiredPathBlockers(root, blockers, requirementsSource);
    const files = await collectSourceFiles(root, requirementsSource);
    const snapshotFiles = [];
    for (const file of files) {
        const absolutePath = join(root, file);
        const bytes = await readFile(absolutePath);
        snapshotFiles.push({
            path: file,
            bytes: bytes.byteLength,
            sha256: createHash("sha256").update(bytes).digest("hex")
        });
        const sensitive = await scanFileForSensitiveMaterial(absolutePath);
        if (sensitive) {
            blockers.push({
                code: "SENSITIVE_MATERIAL_FOUND",
                path: file,
                field: "content",
                category: sensitive
            });
        }
    }
    const boundaries = [...BOUNDARIES];
    for (const boundary of BOUNDARIES) {
        if (!boundaries.includes(boundary)) {
            blockers.push({
                code: "BOUNDARY_MISSING",
                field: "boundaries",
                category: boundary
            });
        }
    }
    const manifest = {
        schemaVersion: "1.0",
        project: packageJson.name,
        version: packageJson.version,
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        commit: input.commit ?? await readGitCommit(root),
        verification: input.verification ?? [],
        boundaries,
        files: snapshotFiles.sort((left, right) => comparePath(left.path, right.path)),
        warnings: [],
        blockers
    };
    return {
        ok: blockers.length === 0,
        manifest
    };
}
async function readPackageJson(root) {
    try {
        const parsed = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
        return {
            name: typeof parsed.name === "string" ? parsed.name : "unknown",
            version: typeof parsed.version === "string" ? parsed.version : "0.0.0"
        };
    }
    catch {
        return {
            name: "unknown",
            version: "0.0.0"
        };
    }
}
async function appendMissingRequiredPathBlockers(root, blockers, requirementsSource) {
    blockers.push(...requirementsSource.blockers);
    for (const path of REQUIRED_PATHS) {
        try {
            await access(join(root, path));
        }
        catch {
            blockers.push({
                code: "REQUIRED_SOURCE_PATH_MISSING",
                path,
                field: "files",
                category: "source coverage"
            });
        }
    }
}
async function collectSourceFiles(root, requirementsSource) {
    const files = [];
    for (const sourcePath of SOURCE_PATHS) {
        await collectPath(root, sourcePath, files);
    }
    for (const sourcePath of requirementsSource.paths) {
        if (!requirementsSource.blockers.some((blocker) => blocker.path === sourcePath.path)) {
            await collectPath(root, sourcePath.path, files);
        }
    }
    return [...new Set(files)].sort(comparePath);
}
async function resolveRequirementsSource(root) {
    const activePath = ".planning/REQUIREMENTS.md";
    const activeKind = await readPathKind(root, activePath);
    if (activeKind !== "missing") {
        return {
            kind: "active",
            paths: [{ path: activePath, expected: "file" }],
            blockers: activeKind === "file" ? [] : [sourcePathBlocker("REQUIRED_SOURCE_PATH_INVALID", activePath)]
        };
    }
    const archivedMilestone = await resolveLatestArchivedMilestone(root);
    if (archivedMilestone === undefined) {
        return {
            kind: "missing",
            paths: [],
            blockers: [sourcePathBlocker("REQUIRED_SOURCE_PATH_MISSING", activePath)]
        };
    }
    const paths = [
        { path: `.planning/milestones/${archivedMilestone}-REQUIREMENTS.md`, expected: "file" },
        { path: `.planning/milestones/${archivedMilestone}-ROADMAP.md`, expected: "file" },
        { path: `.planning/milestones/${archivedMilestone}-MILESTONE-AUDIT.md`, expected: "file" },
        { path: `.planning/milestones/${archivedMilestone}-phases`, expected: "directory" }
    ];
    const blockers = [];
    for (const sourcePath of paths) {
        const actual = await readPathKind(root, sourcePath.path);
        if (actual === "missing") {
            blockers.push(sourcePathBlocker("REQUIRED_SOURCE_PATH_MISSING", sourcePath.path));
        }
        else if (actual !== sourcePath.expected) {
            blockers.push(sourcePathBlocker("REQUIRED_SOURCE_PATH_INVALID", sourcePath.path));
        }
    }
    return { kind: "archived", paths, blockers };
}
function sourcePathBlocker(code, path) {
    return {
        code,
        path,
        field: "files",
        category: "source coverage"
    };
}
async function readPathKind(root, repositoryPath) {
    try {
        const entry = await stat(join(root, repositoryPath));
        if (entry.isFile())
            return "file";
        if (entry.isDirectory())
            return "directory";
        return "other";
    }
    catch (error) {
        if (isNotFoundError(error))
            return "missing";
        throw error;
    }
}
function isNotFoundError(error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
async function resolveLatestArchivedMilestone(root) {
    let entries;
    try {
        entries = await readdir(join(root, ".planning/milestones"), { withFileTypes: true });
    }
    catch (error) {
        if (isNotFoundError(error))
            return undefined;
        throw error;
    }
    const versions = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name.match(/^(v\d+(?:\.\d+)*)-REQUIREMENTS\.md$/))
        .filter((match) => match !== null)
        .map((match) => match[1]);
    versions.sort(compareMilestoneVersion);
    return versions.at(-1);
}
function compareMilestoneVersion(left, right) {
    const leftParts = left.slice(1).split(".").map(Number);
    const rightParts = right.slice(1).split(".").map(Number);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (difference !== 0)
            return difference;
    }
    return left < right ? -1 : left > right ? 1 : 0;
}
async function collectPath(root, sourcePath, files) {
    const absolutePath = join(root, sourcePath);
    let entryStat;
    try {
        entryStat = await stat(absolutePath);
    }
    catch {
        return;
    }
    if (entryStat.isFile()) {
        files.push(toRepositoryPath(sourcePath));
        return;
    }
    if (!entryStat.isDirectory()) {
        return;
    }
    const entries = await readdir(absolutePath, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => comparePath(left.name, right.name))) {
        if (entry.name === "graphs" || entry.name === ".DS_Store") {
            continue;
        }
        const childPath = `${sourcePath}/${entry.name}`;
        if (entry.isDirectory()) {
            await collectPath(root, childPath, files);
        }
        else if (entry.isFile()) {
            files.push(toRepositoryPath(childPath));
        }
    }
}
function comparePath(left, right) {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function toRepositoryPath(path) {
    return path.split(sep).join("/");
}
async function scanFileForSensitiveMaterial(path) {
    if (!TEXT_EXTENSIONS.has(extname(path))) {
        return undefined;
    }
    const content = await readFile(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
        if (line.includes("${") || line.includes("[\"")) {
            continue;
        }
        const match = SENSITIVE_PATTERNS.find((entry) => entry.pattern.test(line));
        if (match) {
            return match.category;
        }
    }
    return undefined;
}
async function readGitCommit(root) {
    const sha = await gitOutput(root, ["rev-parse", "HEAD"]);
    const branch = await gitOutput(root, ["branch", "--show-current"]);
    return {
        sha: sha || "unknown",
        branch: branch || "unknown"
    };
}
async function gitOutput(root, args) {
    try {
        const result = await execFileAsync("git", args, { cwd: root });
        return result.stdout.trim();
    }
    catch {
        return "";
    }
}

import { spawn } from "node:child_process";
import { readdir, readFile, lstat } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";
const RC_COMMANDS = [
    "npm run verify:plugin",
    "npm test -- tests/examples.test.ts",
    "npm run typecheck",
    "npm test",
    "npm run build"
];
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "dist", "graphify-out"]);
const SKIPPED_FILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"]);
const TEXT_EXTENSIONS = new Set([
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".ps1",
    ".sh",
    ".ts",
    ".txt",
    ".yaml",
    ".yml"
]);
const TEXT_FILENAMES = new Set(["AGENTS.md", "README.md", ".gitignore", ".mcp.json"]);
const SECRET_RULES = [
    {
        label: "private network address",
        code: "RC_FORBIDDEN_CONTENT",
        pattern: /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/
    },
    {
        label: "private key",
        code: "RC_FORBIDDEN_CONTENT",
        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
    },
    {
        label: "github token",
        code: "RC_FORBIDDEN_CONTENT",
        pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/
    },
    {
        label: "steam credential",
        code: "RC_FORBIDDEN_CONTENT",
        pattern: /\bsteam[_-]?(?:password|token|secret|apikey|api_key|credential)\b/i
    },
    {
        label: "password assignment",
        code: "RC_FORBIDDEN_CONTENT",
        pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s]+/i
    },
    {
        label: "token assignment",
        code: "RC_FORBIDDEN_CONTENT",
        pattern: /\b(?:token|api[_-]?key|secret)\b\s*[:=]\s*["']?[^"'\s]+/i
    }
];
const boundaryToken = (...parts) => parts.join("");
const BOUNDARY_RULES = [
    {
        label: "workshop upload automation",
        code: "RC_FORBIDDEN_PUBLISHING_BOUNDARY",
        pattern: new RegExp(`\\b(?:${boundaryToken("workshop", "_", "build", "_", "item")}|${boundaryToken("workshop", "_", "upload")}|${boundaryToken("ugc", "_", "publish")}|${boundaryToken("Publish", "Workshop", "File")})\\b`, "i")
    },
    {
        label: "steam login automation",
        code: "RC_FORBIDDEN_PUBLISHING_BOUNDARY",
        pattern: new RegExp(`\\b${boundaryToken("steam", "cmd")}\\b[\\s\\S]{0,120}\\+login\\b`, "i")
    },
    {
        label: "steam guard automation",
        code: "RC_FORBIDDEN_PUBLISHING_BOUNDARY",
        pattern: new RegExp(`\\b(?:${boundaryToken("steam", "_", "guard", "_", "code")}|${boundaryToken("steamguard", "_", "code")}|${boundaryToken("steam", "_", "guard", "_", "automation")}|${boundaryToken("steamguard", "_", "automation")}|${boundaryToken("submit", "_", "steam", "_", "guard")})\\b`, "i")
    },
    {
        label: "content encryption automation",
        code: "RC_FORBIDDEN_PUBLISHING_BOUNDARY",
        pattern: new RegExp(`\\b(?:${boundaryToken("encrypt", "_", "content")}|${boundaryToken("content", "_", "encryption")}|${boundaryToken("vpk", "_", "encrypt")}|${boundaryToken("dota", "_", "pak", "_", "encrypt")})\\b`, "i")
    },
    {
        label: "package signing automation",
        code: "RC_FORBIDDEN_PUBLISHING_BOUNDARY",
        pattern: new RegExp(`\\b(?:${boundaryToken("package", "_", "signing")}|${boundaryToken("sign", "_", "package")}|${boundaryToken("sign", "tool")}|${boundaryToken("code", "sign")})\\b`, "i")
    },
    {
        label: "publish-state mutation automation",
        code: "RC_FORBIDDEN_PUBLISHING_BOUNDARY",
        pattern: new RegExp(`\\b(?:${boundaryToken("publish", "_", "state")}|${boundaryToken("workshop", "_", "update")}|${boundaryToken("published", "file", "id")}|${boundaryToken("mutate", "_", "workshop")})\\b`, "i")
    }
];
export async function verifyReleaseCandidate(input = {}) {
    const root = input.root ?? process.cwd();
    const commandRunner = input.commandRunner ?? runShellCommand;
    const evidence = [];
    const warnings = [];
    const blockers = [];
    const commands = [];
    for (const command of RC_COMMANDS) {
        const result = await commandRunner(command, { cwd: root });
        commands.push(result);
        if (result.exitCode === 0) {
            evidence.push(`RC command gate passed: ${command}`);
        }
        else {
            blockers.push({
                code: "RC_COMMAND_FAILED",
                message: `RC command failed: ${command}`,
                command
            });
        }
    }
    const scan = await scanReleaseCandidateFiles({ root });
    evidence.push(...scan.evidence);
    warnings.push(...scan.warnings);
    blockers.push(...scan.blockers);
    return {
        ok: blockers.length === 0,
        evidence,
        warnings,
        blockers,
        paths: scan.paths,
        commands
    };
}
export async function scanReleaseCandidateFiles(input = {}) {
    const root = input.root ?? process.cwd();
    const maxFileBytes = input.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    const evidence = [];
    const warnings = [];
    const blockers = [];
    let scannedFiles = 0;
    let skippedFiles = 0;
    for await (const path of walkOwnedFiles(root, root)) {
        const relPath = toPosix(relative(root, path));
        const name = basename(path);
        if (SKIPPED_FILES.has(name) || !isTextCandidate(path)) {
            skippedFiles += 1;
            continue;
        }
        let stats;
        try {
            stats = await lstat(path);
        }
        catch {
            warnings.push(`RC scan skipped unreadable file: ${relPath}`);
            continue;
        }
        if (stats.size > maxFileBytes) {
            warnings.push(`RC scan skipped oversized file: ${relPath}`);
            continue;
        }
        let content;
        try {
            content = await readFile(path, "utf8");
        }
        catch {
            warnings.push(`RC scan skipped unreadable text file: ${relPath}`);
            continue;
        }
        if (content.includes("\u0000")) {
            skippedFiles += 1;
            continue;
        }
        scannedFiles += 1;
        for (const rule of [...SECRET_RULES, ...BOUNDARY_RULES]) {
            if (rule.pattern.test(content)) {
                blockers.push({
                    code: rule.code,
                    message: `RC forbidden content found: ${rule.label} in ${relPath}`,
                    file: relPath,
                    rule: rule.label
                });
            }
        }
    }
    evidence.push(`RC repository files scanned: ${scannedFiles}`);
    evidence.push(`RC repository files skipped: ${skippedFiles}`);
    if (blockers.length === 0) {
        evidence.push("RC repository scan passed");
    }
    return {
        ok: blockers.length === 0,
        evidence,
        warnings,
        blockers,
        paths: { root }
    };
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
async function* walkOwnedFiles(root, dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(dir, entry.name);
        const relPath = toPosix(relative(root, path));
        if (entry.isDirectory()) {
            if (SKIPPED_DIRECTORIES.has(entry.name) || relPath === ".planning/graphs" || relPath.startsWith(".planning/graphs/")) {
                continue;
            }
            yield* walkOwnedFiles(root, path);
        }
        else if (entry.isFile()) {
            yield path;
        }
    }
}
function isTextCandidate(path) {
    const name = basename(path);
    return TEXT_FILENAMES.has(name) || TEXT_EXTENSIONS.has(extname(path));
}
function toPosix(path) {
    return path.split(sep).join("/");
}

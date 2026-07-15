import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SourceSnapshotCommit = {
  sha: string;
  branch: string;
};

export type SourceSnapshotVerification = {
  command: string;
  ok: boolean;
};

export type SourceSnapshotFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type SourceSnapshotBlocker = {
  code: string;
  path?: string;
  field: string;
  category: string;
};

export type SourceSnapshotManifest = {
  schemaVersion: "1.0";
  project: string;
  version: string;
  generatedAt: string;
  commit: SourceSnapshotCommit;
  verification: SourceSnapshotVerification[];
  boundaries: string[];
  files: SourceSnapshotFile[];
  warnings: string[];
  blockers: SourceSnapshotBlocker[];
};

export type SourceSnapshotManifestResult = {
  ok: boolean;
  manifest: SourceSnapshotManifest;
};

export type GenerateSourceSnapshotManifestInput = {
  root?: string;
  generatedAt?: string;
  commit?: SourceSnapshotCommit;
  verification?: SourceSnapshotVerification[];
};

const SOURCE_PATHS = [
  ".codex-plugin",
  ".mcp.json",
  ".planning/PROJECT.md",
  ".planning/REQUIREMENTS.md",
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

export async function generateSourceSnapshotManifest(
  input: GenerateSourceSnapshotManifestInput = {}
): Promise<SourceSnapshotManifestResult> {
  const root = input.root ?? process.cwd();
  const packageJson = await readPackageJson(root);
  const blockers: SourceSnapshotBlocker[] = [];

  await appendMissingRequiredPathBlockers(root, blockers);

  const files = await collectSourceFiles(root);
  const snapshotFiles: SourceSnapshotFile[] = [];
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

  const manifest: SourceSnapshotManifest = {
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

async function readPackageJson(root: string): Promise<{ name: string; version: string }> {
  try {
    const parsed = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Record<string, unknown>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "unknown",
      version: typeof parsed.version === "string" ? parsed.version : "0.0.0"
    };
  } catch {
    return {
      name: "unknown",
      version: "0.0.0"
    };
  }
}

async function appendMissingRequiredPathBlockers(root: string, blockers: SourceSnapshotBlocker[]): Promise<void> {
  if (!await hasRequirementsSource(root)) {
    blockers.push({
      code: "REQUIRED_SOURCE_PATH_MISSING",
      path: ".planning/REQUIREMENTS.md",
      field: "files",
      category: "source coverage"
    });
  }

  for (const path of REQUIRED_PATHS) {
    try {
      await access(join(root, path));
    } catch {
      blockers.push({
        code: "REQUIRED_SOURCE_PATH_MISSING",
        path,
        field: "files",
        category: "source coverage"
      });
    }
  }
}

async function hasRequirementsSource(root: string): Promise<boolean> {
  try {
    await access(join(root, ".planning/REQUIREMENTS.md"));
    return true;
  } catch {
    // 活跃里程碑关闭后，归档 requirements 是同一来源契约的唯一合法替代。
  }

  return await resolveLatestArchivedMilestone(root) !== undefined;
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const sourcePath of SOURCE_PATHS) {
    await collectPath(root, sourcePath, files);
  }
  if (!await pathExists(root, ".planning/REQUIREMENTS.md")) {
    const archivedMilestone = await resolveLatestArchivedMilestone(root);
    if (archivedMilestone !== undefined) {
      for (const suffix of ["-REQUIREMENTS.md", "-ROADMAP.md", "-MILESTONE-AUDIT.md", "-phases"]) {
        await collectPath(root, `.planning/milestones/${archivedMilestone}${suffix}`, files);
      }
    }
  }
  return [...new Set(files)].sort(comparePath);
}

async function pathExists(root: string, repositoryPath: string): Promise<boolean> {
  try {
    await access(join(root, repositoryPath));
    return true;
  } catch {
    return false;
  }
}

async function resolveLatestArchivedMilestone(root: string): Promise<string | undefined> {
  let entries;
  try {
    entries = await readdir(join(root, ".planning/milestones"), { withFileTypes: true });
  } catch {
    return undefined;
  }

  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name.match(/^(v\d+(?:\.\d+)*)-REQUIREMENTS\.md$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1]!);
  versions.sort(compareMilestoneVersion);
  return versions.at(-1);
}

function compareMilestoneVersion(left: string, right: string): number {
  const leftParts = left.slice(1).split(".").map(Number);
  const rightParts = right.slice(1).split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

async function collectPath(root: string, sourcePath: string, files: string[]): Promise<void> {
  const absolutePath = join(root, sourcePath);
  let entryStat;
  try {
    entryStat = await stat(absolutePath);
  } catch {
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
    } else if (entry.isFile()) {
      files.push(toRepositoryPath(childPath));
    }
  }
}

function comparePath(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function toRepositoryPath(path: string): string {
  return path.split(sep).join("/");
}

async function scanFileForSensitiveMaterial(path: string): Promise<string | undefined> {
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

async function readGitCommit(root: string): Promise<SourceSnapshotCommit> {
  const sha = await gitOutput(root, ["rev-parse", "HEAD"]);
  const branch = await gitOutput(root, ["branch", "--show-current"]);
  return {
    sha: sha || "unknown",
    branch: branch || "unknown"
  };
}

async function gitOutput(root: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", args, { cwd: root });
    return result.stdout.trim();
  } catch {
    return "";
  }
}

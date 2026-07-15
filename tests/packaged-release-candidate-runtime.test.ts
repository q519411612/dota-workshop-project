import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const temporaryRoots: string[] = [];

const REQUIRED_RUNTIME = [
  "dist/release-candidate.js",
  "dist/release-candidate-result.js",
  "dist/release-candidate-node.js",
  "dist/release-candidate-remote-script.js",
  "dist/release-candidate-remote-executor.js",
  "dist/release-candidate-remote.js",
  "dist/result.js",
  "dist/schemas.js",
  "dist/tools.js",
  "dist/server.js"
] as const;

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (path) => await rm(path, { recursive: true, force: true })));
});

describe("packaged release-candidate runtime", () => {
  test("loads and invokes the exact staged server import closure", async () => {
    const buildRoot = await temporaryDirectory("dota-rc-build-");
    const exportRoot = await temporaryDirectory("dota-rc-index-");

    await execFileAsync(process.execPath, [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      join(root, "tsconfig.build.json"),
      "--outDir",
      buildRoot
    ], { cwd: root });

    const closure = await reachableRuntimeFiles(buildRoot, "server.js");
    for (const path of REQUIRED_RUNTIME) {
      expect(closure).toContain(path.slice("dist/".length));
    }

    for (const relativePath of closure) {
      const isolatedBytes = await readFile(join(buildRoot, relativePath));
      const stagedBytes = await stagedFile(`dist/${relativePath}`);
      expect(stagedBytes, `staged runtime differs: dist/${relativePath}`).toEqual(isolatedBytes);
    }

    await execFileAsync("git", ["checkout-index", "--all", `--prefix=${exportRoot}${sep}`], { cwd: root });
    const serverModule = await import(pathToFileURL(join(exportRoot, "dist/server.js")).href);
    const toolsModule = await import(pathToFileURL(join(exportRoot, "dist/tools.js")).href);
    const server = serverModule.createServer();
    const registered = server._registeredTools ?? server.registeredTools;
    expect(Object.keys(registered)).toContain("preflight_release_candidate");

    let nodeCalls = 0;
    let remoteCalls = 0;
    const expected = {
      ok: false,
      target: { kind: "fixture", root: "[redacted]" },
      operation: "preflight_release_candidate",
      error: { code: "INDEX_RUNTIME_INVOKED", message: "index runtime invoked" },
      evidence: ["index runtime invoked"],
      warnings: [],
      paths: {},
      commands: [],
      logs: []
    };
    const result = await toolsModule.handleTool(
      "preflight_release_candidate",
      { target: { kind: "fixture", root: "/fixture" }, addonName: "demo" },
      {
        preflightNodeReleaseCandidate: async () => { nodeCalls += 1; return expected; },
        preflightRemoteReleaseCandidate: async () => { remoteCalls += 1; return expected; }
      }
    );
    expect(result).toEqual(expected);
    expect({ nodeCalls, remoteCalls }).toEqual({ nodeCalls: 1, remoteCalls: 0 });

    const indexedRuntime = (await execFileAsync("git", ["ls-files", "dist/*.js"], { cwd: root })).stdout
      .trim().split("\n").filter(Boolean);
    expect(indexedRuntime.filter((path) => path.includes("release-candidate"))).toEqual(
      REQUIRED_RUNTIME.filter((path) => path.includes("release-candidate")).sort()
    );
    expect(REQUIRED_RUNTIME.some((path) => /\.(zip|7z|tar|gz|pck|sig|enc)$/i.test(path))).toBe(false);
    expect((await untrackedDistFiles())).toEqual([]);
  });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(path);
  return path;
}

async function reachableRuntimeFiles(buildRoot: string, entry: string): Promise<string[]> {
  const pending = [entry];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(join(buildRoot, current), "utf8");
    for (const specifier of localImports(source)) {
      const imported = relative(buildRoot, resolve(dirname(join(buildRoot, current)), specifier)).split(sep).join("/");
      if (!imported.startsWith("../") && imported.endsWith(".js")) pending.push(imported);
    }
  }
  return [...visited].sort();
}

function localImports(source: string): string[] {
  const imports = new Set<string>();
  const pattern = /(?:from\s+|import\s*\()(["'])(\.\.?\/[^"']+\.js)\1/g;
  for (const match of source.matchAll(pattern)) imports.add(match[2]!);
  return [...imports];
}

async function stagedFile(path: string): Promise<Buffer> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `:${path}`], { cwd: root, encoding: "buffer" });
    return stdout;
  } catch {
    throw new Error(`staged runtime missing: ${path}`);
  }
}

async function untrackedDistFiles(): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["ls-files", "--others", "--exclude-standard", "dist/*.js"], { cwd: root });
  return stdout.trim().split("\n").filter(Boolean);
}

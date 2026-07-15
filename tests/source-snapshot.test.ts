import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { generateSourceSnapshotManifest } from "../src/source-snapshot.js";

const FIXED_TIME = "2026-07-07T00:00:00.000Z";
const FIXED_COMMIT = {
  sha: "0123456789abcdef0123456789abcdef01234567",
  branch: "main"
};

describe("source snapshot manifest dry run", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-snapshot-"));
    await createSnapshotFixture(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("generates deterministic output for identical inputs", async () => {
    const first = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT,
      verification: [{ command: "npm test", ok: true }]
    });
    const second = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT,
      verification: [{ command: "npm test", ok: true }]
    });

    expect(second).toEqual(first);
    expect(first.ok).toBe(true);
    expect(first.manifest.generatedAt).toBe(FIXED_TIME);
    expect(first.manifest.commit).toEqual(FIXED_COMMIT);
  });

  test("includes sorted relative file entries with sha256 coverage", async () => {
    const manifest = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });
    const paths = manifest.manifest.files.map((file) => file.path);
    const packageEntry = manifest.manifest.files.find((file) => file.path === "package.json");

    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("tests/example.test.ts");
    expect(paths.every((path) => !path.startsWith(root))).toBe(true);
    expect(manifest.manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(packageEntry?.sha256).toBe(sha256("{\"name\":\"fixture\",\"version\":\"1.2.3\"}\n"));
  });

  test("records dry-run release boundaries", async () => {
    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });

    expect(result.ok).toBe(true);
    expect(result.manifest.boundaries).toContain("no archive created");
    expect(result.manifest.boundaries).toContain("no package signing performed");
    expect(result.manifest.boundaries).toContain("no content encryption performed");
    expect(result.manifest.boundaries).toContain("no Workshop upload attempted");
    expect(result.manifest.boundaries).toContain("no Steam login captured");
    expect(result.manifest.boundaries).toContain("no remote Windows connection attempted");
    expect(result.manifest.boundaries).toContain("no global install performed");
  });

  test("uses archived milestone requirements as explicit source coverage after completion", async () => {
    await rm(join(root, ".planning/REQUIREMENTS.md"));
    await mkdir(join(root, ".planning/milestones/v1.14-phases/03-safe-candidate-assembly"), { recursive: true });
    await writeFile(join(root, ".planning/milestones/v1.14-REQUIREMENTS.md"), "# Archived Requirements\n");
    await writeFile(join(root, ".planning/milestones/v1.14-ROADMAP.md"), "# Archived Roadmap\n");
    await writeFile(join(root, ".planning/milestones/v1.14-MILESTONE-AUDIT.md"), "# Archived Audit\n");
    await writeFile(
      join(root, ".planning/milestones/v1.14-phases/03-safe-candidate-assembly/03-SUMMARY.md"),
      "# Archived Phase Summary\n"
    );

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });
    const paths = result.manifest.files.map((file) => file.path);

    expect(result.ok).toBe(true);
    expect(paths).toContain(".planning/milestones/v1.14-REQUIREMENTS.md");
    expect(paths).toContain(".planning/milestones/v1.14-ROADMAP.md");
    expect(paths).toContain(".planning/milestones/v1.14-MILESTONE-AUDIT.md");
    expect(paths).toContain(".planning/milestones/v1.14-phases/03-safe-candidate-assembly/03-SUMMARY.md");
    expect(result.manifest.blockers).not.toContainEqual(expect.objectContaining({
      code: "REQUIRED_SOURCE_PATH_MISSING",
      path: ".planning/REQUIREMENTS.md"
    }));
  });

  test.each([
    "v1.14-ROADMAP.md",
    "v1.14-MILESTONE-AUDIT.md",
    "v1.14-phases"
  ])("blocks incomplete archived planning source when %s is absent", async (missingPath) => {
    await rm(join(root, ".planning/REQUIREMENTS.md"));
    await mkdir(join(root, ".planning/milestones/v1.14-phases"), { recursive: true });
    await writeFile(join(root, ".planning/milestones/v1.14-REQUIREMENTS.md"), "# Archived Requirements\n");
    await writeFile(join(root, ".planning/milestones/v1.14-ROADMAP.md"), "# Archived Roadmap\n");
    await writeFile(join(root, ".planning/milestones/v1.14-MILESTONE-AUDIT.md"), "# Archived Audit\n");
    await rm(join(root, `.planning/milestones/${missingPath}`), { recursive: true, force: true });

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });

    expect(result.ok).toBe(false);
    expect(result.manifest.blockers).toContainEqual({
      code: "REQUIRED_SOURCE_PATH_MISSING",
      path: `.planning/milestones/${missingPath}`,
      field: "files",
      category: "source coverage"
    });
  });

  test("blocks an active requirements directory instead of falling back to an archive", async () => {
    await rm(join(root, ".planning/REQUIREMENTS.md"));
    await mkdir(join(root, ".planning/REQUIREMENTS.md"));
    await mkdir(join(root, ".planning/milestones/v1.14-phases"), { recursive: true });
    await writeFile(join(root, ".planning/milestones/v1.14-REQUIREMENTS.md"), "# Archived Requirements\n");
    await writeFile(join(root, ".planning/milestones/v1.14-ROADMAP.md"), "# Archived Roadmap\n");
    await writeFile(join(root, ".planning/milestones/v1.14-MILESTONE-AUDIT.md"), "# Archived Audit\n");

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });

    expect(result.ok).toBe(false);
    expect(result.manifest.blockers).toContainEqual({
      code: "REQUIRED_SOURCE_PATH_INVALID",
      path: ".planning/REQUIREMENTS.md",
      field: "files",
      category: "source coverage"
    });
    expect(result.manifest.files.some((file) => file.path.includes("v1.14"))).toBe(false);
  });

  test("blocks requirements coverage when active and archived sources are both absent", async () => {
    await rm(join(root, ".planning/REQUIREMENTS.md"));

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });

    expect(result.ok).toBe(false);
    expect(result.manifest.blockers).toContainEqual({
      code: "REQUIRED_SOURCE_PATH_MISSING",
      path: ".planning/REQUIREMENTS.md",
      field: "files",
      category: "source coverage"
    });
  });

  test("selects only the latest archived milestone planning source", async () => {
    await rm(join(root, ".planning/REQUIREMENTS.md"));
    await mkdir(join(root, ".planning/milestones/v1.13-phases/01-legacy"), { recursive: true });
    await mkdir(join(root, ".planning/milestones/v1.14-phases/03-current"), { recursive: true });
    await writeFile(join(root, ".planning/milestones/v1.13-REQUIREMENTS.md"), "# Legacy Requirements\n");
    await writeFile(
      join(root, ".planning/milestones/v1.13-phases/01-legacy/01-SUMMARY.md"),
      `legacy path: ${["", "Users", "private", "legacy"].join("/")}\n`
    );
    await writeFile(join(root, ".planning/milestones/v1.14-REQUIREMENTS.md"), "# Current Requirements\n");
    await writeFile(join(root, ".planning/milestones/v1.14-ROADMAP.md"), "# Current Roadmap\n");
    await writeFile(join(root, ".planning/milestones/v1.14-MILESTONE-AUDIT.md"), "# Current Audit\n");
    await writeFile(join(root, ".planning/milestones/v1.14-phases/03-current/03-SUMMARY.md"), "# Current Summary\n");

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });
    const paths = result.manifest.files.map((file) => file.path);

    expect(result.ok).toBe(true);
    expect(paths).toContain(".planning/milestones/v1.14-REQUIREMENTS.md");
    expect(paths).toContain(".planning/milestones/v1.14-phases/03-current/03-SUMMARY.md");
    expect(paths.some((path) => path.includes("v1.13"))).toBe(false);
  });

  test("blocks the latest archived requirements path when its type is invalid", async () => {
    await rm(join(root, ".planning/REQUIREMENTS.md"));
    await mkdir(join(root, ".planning/milestones/v1.14-phases"), { recursive: true });
    await writeFile(join(root, ".planning/milestones/v1.14-REQUIREMENTS.md"), "# Older Requirements\n");
    await writeFile(join(root, ".planning/milestones/v1.14-ROADMAP.md"), "# Older Roadmap\n");
    await writeFile(join(root, ".planning/milestones/v1.14-MILESTONE-AUDIT.md"), "# Older Audit\n");
    await mkdir(join(root, ".planning/milestones/v1.15-REQUIREMENTS.md"));

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });

    expect(result.ok).toBe(false);
    expect(result.manifest.blockers).toContainEqual({
      code: "REQUIRED_SOURCE_PATH_INVALID",
      path: ".planning/milestones/v1.15-REQUIREMENTS.md",
      field: "files",
      category: "source coverage"
    });
    expect(result.manifest.files.some((file) => file.path.includes("v1.14"))).toBe(false);
  });

  test("blocks sensitive material without including the sensitive value", async () => {
    const sensitiveValue = ["steam", "password", "plain", "text"].join("_");
    await writeFile(join(root, "docs/secret.md"), `credential=${sensitiveValue}\n`);

    const result = await generateSourceSnapshotManifest({
      root,
      generatedAt: FIXED_TIME,
      commit: FIXED_COMMIT
    });
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(false);
    expect(result.manifest.blockers.map((blocker) => blocker.code)).toContain("SENSITIVE_MATERIAL_FOUND");
    expect(serialized).toContain("docs/secret.md");
    expect(serialized).not.toContain(sensitiveValue);
  });
});

async function createSnapshotFixture(root: string): Promise<void> {
  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await mkdir(join(root, ".planning/phases/01-fixture"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "examples/workflows"), { recursive: true });
  await mkdir(join(root, "skills/dota2-workshop-tools/references"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });

  await writeFile(join(root, ".codex-plugin/plugin.json"), "{\"name\":\"fixture\"}\n");
  await writeFile(join(root, ".mcp.json"), "{\"mcpServers\":{}}\n");
  await writeFile(join(root, ".planning/REQUIREMENTS.md"), "# Requirements\n");
  await writeFile(join(root, ".planning/phases/01-fixture/01-SPEC.md"), "# Spec\n");
  await writeFile(join(root, "docs/runbook.md"), "# Runbook\n");
  await writeFile(join(root, "examples/workflows/fixture.json"), "{}\n");
  await writeFile(join(root, "package.json"), "{\"name\":\"fixture\",\"version\":\"1.2.3\"}\n");
  await writeFile(join(root, "skills/dota2-workshop-tools/SKILL.md"), "# Skill\n");
  await writeFile(join(root, "skills/dota2-workshop-tools/references/layout.md"), "# Layout\n");
  await writeFile(join(root, "src/index.ts"), "export const value = 1;\n");
  await writeFile(join(root, "tests/example.test.ts"), "export const testName = 'fixture';\n");
  await writeFile(join(root, "tsconfig.json"), "{\"compilerOptions\":{}}\n");
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

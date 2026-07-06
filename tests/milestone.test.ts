import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { ReleaseHandoffResult } from "../src/handoff.js";

async function createMilestoneFixture(options: {
  omitReadmeMilestone?: boolean;
  omitRunbookMilestone?: boolean;
} = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dota-milestone-fixture-"));
  await mkdir(join(root, "docs"), { recursive: true });

  await writeFile(join(root, "README.md"), [
    "# Dota Workshop Project",
    "",
    "Run `npm run build`, `npm run verify:plugin`, `npm run verify:rc`, and `npm run verify:handoff` before handoff.",
    options.omitReadmeMilestone ? "" : "Run `npm run verify:milestone` before release notes review.",
    "Use [docs/operator-runbook.md](docs/operator-runbook.md).",
    "The milestone gate is local-only and does not upload, log into Steam, handle Steam Guard, encrypt content, sign packages, store credentials, or connect to remote Windows.",
    ""
  ].join("\n"));

  await writeFile(join(root, "docs/operator-runbook.md"), [
    "# Operator Runbook",
    "",
    "Run `npm install`, `npm run build`, `npm run verify:plugin`, `npm run verify:rc`, and `npm run verify:handoff` before use.",
    options.omitRunbookMilestone ? "" : "Run `npm run verify:milestone` before milestone closeout review.",
    "Fixture workflow uses examples/workflows without Dota.",
    "Optional remote smoke uses runtime-only target details.",
    "Cleanup is explicit and addon-scoped.",
    "Do not store credentials, tokens, passwords, private keys, private host data, or private target data.",
    ""
  ].join("\n"));

  return root;
}

function passingHandoffResult(root: string): ReleaseHandoffResult {
  return {
    ok: true,
    commit: {
      sha: "7c0d3bfd7224a6ed82a97eaf7b6f6f038590cb1d",
      command: "git rev-parse HEAD"
    },
    verification: {
      releaseCandidate: {
        ok: true,
        commands: [
          { command: "npm run verify:plugin", exitCode: 0, stdout: `${root}/package.json ok`, stderr: "", durationMs: 1 },
          { command: "npm test -- tests/examples.test.ts", exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
          { command: "npm run typecheck", exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
          { command: "npm test", exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
          { command: "npm run build", exitCode: 0, stdout: "", stderr: "", durationMs: 1 }
        ],
        blockers: []
      }
    },
    delivery: {
      ok: true,
      items: [
        { label: "README", path: "README.md", ok: true, evidence: ["README.md exists"] },
        { label: "operator runbook", path: "docs/operator-runbook.md", ok: true, evidence: ["docs/operator-runbook.md exists"] },
        { label: "workflow examples", path: "examples/workflows", ok: true, evidence: ["workflow examples found: 4"] }
      ]
    },
    boundaries: {
      ok: true,
      items: [
        { label: "no real Workshop upload", ok: true, evidence: "handoff boundary" },
        { label: "no Steam login", ok: true, evidence: "handoff boundary" },
        { label: "no Steam Guard handling", ok: true, evidence: "handoff boundary" },
        { label: "no content encryption", ok: true, evidence: "handoff boundary" },
        { label: "no package signing", ok: true, evidence: "handoff boundary" },
        { label: "no credential or private target storage", ok: true, evidence: "handoff boundary" },
        { label: "no remote Windows connection", ok: true, evidence: "handoff boundary" }
      ]
    },
    evidence: ["handoff RC preflight passed", "handoff documentation coverage passed"],
    warnings: [],
    blockers: [],
    paths: {
      readme: "README.md",
      operatorRunbook: "docs/operator-runbook.md",
      examples: "examples/workflows"
    }
  };
}

describe("milestone closeout readiness", () => {
  test("package exposes verify:milestone from built output", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["verify:milestone"]).toBe("node ./dist/verify-milestone.js");
  });

  test("aggregates handoff preflight, v1.2-v1.7 inventory, docs, and boundaries", async () => {
    const { verifyMilestoneCloseout } = await import("../src/milestone.js");
    const root = await createMilestoneFixture();
    try {
      const result = await verifyMilestoneCloseout({
        root,
        handoffVerifier: async () => passingHandoffResult(root)
      });

      expect(result.ok).toBe(true);
      expect(result.milestone.version).toBe("v1.8");
      expect(result.handoff.ok).toBe(true);
      expect(result.commitRange).toEqual({
        from: "ba6856fa170d97dea677a42293fc3d2c12eda012",
        to: "7c0d3bfd7224a6ed82a97eaf7b6f6f038590cb1d",
        label: "v1.2-v1.7"
      });
      expect(result.versions.map((entry) => entry.version)).toEqual(["v1.2", "v1.3", "v1.4", "v1.5", "v1.6", "v1.7"]);
      expect(result.versions.map((entry) => entry.commit)).toEqual([
        "ba6856fa170d97dea677a42293fc3d2c12eda012",
        "c2ae5b36b82e3e826025d5ecf01d2d95fafbca1b",
        "37d436f56c21daa9a7277622db5239fceda4e4b0",
        "62c08d143d7b2fb70d1c6c9293cadafd5acf32d0",
        "1f5b722e7e413b3e19388ba37c2a052d818704c0",
        "7c0d3bfd7224a6ed82a97eaf7b6f6f038590cb1d"
      ]);
      expect(result.documentation.items.map((item) => item.label)).toEqual(["README", "operator runbook", "handoff report"]);
      expect(result.boundaries.items.map((item) => item.label)).toEqual([
        "no real Workshop upload",
        "no Steam login",
        "no Steam Guard handling",
        "no content encryption",
        "no package signing",
        "no credential or private target storage",
        "no remote Windows connection"
      ]);
      expect(result.remainingNonBlockingItems).toContain("same-machine local Windows MCP server smoke remains optional supporting evidence");
      expect(result.blockers).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks handoff preflight failures without leaking values", async () => {
    const { verifyMilestoneCloseout } = await import("../src/milestone.js");
    const root = await createMilestoneFixture();
    try {
      const result = await verifyMilestoneCloseout({
        root,
        handoffVerifier: async () => ({
          ...passingHandoffResult(root),
          ok: false,
          blockers: [
            {
              code: "HANDOFF_DOC_COVERAGE_MISSING",
              message: `Operator runbook is missing coverage in ${root}/docs/operator-runbook.md`,
              file: "docs/operator-runbook.md"
            }
          ]
        })
      });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("HANDOFF_DOC_COVERAGE_MISSING");
      expect(JSON.stringify(result)).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks missing milestone documentation coverage", async () => {
    const { verifyMilestoneCloseout } = await import("../src/milestone.js");
    const root = await createMilestoneFixture({ omitRunbookMilestone: true });
    try {
      const result = await verifyMilestoneCloseout({
        root,
        handoffVerifier: async () => passingHandoffResult(root)
      });

      expect(result.ok).toBe(false);
      expect(result.blockers).toContainEqual({
        code: "MILESTONE_DOC_COVERAGE_MISSING",
        message: "Operator runbook is missing coverage: npm run verify:milestone",
        file: "docs/operator-runbook.md"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

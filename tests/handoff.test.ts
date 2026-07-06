import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { ReleaseCandidateVerificationResult } from "../src/rc.js";

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function createHandoffFixture(options: {
  omitSkillReference?: boolean;
  omitRunbookHandoff?: boolean;
} = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dota-handoff-fixture-"));
  const skillDir = join(root, "skills/dota2-workshop-tools");
  const referencesDir = join(skillDir, "references");

  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(referencesDir, { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "examples/workflows"), { recursive: true });

  await writeJson(join(root, ".codex-plugin/plugin.json"), {
    name: "dota-workshop-tools",
    skills: "./skills/",
    mcpServers: "./.mcp.json"
  });
  await writeJson(join(root, ".mcp.json"), {
    mcpServers: {
      "dota-workshop-tools": {
        command: "node",
        args: ["./dist/index.js"]
      }
    }
  });
  await writeJson(join(root, "package.json"), {
    bin: {
      "dota-workshop-mcp": "./dist/index.js"
    },
    scripts: {
      "verify:plugin": "node ./dist/verify-plugin.js",
      "verify:rc": "node ./dist/verify-rc.js",
      "verify:handoff": "node ./dist/verify-handoff.js"
    }
  });

  await writeFile(join(root, "dist/index.js"), "#!/usr/bin/env node\n");
  await writeFile(join(root, "dist/verify-handoff.js"), "#!/usr/bin/env node\n");
  await writeFile(join(root, "dist/verify-rc.js"), "#!/usr/bin/env node\n");
  await writeFile(join(root, "dist/verify-plugin.js"), "#!/usr/bin/env node\n");
  await writeFile(join(referencesDir, "remote-control.md"), "# Remote Control\n");
  await writeFile(join(skillDir, "SKILL.md"), [
    "---",
    "name: dota2-workshop-tools",
    "---",
    "",
    options.omitSkillReference ? "- Missing: `references/missing.md`" : "- Remote control: `references/remote-control.md`",
    ""
  ].join("\n"));

  await writeFile(join(root, "README.md"), [
    "# Dota Workshop Project",
    "",
    "Run `npm run build`, `npm run verify:plugin`, `npm run verify:rc`, and `npm run verify:handoff` before handoff.",
    "Use [docs/operator-runbook.md](docs/operator-runbook.md).",
    "The handoff gate is local-only and does not upload, log into Steam, handle Steam Guard, encrypt content, sign packages, store credentials, or connect to remote Windows.",
    ""
  ].join("\n"));

  await writeFile(join(root, "docs/operator-runbook.md"), [
    "# Operator Runbook",
    "",
    "Run `npm install`, `npm run build`, `npm run verify:plugin`, `npm run verify:rc`",
    options.omitRunbookHandoff ? "before use." : "and `npm run verify:handoff` before use.",
    "Fixture workflow uses examples/workflows without Dota.",
    "Optional remote smoke uses runtime-only target details.",
    "Cleanup is explicit and addon-scoped.",
    "Do not store credentials, tokens, passwords, private keys, private host data, or private target data.",
    ""
  ].join("\n"));

  for (const name of [
    "fixture-create-addon.json",
    "fixture-preflight.json",
    "fixture-release-dry-run.json",
    "remote-playable-smoke.template.json"
  ]) {
    await writeJson(join(root, `examples/workflows/${name}`), {
      operation: "create_addon",
      target: { kind: "fixture", root: "/tmp/dota-fixture" },
      addonName: "demo_addon"
    });
  }

  return root;
}

function passingRcResult(root: string): ReleaseCandidateVerificationResult {
  return {
    ok: true,
    evidence: ["RC command gate passed: npm run verify:plugin", "RC repository scan passed"],
    warnings: [],
    blockers: [],
    paths: { root },
    commands: [
      { command: "npm run verify:plugin", exitCode: 0, stdout: `${root}/package.json ok`, stderr: "", durationMs: 1 },
      { command: "npm test -- tests/examples.test.ts", exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
      { command: "npm run typecheck", exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
      { command: "npm test", exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
      { command: "npm run build", exitCode: 0, stdout: "", stderr: "", durationMs: 1 }
    ]
  };
}

describe("release handoff readiness", () => {
  test("package exposes verify:handoff from built output", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["verify:handoff"]).toBe("node ./dist/verify-handoff.js");
  });

  test("aggregates commit, RC evidence, delivery checklist, docs, and boundaries", async () => {
    const { verifyReleaseHandoff } = await import("../src/handoff.js");
    const root = await createHandoffFixture();
    try {
      const result = await verifyReleaseHandoff({
        root,
        releaseCandidateVerifier: async () => passingRcResult(root),
        commandRunner: async (command) => ({
          command,
          exitCode: 0,
          stdout: "abc123\n",
          stderr: "",
          durationMs: 1
        })
      });

      expect(result.ok).toBe(true);
      expect(result.commit.sha).toBe("abc123");
      expect(result.verification.releaseCandidate.ok).toBe(true);
      expect(result.verification.releaseCandidate.commands.map((entry) => entry.command)).toEqual([
        "npm run verify:plugin",
        "npm test -- tests/examples.test.ts",
        "npm run typecheck",
        "npm test",
        "npm run build"
      ]);
      expect(result.delivery.items.map((item) => item.label)).toContain("plugin manifest");
      expect(result.delivery.items.map((item) => item.label)).toContain("workflow examples");
      expect(result.boundaries.items.map((item) => item.label)).toEqual([
        "no real Workshop upload",
        "no Steam login",
        "no Steam Guard handling",
        "no content encryption",
        "no package signing",
        "no credential or private target storage",
        "no remote Windows connection"
      ]);
      expect(result.blockers).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks missing delivery artifacts with relative paths", async () => {
    const { verifyReleaseHandoff } = await import("../src/handoff.js");
    const root = await createHandoffFixture({ omitSkillReference: true });
    try {
      const result = await verifyReleaseHandoff({
        root,
        releaseCandidateVerifier: async () => passingRcResult(root),
        commandRunner: async (command) => ({ command, exitCode: 0, stdout: "abc123\n", stderr: "", durationMs: 1 })
      });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("HANDOFF_SKILL_REFERENCE_MISSING");
      expect(result.blockers.map((blocker) => blocker.file)).toContain("skills/dota2-workshop-tools/references/missing.md");
      expect(JSON.stringify(result)).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks missing documentation coverage", async () => {
    const { verifyReleaseHandoff } = await import("../src/handoff.js");
    const root = await createHandoffFixture({ omitRunbookHandoff: true });
    try {
      const result = await verifyReleaseHandoff({
        root,
        releaseCandidateVerifier: async () => passingRcResult(root),
        commandRunner: async (command) => ({ command, exitCode: 0, stdout: "abc123\n", stderr: "", durationMs: 1 })
      });

      expect(result.ok).toBe(false);
      expect(result.blockers).toContainEqual({
        code: "HANDOFF_DOC_COVERAGE_MISSING",
        message: "Operator runbook is missing coverage: npm run verify:handoff",
        file: "docs/operator-runbook.md"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("includes RC blockers without leaking values", async () => {
    const { verifyReleaseHandoff } = await import("../src/handoff.js");
    const root = await createHandoffFixture();
    try {
      const result = await verifyReleaseHandoff({
        root,
        releaseCandidateVerifier: async () => ({
          ...passingRcResult(root),
          ok: false,
          blockers: [
            {
              code: "RC_FORBIDDEN_CONTENT",
              message: "RC forbidden content found: token assignment in docs/private.md",
              file: "docs/private.md",
              rule: "token assignment"
            }
          ]
        }),
        commandRunner: async (command) => ({ command, exitCode: 0, stdout: "abc123\n", stderr: "", durationMs: 1 })
      });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("RC_FORBIDDEN_CONTENT");
      expect(JSON.stringify(result)).not.toContain("secret-value");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function createInstallFixture(options: {
  omitDistIndex?: boolean;
  skillContent?: string;
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "dota-install-fixture-"));
  const skillRoot = join(root, "skills/dota2-workshop-tools");

  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(skillRoot, { recursive: true });

  await writeJson(join(root, ".codex-plugin/plugin.json"), {
    name: "dota-workshop-tools",
    version: "0.1.0",
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
    name: "dota-workshop-project",
    version: "0.1.0",
    bin: {
      "dota-workshop-mcp": "./dist/index.js"
    },
    scripts: {
      "verify:install-simulation": "node ./dist/verify-install-simulation.js"
    }
  });

  if (!options.omitDistIndex) {
    await writeFile(join(root, "dist/index.js"), "#!/usr/bin/env node\n");
  }

  await writeFile(
    join(skillRoot, "SKILL.md"),
    options.skillContent ?? "# Dota Workshop Tools\n\nSafe local install simulation fixture.\n"
  );

  return root;
}

function selectedEnvironment() {
  return {
    CODEX_HOME: process.env.CODEX_HOME,
    HOME: process.env.HOME,
    PATH: process.env.PATH
  };
}

describe("local install simulation", () => {
  test("package exposes install simulation verifier script", async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["verify:install-simulation"]).toBe("node ./dist/verify-install-simulation.js");
  });

  test("copies install-facing plugin files into an isolated temporary layout and cleans it up", async () => {
    const root = await createInstallFixture();
    const tempParent = await mkdtemp(join(tmpdir(), "dota-install-parent-"));
    try {
      const { simulateLocalInstall } = await import("../src/install-simulation.js");
      const result = await simulateLocalInstall({ root, tempParent });

      expect(result.ok).toBe(true);
      expect(result.evidence).toContain("install simulation root is isolated");
      expect(result.evidence).toContain("plugin manifest exists in simulation");
      expect(result.evidence).toContain("MCP config points to node ./dist/index.js");
      expect(result.evidence).toContain("package bin points to ./dist/index.js");
      expect(result.evidence).toContain("skill file exists in simulation");
      expect(result.evidence).toContain("cleanup removed simulation root");
      expect(result.cleanup.removed).toBe(true);
      expect(result.paths.simulationRoot.startsWith(tempParent)).toBe(true);
      await expect(access(result.paths.simulationRoot)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(tempParent, { recursive: true, force: true });
    }
  });

  test("blocks missing dist entrypoint with cleanup still performed", async () => {
    const root = await createInstallFixture({ omitDistIndex: true });
    const tempParent = await mkdtemp(join(tmpdir(), "dota-install-parent-"));
    try {
      const { simulateLocalInstall } = await import("../src/install-simulation.js");
      const result = await simulateLocalInstall({ root, tempParent });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("SIM_DIST_INDEX_MISSING");
      expect(result.cleanup.removed).toBe(true);
      await expect(access(result.paths.simulationRoot)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(tempParent, { recursive: true, force: true });
    }
  });

  test("blocks sensitive material without leaking matched values", async () => {
    const secretValue = ["super", "secret", "value", "123"].join("");
    const root = await createInstallFixture({
      skillContent: `# Dota Workshop Tools\n\ncredential_password = "${secretValue}"\n`
    });
    const tempParent = await mkdtemp(join(tmpdir(), "dota-install-parent-"));
    try {
      const { simulateLocalInstall } = await import("../src/install-simulation.js");
      const result = await simulateLocalInstall({ root, tempParent });
      const serialized = JSON.stringify(result);

      expect(result.ok).toBe(false);
      expect(result.blockers).toContainEqual(expect.objectContaining({
        code: "SIM_SENSITIVE_MATERIAL_FOUND",
        path: "skills/dota2-workshop-tools/SKILL.md",
        category: "credential"
      }));
      expect(serialized).not.toContain(secretValue);
      expect(result.cleanup.removed).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(tempParent, { recursive: true, force: true });
    }
  });

  test("does not mutate selected environment variables", async () => {
    const root = await createInstallFixture();
    const before = selectedEnvironment();
    try {
      const { simulateLocalInstall } = await import("../src/install-simulation.js");
      const result = await simulateLocalInstall({ root });

      expect(selectedEnvironment()).toEqual(before);
      expect(result.evidence).toContain("selected environment variables unchanged");
      expect(result.evidence).toContain("global install not performed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

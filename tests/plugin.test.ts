import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { toolNames } from "../src/tools.js";
import { verifyPluginPackage } from "../src/plugin.js";

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function createPluginFixture(options: {
  omitPluginManifest?: boolean;
  mcpArgs?: string[];
  skillReferences?: string[];
  readmeTools?: string[];
  skillTools?: string[];
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "dota-plugin-fixture-"));
  const skillDir = join(root, "skills/dota2-workshop-tools");
  const referencesDir = join(skillDir, "references");

  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(referencesDir, { recursive: true });

  if (!options.omitPluginManifest) {
    await writeJson(join(root, ".codex-plugin/plugin.json"), {
      name: "dota-workshop-tools",
      version: "0.1.0",
      skills: "./skills/",
      mcpServers: "./.mcp.json"
    });
  }

  await writeJson(join(root, ".mcp.json"), {
    mcpServers: {
      "dota-workshop-tools": {
        command: "node",
        args: options.mcpArgs ?? ["./dist/index.js"]
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
      "verify:plugin": "node ./dist/verify-plugin.js"
    }
  });

  await writeFile(join(root, "dist/index.js"), "#!/usr/bin/env node\n");

  const skillReferences = options.skillReferences ?? ["references/remote-control.md"];
  const skillTools = options.skillTools ?? [...toolNames];
  await writeFile(join(skillDir, "SKILL.md"), [
    "---",
    "name: dota2-workshop-tools",
    "---",
    "",
    "2. Read only the reference needed for the task:",
    ...skillReferences.map((path) => `   - Remote control: \`${path}\``),
    "",
    "Expected v1 operations:",
    "",
    ...skillTools.map((tool) => `- \`${tool}\``),
    ""
  ].join("\n"));

  await writeFile(join(referencesDir, "remote-control.md"), "# Remote Control\n");

  const readmeTools = options.readmeTools ?? [...toolNames];
  await writeFile(join(root, "README.md"), [
    "# Dota Workshop Project",
    "",
    "## MCP Tools",
    "",
    "The server exposes these logical operations:",
    "",
    ...readmeTools.map((tool) => `- \`${tool}\``),
    "",
    "## Targets",
    ""
  ].join("\n"));

  return root;
}

describe("plugin readiness verifier", () => {
  test("keeps candidate preflight discoverable in canonical operator surfaces", async () => {
    const readme = await readFile("README.md", "utf8");
    const readmeToolList = readme.slice(
      readme.indexOf("## MCP Tools"),
      readme.indexOf("## Targets")
    );
    expect(readmeToolList.match(/`preflight_release_candidate`/g)).toHaveLength(1);

    const skill = await readFile("skills/dota2-workshop-tools/SKILL.md", "utf8");
    const skillToolList = skill.slice(
      skill.indexOf("Expected v1 operations:"),
      skill.indexOf("Every result must make failures visible.")
    );
    expect(skillToolList.match(/`preflight_release_candidate`/g)).toHaveLength(1);
  });

  test("passes a complete plugin handoff fixture", async () => {
    const root = await createPluginFixture();
    try {
      const result = await verifyPluginPackage({ root });

      expect(result.ok).toBe(true);
      expect(result.blockers).toEqual([]);
      expect(result.evidence).toContain("plugin manifest exists");
      expect(result.evidence).toContain("README tool list matches toolNames");
      expect(result.evidence).toContain("skill tool list matches toolNames");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks missing plugin manifest", async () => {
    const root = await createPluginFixture({ omitPluginManifest: true });
    try {
      const result = await verifyPluginPackage({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("PLUGIN_MANIFEST_MISSING");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks bad MCP entrypoint", async () => {
    const root = await createPluginFixture({ mcpArgs: ["./src/index.ts"] });
    try {
      const result = await verifyPluginPackage({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("MCP_ENTRYPOINT_INVALID");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks missing skill references", async () => {
    const root = await createPluginFixture({ skillReferences: ["references/missing.md"] });
    try {
      const result = await verifyPluginPackage({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("SKILL_REFERENCE_MISSING");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks extra documented tools", async () => {
    const root = await createPluginFixture({ readmeTools: [...toolNames, "link_addon"] });
    try {
      const result = await verifyPluginPackage({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("README_TOOL_EXTRA");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks missing documented tools", async () => {
    const root = await createPluginFixture({ skillTools: toolNames.slice(0, -1) });
    try {
      const result = await verifyPluginPackage({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("SKILL_TOOL_MISSING");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

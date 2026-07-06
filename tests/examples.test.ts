import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { toolNames } from "../src/tools.js";
import {
  CreateAddonInputSchema,
  DryRunReleaseReportInputSchema,
  InspectWorkshopPreflightInputSchema,
  RunPlayableSmokeInputSchema
} from "../src/schemas.js";

const workflowDir = "examples/workflows";
const requiredExamples = [
  "fixture-create-addon.json",
  "fixture-preflight.json",
  "fixture-release-dry-run.json",
  "remote-playable-smoke.template.json"
];

const schemasByOperation: Record<string, z.ZodTypeAny> = {
  create_addon: CreateAddonInputSchema,
  inspect_workshop_preflight: InspectWorkshopPreflightInputSchema,
  dry_run_release_report: DryRunReleaseReportInputSchema,
  run_playable_smoke: RunPlayableSmokeInputSchema
};

const forbiddenPatterns = [
  new RegExp(["192", "168", "50", "42"].join("\\.")),
  new RegExp(["120", "120a"].join("")),
  new RegExp(`\\b${["che", "na"].join("")}\\b`),
  new RegExp(["dfs", "team", "v2"].join(""), "i"),
  /BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY/,
  /ghp_[A-Za-z0-9_]+/,
  /github_pat_[A-Za-z0-9_]+/,
  /password"\s*:/i,
  /token"\s*:/i,
  /steam(password|guard|login|credential)/i
];

type WorkflowExample = {
  operation: string;
  input: unknown;
  notes?: string[];
};

async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function readExample(name: string): Promise<WorkflowExample> {
  return JSON.parse(await readText(join(workflowDir, name))) as WorkflowExample;
}

describe("operator runbook and workflow examples", () => {
  test("required runbook and examples exist", async () => {
    const runbook = await readText("docs/operator-runbook.md");
    const exampleNames = await readdir(workflowDir);

    expect(runbook).toContain("npm run build");
    expect(runbook).toContain("npm run verify:plugin");
    expect(runbook).toContain("Process launch is not validation success");
    expect(runbook).toContain("runtime-only");
    for (const name of requiredExamples) {
      expect(exampleNames).toContain(name);
    }
  });

  test("examples use known operations and schema-valid inputs", async () => {
    for (const name of requiredExamples) {
      const example = await readExample(name);

      expect(toolNames).toContain(example.operation as typeof toolNames[number]);
      const schema = schemasByOperation[example.operation];
      expect(schema, `${name} uses an operation with a schema mapping`).toBeDefined();
      expect(() => schema.parse(example.input)).not.toThrow();
    }
  });

  test("runbook and examples contain no private or credential-like material", async () => {
    const paths = [
      "docs/operator-runbook.md",
      ...requiredExamples.map((name) => join(workflowDir, name))
    ];

    for (const path of paths) {
      const content = await readText(path);
      for (const pattern of forbiddenPatterns) {
        expect(content, `${path} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test("README links to runbook and safe examples", async () => {
    const readme = await readText("README.md");

    expect(readme).toContain("docs/operator-runbook.md");
    expect(readme).toContain("examples/workflows/");
    expect(readme).toContain("safe templates");
    expect(readme).toContain("not upload automation");
  });
});

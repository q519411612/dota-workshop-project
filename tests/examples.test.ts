import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { toolNames } from "../src/tools.js";
import {
  CreateAddonInputSchema,
  DryRunReleaseReportInputSchema,
  InspectWorkshopPreflightInputSchema,
  CleanupExportedCandidateInputSchema,
  ExportReleaseCandidateInputSchema,
  PreflightReleaseCandidateInputSchema,
  RunPlayableSmokeInputSchema
} from "../src/schemas.js";

const workflowDir = "examples/workflows";
const requiredExamples = [
  "fixture-create-addon.json",
  "fixture-preflight.json",
  "fixture-release-dry-run.json",
  "fixture-release-candidate-preflight.json",
  "fixture-release-candidate-export.json",
  "fixture-exported-candidate-cleanup.json",
  "remote-playable-smoke.template.json"
];

const schemasByOperation: Record<string, z.ZodTypeAny> = {
  create_addon: CreateAddonInputSchema,
  inspect_workshop_preflight: InspectWorkshopPreflightInputSchema,
  dry_run_release_report: DryRunReleaseReportInputSchema,
  preflight_release_candidate: PreflightReleaseCandidateInputSchema,
  export_release_candidate: ExportReleaseCandidateInputSchema,
  cleanup_exported_candidate: CleanupExportedCandidateInputSchema,
  run_playable_smoke: RunPlayableSmokeInputSchema
};

const forbiddenPatterns = [
  /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/,
  /BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY/,
  /ghp_[A-Za-z0-9_]+/,
  /github_pat_[A-Za-z0-9_]+/,
  /password"\s*:/i,
  /\bpassword\b\s*[:=]/i,
  /token"\s*:/i,
  /\btoken\b\s*[:=]/i,
  /steam[_-]?(password|guard|login|credential)\b/i
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

  test("candidate preflight guidance preserves the evidence-only release boundary", async () => {
    const paths = [
      "README.md",
      "skills/dota2-workshop-tools/SKILL.md",
      "skills/dota2-workshop-tools/references/remote-control.md",
      "docs/operator-runbook.md"
    ];
    for (const path of paths) {
      const content = await readText(path);
      expect(content).toContain("preflight_release_candidate");
      expect(content).toContain("contract evidence");
      expect(content).toContain("no candidate remains to upload");
      expect(content).toContain("not an official Valve upload payload");
    }
    const runbook = await readText("docs/operator-runbook.md");
    expect(runbook).toContain("manifest plus verified cleanup proof");
    expect(runbook).toContain("does not prove real Windows reparse, canonicalization, transport, or cleanup behavior");
    expect(runbook).toContain("authorization is external runtime configuration");
  });
});

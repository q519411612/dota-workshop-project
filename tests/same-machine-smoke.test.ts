import { describe, expect, test } from "vitest";
import {
  createHarnessReadySameMachineSmokeArtifact,
  verifySameMachineSmokeEvidence
} from "../src/same-machine-smoke.js";

describe("same-machine Windows smoke evidence verifier", () => {
  test("accepts a harness-ready artifact without claiming runtime evidence passed", () => {
    const artifact = createHarnessReadySameMachineSmokeArtifact();

    const result = verifySameMachineSmokeEvidence(artifact);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("harness_ready");
    expect(result.runtimeEvidence).toBe("pending");
    expect(result.evidence).toContain("same-machine smoke harness ready");
    expect(result.warnings).toContain("real same-machine Windows runtime evidence is pending");
    expect(result.blockers).toEqual([]);
    expect(result.boundaries).toContain("no Workshop upload attempted");
    expect(result.boundaries).toContain("no Steam login captured");
  });

  test("blocks runtime-passed artifacts without marker log evidence", () => {
    const artifact = {
      ...createHarnessReadySameMachineSmokeArtifact(),
      status: "runtime_passed" as const,
      evidence: ["launch command captured"],
      logs: []
    };

    const result = verifySameMachineSmokeEvidence(artifact);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("runtime_passed");
    expect(result.runtimeEvidence).toBe("missing");
    expect(result.blockers.map((blocker) => blocker.code)).toContain("RUNTIME_MARKER_EVIDENCE_MISSING");
    expect(result.evidence).not.toContain("real same-machine Windows runtime evidence passed");
  });

  test("accepts runtime-passed artifacts with sanitized marker log evidence", () => {
    const addonName = "local_smoke_demo";
    const artifact = {
      ...createHarnessReadySameMachineSmokeArtifact(),
      status: "runtime_passed" as const,
      addonName,
      mapName: "dota",
      evidence: ["same-machine MCP server launched on Windows", "Dota custom game launch returned log evidence"],
      logs: [
        {
          source: "sanitized console log",
          lines: [
            `[VScript] [DOTA_WORKSHOP_MCP] addon loaded: ${addonName}`,
            `[VScript] [DOTA_WORKSHOP_MCP] win condition reached: ${addonName}`
          ]
        }
      ]
    };

    const result = verifySameMachineSmokeEvidence(artifact);

    expect(result.ok).toBe(true);
    expect(result.runtimeEvidence).toBe("passed");
    expect(result.evidence).toContain("real same-machine Windows runtime evidence passed");
    expect(result.blockers).toEqual([]);
  });

  test("rejects sensitive values without echoing them in blockers", () => {
    const secretValue = ["steam", "password", "plain", "text"].join("_");
    const artifact = {
      ...createHarnessReadySameMachineSmokeArtifact(),
      commands: [
        {
          command: `node ./dist/index.js --${secretValue}`
        }
      ],
      logs: [
        {
          source: "sanitized console log",
          lines: [`credential ${secretValue}`]
        }
      ]
    };

    const result = verifySameMachineSmokeEvidence(artifact);
    const serializedBlockers = JSON.stringify(result.blockers);

    expect(result.ok).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toContain("SENSITIVE_MATERIAL_FOUND");
    expect(serializedBlockers).not.toContain(secretValue);
  });
});

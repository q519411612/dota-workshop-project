import { describe, expect, test } from "vitest";
import { createFailureResult, createSuccessResult } from "../src/result.js";

describe("MCP result contract", () => {
  test("success results include the required evidence fields", () => {
    const result = createSuccessResult({
      target: { kind: "fixture", root: "/tmp/dota" },
      operation: "inspect_addon",
      evidence: ["addon exists"],
      paths: { gameAddon: "/tmp/dota/game/dota_addons/demo" },
      commands: [{ command: "inspect", cwd: "/tmp/dota" }],
      logs: [{ source: "fixture", lines: ["ok"] }]
    });

    expect(result).toMatchObject({
      ok: true,
      target: { kind: "fixture", root: "/tmp/dota" },
      operation: "inspect_addon",
      evidence: ["addon exists"],
      warnings: [],
      paths: { gameAddon: "/tmp/dota/game/dota_addons/demo" },
      commands: [{ command: "inspect", cwd: "/tmp/dota" }],
      logs: [{ source: "fixture", lines: ["ok"] }]
    });
  });

  test("failure results include stable error codes and evidence", () => {
    const result = createFailureResult({
      target: { kind: "local", dotaRoot: "C:/missing" },
      operation: "discover_environment",
      error: {
        code: "DOTA_INSTALL_NOT_FOUND",
        message: "Dota 2 install root was not found."
      },
      evidence: ["checked C:/missing"],
      paths: { dotaRoot: "C:/missing" }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      code: "DOTA_INSTALL_NOT_FOUND",
      message: "Dota 2 install root was not found."
    });
    expect(result.warnings).toEqual([]);
    expect(result.evidence).toEqual(["checked C:/missing"]);
  });
});

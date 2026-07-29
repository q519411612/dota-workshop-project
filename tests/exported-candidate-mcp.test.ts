import { describe, expect, test } from "vitest";
import {
  CleanupExportedCandidateInputSchema,
  ExportReleaseCandidateInputSchema
} from "../src/schemas.js";
import { createServer } from "../src/server.js";
import { handleTool, toolNames } from "../src/tools.js";
import type { ToolResult } from "../src/types.js";

function selected(operation: string, target: ToolResult["target"]): ToolResult {
  return {
    ok: false,
    target,
    operation,
    error: { code: "SELECTED", message: "selected" },
    evidence: [],
    warnings: [],
    paths: {},
    commands: [],
    logs: [],
    cleanup: {
      schemaVersion: "1.0",
      mode: operation === "cleanup_exported_candidate" ? "dry-run" : "export-failure",
      authorized: false,
      attempted: false,
      candidateRemoved: false,
      candidateAbsent: false,
      manifestRemoved: false,
      manifestAbsent: false,
      status: "not-reached"
    }
  };
}

describe("exported candidate MCP contract", () => {
  test("registers exactly two independent operations", () => {
    expect(toolNames.filter((name) => name === "export_release_candidate")).toHaveLength(1);
    expect(toolNames.filter((name) => name === "cleanup_exported_candidate")).toHaveLength(1);
    const server = createServer() as any;
    const registered = server._registeredTools ?? server.registeredTools;
    expect(Object.keys(registered)).toEqual(expect.arrayContaining([
      "preflight_release_candidate",
      "export_release_candidate",
      "cleanup_exported_candidate"
    ]));
  });

  test("uses closed export and cleanup schemas", () => {
    expect(ExportReleaseCandidateInputSchema.parse({
      target: { kind: "fixture", root: "/fixture" },
      addonName: "demo",
      exportRoot: "/exports",
      destination: "/exports/demo"
    })).toBeDefined();
    expect(() => ExportReleaseCandidateInputSchema.parse({
      target: { kind: "fixture", root: "/fixture" },
      addonName: "demo",
      exportRoot: "/exports",
      destination: "/exports/demo",
      overwrite: true
    })).toThrow();
    expect(() => CleanupExportedCandidateInputSchema.parse({
      target: { kind: "fixture", root: "/fixture" },
      exportRoot: "/exports",
      destination: "/exports/demo",
      ownershipId: "not-a-uuid",
      manifestVersion: "1.0",
      combinedSha256: "a".repeat(64)
    })).toThrow();
  });

  test.each([
    ["fixture", { kind: "fixture" as const, root: "/fixture" }],
    ["local", { kind: "local" as const, dotaRoot: "C:/Dota" }],
    ["ssh", { kind: "remote" as const, name: "target", transport: "ssh" as const, host: "private", dotaRoot: "C:/Dota" }],
    ["powershell", { kind: "remote" as const, name: "target", transport: "powershell" as const, host: "private", dotaRoot: "C:/Dota" }]
  ])("routes export and cleanup for %s without fallback", async (kind, target) => {
    const calls = { exportNode: 0, exportRemote: 0, cleanupNode: 0, cleanupRemote: 0 };
    const services = {
      preflightNodeReleaseCandidate: async () => selected("preflight_release_candidate", { kind: "local" }),
      preflightRemoteReleaseCandidate: async () => selected("preflight_release_candidate", { kind: "local" }),
      exportNodeReleaseCandidate: async () => { calls.exportNode += 1; return selected("export_release_candidate", target); },
      exportRemoteReleaseCandidate: async () => { calls.exportRemote += 1; return selected("export_release_candidate", target); },
      cleanupNodeExportedCandidate: async () => { calls.cleanupNode += 1; return selected("cleanup_exported_candidate", target); },
      cleanupRemoteExportedCandidate: async () => { calls.cleanupRemote += 1; return selected("cleanup_exported_candidate", target); }
    };
    await (handleTool as any)("export_release_candidate", {
      target,
      addonName: "demo",
      exportRoot: kind === "fixture" ? "/exports" : "C:/Exports",
      destination: kind === "fixture" ? "/exports/demo" : "C:/Exports/demo"
    }, services);
    await (handleTool as any)("cleanup_exported_candidate", {
      target,
      exportRoot: kind === "fixture" ? "/exports" : "C:/Exports",
      destination: kind === "fixture" ? "/exports/demo" : "C:/Exports/demo",
      ownershipId: "00000000-0000-4000-8000-000000000000",
      manifestVersion: "1.0",
      combinedSha256: "a".repeat(64),
      dryRun: true
    }, services);
    const remote = kind === "ssh" || kind === "powershell";
    expect(calls).toEqual({
      exportNode: remote ? 0 : 1,
      exportRemote: remote ? 1 : 0,
      cleanupNode: remote ? 0 : 1,
      cleanupRemote: remote ? 1 : 0
    });
  });
});


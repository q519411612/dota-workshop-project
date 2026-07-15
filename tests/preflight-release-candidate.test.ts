import { describe, expect, test } from "vitest";
import { PreflightReleaseCandidateInputSchema } from "../src/schemas.js";
import { createServer } from "../src/server.js";
import { asToolContent, handleTool, toolNames } from "../src/tools.js";
import type { ToolResult } from "../src/types.js";

function serviceResult(kind: "fixture" | "local" | "ssh" | "powershell"): ToolResult {
  const target = kind === "fixture"
    ? { kind: "fixture" as const, root: "/redacted" }
    : kind === "local"
      ? { kind: "local" as const }
      : { kind: "remote" as const, name: "remote-target", transport: kind, host: "redacted" };
  return {
    ok: false,
    target,
    operation: "preflight_release_candidate",
    error: { code: `SERVICE_${kind.toUpperCase()}`, message: "service selected" },
    evidence: [`${kind} service selected`],
    warnings: [],
    paths: {},
    commands: [],
    logs: []
  };
}

describe("preflight_release_candidate MCP surface", () => {
  test("advertises exactly one additive operation", () => {
    expect(toolNames.filter((name) => name === "preflight_release_candidate")).toHaveLength(1);
  });

  test("registers the operation on the MCP server", () => {
    const server = createServer() as any;
    const registered = server._registeredTools ?? server.registeredTools;
    expect(registered).toBeDefined();
    expect(Object.keys(registered)).toContain("preflight_release_candidate");
  });

  test.each([
    ["fixture", { kind: "fixture", root: "/unused" }],
    ["local", { kind: "local" }],
    ["ssh", { kind: "remote", name: "private", transport: "ssh", host: "-option", dotaRoot: "C:/Dota" }],
    ["powershell", { kind: "remote", name: "private", transport: "powershell", host: "-option", dotaRoot: "C:/Dota" }]
  ] as const)("routes %s through only its target service", async (kind, target) => {
    const calls = { node: 0, remote: 0 };
    const result = await (handleTool as any)(
      "preflight_release_candidate",
      { target, addonName: "demo" },
      {
        preflightNodeReleaseCandidate: async () => {
          calls.node += 1;
          return serviceResult(kind as "fixture" | "local");
        },
        preflightRemoteReleaseCandidate: async () => {
          calls.remote += 1;
          return serviceResult(kind as "ssh" | "powershell");
        }
      }
    );

    expect(result).toEqual(serviceResult(kind));
    expect(calls).toEqual({
      node: kind === "fixture" || kind === "local" ? 1 : 0,
      remote: kind === "ssh" || kind === "powershell" ? 1 : 0
    });
  });

  test("rejects prohibited fields before either service is called", async () => {
    const calls = { node: 0, remote: 0 };
    const services = {
      preflightNodeReleaseCandidate: async () => { calls.node += 1; return serviceResult("fixture"); },
      preflightRemoteReleaseCandidate: async () => { calls.remote += 1; return serviceResult("ssh"); }
    };
    for (const field of ["password", "token", "destination", "retention", "upload", "temporaryPath"]) {
      await expect((handleTool as any)("preflight_release_candidate", {
        target: { kind: "fixture", root: "/unused" },
        addonName: "demo",
        [field]: "forbidden"
      }, services)).rejects.toThrow();
    }
    expect(calls).toEqual({ node: 0, remote: 0 });
  });

  test("uses the exact strict public input schema", () => {
    expect(PreflightReleaseCandidateInputSchema.parse({
      target: { kind: "fixture", root: "/fixture" },
      addonName: "demo"
    })).toEqual({ target: { kind: "fixture", root: "/fixture" }, addonName: "demo" });
    expect(() => PreflightReleaseCandidateInputSchema.parse({
      target: { kind: "fixture", root: "/fixture", extra: true },
      addonName: "demo"
    })).toThrow();
  });

  test("serializes identical text and structured content", () => {
    const result = serviceResult("fixture");
    const content = asToolContent(result);
    expect(JSON.parse(content.content[0]!.text)).toEqual(result);
    expect(content.structuredContent).toBe(result);
    expect(content.isError).toBe(true);
  });
});

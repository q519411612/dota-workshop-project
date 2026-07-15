import { describe, expect, test } from "vitest";
import { buildRemoteReleaseCandidateScript } from "../src/release-candidate-remote-script.js";
import {
  executeRemoteReleaseCandidateScript,
  type RemoteReleaseCandidateInvocation
} from "../src/release-candidate-remote-executor.js";
import type { RemoteTarget } from "../src/types.js";

describe("remote release candidate transport binding", () => {
  const targets = [
    {
      kind: "remote",
      name: "ssh-target",
      transport: "ssh",
      host: "private.example.test",
      username: "operator",
      dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
    },
    {
      kind: "remote",
      name: "ps-target",
      transport: "powershell",
      host: "private.example.test",
      username: "ignored-by-preflight",
      dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
    }
  ] satisfies RemoteTarget[];

  test.each(targets)("invokes the exact generated script once through $transport", async (target) => {
    const invocations: RemoteReleaseCandidateInvocation[] = [];
    const result = await executeRemoteReleaseCandidateScript({
      target,
      addonName: "demo_addon",
      executor: async (invocation) => {
        invocations.push(invocation);
        return { exitCode: 0, stdout: "{\"schemaVersion\":\"1.0\"}", stderr: "" };
      }
    });

    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.script).toBe(buildRemoteReleaseCandidateScript({
      dotaRoot: target.dotaRoot,
      addonName: "demo_addon"
    }));
    expect(invocations[0]?.executable).not.toContain(target.host);
    expect(invocations[0]?.args.join(" ")).toContain(target.host);
    expect(result).toEqual({
      transport: target.transport,
      outcome: "completed",
      exitCode: 0,
      stdout: "{\"schemaVersion\":\"1.0\"}"
    });
    expect(JSON.stringify(result)).not.toContain(target.host);
    expect(JSON.stringify(result)).not.toContain(target.dotaRoot);
    expect(JSON.stringify(result)).not.toContain("demo_addon");
  });

  test("uses identical lifecycle bytes and responsibility-specific invocation only", async () => {
    const invocations: RemoteReleaseCandidateInvocation[] = [];
    for (const target of targets) {
      await executeRemoteReleaseCandidateScript({
        target,
        addonName: "demo_addon",
        executor: async (invocation) => {
          invocations.push(invocation);
          return { exitCode: 0, stdout: "same raw JSON", stderr: "" };
        }
      });
    }

    expect(invocations[0]?.script).toBe(invocations[1]?.script);
    expect(invocations[0]?.args).toContain("operator@private.example.test");
    expect(invocations[1]?.args.join(" ")).toContain("Invoke-Command");
    expect(invocations[1]?.args.join(" ")).not.toContain("ignored-by-preflight");
    for (const invocation of invocations) {
      const rendered = [invocation.executable, ...invocation.args].join(" ");
      expect(rendered).not.toMatch(/-Credential|Get-Credential|scp|sftp|Copy-Item|retry|fallback/i);
    }
  });

  test("does not parse, normalize, retry, fall back, or disclose a failed invocation", async () => {
    let attempts = 0;
    const result = await executeRemoteReleaseCandidateScript({
      target: targets[0]!,
      addonName: "demo_addon",
      executor: async () => {
        attempts += 1;
        return { exitCode: 23, stdout: "private stdout", stderr: "private stderr" };
      }
    });

    expect(attempts).toBe(1);
    expect(result).toEqual({ transport: "ssh", outcome: "failed", exitCode: 23 });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  test("returns closed uncertainty for executor exceptions without leaking them", async () => {
    const result = await executeRemoteReleaseCandidateScript({
      target: targets[1]!,
      addonName: "demo_addon",
      executor: async () => { throw new Error("secret host failure"); }
    });

    expect(result).toEqual({ transport: "powershell", outcome: "uncertain" });
    expect(JSON.stringify(result)).not.toContain("secret host failure");
  });

  test("fails before invocation when required runtime destination configuration is absent", async () => {
    let called = false;
    const result = await executeRemoteReleaseCandidateScript({
      target: { ...targets[0]!, dotaRoot: undefined },
      addonName: "demo_addon",
      executor: async () => {
        called = true;
        return { exitCode: 0, stdout: "{}", stderr: "" };
      }
    });

    expect(called).toBe(false);
    expect(result).toEqual({ transport: "ssh", outcome: "configuration-failed", code: "REMOTE_DOTA_ROOT_REQUIRED" });
  });
});

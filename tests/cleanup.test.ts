import { describe, expect, test } from "vitest";
import { cleanupPlayableSmoke } from "../src/cleanup.js";
import { CleanupPlayableSmokeInputSchema } from "../src/schemas.js";
import { handleTool, toolNames } from "../src/tools.js";
import { runPlayableSmoke } from "../src/smoke.js";

describe("safe smoke cleanup controls", () => {
  const localTarget = {
    kind: "local" as const,
    dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
  };

  const remoteTarget = {
    kind: "remote" as const,
    name: "lab-windows",
    transport: "ssh" as const,
    host: "dota.example.test",
    username: "builder",
    dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
  };

  test("exposes cleanup schema and dispatcher contract", async () => {
    const parsed = CleanupPlayableSmokeInputSchema.parse({
      target: localTarget,
      addonName: "playable_smoke_demo",
      dryRun: true
    });

    expect(parsed.addonName).toBe("playable_smoke_demo");
    expect(toolNames).toContain("cleanup_playable_smoke");

    const result = await handleTool("cleanup_playable_smoke", {
      target: { kind: "fixture", root: "C:/DotaFixture" },
      addonName: "../bad",
      dryRun: true
    });

    expect(result.ok).toBe(false);
    expect(result.operation).toBe("cleanup_playable_smoke");
    expect(result.error?.code).toBe("INVALID_ADDON_NAME");
    expect(result.commands).toHaveLength(0);
  });

  test("rejects invalid addon names before local command construction", async () => {
    const result = await cleanupPlayableSmoke({
      target: localTarget,
      addonName: "BadAddon",
      dryRun: true,
      executor: async () => {
        throw new Error("executor should not run");
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_ADDON_NAME");
    expect(result.evidence).toContain("rejected cleanup addon name: BadAddon");
    expect(result.commands).toHaveLength(0);
  });

  test("builds a local dry-run command that only inspects addon-matched Dota processes", async () => {
    const result = await cleanupPlayableSmoke({
      target: localTarget,
      addonName: "playable_smoke_demo",
      dryRun: true,
      executor: async (command) => ({
        exitCode: 0,
        stdout: JSON.stringify({
          addonName: "playable_smoke_demo",
          dryRun: true,
          matchedCount: 1,
          stoppedProcessIds: [],
          processes: [{
            ProcessId: 1234,
            Name: "dota2.exe",
            CommandLine: "dota2.exe -addon playable_smoke_demo +dota_launch_custom_game playable_smoke_demo dota",
            SessionId: 1
          }]
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.operation).toBe("cleanup_playable_smoke");
    expect(result.evidence).toContain("cleanup mode: dry-run");
    expect(result.evidence).toContain("matched Dota smoke process 1234: dota2.exe");
    expect(result.evidence).toContain("dry-run did not stop matching processes");
    expect(result.commands[0].command).toContain("Get-CimInstance Win32_Process");
    expect(result.commands[0].command).toContain("dota2.exe");
    expect(result.commands[0].command).toContain("dota2cfg.exe");
    expect(result.commands[0].command).toContain("vconsole2.exe");
    expect(result.commands[0].command).toContain("playable_smoke_demo");
    expect(result.commands[0].command).not.toContain("Stop-Process");
    expect(result.commands[0].command).not.toContain("steam.exe");
    expect(result.commands[0].command).not.toContain("Remove-Item");
  });

  test("builds a local execute command that stops only matched Dota process IDs", async () => {
    const result = await cleanupPlayableSmoke({
      target: localTarget,
      addonName: "playable_smoke_demo",
      dryRun: false,
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          addonName: "playable_smoke_demo",
          dryRun: false,
          matchedCount: 1,
          stoppedProcessIds: [1234],
          processes: [{
            ProcessId: 1234,
            Name: "dota2.exe",
            CommandLine: "dota2.exe -addon playable_smoke_demo +dota_launch_custom_game playable_smoke_demo dota",
            SessionId: 1
          }]
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("cleanup mode: execute");
    expect(result.evidence).toContain("stopped Dota smoke process 1234");
    expect(result.commands[0].command).toContain("Stop-Process -Id $process.ProcessId -Force");
    expect(result.commands[0].command).toContain("CommandLine");
    expect(result.commands[0].command).toContain("playable_smoke_demo");
    expect(result.commands[0].command).not.toContain("Get-Process dota");
    expect(result.commands[0].command).not.toContain("steam");
  });

  test("reports no-match cleanup as explicit auditable success", async () => {
    const result = await cleanupPlayableSmoke({
      target: localTarget,
      addonName: "playable_smoke_absent",
      dryRun: false,
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          addonName: "playable_smoke_absent",
          dryRun: false,
          matchedCount: 0,
          stoppedProcessIds: [],
          processes: []
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("no matching Dota smoke process found for playable_smoke_absent");
    expect(result.evidence).not.toContain("stopped Dota smoke process");
  });

  test("builds a remote dry-run cleanup command through the remote adapter", async () => {
    const attemptedCommands: string[] = [];
    const result = await cleanupPlayableSmoke({
      target: remoteTarget,
      addonName: "remote_smoke",
      dryRun: true,
      executor: async (command) => {
        attemptedCommands.push(command.command);
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            addonName: "remote_smoke",
            dryRun: true,
            matchedCount: 1,
            stoppedProcessIds: [],
            processes: [{
              ProcessId: 2345,
              Name: "dota2.exe",
              CommandLine: "dota2.exe -addon remote_smoke +dota_launch_custom_game remote_smoke dota",
              SessionId: 1
            }]
          }),
          stderr: ""
        };
      }
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("matched Dota smoke process 2345: dota2.exe");
    expect(attemptedCommands[0]).toContain("ssh");
    expect(attemptedCommands[0]).toContain("Get-CimInstance Win32_Process");
    expect(attemptedCommands[0]).toContain("remote_smoke");
    expect(attemptedCommands[0]).not.toContain("Stop-Process");
    expect(attemptedCommands[0]).not.toContain("Remove-Item");
    expect(attemptedCommands[0]).not.toContain("steam.exe");
  });

  test("builds a remote execute cleanup command and preserves remote failure evidence", async () => {
    const result = await cleanupPlayableSmoke({
      target: remoteTarget,
      addonName: "remote_smoke",
      dryRun: false,
      executor: async () => ({
        exitCode: 5,
        stdout: "partial stdout",
        stderr: "access denied"
      })
    });

    expect(result.ok).toBe(false);
    expect(result.operation).toBe("cleanup_playable_smoke");
    expect(result.error?.code).toBe("REMOTE_COMMAND_FAILED");
    expect(result.evidence).toContain("remote command failed with exit code 5");
    expect(result.commands[0].command).toContain("Stop-Process -Id $process.ProcessId -Force");
    expect(result.commands[0].stdout).toBe("partial stdout");
    expect(result.commands[0].stderr).toBe("access denied");
    expect(result.logs[0].lines).toContain("access denied");
  });

  test("requires target root information for local and remote cleanup", async () => {
    const localResult = await cleanupPlayableSmoke({
      target: { kind: "local" },
      addonName: "playable_smoke_demo",
      dryRun: true
    });

    const remoteResult = await cleanupPlayableSmoke({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test"
      },
      addonName: "playable_smoke_demo",
      dryRun: true
    });

    expect(localResult.ok).toBe(false);
    expect(localResult.error?.code).toBe("TARGET_ROOT_REQUIRED");
    expect(remoteResult.ok).toBe(false);
    expect(remoteResult.error?.code).toBe("REMOTE_DOTA_ROOT_REQUIRED");
  });

  test("rejects direct local cleanup on non-Windows hosts without an executor", async () => {
    if (process.platform === "win32") {
      return;
    }

    const result = await cleanupPlayableSmoke({
      target: localTarget,
      addonName: "playable_smoke_demo",
      dryRun: true
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNSUPPORTED_HOST_PLATFORM");
    expect(result.commands).toHaveLength(0);
    expect(result.evidence).toContain(`local cleanup host platform: ${process.platform}`);
  });

  test("does not run cleanup implicitly inside playable smoke", async () => {
    const commands: string[] = [];
    const result = await runPlayableSmoke({
      target: remoteTarget,
      addonName: "remote_smoke",
      launchMode: "interactiveTask",
      validationTimeoutMs: 0,
      executor: async (command) => {
        commands.push(command.command);
        if (commands.length === 1) {
          return { exitCode: 0, stdout: "created", stderr: "" };
        }
        if (commands.length === 2) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              evidence: ["game addon root exists", "content addon root exists"],
              paths: {}
            }),
            stderr: ""
          };
        }
        if (commands.length === 3) {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "INTERACTIVE_LAUNCH_PROCESS_NOT_FOUND"
          };
        }
        throw new Error("smoke should stop after launch failure");
      }
    });

    expect(result.ok).toBe(false);
    expect(result.evidence).toContain("failed smoke operation: launch_custom_game");
    expect(commands.some((command) => command.includes("Stop-Process"))).toBe(false);
    expect(commands.some((command) => command.includes("cleanup_playable_smoke"))).toBe(false);
  });
});

import { describe, expect, test } from "vitest";
import { runRemoteCommand } from "../src/remote.js";

describe("remote command adapter", () => {
  test("returns command evidence for successful SSH execution", async () => {
    const result = await runRemoteCommand({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder"
      },
      command: "Write-Output ok",
      executor: async () => ({
        exitCode: 0,
        stdout: "ok\n",
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0]).toMatchObject({
      command: "ssh 'builder@dota.example.test' 'Write-Output ok'"
    });
    expect(result.logs[0].lines).toEqual(["ok"]);
  });

  test("quotes SSH PowerShell scripts as a single remote command argument", async () => {
    let attemptedCommand = "";
    const result = await runRemoteCommand({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder"
      },
      command: "$root = 'C:/Steam/steamapps/common/dota 2 beta'; (Test-Path $root) | ConvertTo-Json",
      executor: async (command) => {
        attemptedCommand = command.command;
        return {
          exitCode: 0,
          stdout: "true\n",
          stderr: ""
        };
      }
    });

    expect(result.ok).toBe(true);
    expect(attemptedCommand).toBe(
      "ssh 'builder@dota.example.test' '$root = '\\''C:/Steam/steamapps/common/dota 2 beta'\\''; (Test-Path $root) | ConvertTo-Json'"
    );
  });

  test("remote failures stay remote and do not fall back to local behavior", async () => {
    const result = await runRemoteCommand({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        username: "builder"
      },
      command: "Get-ChildItem C:/missing",
      executor: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "path not found"
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("REMOTE_COMMAND_FAILED");
    expect(result.commands[0].command).toContain("Invoke-Command");
    expect(result.evidence).toContain("remote command failed with exit code 1");
  });
});

import { describe, expect, test } from "vitest";
import {
  createRemoteAddon,
  discoverRemoteEnvironment,
  inspectRemoteAddon,
  readRemoteConsoleOrLogs,
  validateRemoteAddon,
  launchRemoteCustomGame,
  launchRemoteTools
} from "../src/remote.js";

describe("remote Windows operations", () => {
  test("discovers a remote Dota install from JSON command output", async () => {
    const result = await discoverRemoteEnvironment({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          dotaRoot: "C:/Steam/steamapps/common/dota 2 beta",
          missing: [],
          paths: {
            dotaExecutable: "C:/Steam/steamapps/common/dota 2 beta/game/bin/win64/dota2.exe"
          }
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.paths.dotaRoot).toBe("C:/Steam/steamapps/common/dota 2 beta");
    expect(result.evidence).toContain("remote environment verified");
  });

  test("returns explicit remote discovery failure for missing paths", async () => {
    const result = await discoverRemoteEnvironment({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/missing"
      },
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          dotaRoot: "C:/missing",
          missing: ["dotaExecutable"],
          paths: {
            dotaExecutable: "C:/missing/game/bin/win64/dota2.exe"
          }
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("REMOTE_WORKSHOP_TOOLS_PATH_MISSING");
    expect(result.evidence).toContain("remote missing dotaExecutable");
  });

  test("launches Workshop Tools through remote command evidence", async () => {
    const result = await launchRemoteTools({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      executor: async () => ({
        exitCode: 0,
        stdout: "started",
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).toContain("Start-Process");
    expect(result.commands[0].command).toContain("'\\''-tools'\\''");
    expect(result.commands[0].command).toContain("'\\''-addon'\\''");
    expect(result.commands[0].command).toContain("'\\''demo_addon'\\''");
  });

  test("launches custom game through remote command evidence", async () => {
    const result = await launchRemoteCustomGame({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      mapName: "demo_map",
      executor: async () => ({
        exitCode: 0,
        stdout: "started",
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).toContain("Start-Process");
    expect(result.commands[0].command).toContain("'+dota_launch_custom_game'");
    expect(result.commands[0].command).toContain("'demo_addon'");
    expect(result.commands[0].command).toContain("'demo_map'");
  });

  test("creates addon on the remote target instead of writing locally", async () => {
    const result = await createRemoteAddon({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      mapName: "demo_map",
      executor: async () => ({
        exitCode: 0,
        stdout: "created",
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("remote addon creation completed");
    expect(result.commands[0].command).toContain("New-Item");
    expect(result.commands[0].command).toContain("demo_addon");
  });

  test("inspects addon on the remote target from JSON command output", async () => {
    const result = await inspectRemoteAddon({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          evidence: ["game addon root exists", "content addon root exists"],
          paths: {
            gameAddon: "C:/Steam/steamapps/common/dota 2 beta/game/dota_addons/demo_addon"
          }
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("game addon root exists");
    expect(result.paths.gameAddon).toContain("demo_addon");
  });

  test("reads remote logs from JSON command output", async () => {
    let attemptedCommand = "";
    const result = await readRemoteConsoleOrLogs({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      logPaths: ["C:/Steam/logs/console.log"],
      executor: async (command) => {
        attemptedCommand = command.command;
        return {
          exitCode: 0,
          stdout: JSON.stringify([{ source: "C:/Steam/logs/console.log", lines: ["[DOTA_WORKSHOP_MCP] addon loaded: demo_addon"] }]),
          stderr: ""
        };
      }
    });

    expect(result.ok).toBe(true);
    expect(attemptedCommand).toContain("ForEach-Object { [string]$_ }");
    expect(result.logs[0].lines).toContain("[DOTA_WORKSHOP_MCP] addon loaded: demo_addon");
  });

  test("validates remote addon only when marker is present", async () => {
    const result = await validateRemoteAddon({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      logPaths: ["C:/Steam/logs/console.log"],
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify([{ source: "C:/Steam/logs/console.log", lines: ["[DOTA_WORKSHOP_MCP] addon loaded: demo_addon"] }]),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("found validation marker for demo_addon");
  });
});

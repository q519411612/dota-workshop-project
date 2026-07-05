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
  const gameplayMarkers = [
    "[DOTA_WORKSHOP_MCP] addon loaded: demo_addon",
    "[DOTA_WORKSHOP_MCP] gamemode initialized: demo_addon",
    "[DOTA_WORKSHOP_MCP] round started: demo_addon",
    "[DOTA_WORKSHOP_MCP] score updated: demo_addon",
    "[DOTA_WORKSHOP_MCP] win condition reached: demo_addon"
  ];

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

  test("launches runtime custom game through remote command evidence", async () => {
    const result = await launchRemoteCustomGame({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      mapName: "dota",
      runtimeMode: "game",
      consoleLog: true,
      executor: async () => ({
        exitCode: 0,
        stdout: "started",
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).not.toContain("'-tools'");
    expect(result.commands[0].command).toContain("'-condebug'");
    expect(result.commands[0].command).toContain("'+dota_launch_custom_game'");
  });

  test("rejects unsafe map names before remote launch command construction", async () => {
    const result = await launchRemoteCustomGame({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      mapName: "../demo"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_MAP_NAME");
    expect(result.commands).toHaveLength(0);
  });

  test("launches custom game through an interactive remote task when requested", async () => {
    const result = await launchRemoteCustomGame({
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
      launchMode: "interactiveTask",
      taskName: "DotaWorkshopMcp_demo",
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          taskName: "DotaWorkshopMcp_demo",
          lastTaskResult: 0,
          processes: [{
            ProcessId: 1234,
            Name: "dota2.exe",
            CommandLine: "dota2.exe -tools -addon demo_addon +dota_launch_custom_game demo_addon demo_map",
            SessionId: 1
          }]
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("remote interactive launch task completed");
    expect(result.commands[0].command).toContain("New-ScheduledTaskAction");
    expect(result.commands[0].command).toContain("-applaunch 570 -novid -tools -addon demo_addon +dota_launch_custom_game demo_addon demo_map");
    expect(result.commands[0].command).toContain("CreationDate");
    expect(result.commands[0].command).toContain("Unregister-ScheduledTask");
  });

  test("rejects unsafe interactive remote task names", async () => {
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
      launchMode: "interactiveTask",
      taskName: "bad task name"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_REMOTE_TASK_NAME");
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
    expect(result.commands[0].command).toContain("[DOTA_WORKSHOP_MCP] gamemode initialized: demo_addon");
    expect(result.commands[0].command).toContain("npc_units_custom.txt");
  });

  test("creates remote addon with runtime placement through shared renderer", async () => {
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
      mapName: "dota",
      placement: {
        unitName: "npc_dota_creep_badguys_melee",
        team: "badguys",
        origin: { x: 128, y: -64, z: 256 }
      },
      executor: async () => ({
        exitCode: 0,
        stdout: "created",
        stderr: ""
      })
    } as Parameters<typeof createRemoteAddon>[0]);

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).toContain("self.placementOrigin = Vector(128, -64, 256)");
    expect(result.commands[0].command).toContain("[DOTA_WORKSHOP_MCP] placement configured: demo_addon");
    expect(result.commands[0].command).toContain("[DOTA_WORKSHOP_MCP] placement spawned: demo_addon");
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
    expect(attemptedCommand).toContain("-Tail 2000");
    expect(result.logs[0].lines).toContain("[DOTA_WORKSHOP_MCP] addon loaded: demo_addon");
  });

  test("auto-discovers recent remote logs when explicit paths are omitted", async () => {
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
      executor: async (command) => {
        attemptedCommand = command.command;
        return {
          exitCode: 0,
          stdout: JSON.stringify([{ source: "C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log", lines: ["Workshop Tools ready"] }]),
          stderr: ""
        };
      }
    } as Parameters<typeof readRemoteConsoleOrLogs>[0]);

    expect(result.ok).toBe(true);
    expect(attemptedCommand).toContain("$runtimeConsole = Join-Path $root");
    expect(attemptedCommand).toContain("game/dota/console.log");
    expect(attemptedCommand).toContain("Get-ChildItem");
    expect(attemptedCommand).toContain("LastWriteTime");
    expect(attemptedCommand).toContain("$tailLines = if ($file.FullName -eq $runtimeConsole) { 2000 } else { 200 }");
    expect(attemptedCommand).toContain("-Tail $tailLines");
    expect(result.evidence).toContain("read remote log: C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log");
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

  test("validates remote marker inside prefixed Dota console lines", async () => {
    const result = await validateRemoteAddon({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      logPaths: ["C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log"],
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify([{ source: "C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log", lines: ["07/03 21:47:16 [VScript] [DOTA_WORKSHOP_MCP] addon loaded: demo_addon"] }]),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("found validation marker for demo_addon");
  });

  test("validates all requested remote gameplay markers", async () => {
    const result = await validateRemoteAddon({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      logPaths: ["C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log"],
      expectedMarkers: gameplayMarkers,
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify([{ source: "C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log", lines: gameplayMarkers.map((marker) => `[VScript] ${marker}`) }]),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    for (const marker of gameplayMarkers) {
      expect(result.evidence).toContain(`found validation marker: ${marker}`);
    }
  });

  test("fails remote validation when any requested gameplay marker is missing", async () => {
    const result = await validateRemoteAddon({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "powershell",
        host: "dota.example.test",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName: "demo_addon",
      logPaths: ["C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log"],
      expectedMarkers: gameplayMarkers,
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify([{ source: "C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log", lines: gameplayMarkers.slice(0, -1) }]),
        stderr: ""
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_MARKER_NOT_FOUND");
    expect(result.evidence).toContain("missing marker: [DOTA_WORKSHOP_MCP] win condition reached: demo_addon");
  });
});

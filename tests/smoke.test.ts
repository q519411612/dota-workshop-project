import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { handleTool, toolNames } from "../src/tools.js";
import {
  generatePlayableSmokeAddonName,
  playableSmokeMarkers,
  runPlayableSmoke
} from "../src/smoke.js";

describe("repeatable playable smoke workflow", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-smoke-"));
    await mkdir(join(root, "game/bin/win64"), { recursive: true });
    await mkdir(join(root, "game/dota"), { recursive: true });
    await mkdir(join(root, "game/dota_addons"), { recursive: true });
    await mkdir(join(root, "content/dota_addons/addon_template/maps"), { recursive: true });
    await mkdir(join(root, "content/dota_addons"), { recursive: true });
    await writeFile(join(root, "game/bin/win64/dota2.exe"), "");
    await writeFile(join(root, "game/bin/win64/vconsole2.exe"), "");
    await writeFile(join(root, "game/bin/win64/resourcecompiler.exe"), "");
    await writeFile(join(root, "game/dota/gameinfo.gi"), "");
    await writeFile(
      join(root, "content/dota_addons/addon_template/maps/template_map.vmap"),
      "info_player_start_goodguys\ninfo_player_start_badguys\n"
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("generates valid unique smoke addon names", () => {
    const first = generatePlayableSmokeAddonName();
    const second = generatePlayableSmokeAddonName();

    expect(first).toMatch(/^playable_smoke_[0-9]{8}_[0-9]{9}_[a-z0-9]{4}$/);
    expect(second).toMatch(/^playable_smoke_[0-9]{8}_[0-9]{9}_[a-z0-9]{4}$/);
    expect(first).not.toBe(second);
  });

  test("runs fixture smoke with an explicit addon name", async () => {
    const addonName = "smoke_demo";
    const logPath = join(root, "game/dota/console.log");
    await mkdir(join(root, "game/dota"), { recursive: true });
    await writeFile(logPath, playableSmokeMarkers(addonName).map((marker) => `[VScript] ${marker}`).join("\n"));

    const result = await runPlayableSmoke({
      target: { kind: "fixture", root },
      addonName,
      dryRun: true,
      logPaths: [logPath],
      validationTimeoutMs: 0
    });

    expect(result.ok).toBe(true);
    expect(result.operation).toBe("run_playable_smoke");
    expect(result.evidence).toContain("smoke addon name: smoke_demo");
    expect(result.evidence).toContain("smoke operation create_addon succeeded");
    expect(result.evidence).toContain("smoke operation inspect_addon succeeded");
    expect(result.evidence).toContain("smoke operation launch_custom_game succeeded");
    expect(result.evidence).toContain("smoke operation validate_addon succeeded");
    expect(result.evidence).toContain("found validation marker: [DOTA_WORKSHOP_MCP] win condition reached: smoke_demo");
    expect(result.evidence.some((line) => line.startsWith("missing marker:"))).toBe(false);
    expect(result.commands[0].command).toContain("-addon smoke_demo +dota_launch_custom_game smoke_demo dota");
    expect(result.commands[0].command).toContain("-console -condebug");
    expect(result.commands[0].command).not.toContain("-tools");
    expect(result.paths.gameAddon).toContain("smoke_demo");
  });

  test("validates placement markers when smoke placement is requested", async () => {
    const addonName = "smoke_place";
    const logPath = join(root, "game/dota/console.log");
    const placementMarkers = [
      `[DOTA_WORKSHOP_MCP] placement configured: ${addonName}`,
      `[DOTA_WORKSHOP_MCP] placement origin: ${addonName} x=128 y=-64 z=256`,
      `[DOTA_WORKSHOP_MCP] placement unit: ${addonName} npc_dota_creep_badguys_melee team=badguys`,
      `[DOTA_WORKSHOP_MCP] placement spawned: ${addonName} npc_dota_creep_badguys_melee`
    ];
    await mkdir(join(root, "game/dota"), { recursive: true });
    await writeFile(logPath, [...playableSmokeMarkers(addonName), ...placementMarkers].map((marker) => `[VScript] ${marker}`).join("\n"));

    const result = await runPlayableSmoke({
      target: { kind: "fixture", root },
      addonName,
      dryRun: true,
      logPaths: [logPath],
      validationTimeoutMs: 0,
      placement: {
        unitName: "npc_dota_creep_badguys_melee",
        team: "badguys",
        origin: { x: 128, y: -64, z: 256 }
      }
    } as Parameters<typeof runPlayableSmoke>[0]);

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain(`found validation marker: [DOTA_WORKSHOP_MCP] placement spawned: ${addonName} npc_dota_creep_badguys_melee`);
  });

  test("validates score objective markers when smoke objective is requested", async () => {
    const addonName = "smoke_objective";
    const logPath = join(root, "game/dota/console.log");
    const objectiveMarkers = [
      `[DOTA_WORKSHOP_MCP] objective configured: ${addonName} type=score target=2`,
      `[DOTA_WORKSHOP_MCP] objective progress: ${addonName} 1/2 source=think`,
      `[DOTA_WORKSHOP_MCP] objective complete: ${addonName} type=score`
    ];
    await writeFile(logPath, [...playableSmokeMarkers(addonName), ...objectiveMarkers].map((marker) => `[VScript] ${marker}`).join("\n"));

    const result = await runPlayableSmoke({
      target: { kind: "fixture", root },
      addonName,
      dryRun: true,
      logPaths: [logPath],
      validationTimeoutMs: 0,
      objective: {
        type: "score",
        targetScore: 2,
        tickIntervalSeconds: 1
      }
    } as Parameters<typeof runPlayableSmoke>[0]);

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain(`found validation marker: [DOTA_WORKSHOP_MCP] objective configured: ${addonName} type=score target=2`);
    expect(result.evidence).toContain(`found validation marker: [DOTA_WORKSHOP_MCP] objective complete: ${addonName} type=score`);
  });

  test("creates scaffolded smoke addon without adding scaffold runtime markers", async () => {
    const addonName = "smoke_scaffold";
    const logPath = join(root, "game/dota/console.log");
    await writeFile(logPath, playableSmokeMarkers(addonName).map((marker) => `[VScript] ${marker}`).join("\n"));

    const result = await runPlayableSmoke({
      target: { kind: "fixture", root },
      addonName,
      dryRun: true,
      logPaths: [logPath],
      validationTimeoutMs: 0,
      unitAbilityScaffold: {
        unitName: "npc_dota_workshop_mcp_dummy",
        abilityName: "ability_dota_workshop_mcp_dummy"
      }
    } as Parameters<typeof runPlayableSmoke>[0]);

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("smoke operation create_addon succeeded");
    expect(result.evidence).toContain(`found validation marker: [DOTA_WORKSHOP_MCP] win condition reached: ${addonName}`);
    expect(result.evidence.some((line) => line.startsWith("found validation marker:") && line.includes("unit ability scaffold"))).toBe(false);
  });

  test("fails smoke workflow when a required marker is missing", async () => {
    const addonName = "smoke_missing";
    const logPath = join(root, "game/dota/console.log");
    await mkdir(join(root, "game/dota"), { recursive: true });
    await writeFile(logPath, playableSmokeMarkers(addonName).slice(0, -1).join("\n"));

    const result = await runPlayableSmoke({
      target: { kind: "fixture", root },
      addonName,
      dryRun: true,
      logPaths: [logPath],
      validationTimeoutMs: 0
    });

    expect(result.ok).toBe(false);
    expect(result.operation).toBe("run_playable_smoke");
    expect(result.error?.code).toBe("SMOKE_WORKFLOW_FAILED");
    expect(result.evidence).toContain("failed smoke operation: validate_addon");
    expect(result.evidence).toContain("missing marker: [DOTA_WORKSHOP_MCP] win condition reached: smoke_missing");
  });

  test("passes remote interactive task launch settings through smoke workflow", async () => {
    const addonName = "remote_smoke";
    const markers = playableSmokeMarkers(addonName);
    const attemptedCommands: string[] = [];
    let callIndex = 0;

    const result = await runPlayableSmoke({
      target: {
        kind: "remote",
        name: "lab-windows",
        transport: "ssh",
        host: "dota.example.test",
        username: "builder",
        dotaRoot: "C:/Steam/steamapps/common/dota 2 beta"
      },
      addonName,
      launchMode: "interactiveTask",
      taskName: "DotaWorkshopMcp_remote_smoke",
      logPaths: ["C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log"],
      validationTimeoutMs: 1000,
      validationPollIntervalMs: 0,
      executor: async (command) => {
        attemptedCommands.push(command.command);
        callIndex += 1;
        if (callIndex === 1) {
          return { exitCode: 0, stdout: "created", stderr: "" };
        }
        if (callIndex === 2) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              evidence: ["game addon root exists", "content addon root exists"],
              paths: {
                gameAddon: "C:/Steam/steamapps/common/dota 2 beta/game/dota_addons/remote_smoke",
                contentAddon: "C:/Steam/steamapps/common/dota 2 beta/content/dota_addons/remote_smoke"
              }
            }),
            stderr: ""
          };
        }
        if (callIndex === 3) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              taskName: "DotaWorkshopMcp_remote_smoke",
              lastTaskResult: 0,
              processes: [{
                ProcessId: 1234,
                Name: "dota2.exe",
                CommandLine: "dota2.exe -addon remote_smoke +dota_launch_custom_game remote_smoke dota -console -condebug",
                SessionId: 1
              }]
            }),
            stderr: ""
          };
        }
        if (callIndex === 4) {
          return {
            exitCode: 0,
            stdout: JSON.stringify([{
              source: "C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log",
              lines: markers.slice(0, -1).map((marker) => `[VScript] ${marker}`)
            }]),
            stderr: ""
          };
        }
        return {
          exitCode: 0,
          stdout: JSON.stringify([{
            source: "C:/Steam/steamapps/common/dota 2 beta/game/dota/console.log",
            lines: markers.map((marker) => `[VScript] ${marker}`)
          }]),
          stderr: ""
        };
      }
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("smoke operation validate_addon succeeded");
    expect(result.evidence).toContain("smoke validation retries before final result: 1");
    expect(result.evidence).toContain("found validation marker: [DOTA_WORKSHOP_MCP] win condition reached: remote_smoke");
    expect(result.commands).toHaveLength(4);
    expect(attemptedCommands[2]).toContain("New-ScheduledTaskAction");
    expect(attemptedCommands[2]).toContain("-applaunch 570 -novid -addon remote_smoke +dota_launch_custom_game remote_smoke dota -console -condebug");
    expect(attemptedCommands[2]).not.toContain("-tools");
  });

  test("prepares a custom map before launching a custom-map smoke workflow", async () => {
    const addonName = "smoke_custom_map";
    const markers = playableSmokeMarkers(addonName);
    const logPath = join(root, "game/dota/console.log");
    const commandOrder: string[] = [];
    await writeFile(logPath, markers.map((marker) => `[VScript] ${marker}`).join("\n"));

    const result = await runPlayableSmoke({
      target: { kind: "fixture", root },
      addonName,
      customMap: {
        mapName: "template_spawn_demo"
      },
      dryRun: true,
      logPaths: [logPath],
      validationTimeoutMs: 0,
      executor: async (command) => {
        if (command.command.includes("resourcecompiler.exe")) {
          commandOrder.push("prepare_custom_map");
          const compiledMap = join(root, "game/dota_addons/smoke_custom_map/maps/template_spawn_demo.vpk");
          await mkdir(join(root, "game/dota_addons/smoke_custom_map/maps"), { recursive: true });
          await writeFile(compiledMap, "compiled");
          return { exitCode: 0, stdout: "compile ok", stderr: "" };
        }
        commandOrder.push("unexpected");
        return { exitCode: 1, stdout: "", stderr: "unexpected command" };
      }
    });

    expect(result.ok).toBe(true);
    expect(commandOrder).toEqual(["prepare_custom_map"]);
    expect(result.evidence).toContain("smoke operation prepare_custom_map succeeded");
    expect(result.evidence).toContain("compiled custom map with resourcecompiler");
    expect(result.commands.some((command) => command.command.includes("resourcecompiler.exe"))).toBe(true);
    expect(result.commands.some((command) => command.command.includes("+dota_launch_custom_game smoke_custom_map template_spawn_demo"))).toBe(true);
    expect(result.paths.contentMap).toContain("template_spawn_demo.vmap");
  });

  test("exposes run_playable_smoke through the MCP dispatcher", async () => {
    const addonName = "dispatch_smoke";
    const logPath = join(root, "game/dota/console.log");
    await mkdir(join(root, "game/dota"), { recursive: true });
    await writeFile(logPath, playableSmokeMarkers(addonName).join("\n"));

    expect(toolNames).toContain("run_playable_smoke");

    const result = await handleTool("run_playable_smoke", {
      target: { kind: "fixture", root },
      addonName,
      dryRun: true,
      logPaths: [logPath]
    });

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("smoke addon name: dispatch_smoke");
  });
});

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { discoverEnvironment } from "../src/environment.js";
import { launchCustomGame, launchTools, readConsoleOrLogs, validateAddon } from "../src/launch.js";

describe("local Windows validation flow", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-local-"));
    await mkdir(join(root, "steam/steamapps/common/dota 2 beta/game/bin/win64"), { recursive: true });
    await mkdir(join(root, "steam/steamapps/common/dota 2 beta/game/dota_addons"), { recursive: true });
    await mkdir(join(root, "steam/steamapps/common/dota 2 beta/content/dota_addons"), { recursive: true });
    await mkdir(join(root, "steam/config"), { recursive: true });
    await writeFile(join(root, "steam/steamapps/common/dota 2 beta/game/bin/win64/dota2.exe"), "");
    await writeFile(join(root, "steam/steamapps/common/dota 2 beta/game/bin/win64/vconsole2.exe"), "");
    await writeFile(join(root, "steam/config/libraryfolders.vdf"), `"libraryfolders"\n{\n  "0"\n  {\n    "path" "${join(root, "steam").replaceAll("\\", "\\\\")}"\n  }\n}\n`);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("discovers a Dota install from a Steam library fixture", async () => {
    const result = await discoverEnvironment({
      target: { kind: "local" },
      platform: "win32",
      environment: { STEAM_ROOT: join(root, "steam") }
    });

    expect(result.ok).toBe(true);
    expect(result.paths.dotaRoot).toBe(join(root, "steam/steamapps/common/dota 2 beta"));
    expect(result.evidence).toContain("verified dota2.exe");
  });

  test("builds Workshop Tools launch command without claiming validation", async () => {
    const dotaRoot = join(root, "steam/steamapps/common/dota 2 beta");
    const result = await launchTools({
      target: { kind: "local", dotaRoot },
      addonName: "demo_addon",
      dryRun: true
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).toContain("dota2.exe");
    expect(result.commands[0].command).toContain("-tools -addon demo_addon");
    expect(result.warnings).toContain("launch started or dry-run completed; validation still requires log evidence");
  });

  test("builds custom game launch command with addon and map", async () => {
    const dotaRoot = join(root, "steam/steamapps/common/dota 2 beta");
    const result = await launchCustomGame({
      target: { kind: "local", dotaRoot },
      addonName: "demo_addon",
      mapName: "demo_map",
      dryRun: true
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).toContain("+dota_launch_custom_game demo_addon demo_map");
  });

  test("builds runtime custom game launch command with console logging", async () => {
    const dotaRoot = join(root, "steam/steamapps/common/dota 2 beta");
    const result = await launchCustomGame({
      target: { kind: "local", dotaRoot },
      addonName: "demo_addon",
      mapName: "dota",
      runtimeMode: "game",
      consoleLog: true,
      dryRun: true
    });

    expect(result.ok).toBe(true);
    expect(result.commands[0].command).toContain("-addon demo_addon +dota_launch_custom_game demo_addon dota");
    expect(result.commands[0].command).toContain("-console -condebug");
    expect(result.commands[0].command).not.toContain("-tools");
  });

  test("rejects unsafe map names before local launch command construction", async () => {
    const dotaRoot = join(root, "steam/steamapps/common/dota 2 beta");
    const result = await launchCustomGame({
      target: { kind: "local", dotaRoot },
      addonName: "demo_addon",
      mapName: "demo map",
      dryRun: true
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_MAP_NAME");
    expect(result.commands).toHaveLength(0);
  });

  test("reads default runtime console log when local log paths are omitted", async () => {
    const dotaRoot = join(root, "steam/steamapps/common/dota 2 beta");
    const logPath = join(dotaRoot, "game/dota/console.log");
    await mkdir(join(dotaRoot, "game/dota"), { recursive: true });
    await writeFile(logPath, "[DOTA_WORKSHOP_MCP] addon loaded: demo_addon\n");

    const readResult = await readConsoleOrLogs({
      target: { kind: "local", dotaRoot },
      addonName: "demo_addon"
    });

    expect(readResult.ok).toBe(true);
    expect(readResult.paths.log0).toBe(logPath);
    expect(readResult.logs[0].lines).toContain("[DOTA_WORKSHOP_MCP] addon loaded: demo_addon");
  });

  test("validates addon success only when the expected marker is present", async () => {
    const logPath = join(root, "console.log");
    await writeFile(logPath, "noise\n[DOTA_WORKSHOP_MCP] addon loaded: demo_addon\n");

    const readResult = await readConsoleOrLogs({
      target: { kind: "local", dotaRoot: root },
      addonName: "demo_addon",
      logPaths: [logPath]
    });

    expect(readResult.ok).toBe(true);
    expect(readResult.logs[0].lines).toContain("[DOTA_WORKSHOP_MCP] addon loaded: demo_addon");

    const validation = await validateAddon({
      target: { kind: "local", dotaRoot: root },
      addonName: "demo_addon",
      logPaths: [logPath]
    });

    expect(validation.ok).toBe(true);
    expect(validation.evidence).toContain("found validation marker for demo_addon");
  });

  test("validates marker inside prefixed Dota console lines", async () => {
    const logPath = join(root, "console.log");
    await writeFile(logPath, "07/03 21:47:16 [VScript] [DOTA_WORKSHOP_MCP] addon loaded: demo_addon\n");

    const validation = await validateAddon({
      target: { kind: "local", dotaRoot: root },
      addonName: "demo_addon",
      logPaths: [logPath]
    });

    expect(validation.ok).toBe(true);
    expect(validation.evidence).toContain("found validation marker for demo_addon");
  });

  test("classifies missing validation marker as failure", async () => {
    const logPath = join(root, "console.log");
    await writeFile(logPath, "addon started without marker\n");

    const validation = await validateAddon({
      target: { kind: "local", dotaRoot: root },
      addonName: "demo_addon",
      logPaths: [logPath]
    });

    expect(validation.ok).toBe(false);
    expect(validation.error?.code).toBe("VALIDATION_MARKER_NOT_FOUND");
  });
});

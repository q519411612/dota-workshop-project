import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { discoverEnvironment, validateInstallRoot } from "../src/environment.js";

describe("environment discovery", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dota-env-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("validates a fixture install root with required binaries and addon roots", async () => {
    await mkdir(join(root, "game/bin/win64"), { recursive: true });
    await mkdir(join(root, "game/dota_addons"), { recursive: true });
    await mkdir(join(root, "content/dota_addons"), { recursive: true });
    await writeFile(join(root, "game/bin/win64/dota2.exe"), "");
    await writeFile(join(root, "game/bin/win64/vconsole2.exe"), "");

    const result = await validateInstallRoot({
      target: { kind: "fixture", root },
      dotaRoot: root
    });

    expect(result.ok).toBe(true);
    expect(result.paths.dotaExecutable).toBe(join(root, "game/bin/win64/dota2.exe"));
    expect(result.evidence).toContain("verified dota2.exe");
  });

  test("reports missing binaries as explicit failures", async () => {
    const result = await validateInstallRoot({
      target: { kind: "fixture", root },
      dotaRoot: root
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("WORKSHOP_TOOLS_PATH_MISSING");
    expect(result.evidence.join("\n")).toContain("missing dota2.exe");
  });

  test("does not claim local Windows discovery on unsupported platforms", async () => {
    const result = await discoverEnvironment({
      target: { kind: "local" },
      platform: "darwin"
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNSUPPORTED_OS");
  });
});

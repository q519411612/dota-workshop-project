import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { scanReleaseCandidateFiles, verifyReleaseCandidate } from "../src/rc.js";

async function createScanFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dota-rc-fixture-"));
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "node_modules/ignored"), { recursive: true });
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(join(root, ".planning/graphs"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Safe boundary\nWorkshop upload is not performed by this project.\n");
  await writeFile(join(root, "docs/operator.md"), "Steam login is manual and out of scope.\n");
  const passwordKey = ["pass", "word"].join("");
  await writeFile(join(root, "node_modules/ignored/file.txt"), `${passwordKey}: ignored\n`);
  await writeFile(join(root, "dist/generated.js"), `const ${passwordKey} = 'ignored';\n`);
  await writeFile(join(root, ".planning/graphs/graph.json"), `{"${passwordKey}":"ignored"}\n`);
  return root;
}

describe("release candidate gate", () => {
  test("package exposes verify:rc from built output", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["verify:rc"]).toBe("node ./dist/verify-rc.js");
  });

  test("aggregates command gates and scan evidence", async () => {
    const root = await createScanFixture();
    const commands: string[] = [];
    try {
      const result = await verifyReleaseCandidate({
        root,
        commandRunner: async (command) => {
          commands.push(command);
          return {
            command,
            exitCode: 0,
            stdout: `${command} ok`,
            stderr: "",
            durationMs: 1
          };
        }
      });

      expect(result.ok).toBe(true);
      expect(commands).toEqual([
        "npm run verify:plugin",
        "npm test -- tests/examples.test.ts",
        "npm run typecheck",
        "npm test",
        "npm run build"
      ]);
      expect(result.evidence).toContain("RC command gate passed: npm run verify:plugin");
      expect(result.evidence).toContain("RC repository scan passed");
      expect(result.blockers).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("reports all command failures without stopping at the first one", async () => {
    const root = await createScanFixture();
    try {
      const result = await verifyReleaseCandidate({
        root,
        commandRunner: async (command) => ({
          command,
          exitCode: command === "npm run typecheck" || command === "npm test" ? 1 : 0,
          stdout: "",
          stderr: command,
          durationMs: 1
        })
      });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toEqual([
        "RC_COMMAND_FAILED",
        "RC_COMMAND_FAILED"
      ]);
      expect(result.blockers.map((blocker) => blocker.message)).toEqual([
        "RC command failed: npm run typecheck",
        "RC command failed: npm test"
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks private material without leaking values", async () => {
    const root = await createScanFixture();
    try {
      const privateAddress = ["10", "254", "0", "7"].join(".");
      const fakePassword = ["example", "secret", "value"].join("_");
      const passwordKey = ["pass", "word"].join("");
      await writeFile(join(root, "docs/private.md"), `remote host is ${privateAddress} and ${passwordKey}: ${fakePassword}\n`);

      const result = await scanReleaseCandidateFiles({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.code)).toContain("RC_FORBIDDEN_CONTENT");
      expect(result.blockers.map((blocker) => blocker.rule)).toContain("private network address");
      expect(result.blockers.map((blocker) => blocker.rule)).toContain("password assignment");
      expect(JSON.stringify(result)).not.toContain(fakePassword);
      expect(JSON.stringify(result)).not.toContain(privateAddress);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks unsafe publishing automation while allowing boundary docs", async () => {
    const root = await createScanFixture();
    try {
      await writeFile(join(root, "README.md"), "Workshop upload is not performed by this project.\n");
      const steamCommand = ["steam", "cmd"].join("");
      const uploadCommand = ["workshop", "build", "item"].join("_");
      await writeFile(join(root, "publish.sh"), `${steamCommand} +login builder secret +${uploadCommand} item.vdf\n`);

      const result = await scanReleaseCandidateFiles({ root });

      expect(result.ok).toBe(false);
      expect(result.blockers.map((blocker) => blocker.rule)).toContain("workshop upload automation");
      expect(result.blockers.map((blocker) => blocker.rule)).toContain("steam login automation");
      expect(JSON.stringify(result)).not.toContain("secret");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("excludes generated dependency and graph outputs from scans", async () => {
    const root = await createScanFixture();
    try {
      const result = await scanReleaseCandidateFiles({ root });

      expect(result.ok).toBe(true);
      expect(result.evidence).toContain("RC repository scan passed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

import { describe, expect, test } from "vitest";
import { evaluateReleaseReadiness, type ReleaseReadinessInput } from "../src/release-readiness.js";

const quotedAssignment = (name: string, value: string): string => [name, " = '", value, "'"].join("");
const privateUnixFixture = (): string => ["/", "Users", "/private/workshop"].join("");

describe("release readiness policy", () => {
  test("returns ordered structure and metadata findings", () => {
    const findings = evaluateReleaseReadiness({
      requiredPaths: [
        { label: "game addon root", present: true },
        { label: "content addon root", present: false }
      ],
      metadata: {
        state: "readable",
        content:
          '"addonSteamAppID" "570"\n"addontitle" "Demo"\n"addonAuthor" "TBD"\n"addonDescription" "Ready"\n"addonVersion" "1.0.0"\n"DefaultMap" "dota"\n"maps" "dota"'
      },
      scanRoots: []
    });

    expect(findings).toEqual([
      { code: "REQUIRED_PATH_PRESENT", category: "required-structure", disposition: "evidence", field: "game addon root" },
      { code: "REQUIRED_PATH_MISSING", category: "required-structure", disposition: "blocker", field: "content addon root" },
      { code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field: "addonSteamAppID" },
      { code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field: "addontitle" },
      { code: "METADATA_PLACEHOLDER", category: "metadata", disposition: "blocker", field: "addonAuthor" },
      { code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field: "addonDescription" },
      { code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field: "addonVersion" },
      { code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field: "DefaultMap" },
      { code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field: "maps" }
    ]);
  });

  test("returns safe sensitive and unscannable text findings", () => {
    const secretValue = "private-fixture-value";
    const privateRoot = privateUnixFixture();
    const platformSecretName = ["steam", "password"].join("_");
    const findings = evaluateReleaseReadiness({
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [
        {
          root: "game",
          files: [
            { relativePath: "scripts/secret.lua", state: "text", content: quotedAssignment(platformSecretName, secretValue) },
            { relativePath: "maps/demo.vmap", state: "non-text" },
            { relativePath: "addoninfo.txt", state: "oversized", requiredText: true },
            { relativePath: "resource/addon_demo_english.txt", state: "unreadable", requiredText: true },
            { relativePath: `${privateRoot}/credential.lua`, state: "text", content: quotedAssignment("token", "redacted") }
          ]
        }
      ]
    } as unknown as ReleaseReadinessInput);

    expect(findings.slice(-7)).toEqual([
      { code: "REQUIRED_TEXT_OVERSIZED", category: "oversized-required-text", disposition: "blocker", path: "addoninfo.txt" },
      { code: "NON_TEXT_INCLUDED", category: "non-text", disposition: "warning", path: "maps/demo.vmap" },
      { code: "REQUIRED_TEXT_UNREADABLE", category: "unreadable-required-text", disposition: "blocker", path: "resource/addon_demo_english.txt" },
      { code: "SENSITIVE_MATERIAL", category: "steam credential", disposition: "blocker", path: "scripts/secret.lua" },
      { code: "SENSITIVE_MATERIAL", category: "password", disposition: "blocker", path: "scripts/secret.lua" },
      { code: "POLICY_INPUT_INVALID", category: "relative-path-identity", disposition: "blocker" },
      { code: "SECRET_SCAN_COMPLETED", category: "sensitive-material", disposition: "evidence", field: "game" }
    ]);
    expect(JSON.stringify(findings)).not.toContain(secretValue);
    expect(JSON.stringify(findings)).not.toContain(privateRoot);
  });

  test("does not serialize unsafe caller-provided finding identities", () => {
    const tokenShapedLabel = quotedAssignment("token", "private-label-value");
    const privateScanRoot = privateUnixFixture();
    const findings = evaluateReleaseReadiness({
      requiredPaths: [{ label: tokenShapedLabel, present: false }],
      metadata: {
        state: "readable",
        content:
          '"addonSteamAppID" "570"\n"addontitle" "Demo"\n"addonAuthor" "Team"\n"addonDescription" "Ready"\n"addonVersion" "1.0.0"\n"DefaultMap" "dota"\n"maps" "dota"'
      },
      scanRoots: [
        {
          root: privateScanRoot,
          files: [{ relativePath: "scripts/safe.lua", state: "text", content: quotedAssignment("token", "redacted") }]
        }
      ]
    } as unknown as ReleaseReadinessInput);

    expect(findings[0]).toEqual({
      code: "POLICY_INPUT_INVALID",
      category: "required-structure-identity",
      disposition: "blocker"
    });
    expect(findings.at(-1)).toEqual({
      code: "POLICY_INPUT_INVALID",
      category: "scan-root-identity",
      disposition: "blocker"
    });
    expect(findings.some((finding) => finding.code === "SECRET_SCAN_COMPLETED")).toBe(false);
    expect(JSON.stringify(findings)).not.toContain(tokenShapedLabel);
    expect(JSON.stringify(findings)).not.toContain(privateScanRoot);
  });

  test("redacts credential-bearing metadata paths and unsafe required identities", () => {
    const credential = ["ghp", "12345678901234567890"].join("_");
    const findings = evaluateReleaseReadiness({
      requiredPaths: [{ label: `addon ${credential}`, present: false }],
      metadata: { state: "unreadable", path: `metadata/${credential}.txt` },
      scanRoots: []
    } as unknown as ReleaseReadinessInput);

    expect(findings).toEqual([
      { code: "POLICY_INPUT_INVALID", category: "required-structure-identity", disposition: "blocker" },
      {
        code: "REQUIRED_TEXT_UNREADABLE",
        category: "unreadable-required-text",
        disposition: "blocker",
        path: "metadata/[redacted]"
      }
    ]);
    expect(JSON.stringify(findings)).not.toContain(credential);
  });

  test("redacts credential-bearing scanned-file path segments", () => {
    const credential = ["ghp", "12345678901234567890"].join("_");
    const findings = evaluateReleaseReadiness({
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [
        {
          root: "game",
          files: [{ relativePath: `scripts/${credential}.lua`, state: "non-text" }]
        }
      ]
    });

    expect(findings.at(-2)).toEqual({
      code: "NON_TEXT_INCLUDED",
      category: "non-text",
      disposition: "warning",
      path: "scripts/[redacted]"
    });
    expect(JSON.stringify(findings)).not.toContain(credential);
  });

  test("returns stable blockers for impossible runtime policy identities", () => {
    const input = {
      requiredPaths: [{ present: true }, { label: "unknown required path", present: false }],
      metadata: {
        state: "readable",
        content:
          '"addonSteamAppID" "570"\n"addontitle" "Demo"\n"addonAuthor" "Team"\n"addonDescription" "Ready"\n"addonVersion" "1.0.0"\n"DefaultMap" "dota"\n"maps" "dota"'
      },
      scanRoots: [{ files: [] }, { root: "unknown", files: [] }]
    } as unknown as ReleaseReadinessInput;

    const findings = evaluateReleaseReadiness(input);

    expect(findings.filter((finding) => finding.code === "POLICY_INPUT_INVALID")).toEqual([
      { code: "POLICY_INPUT_INVALID", category: "required-structure-identity", disposition: "blocker" },
      { code: "POLICY_INPUT_INVALID", category: "required-structure-identity", disposition: "blocker" },
      { code: "POLICY_INPUT_INVALID", category: "scan-root-identity", disposition: "blocker" },
      { code: "POLICY_INPUT_INVALID", category: "scan-root-identity", disposition: "blocker" }
    ]);
  });

  test("returns identical findings for shuffled canonical observations", () => {
    const metadata = {
      state: "readable" as const,
      content:
        '"addonSteamAppID" "570"\n"addontitle" "Demo"\n"addonAuthor" "Team"\n"addonDescription" "Ready"\n"addonVersion" "1.0.0"\n"DefaultMap" "dota"\n"maps" "dota"'
    };
    const ordered: ReleaseReadinessInput = {
      requiredPaths: [
        { label: "game addon root", present: true },
        { label: "content addon root", present: false }
      ],
      metadata,
      scanRoots: [
        {
          root: "game",
          files: [
            { relativePath: "a.lua", state: "text", content: quotedAssignment("token", "redacted") },
            { relativePath: "z.vmap", state: "non-text" }
          ]
        },
        { root: "content", files: [{ relativePath: "maps/demo.vmap", state: "non-text" }] }
      ]
    };
    const shuffled: ReleaseReadinessInput = {
      requiredPaths: [...ordered.requiredPaths].reverse(),
      metadata,
      scanRoots: [
        { root: "content", files: [...ordered.scanRoots[1].files] },
        { root: "game", files: [...ordered.scanRoots[0].files].reverse() }
      ]
    };

    expect(evaluateReleaseReadiness(shuffled)).toEqual(evaluateReleaseReadiness(ordered));
  });

  test("orders distinct paths deterministically when redaction collapses their identities", () => {
    const firstCredential = ["ghp", "12345678901234567890a"].join("_");
    const secondCredential = ["ghp", "12345678901234567890b"].join("_");
    const first = { relativePath: `scripts/${firstCredential}.lua`, state: "text" as const, content: quotedAssignment("password", "redacted") };
    const second = { relativePath: `scripts/${secondCredential}.lua`, state: "text" as const, content: quotedAssignment("token", "redacted") };
    const input = (files: [typeof first, typeof second] | [typeof second, typeof first]): ReleaseReadinessInput => ({
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [{ root: "game", files }]
    });

    const ordered = evaluateReleaseReadiness(input([first, second]));
    const reversed = evaluateReleaseReadiness(input([second, first]));

    expect(reversed).toEqual(ordered);
    expect(JSON.stringify(ordered)).not.toContain(firstCredential);
    expect(JSON.stringify(ordered)).not.toContain(secondCredential);
  });

  test("reports complete release candidate scan coverage from canonical observations", async () => {
    const policy = await import("../src/release-readiness.js") as unknown as {
      evaluateReleaseScanCoverage?: (input: ReleaseReadinessInput) => unknown;
    };
    expect(typeof policy.evaluateReleaseScanCoverage).toBe("function");
    if (policy.evaluateReleaseScanCoverage === undefined) return;

    const firstCredential = ["ghp", "12345678901234567890a"].join("_");
    const secondCredential = ["ghp", "12345678901234567890b"].join("_");
    const input = {
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [
        {
          root: "game",
          files: [
            { relativePath: `scripts/${secondCredential}.lua`, state: "text", content: "safe\n" },
            { relativePath: "scripts/optional-unreadable.lua", state: "unreadable" },
            { relativePath: "addoninfo.txt", state: "oversized", requiredText: true },
            { relativePath: "materials/icon.bin", state: "binary" }
          ]
        },
        {
          root: "content",
          files: [
            { relativePath: `panorama/${firstCredential}.txt`, state: "text", content: "safe\n" },
            { relativePath: "maps/large.vmap.txt", state: "oversized" }
          ]
        }
      ]
    } as unknown as ReleaseReadinessInput;

    const coverage = policy.evaluateReleaseScanCoverage(input);

    expect(coverage).toEqual({
      ok: true,
      value: {
        schemaVersion: "1.0",
        totalFileCount: 6,
        text: { count: 2, paths: ["content/panorama/[redacted]", "game/scripts/[redacted]"] },
        binary: { count: 1, paths: ["game/materials/icon.bin"] },
        unreadable: { count: 1, paths: ["game/scripts/optional-unreadable.lua"] },
        oversized: { count: 2, paths: ["content/maps/large.vmap.txt", "game/addoninfo.txt"] }
      }
    });
    expect(JSON.stringify(coverage)).not.toContain(firstCredential);
    expect(JSON.stringify(coverage)).not.toContain(secondCredential);
  });

  test("normalizes hostile release candidate scan coverage getters exactly once", async () => {
    const policy = await import("../src/release-readiness.js") as unknown as {
      evaluateReleaseScanCoverage?: (input: ReleaseReadinessInput) => unknown;
    };
    if (policy.evaluateReleaseScanCoverage === undefined) throw new Error("production scan coverage policy missing");
    const privateRoot = privateUnixFixture();
    const matchedValue = ["ghp", "12345678901234567890z"].join("_");
    const reads = { root: 0, files: 0, relativePath: 0, state: 0 };
    const file = {} as Record<string, unknown>;
    Object.defineProperties(file, {
      relativePath: {
        enumerable: true,
        get: () => (++reads.relativePath === 1 ? "scripts/safe.lua" : `${privateRoot}/${matchedValue}.lua`)
      },
      state: {
        enumerable: true,
        get: () => (++reads.state === 1 ? "text" : matchedValue)
      },
      content: { enumerable: true, value: "safe\n" }
    });
    const scanRoot = {} as Record<string, unknown>;
    Object.defineProperties(scanRoot, {
      root: {
        enumerable: true,
        get: () => (++reads.root === 1 ? "game" : privateRoot)
      },
      files: {
        enumerable: true,
        get: () => (++reads.files === 1 ? [file] : new Proxy([], {
          get: () => {
            throw new Error(`${privateRoot}/${matchedValue}`);
          }
        }))
      }
    });

    const result = policy.evaluateReleaseScanCoverage({
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [scanRoot]
    } as unknown as ReleaseReadinessInput);

    expect(result).toEqual({
      ok: true,
      value: {
        schemaVersion: "1.0",
        totalFileCount: 1,
        text: { count: 1, paths: ["game/scripts/safe.lua"] },
        binary: { count: 0, paths: [] },
        unreadable: { count: 0, paths: [] },
        oversized: { count: 0, paths: [] }
      }
    });
    expect(reads).toEqual({ root: 1, files: 1, relativePath: 1, state: 1 });
    expect(JSON.stringify(result)).not.toContain(privateRoot);
    expect(JSON.stringify(result)).not.toContain(matchedValue);
  });

  test("returns sanitized failures for exceptional release candidate scan coverage observations", async () => {
    const policy = await import("../src/release-readiness.js") as unknown as {
      evaluateReleaseScanCoverage?: (input: ReleaseReadinessInput) => unknown;
    };
    if (policy.evaluateReleaseScanCoverage === undefined) throw new Error("production scan coverage policy missing");
    const privateRoot = privateUnixFixture();
    const matchedValue = ["ghp", "12345678901234567890y"].join("_");
    const failure = {
      ok: false,
      blockers: [{ code: "POLICY_INPUT_INVALID", category: "scan-coverage-observation", disposition: "blocker" }]
    };
    const throwing = (): never => {
      throw new Error(`${privateRoot}/${matchedValue}`);
    };
    const scenarios: Array<{ name: string; scanRoots: unknown[] }> = [
      { name: "root getter", scanRoots: [Object.defineProperty({ files: [] }, "root", { get: throwing })] },
      { name: "files getter", scanRoots: [Object.defineProperty({ root: "game" }, "files", { get: throwing })] },
      {
        name: "relative path getter",
        scanRoots: [{ root: "game", files: [Object.defineProperty({ state: "text", content: "safe" }, "relativePath", { get: throwing })] }]
      },
      {
        name: "state getter",
        scanRoots: [{ root: "game", files: [Object.defineProperty({ relativePath: "safe.lua", content: "safe" }, "state", { get: throwing })] }]
      },
      {
        name: "files iterator proxy",
        scanRoots: [{
          root: "game",
          files: new Proxy([], {
            get: (target, key, receiver) => key === Symbol.iterator ? throwing() : Reflect.get(target, key, receiver)
          })
        }]
      }
    ];

    for (const scenario of scenarios) {
      const result = policy.evaluateReleaseScanCoverage({
        requiredPaths: [],
        metadata: { state: "missing" },
        scanRoots: scenario.scanRoots
      } as unknown as ReleaseReadinessInput);
      expect(result, scenario.name).toEqual(failure);
      expect(JSON.stringify(result), scenario.name).not.toContain(privateRoot);
      expect(JSON.stringify(result), scenario.name).not.toContain(matchedValue);
    }
  });
});

import { describe, expect, test } from "vitest";
import { evaluateReleaseReadiness, type ReleaseReadinessInput } from "../src/release-readiness.js";

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
    const privateRoot = "/Users/private/workshop";
    const findings = evaluateReleaseReadiness({
      requiredPaths: [],
      metadata: { state: "missing" },
      scanRoots: [
        {
          root: "game",
          files: [
            { relativePath: "scripts/secret.lua", state: "text", content: `steam_password = '${secretValue}'` },
            { relativePath: "maps/demo.vmap", state: "non-text" },
            { relativePath: "addoninfo.txt", state: "oversized", requiredText: true },
            { relativePath: "resource/addon_demo_english.txt", state: "unreadable", requiredText: true },
            { relativePath: `${privateRoot}/credential.lua`, state: "text", content: "token = 'redacted'" }
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
    const tokenShapedLabel = "token = 'private-label-value'";
    const privateScanRoot = "/Users/private/workshop";
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
          files: [{ relativePath: "scripts/safe.lua", state: "text", content: "token = 'redacted'" }]
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
            { relativePath: "a.lua", state: "text", content: "token = 'redacted'" },
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
});

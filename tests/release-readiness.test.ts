import { describe, expect, test } from "vitest";
import { evaluateReleaseReadiness } from "../src/release-readiness.js";

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
    });

    expect(findings.slice(-7)).toEqual([
      { code: "SENSITIVE_MATERIAL", category: "steam credential", disposition: "blocker", path: "scripts/secret.lua" },
      { code: "SENSITIVE_MATERIAL", category: "password", disposition: "blocker", path: "scripts/secret.lua" },
      { code: "NON_TEXT_INCLUDED", category: "non-text", disposition: "warning", path: "maps/demo.vmap" },
      { code: "REQUIRED_TEXT_OVERSIZED", category: "oversized-required-text", disposition: "blocker", path: "addoninfo.txt" },
      { code: "REQUIRED_TEXT_UNREADABLE", category: "unreadable-required-text", disposition: "blocker", path: "resource/addon_demo_english.txt" },
      { code: "SENSITIVE_MATERIAL", category: "token", disposition: "blocker" },
      { code: "SECRET_SCAN_COMPLETED", category: "sensitive-material", disposition: "evidence", field: "game" }
    ]);
    expect(JSON.stringify(findings)).not.toContain(secretValue);
    expect(JSON.stringify(findings)).not.toContain(privateRoot);
  });
});

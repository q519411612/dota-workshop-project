import type { CommandEvidence, LogEvidence } from "./types.js";

export type SameMachineSmokeStatus = "harness_ready" | "runtime_pending" | "runtime_passed";
export type SameMachineRuntimeEvidence = "pending" | "missing" | "passed";

export type SameMachineSmokeEvidenceArtifact = {
  schemaVersion: "1.0";
  generatedAt: string;
  target: {
    kind: "same-machine-windows";
    identity: "sanitized";
  };
  status: SameMachineSmokeStatus;
  addonName: string;
  mapName: string;
  operations: string[];
  evidence: string[];
  warnings: string[];
  blockers: string[];
  boundaries: string[];
  paths: Record<string, string>;
  commands: CommandEvidence[];
  logs: LogEvidence[];
};

export type SameMachineSmokeVerificationBlocker = {
  code: string;
  field: string;
  category: string;
};

export type SameMachineSmokeVerificationResult = {
  ok: boolean;
  status: SameMachineSmokeStatus | "invalid";
  runtimeEvidence: SameMachineRuntimeEvidence;
  evidence: string[];
  warnings: string[];
  blockers: SameMachineSmokeVerificationBlocker[];
  boundaries: string[];
  paths: Record<string, string>;
  commands: CommandEvidence[];
  logs: LogEvidence[];
};

const REQUIRED_BOUNDARIES = [
  "no Workshop upload attempted",
  "no Steam login captured",
  "no Steam Guard handling captured",
  "no content encryption performed",
  "no package signing performed",
  "no credentials stored",
  "no remote Windows connection attempted"
];

const SENSITIVE_PATTERNS = [
  { category: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { category: "token", pattern: /\b(?:token|api[_-]?key|secret)\b\s*[:=]/i },
  { category: "credential", pattern: /\b(?:password|passwd|pwd)\b\s*[:=]?/i },
  { category: "credential", pattern: /\bsteam_(?:password|token|secret|apikey|api_key)/i },
  { category: "credential", pattern: /\b(?:steam|github|windows|remote)_(?:password|token|secret|apikey|api_key)/i },
  { category: "private windows path", pattern: /\b[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/]+/ },
  { category: "private unix path", pattern: /\/Users\/[^/\s]+/ },
  { category: "private host path", pattern: /\\\\[^\\/\s]+[\\/][^\\/\s]+/ },
  { category: "private host field", pattern: /\b(?:hostname|host|username|account)\b\s*[:=]/i }
];

export function createHarnessReadySameMachineSmokeArtifact(): SameMachineSmokeEvidenceArtifact {
  return {
    schemaVersion: "1.0",
    generatedAt: new Date(0).toISOString(),
    target: {
      kind: "same-machine-windows",
      identity: "sanitized"
    },
    status: "harness_ready",
    addonName: "same_machine_smoke_harness",
    mapName: "dota",
    operations: [
      "schema verification",
      "sanitization verification",
      "runbook verification"
    ],
    evidence: [
      "same-machine smoke harness ready",
      "sanitized evidence schema available",
      "same-machine Windows runtime evidence not collected"
    ],
    warnings: [
      "real same-machine Windows runtime evidence is pending"
    ],
    blockers: [],
    boundaries: [...REQUIRED_BOUNDARIES],
    paths: {
      dotaRoot: "<sanitized-dota-root>",
      consoleLog: "<sanitized-console-log>"
    },
    commands: [
      {
        command: "node ./dist/index.js"
      },
      {
        command: "node ./dist/verify-same-machine-smoke.js"
      }
    ],
    logs: []
  };
}

export function verifySameMachineSmokeEvidence(
  artifact: unknown
): SameMachineSmokeVerificationResult {
  const record = asRecord(artifact);
  const status = parseStatus(record.status);
  const evidence = stringArray(record.evidence);
  const warnings = stringArray(record.warnings);
  const boundaries = stringArray(record.boundaries);
  const paths = stringRecord(record.paths);
  const commands = commandArray(record.commands);
  const logs = logArray(record.logs);
  const blockers: SameMachineSmokeVerificationBlocker[] = [];

  if (record.schemaVersion !== "1.0") {
    blockers.push(blocker("SCHEMA_VERSION_INVALID", "schemaVersion", "schema"));
  }

  const target = asRecord(record.target);
  if (target.kind !== "same-machine-windows" || target.identity !== "sanitized") {
    blockers.push(blocker("TARGET_CATEGORY_INVALID", "target", "schema"));
  }

  if (status === "invalid") {
    blockers.push(blocker("STATUS_INVALID", "status", "schema"));
  }

  if (typeof record.addonName !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(record.addonName)) {
    blockers.push(blocker("ADDON_NAME_INVALID", "addonName", "schema"));
  }

  if (typeof record.mapName !== "string" || record.mapName.length === 0) {
    blockers.push(blocker("MAP_NAME_INVALID", "mapName", "schema"));
  }

  for (const required of REQUIRED_BOUNDARIES) {
    if (!boundaries.includes(required)) {
      blockers.push(blocker("BOUNDARY_MISSING", "boundaries", required));
    }
  }

  const runtimeEvidence = resolveRuntimeEvidence(status, logs);
  if (status === "runtime_passed" && runtimeEvidence !== "passed") {
    blockers.push(blocker("RUNTIME_MARKER_EVIDENCE_MISSING", "logs", "runtime marker"));
  }

  for (const finding of findSensitiveStrings(record)) {
    blockers.push(blocker("SENSITIVE_MATERIAL_FOUND", finding.field, finding.category));
  }

  const resultEvidence = [...evidence];
  const resultWarnings = [...warnings];
  if (status === "harness_ready" && !resultWarnings.includes("real same-machine Windows runtime evidence is pending")) {
    resultWarnings.push("real same-machine Windows runtime evidence is pending");
  }
  if (status === "runtime_passed" && runtimeEvidence === "passed") {
    resultEvidence.push("real same-machine Windows runtime evidence passed");
  }

  return {
    ok: blockers.length === 0,
    status,
    runtimeEvidence,
    evidence: resultEvidence,
    warnings: resultWarnings,
    blockers,
    boundaries,
    paths,
    commands,
    logs
  };
}

function resolveRuntimeEvidence(status: SameMachineSmokeStatus | "invalid", logs: LogEvidence[]): SameMachineRuntimeEvidence {
  const hasRuntimeMarker = logs.some((log) =>
    log.lines.some((line) => line.includes("[DOTA_WORKSHOP_MCP]") && line.includes("win condition reached"))
  );

  if (status === "runtime_passed") {
    return hasRuntimeMarker ? "passed" : "missing";
  }

  return "pending";
}

function findSensitiveStrings(value: unknown, field = "$"): Array<{ field: string; category: string }> {
  if (typeof value === "string") {
    const match = SENSITIVE_PATTERNS.find((entry) => entry.pattern.test(value));
    return match ? [{ field, category: match.category }] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findSensitiveStrings(entry, `${field}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => findSensitiveStrings(entry, `${field}.${key}`));
  }

  return [];
}

function parseStatus(value: unknown): SameMachineSmokeStatus | "invalid" {
  if (value === "harness_ready" || value === "runtime_pending" || value === "runtime_passed") {
    return value;
  }

  return "invalid";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function stringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function commandArray(value: unknown): CommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter((entry) => typeof entry.command === "string")
    .map((entry) => ({
      command: entry.command as string,
      cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      exitCode: typeof entry.exitCode === "number" ? entry.exitCode : undefined,
      stdout: typeof entry.stdout === "string" ? entry.stdout : undefined,
      stderr: typeof entry.stderr === "string" ? entry.stderr : undefined
    }));
}

function logArray(value: unknown): LogEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter((entry) => typeof entry.source === "string")
    .map((entry) => ({
      source: entry.source as string,
      lines: stringArray(entry.lines)
    }));
}

function blocker(code: string, field: string, category: string): SameMachineSmokeVerificationBlocker {
  return { code, field, category };
}

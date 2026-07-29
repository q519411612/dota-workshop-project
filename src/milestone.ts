import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyReleaseHandoff, type ReleaseBoundaryItem, type ReleaseHandoffBlocker, type ReleaseHandoffResult } from "./handoff.js";

export type MilestoneCloseoutBlocker = {
  code: string;
  message: string;
  file?: string;
  version?: string;
  rule?: string;
  command?: string;
};

export type MilestoneVersionEntry = {
  version: string;
  title: string;
  commit: string;
  goal: string;
  keyDeliveries: string[];
  verificationStatus: string;
  documentationStatus: string;
  knownBoundary: string;
  remainingNonBlockingItems: string[];
};

export type MilestoneDocumentationItem = {
  label: string;
  path: string;
  ok: boolean;
  evidence: string[];
};

export type MilestoneCloseoutResult = {
  ok: boolean;
  milestone: {
    version: string;
    title: string;
    purpose: string;
  };
  commitRange: {
    from: string;
    to: string;
    label: string;
  };
  handoff: {
    ok: boolean;
    commit: string;
    releaseCandidateOk: boolean;
    commands: {
      command: string;
      exitCode: number;
      stdout: string;
      stderr: string;
      durationMs: number;
    }[];
    blockers: MilestoneCloseoutBlocker[];
  };
  versions: MilestoneVersionEntry[];
  documentation: {
    ok: boolean;
    items: MilestoneDocumentationItem[];
  };
  boundaries: {
    ok: boolean;
    items: ReleaseBoundaryItem[];
  };
  remainingNonBlockingItems: string[];
  evidence: string[];
  warnings: string[];
  blockers: MilestoneCloseoutBlocker[];
  paths: Record<string, string>;
};

export type VerifyMilestoneCloseoutInput = {
  root?: string;
  handoffVerifier?: (input: { root: string }) => Promise<ReleaseHandoffResult>;
};

const VERSION_INVENTORY: MilestoneVersionEntry[] = [
  {
    version: "v1.2",
    title: "Publishing Readiness",
    commit: "ba6856fa170d97dea677a42293fc3d2c12eda012",
    goal: "Add dry-run release/package readiness before any real Workshop upload automation.",
    keyDeliveries: [
      "Added dry-run release report for release-critical addon roots and files.",
      "Checked publish-facing addon metadata completeness.",
      "Reported sensitive information blockers and explicit publishing boundaries."
    ],
    verificationStatus: "Complete: local tests and dry-run release report passed for the slice.",
    documentationStatus: "Roadmap and requirements record dry-run publishing boundaries.",
    knownBoundary: "No real upload, encryption, credential handling, publish-state mutation, archive signing, or toolchain execution.",
    remainingNonBlockingItems: []
  },
  {
    version: "v1.3",
    title: "Windows Validation Closure",
    commit: "c2ae5b36b82e3e826025d5ecf01d2d95fafbca1b",
    goal: "Collect sanitized evidence from a user-provided Windows host for validation closure.",
    keyDeliveries: [
      "Recorded sanitized Dota and Workshop path-category evidence.",
      "Validated playable smoke runtime markers through the remote Windows path.",
      "Recorded dry-run release blockers and addon-scoped cleanup evidence."
    ],
    verificationStatus: "Complete: real Windows validation passed through the remote SSH path with sanitized evidence.",
    documentationStatus: "Verification artifact records private target data exclusion.",
    knownBoundary: "No stored connection details, broad cleanup, UI automation, Steam login, encryption, or Workshop upload.",
    remainingNonBlockingItems: ["Same-machine local Windows MCP server execution remains unproven and non-blocking."]
  },
  {
    version: "v1.4",
    title: "Plugin Install Handoff Readiness",
    commit: "37d436f56c21daa9a7277622db5239fceda4e4b0",
    goal: "Make plugin installation and operator handoff readiness locally verifiable.",
    keyDeliveries: [
      "Added `npm run verify:plugin`.",
      "Checked plugin manifest, MCP config, package bin, built entrypoint, skill references, and tool-list drift.",
      "Documented plugin handoff readiness commands and no-credentials boundary."
    ],
    verificationStatus: "Complete: plugin verifier and tests passed locally.",
    documentationStatus: "README documents plugin readiness and credential boundaries.",
    knownBoundary: "No global installation, package publishing, archive signing, Steam login, encryption, Workshop upload, or credential storage.",
    remainingNonBlockingItems: []
  },
  {
    version: "v1.5",
    title: "Operator Runbook and Example Workflows",
    commit: "62c08d143d7b2fb70d1c6c9293cadafd5acf32d0",
    goal: "Make the validated workflow understandable and reusable through checked docs and schema-valid examples.",
    keyDeliveries: [
      "Added `docs/operator-runbook.md`.",
      "Added schema-valid workflow examples under `examples/workflows/`.",
      "Added tests for example schemas, README links, and forbidden private or credential-like material."
    ],
    verificationStatus: "Complete: runbook and example tests passed locally.",
    documentationStatus: "README links the runbook and examples.",
    knownBoundary: "No real Windows smoke, real Workshop upload, Steam login, encryption, global plugin install, or package publishing.",
    remainingNonBlockingItems: []
  },
  {
    version: "v1.6",
    title: "Release Candidate Audit Gate",
    commit: "1f5b722e7e413b3e19388ba37c2a052d818704c0",
    goal: "Establish a local release-candidate gate before broader handoff or publishing work.",
    keyDeliveries: [
      "Added `npm run verify:rc`.",
      "Aggregated plugin readiness, example/schema tests, typecheck, tests, build, and repository hygiene scanning.",
      "Excluded generated dependency/output trees and graph freshness output from the scanner."
    ],
    verificationStatus: "Complete: RC gate passed locally.",
    documentationStatus: "README and runbook place RC before handoff or optional remote smoke.",
    knownBoundary: "No upload, login, Steam Guard, encryption, signing, archive creation, Windows smoke, remote smoke, UI automation, or new gameplay/toolchain features.",
    remainingNonBlockingItems: []
  },
  {
    version: "v1.7",
    title: "Release Handoff Bundle Readiness",
    commit: "7c0d3bfd7224a6ed82a97eaf7b6f6f038590cb1d",
    goal: "Add a local release handoff report before external operator delivery or release review.",
    keyDeliveries: [
      "Added `npm run verify:handoff`.",
      "Reported commit SHA, RC preflight status, delivery checklist, documentation coverage, and explicit release boundaries.",
      "Sanitized RC command output so repository absolute paths are not leaked."
    ],
    verificationStatus: "Complete: handoff gate passed locally.",
    documentationStatus: "README and runbook include the handoff gate after `verify:rc`.",
    knownBoundary: "No Workshop upload, Steam login, Steam Guard handling, content encryption, package signing, credential storage, or remote Windows connection.",
    remainingNonBlockingItems: []
  },
  {
    version: "v1.15",
    title: "Verifiable Release Candidate Export and Handoff",
    commit: "0000000000000000000000000000000000000000",
    goal: "Retain a strictly validated target-local candidate with auditable handoff, ownership, and exact cleanup evidence.",
    keyDeliveries: [
      "Added independent export_release_candidate and cleanup_exported_candidate MCP operations.",
      "Added same-filesystem staging, atomic no-replace promotion, external handoff ownership, and verified cleanup.",
      "Added strict fixture, local, SSH, and PowerShell contract normalization with no remote candidate transfer."
    ],
    verificationStatus: "Complete: 24/24 requirements, clean independent review, and all local release gates passed.",
    documentationStatus: "README, operator runbook, skill guidance, examples, phase verification, and milestone audit cover v1.15.",
    knownBoundary: "Real Windows export, normalization, reparse, promotion, and cleanup runtime evidence remains explicitly unverified.",
    remainingNonBlockingItems: ["Real Windows exported-candidate runtime evidence remains optional supporting evidence."]
  }
];

const BOUNDARIES: ReleaseBoundaryItem[] = [
  {
    label: "no real Workshop upload",
    ok: true,
    evidence: "Milestone closeout reports readiness only and performs no publish-state mutation."
  },
  {
    label: "no Steam login",
    ok: true,
    evidence: "The milestone command performs local file and handoff checks only."
  },
  {
    label: "no Steam Guard handling",
    ok: true,
    evidence: "The milestone command has no account or authentication workflow."
  },
  {
    label: "no content encryption",
    ok: true,
    evidence: "The milestone command does not build, transform, encrypt, or package addon content."
  },
  {
    label: "no package signing",
    ok: true,
    evidence: "The milestone command does not create or sign distribution packages."
  },
  {
    label: "no credential or private target storage",
    ok: true,
    evidence: "The milestone report uses fixed public commits and repository-relative paths."
  },
  {
    label: "no remote Windows connection",
    ok: true,
    evidence: "The milestone command does not use SSH, PowerShell Remoting, or MCP target operations."
  }
];

const REQUIRED_README_COVERAGE = [
  "npm run build",
  "npm run verify:plugin",
  "npm run verify:rc",
  "npm run verify:handoff",
  "npm run verify:milestone",
  "docs/operator-runbook.md",
  "local-only"
];

const REQUIRED_RUNBOOK_COVERAGE = [
  "npm install",
  "npm run build",
  "npm run verify:plugin",
  "npm run verify:rc",
  "npm run verify:handoff",
  "npm run verify:milestone",
  "Fixture Workflow",
  "Optional Remote Smoke",
  "Cleanup",
  "credentials",
  "private target"
];

const REQUIRED_HANDOFF_DELIVERY_LABELS = ["README", "operator runbook", "workflow examples"];
const REMAINING_NON_BLOCKING_ITEMS = [
  "same-machine local Windows MCP server smoke remains optional supporting evidence",
  "real Windows exported-candidate runtime evidence remains explicitly unverified",
  "real Workshop upload remains deferred until a future explicit publishing milestone",
  "package signing, content encryption, and registry publishing remain out of scope"
];

export async function verifyMilestoneCloseout(input: VerifyMilestoneCloseoutInput = {}): Promise<MilestoneCloseoutResult> {
  const root = input.root ?? process.cwd();
  const handoffVerifier = input.handoffVerifier ?? ((args) => verifyReleaseHandoff(args));
  const evidence: string[] = [];
  const warnings: string[] = [];
  const blockers: MilestoneCloseoutBlocker[] = [];

  const handoffResult = await handoffVerifier({ root });
  if (handoffResult.ok) {
    evidence.push("milestone handoff preflight passed");
  } else {
    blockers.push(...handoffResult.blockers.map((blocker) => copyHandoffBlocker(blocker, root)));
  }
  warnings.push(...handoffResult.warnings.map((warning) => sanitizeText(warning, root)));

  const versions = VERSION_INVENTORY.map((entry) => ({
    ...entry,
    ...(entry.version === "v1.15" ? { commit: handoffResult.commit.sha } : {}),
    keyDeliveries: [...entry.keyDeliveries],
    remainingNonBlockingItems: [...entry.remainingNonBlockingItems]
  }));
  blockers.push(...validateVersionInventory(versions));
  if (!blockers.some((blocker) => blocker.code.startsWith("MILESTONE_VERSION"))) {
    evidence.push("milestone version inventory complete: v1.2-v1.15");
  }

  const documentationItems = await buildDocumentationItems(root, handoffResult, blockers);
  if (documentationItems.every((item) => item.ok)) {
    evidence.push("milestone documentation coverage passed");
  }

  const boundaries = {
    ok: BOUNDARIES.every((item) => item.ok),
    items: BOUNDARIES
  };
  evidence.push("milestone release boundaries recorded");

  const handoffBlockers = handoffResult.blockers.map((blocker) => copyHandoffBlocker(blocker, root));

  return {
    ok: blockers.length === 0,
    milestone: {
      version: "v1.15",
      title: "Verifiable Release Candidate Export and Handoff",
      purpose: "Verify retained candidate export, external handoff, exact cleanup, release boundaries, and audit readiness."
    },
    commitRange: {
      from: versions[0]?.commit ?? "",
      to: versions[versions.length - 1]?.commit ?? "",
      label: "v1.2-v1.15"
    },
    handoff: {
      ok: handoffResult.ok,
      commit: handoffResult.commit.sha,
      releaseCandidateOk: handoffResult.verification.releaseCandidate.ok,
      commands: handoffResult.verification.releaseCandidate.commands.map((command) => ({
        ...command,
        stdout: sanitizeText(command.stdout, root),
        stderr: sanitizeText(command.stderr, root)
      })),
      blockers: handoffBlockers
    },
    versions,
    documentation: {
      ok: documentationItems.every((item) => item.ok),
      items: documentationItems
    },
    boundaries,
    remainingNonBlockingItems: REMAINING_NON_BLOCKING_ITEMS,
    evidence,
    warnings,
    blockers,
    paths: {
      readme: "README.md",
      operatorRunbook: "docs/operator-runbook.md",
      handoffReport: "npm run verify:handoff",
      milestoneReport: "npm run verify:milestone"
    }
  };
}

function validateVersionInventory(entries: MilestoneVersionEntry[]): MilestoneCloseoutBlocker[] {
  const blockers: MilestoneCloseoutBlocker[] = [];
  const expectedVersions = ["v1.2", "v1.3", "v1.4", "v1.5", "v1.6", "v1.7", "v1.15"];
  const actualVersions = entries.map((entry) => entry.version);
  for (const version of expectedVersions) {
    if (!actualVersions.includes(version)) {
      blockers.push({
        code: "MILESTONE_VERSION_MISSING",
        message: `Milestone version inventory is missing ${version}.`,
        version
      });
    }
  }

  for (const entry of entries) {
    if (!entry.commit || !/^[a-f0-9]{40}$/.test(entry.commit)) {
      blockers.push({
        code: "MILESTONE_VERSION_COMMIT_INVALID",
        message: `Milestone version ${entry.version} is missing a full commit SHA.`,
        version: entry.version
      });
    }
    if (entry.keyDeliveries.length === 0) {
      blockers.push({
        code: "MILESTONE_VERSION_DELIVERY_MISSING",
        message: `Milestone version ${entry.version} is missing delivery summary entries.`,
        version: entry.version
      });
    }
    if (!entry.verificationStatus.trim()) {
      blockers.push({
        code: "MILESTONE_VERSION_VERIFICATION_MISSING",
        message: `Milestone version ${entry.version} is missing verification status.`,
        version: entry.version
      });
    }
  }

  return blockers;
}

async function buildDocumentationItems(
  root: string,
  handoffResult: ReleaseHandoffResult,
  blockers: MilestoneCloseoutBlocker[]
): Promise<MilestoneDocumentationItem[]> {
  const readme = await coverageItem(root, "README.md", "README", REQUIRED_README_COVERAGE, blockers);
  const runbook = await coverageItem(root, "docs/operator-runbook.md", "operator runbook", REQUIRED_RUNBOOK_COVERAGE, blockers, "Operator runbook");
  const handoff = handoffReportItem(handoffResult, blockers);

  return [readme, runbook, handoff];
}

async function coverageItem(
  root: string,
  relPath: string,
  label: string,
  requiredTerms: string[],
  blockers: MilestoneCloseoutBlocker[],
  messageLabel = label
): Promise<MilestoneDocumentationItem> {
  let content = "";
  try {
    content = await readFile(join(root, relPath), "utf8");
  } catch {
    blockers.push({
      code: "MILESTONE_DOC_MISSING",
      message: `${messageLabel} is missing.`,
      file: relPath
    });
    return {
      label,
      path: relPath,
      ok: false,
      evidence: [`${relPath} is missing`]
    };
  }

  const normalized = content.toLowerCase();
  const missing = requiredTerms.filter((term) => !normalized.includes(term.toLowerCase()));
  for (const term of missing) {
    blockers.push({
      code: "MILESTONE_DOC_COVERAGE_MISSING",
      message: `${messageLabel} is missing coverage: ${term}`,
      file: relPath
    });
  }

  return {
    label,
    path: relPath,
    ok: missing.length === 0,
    evidence: missing.length === 0 ? [`${relPath} covers milestone review readiness`] : missing.map((term) => `${term} is missing`)
  };
}

function handoffReportItem(handoffResult: ReleaseHandoffResult, blockers: MilestoneCloseoutBlocker[]): MilestoneDocumentationItem {
  const evidence: string[] = [];
  const deliveryLabels = handoffResult.delivery.items.map((item) => item.label);
  const missingDelivery = REQUIRED_HANDOFF_DELIVERY_LABELS.filter((label) => !deliveryLabels.includes(label));
  for (const label of missingDelivery) {
    blockers.push({
      code: "MILESTONE_HANDOFF_DELIVERY_MISSING",
      message: `Handoff report is missing delivery coverage: ${label}`,
      file: "npm run verify:handoff"
    });
  }

  if (!handoffResult.delivery.ok) {
    blockers.push({
      code: "MILESTONE_HANDOFF_DELIVERY_NOT_READY",
      message: "Handoff report delivery checklist is not ready.",
      file: "npm run verify:handoff"
    });
  } else {
    evidence.push("handoff delivery checklist is ready");
  }

  if (!handoffResult.boundaries.ok) {
    blockers.push({
      code: "MILESTONE_HANDOFF_BOUNDARIES_NOT_READY",
      message: "Handoff report release boundaries are not ready.",
      file: "npm run verify:handoff"
    });
  } else {
    evidence.push("handoff release boundaries are ready");
  }

  if (!handoffResult.evidence.includes("handoff documentation coverage passed")) {
    blockers.push({
      code: "MILESTONE_HANDOFF_DOC_COVERAGE_MISSING",
      message: "Handoff report is missing documentation coverage evidence.",
      file: "npm run verify:handoff"
    });
  } else {
    evidence.push("handoff documentation coverage is ready");
  }

  return {
    label: "handoff report",
    path: "npm run verify:handoff",
    ok: missingDelivery.length === 0 && handoffResult.delivery.ok && handoffResult.boundaries.ok && handoffResult.evidence.includes("handoff documentation coverage passed"),
    evidence: evidence.length > 0 ? evidence : ["handoff report coverage is incomplete"]
  };
}

function copyHandoffBlocker(blocker: ReleaseHandoffBlocker, root: string): MilestoneCloseoutBlocker {
  return {
    code: blocker.code,
    message: sanitizeText(blocker.message, root),
    file: blocker.file ? sanitizeText(blocker.file, root) : undefined,
    rule: blocker.rule,
    command: blocker.command
  };
}

function sanitizeText(value: string, root: string): string {
  return value.split(root).join("<repo>");
}

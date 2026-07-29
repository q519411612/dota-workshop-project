export type FixtureTarget = {
  kind: "fixture";
  root: string;
};

export type LocalTarget = {
  kind: "local";
  dotaRoot?: string;
};

export type RemoteTarget = {
  kind: "remote";
  name: string;
  transport: "ssh" | "powershell";
  host: string;
  username?: string;
  dotaRoot?: string;
};

export type Target = FixtureTarget | LocalTarget | RemoteTarget;

export type CommandEvidence = {
  command: string;
  cwd?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
};

export type LogEvidence = {
  source: string;
  lines: string[];
};

export type ToolError = {
  code: string;
  message: string;
};

export type ToolResult = {
  ok: boolean;
  target: Target;
  operation: string;
  evidence: string[];
  warnings: string[];
  paths: Record<string, string>;
  commands: CommandEvidence[];
  logs: LogEvidence[];
  error?: ToolError;
  releaseCandidate?: ReleaseCandidateDetail;
  manifest?: import("./exported-candidate.js").ExportedCandidateHandoffManifest | null;
  ownership?: import("./exported-candidate.js").ExportedCandidateOwnership | null;
  cleanup?: import("./exported-candidate.js").ExportedCandidateCleanupEvidence;
};
import type { ReleaseCandidateDetail } from "./release-candidate-result.js";

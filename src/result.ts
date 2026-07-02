import type { CommandEvidence, LogEvidence, Target, ToolError, ToolResult } from "./types.js";

type SuccessInput = {
  target: Target;
  operation: string;
  evidence?: string[];
  warnings?: string[];
  paths?: Record<string, string>;
  commands?: CommandEvidence[];
  logs?: LogEvidence[];
};

type FailureInput = SuccessInput & {
  error: ToolError;
};

export function createSuccessResult(input: SuccessInput): ToolResult {
  return {
    ok: true,
    target: input.target,
    operation: input.operation,
    evidence: input.evidence ?? [],
    warnings: input.warnings ?? [],
    paths: input.paths ?? {},
    commands: input.commands ?? [],
    logs: input.logs ?? []
  };
}

export function createFailureResult(input: FailureInput): ToolResult {
  return {
    ok: false,
    target: input.target,
    operation: input.operation,
    error: input.error,
    evidence: input.evidence ?? [],
    warnings: input.warnings ?? [],
    paths: input.paths ?? {},
    commands: input.commands ?? [],
    logs: input.logs ?? []
  };
}

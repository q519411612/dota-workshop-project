import { createAddon, inspectAddon } from "./addon.js";
import { cleanupPlayableSmoke } from "./cleanup.js";
import { discoverEnvironment, validateInstallRoot } from "./environment.js";
import { launchCustomGame, launchTools, readConsoleOrLogs, validateAddon } from "./launch.js";
import { prepareCustomMap } from "./map.js";
import { dryRunReleaseReport, inspectWorkshopPreflight } from "./preflight.js";
import { preflightNodeReleaseCandidate } from "./release-candidate-node.js";
import { preflightRemoteReleaseCandidate } from "./release-candidate-remote.js";
import { createReleaseCandidateToolResult } from "./release-candidate-result.js";
import { createFailureResult } from "./result.js";
import { cleanupNodeExportedCandidate, exportNodeReleaseCandidate } from "./exported-candidate.js";
import { runPlayableSmoke } from "./smoke.js";
import {
  createRemoteAddon,
  discoverRemoteEnvironment,
  inspectRemoteAddon,
  dryRunRemoteReleaseReport,
  inspectRemoteWorkshopPreflight,
  launchRemoteCustomGame,
  launchRemoteTools,
  readRemoteConsoleOrLogs,
  runRemoteCommand,
  validateRemoteAddon
} from "./remote.js";
import {
  CreateAddonInputSchema,
  DiscoverEnvironmentInputSchema,
  DryRunReleaseReportInputSchema,
  InspectAddonInputSchema,
  InspectWorkshopPreflightInputSchema,
  LaunchCustomGameInputSchema,
  LaunchToolsInputSchema,
  PrepareCustomMapInputSchema,
  PreflightReleaseCandidateInputSchema,
  ReadLogsInputSchema,
  RemoteCommandInputSchema,
  RunPlayableSmokeInputSchema,
  CleanupPlayableSmokeInputSchema,
  CleanupExportedCandidateInputSchema,
  ExportReleaseCandidateInputSchema,
  ValidateAddonInputSchema,
  ValidateTargetInputSchema
} from "./schemas.js";
import type { ToolResult } from "./types.js";
import type {
  CleanupExportedCandidateToolInput,
  ExportReleaseCandidateToolInput,
  PreflightReleaseCandidateToolInput
} from "./schemas.js";

type PreflightServices = Readonly<{
  preflightNodeReleaseCandidate(input: PreflightReleaseCandidateToolInput): Promise<ToolResult>;
  preflightRemoteReleaseCandidate(input: PreflightReleaseCandidateToolInput): Promise<ToolResult>;
}>;

type CandidateServices = PreflightServices & Readonly<{
  exportNodeReleaseCandidate(input: ExportReleaseCandidateToolInput): Promise<ToolResult>;
  exportRemoteReleaseCandidate(input: ExportReleaseCandidateToolInput): Promise<ToolResult>;
  cleanupNodeExportedCandidate(input: CleanupExportedCandidateToolInput): Promise<ToolResult>;
  cleanupRemoteExportedCandidate(input: CleanupExportedCandidateToolInput): Promise<ToolResult>;
}>;

const defaultPreflightServices: PreflightServices = Object.freeze({
  preflightNodeReleaseCandidate: async (input) => {
    const releaseCandidate = await preflightNodeReleaseCandidate(input);
    const target = input.target.kind === "fixture"
      ? { kind: "fixture" as const, root: "[redacted]" }
      : { kind: "local" as const };
    return createReleaseCandidateToolResult({
      target,
      operation: "preflight_release_candidate",
      releaseCandidate
    });
  },
  preflightRemoteReleaseCandidate: async (input) => {
    if (input.target.kind !== "remote") {
      throw new Error("REMOTE_TARGET_REQUIRED");
    }
    return preflightRemoteReleaseCandidate({ target: input.target, addonName: input.addonName });
  }
});

const defaultCandidateServices: CandidateServices = Object.freeze({
  ...defaultPreflightServices,
  exportNodeReleaseCandidate: async (input) => await exportNodeReleaseCandidate(input),
  exportRemoteReleaseCandidate: async (input) => await exportNodeReleaseCandidate(input),
  cleanupNodeExportedCandidate: async (input) => await cleanupNodeExportedCandidate(input),
  cleanupRemoteExportedCandidate: async (input) => await cleanupNodeExportedCandidate(input)
});

export const toolNames = [
  "discover_environment",
  "validate_target",
  "create_addon",
  "prepare_custom_map",
  "inspect_addon",
  "inspect_workshop_preflight",
  "dry_run_release_report",
  "preflight_release_candidate",
  "export_release_candidate",
  "cleanup_exported_candidate",
  "launch_tools",
  "launch_custom_game",
  "run_playable_smoke",
  "cleanup_playable_smoke",
  "read_console_or_logs",
  "validate_addon",
  "remote_command"
] as const;

export async function handleTool(
  name: string,
  input: unknown,
  candidateServices: CandidateServices = defaultCandidateServices
): Promise<ToolResult> {
  switch (name) {
    case "discover_environment": {
      const parsed = DiscoverEnvironmentInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return discoverRemoteEnvironment({ target: parsed.target });
      }
      return discoverEnvironment(parsed);
    }
    case "validate_target": {
      const parsed = ValidateTargetInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return discoverRemoteEnvironment({
          target: {
            ...parsed.target,
            dotaRoot: parsed.target.dotaRoot ?? parsed.dotaRoot
          }
        });
      }
      return validateInstallRoot(parsed);
    }
    case "create_addon": {
      const parsed = CreateAddonInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return createRemoteAddon({
          target: parsed.target,
          addonName: parsed.addonName,
          mapName: parsed.mapName,
          template: parsed.template,
          placement: parsed.placement,
          objective: parsed.objective,
          unitAbilityScaffold: parsed.unitAbilityScaffold,
          replace: parsed.replace
        });
      }
      return createAddon(parsed);
    }
    case "prepare_custom_map": {
      const parsed = PrepareCustomMapInputSchema.parse(input);
      return prepareCustomMap(parsed);
    }
    case "inspect_addon": {
      const parsed = InspectAddonInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return inspectRemoteAddon({
          target: parsed.target,
          addonName: parsed.addonName
        });
      }
      return inspectAddon(parsed);
    }
    case "inspect_workshop_preflight": {
      const parsed = InspectWorkshopPreflightInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return inspectRemoteWorkshopPreflight({
          target: parsed.target,
          addonName: parsed.addonName
        });
      }
      return inspectWorkshopPreflight(parsed);
    }
    case "dry_run_release_report": {
      const parsed = DryRunReleaseReportInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return dryRunRemoteReleaseReport({
          target: parsed.target,
          addonName: parsed.addonName
        });
      }
      return dryRunReleaseReport(parsed);
    }
    case "preflight_release_candidate": {
      const parsed = PreflightReleaseCandidateInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return candidateServices.preflightRemoteReleaseCandidate(parsed);
      }
      return candidateServices.preflightNodeReleaseCandidate(parsed);
    }
    case "export_release_candidate": {
      const parsed = ExportReleaseCandidateInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return candidateServices.exportRemoteReleaseCandidate(parsed);
      }
      return candidateServices.exportNodeReleaseCandidate(parsed);
    }
    case "cleanup_exported_candidate": {
      const parsed = CleanupExportedCandidateInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return candidateServices.cleanupRemoteExportedCandidate(parsed);
      }
      return candidateServices.cleanupNodeExportedCandidate(parsed);
    }
    case "launch_tools": {
      const parsed = LaunchToolsInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return launchRemoteTools({
          target: parsed.target,
          addonName: parsed.addonName,
          launchMode: parsed.launchMode,
          taskName: parsed.taskName
        });
      }
      return launchTools(parsed);
    }
    case "launch_custom_game": {
      const parsed = LaunchCustomGameInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return launchRemoteCustomGame({
          target: parsed.target,
          addonName: parsed.addonName,
          mapName: parsed.mapName,
          launchMode: parsed.launchMode,
          taskName: parsed.taskName,
          runtimeMode: parsed.runtimeMode,
          consoleLog: parsed.consoleLog
        });
      }
      return launchCustomGame(parsed);
    }
    case "run_playable_smoke": {
      const parsed = RunPlayableSmokeInputSchema.parse(input);
      return runPlayableSmoke(parsed);
    }
    case "cleanup_playable_smoke": {
      const parsed = CleanupPlayableSmokeInputSchema.parse(input);
      return cleanupPlayableSmoke(parsed);
    }
    case "read_console_or_logs": {
      const parsed = ReadLogsInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return readRemoteConsoleOrLogs({
          target: parsed.target,
          addonName: parsed.addonName,
          logPaths: parsed.logPaths
        });
      }
      return readConsoleOrLogs(parsed);
    }
    case "validate_addon": {
      const parsed = ValidateAddonInputSchema.parse(input);
      if (parsed.target.kind === "remote") {
        return validateRemoteAddon({
          target: parsed.target,
          addonName: parsed.addonName,
          logPaths: parsed.logPaths,
          expectedMarker: parsed.expectedMarker,
          expectedMarkers: parsed.expectedMarkers
        });
      }
      return validateAddon(parsed);
    }
    case "remote_command": {
      const parsed = RemoteCommandInputSchema.parse(input);
      return runRemoteCommand(parsed);
    }
    default:
      return createFailureResult({
        target: { kind: "local" },
        operation: name,
        error: {
          code: "UNKNOWN_TOOL",
          message: `Unknown tool: ${name}`
        }
      });
  }
}

export function asToolContent(result: ToolResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2)
      }
    ],
    structuredContent: result,
    isError: !result.ok
  };
}

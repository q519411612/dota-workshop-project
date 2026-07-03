import { createAddon, inspectAddon } from "./addon.js";
import { cleanupPlayableSmoke } from "./cleanup.js";
import { discoverEnvironment, validateInstallRoot } from "./environment.js";
import { launchCustomGame, launchTools, readConsoleOrLogs, validateAddon } from "./launch.js";
import { createFailureResult } from "./result.js";
import { runPlayableSmoke } from "./smoke.js";
import {
  createRemoteAddon,
  discoverRemoteEnvironment,
  inspectRemoteAddon,
  launchRemoteCustomGame,
  launchRemoteTools,
  readRemoteConsoleOrLogs,
  runRemoteCommand,
  validateRemoteAddon
} from "./remote.js";
import {
  CreateAddonInputSchema,
  DiscoverEnvironmentInputSchema,
  InspectAddonInputSchema,
  LaunchCustomGameInputSchema,
  LaunchToolsInputSchema,
  ReadLogsInputSchema,
  RemoteCommandInputSchema,
  RunPlayableSmokeInputSchema,
  CleanupPlayableSmokeInputSchema,
  ValidateAddonInputSchema,
  ValidateTargetInputSchema
} from "./schemas.js";
import type { ToolResult } from "./types.js";

export const toolNames = [
  "discover_environment",
  "validate_target",
  "create_addon",
  "inspect_addon",
  "launch_tools",
  "launch_custom_game",
  "run_playable_smoke",
  "cleanup_playable_smoke",
  "read_console_or_logs",
  "validate_addon",
  "remote_command"
] as const;

export async function handleTool(name: string, input: unknown): Promise<ToolResult> {
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
          replace: parsed.replace
        });
      }
      return createAddon(parsed);
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

import { z } from "zod";

export const FixtureTargetSchema = z.object({
  kind: z.literal("fixture"),
  root: z.string().min(1)
});

export const LocalTargetSchema = z.object({
  kind: z.literal("local"),
  dotaRoot: z.string().min(1).optional()
});

export const RemoteTargetSchema = z.object({
  kind: z.literal("remote"),
  name: z.string().min(1),
  transport: z.enum(["ssh", "powershell"]),
  host: z.string().min(1),
  username: z.string().min(1).optional(),
  dotaRoot: z.string().min(1).optional()
});

export const TargetSchema = z.discriminatedUnion("kind", [
  FixtureTargetSchema,
  LocalTargetSchema,
  RemoteTargetSchema
]);

export const CreateAddonInputSchema = z.object({
  target: TargetSchema,
  addonName: z.string().min(1),
  mapName: z.string().min(1).optional(),
  template: z.enum(["minimal", "playable"]).optional(),
  replace: z.boolean().optional()
});

export const InspectAddonInputSchema = z.object({
  target: TargetSchema,
  addonName: z.string().min(1)
});

export const DiscoverEnvironmentInputSchema = z.object({
  target: TargetSchema,
  platform: z.enum(["aix", "android", "darwin", "freebsd", "haiku", "linux", "openbsd", "sunos", "win32", "cygwin", "netbsd"]).optional()
});

export const ValidateTargetInputSchema = z.object({
  target: TargetSchema,
  dotaRoot: z.string().min(1)
});

export const RemoteCommandInputSchema = z.object({
  target: RemoteTargetSchema,
  command: z.string().min(1)
});

export const LaunchToolsInputSchema = z.object({
  target: TargetSchema,
  addonName: z.string().min(1),
  dryRun: z.boolean().optional(),
  launchMode: z.enum(["process", "interactiveTask"]).optional(),
  taskName: z.string().min(1).optional()
});

export const LaunchCustomGameInputSchema = LaunchToolsInputSchema.extend({
  mapName: z.string().min(1),
  runtimeMode: z.enum(["tools", "game"]).optional(),
  consoleLog: z.boolean().optional()
});

export const ReadLogsInputSchema = z.object({
  target: TargetSchema,
  addonName: z.string().min(1),
  logPaths: z.array(z.string().min(1)).optional()
});

export const ValidateAddonInputSchema = ReadLogsInputSchema.extend({
  expectedMarker: z.string().min(1).optional(),
  expectedMarkers: z.array(z.string().min(1)).min(1).optional()
});

export const RunPlayableSmokeInputSchema = z.object({
  target: TargetSchema,
  addonName: z.string().min(1).optional(),
  addonPrefix: z.string().min(1).optional(),
  mapName: z.string().min(1).optional(),
  expectedMarkers: z.array(z.string().min(1)).min(1).optional(),
  replace: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  launchMode: z.enum(["process", "interactiveTask"]).optional(),
  taskName: z.string().min(1).optional(),
  logPaths: z.array(z.string().min(1)).optional(),
  validationTimeoutMs: z.number().int().min(0).optional(),
  validationPollIntervalMs: z.number().int().min(0).optional()
});

export type CreateAddonToolInput = z.infer<typeof CreateAddonInputSchema>;
export type InspectAddonToolInput = z.infer<typeof InspectAddonInputSchema>;
export type DiscoverEnvironmentToolInput = z.infer<typeof DiscoverEnvironmentInputSchema>;
export type ValidateTargetToolInput = z.infer<typeof ValidateTargetInputSchema>;
export type RemoteCommandToolInput = z.infer<typeof RemoteCommandInputSchema>;
export type LaunchToolsToolInput = z.infer<typeof LaunchToolsInputSchema>;
export type LaunchCustomGameToolInput = z.infer<typeof LaunchCustomGameInputSchema>;
export type ReadLogsToolInput = z.infer<typeof ReadLogsInputSchema>;
export type ValidateAddonToolInput = z.infer<typeof ValidateAddonInputSchema>;
export type RunPlayableSmokeToolInput = z.infer<typeof RunPlayableSmokeInputSchema>;

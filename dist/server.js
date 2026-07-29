import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CleanupExportedCandidateInputSchema, ExportReleaseCandidateInputSchema, PreflightReleaseCandidateInputSchema } from "./schemas.js";
import { asToolContent, handleTool } from "./tools.js";
const targetInput = {
    target: z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("fixture"),
            root: z.string().min(1)
        }),
        z.object({
            kind: z.literal("local"),
            dotaRoot: z.string().min(1).optional()
        }),
        z.object({
            kind: z.literal("remote"),
            name: z.string().min(1),
            transport: z.enum(["ssh", "powershell"]),
            host: z.string().min(1),
            username: z.string().min(1).optional(),
            dotaRoot: z.string().min(1).optional()
        })
    ])
};
const placementInput = z.object({
    unitName: z.string().min(1),
    team: z.enum(["goodguys", "badguys", "neutral"]),
    origin: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
    })
});
const objectiveInput = z.object({
    type: z.literal("score"),
    targetScore: z.number().int().min(1).max(99).optional(),
    tickIntervalSeconds: z.number().positive().max(60).optional()
});
const unitAbilityScaffoldInput = z.object({
    unitName: z.string().min(1),
    abilityName: z.string().min(1),
    abilityProof: z.boolean().optional()
});
export function createServer() {
    const server = new McpServer({
        name: "dota-workshop-tools",
        version: "0.1.0"
    });
    server.registerTool("discover_environment", {
        title: "Discover Dota Environment",
        description: "Discover or verify a Dota 2 Workshop Tools target environment.",
        inputSchema: {
            ...targetInput,
            platform: z.enum(["aix", "android", "darwin", "freebsd", "haiku", "linux", "openbsd", "sunos", "win32", "cygwin", "netbsd"]).optional()
        }
    }, async (input) => asToolContent(await handleTool("discover_environment", input)));
    server.registerTool("validate_target", {
        title: "Validate Dota Target",
        description: "Validate a Dota install root for required Workshop Tools files.",
        inputSchema: {
            ...targetInput,
            dotaRoot: z.string().min(1)
        }
    }, async (input) => asToolContent(await handleTool("validate_target", input)));
    server.registerTool("create_addon", {
        title: "Create Addon",
        description: "Generate a minimal or playable Dota 2 custom game addon template.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            mapName: z.string().min(1).optional(),
            template: z.enum(["minimal", "playable"]).optional(),
            placement: placementInput.optional(),
            objective: objectiveInput.optional(),
            unitAbilityScaffold: unitAbilityScaffoldInput.optional(),
            replace: z.boolean().optional()
        }
    }, async (input) => asToolContent(await handleTool("create_addon", input)));
    server.registerTool("inspect_addon", {
        title: "Inspect Addon",
        description: "Inspect game and content addon roots without modifying them.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1)
        }
    }, async (input) => asToolContent(await handleTool("inspect_addon", input)));
    server.registerTool("inspect_workshop_preflight", {
        title: "Inspect Workshop Preflight",
        description: "Inspect addon layout, Panorama boundaries, toolchain markers, and publishing blockers without generating or uploading content.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1)
        }
    }, async (input) => asToolContent(await handleTool("inspect_workshop_preflight", input)));
    server.registerTool("dry_run_release_report", {
        title: "Dry Run Release Report",
        description: "Inspect release package readiness, addon metadata, sensitive information blockers, and publishing boundaries without uploading or encrypting content.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1)
        }
    }, async (input) => asToolContent(await handleTool("dry_run_release_report", input)));
    server.registerTool("preflight_release_candidate", {
        title: "Preflight Release Candidate",
        description: "Assemble, validate, report, and remove one temporary evidence-only release candidate without uploading or retaining it.",
        inputSchema: PreflightReleaseCandidateInputSchema
    }, async (input) => asToolContent(await handleTool("preflight_release_candidate", input)));
    server.registerTool("export_release_candidate", {
        title: "Export Release Candidate",
        description: "Validate and retain one target-local release candidate at an explicit isolated destination with handoff and ownership evidence.",
        inputSchema: ExportReleaseCandidateInputSchema
    }, async (input) => asToolContent(await handleTool("export_release_candidate", input)));
    server.registerTool("cleanup_exported_candidate", {
        title: "Cleanup Exported Candidate",
        description: "Dry-run or remove one exactly matched exported candidate and handoff manifest after ownership and digest verification.",
        inputSchema: CleanupExportedCandidateInputSchema
    }, async (input) => asToolContent(await handleTool("cleanup_exported_candidate", input)));
    server.registerTool("prepare_custom_map", {
        title: "Prepare Custom Map",
        description: "Copy an installed Workshop template map, verify spawn entity markers, and compile it with resourcecompiler.exe.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            mapName: z.string().min(1),
            templateAddonName: z.string().min(1).optional(),
            templateMapName: z.string().min(1).optional(),
            replace: z.boolean().optional()
        }
    }, async (input) => asToolContent(await handleTool("prepare_custom_map", input)));
    server.registerTool("remote_command", {
        title: "Run Remote Windows Command",
        description: "Run a command through the configured remote Windows transport and return command evidence.",
        inputSchema: {
            target: z.object({
                kind: z.literal("remote"),
                name: z.string().min(1),
                transport: z.enum(["ssh", "powershell"]),
                host: z.string().min(1),
                username: z.string().min(1).optional(),
                dotaRoot: z.string().min(1).optional()
            }),
            command: z.string().min(1)
        }
    }, async (input) => asToolContent(await handleTool("remote_command", input)));
    server.registerTool("launch_tools", {
        title: "Launch Workshop Tools",
        description: "Launch Dota 2 Workshop Tools for an addon on a local or remote Windows target.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            dryRun: z.boolean().optional(),
            launchMode: z.enum(["process", "interactiveTask"]).optional(),
            taskName: z.string().min(1).optional()
        }
    }, async (input) => asToolContent(await handleTool("launch_tools", input)));
    server.registerTool("launch_custom_game", {
        title: "Launch Custom Game",
        description: "Launch a Dota 2 custom game addon and map candidate.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            mapName: z.string().min(1),
            dryRun: z.boolean().optional(),
            launchMode: z.enum(["process", "interactiveTask"]).optional(),
            taskName: z.string().min(1).optional(),
            runtimeMode: z.enum(["tools", "game"]).optional(),
            consoleLog: z.boolean().optional()
        }
    }, async (input) => asToolContent(await handleTool("launch_custom_game", input)));
    server.registerTool("run_playable_smoke", {
        title: "Run Playable Smoke",
        description: "Create, launch, and validate a minimal playable addon through runtime gameplay markers.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1).optional(),
            addonPrefix: z.string().min(1).optional(),
            mapName: z.string().min(1).optional(),
            customMap: z.object({
                mapName: z.string().min(1),
                templateAddonName: z.string().min(1).optional(),
                templateMapName: z.string().min(1).optional(),
                replace: z.boolean().optional()
            }).optional(),
            placement: placementInput.optional(),
            objective: objectiveInput.optional(),
            unitAbilityScaffold: unitAbilityScaffoldInput.optional(),
            expectedMarkers: z.array(z.string().min(1)).min(1).optional(),
            replace: z.boolean().optional(),
            dryRun: z.boolean().optional(),
            launchMode: z.enum(["process", "interactiveTask"]).optional(),
            taskName: z.string().min(1).optional(),
            logPaths: z.array(z.string().min(1)).optional(),
            validationTimeoutMs: z.number().int().min(0).optional(),
            validationPollIntervalMs: z.number().int().min(0).optional()
        }
    }, async (input) => asToolContent(await handleTool("run_playable_smoke", input)));
    server.registerTool("cleanup_playable_smoke", {
        title: "Cleanup Playable Smoke",
        description: "Explicitly inspect or stop known Dota smoke processes whose command line matches the requested addon.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            dryRun: z.boolean().optional()
        }
    }, async (input) => asToolContent(await handleTool("cleanup_playable_smoke", input)));
    server.registerTool("read_console_or_logs", {
        title: "Read Workshop Logs",
        description: "Read Workshop Tools log or console files for validation evidence.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            logPaths: z.array(z.string().min(1)).min(1).optional()
        }
    }, async (input) => asToolContent(await handleTool("read_console_or_logs", input)));
    server.registerTool("validate_addon", {
        title: "Validate Addon",
        description: "Validate an addon only when expected log or console evidence is present.",
        inputSchema: {
            ...targetInput,
            addonName: z.string().min(1),
            logPaths: z.array(z.string().min(1)).min(1).optional(),
            expectedMarker: z.string().min(1).optional(),
            expectedMarkers: z.array(z.string().min(1)).min(1).optional()
        }
    }, async (input) => asToolContent(await handleTool("validate_addon", input)));
    return server;
}

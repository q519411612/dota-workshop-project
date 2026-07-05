import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
            placement: placementInput.optional(),
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

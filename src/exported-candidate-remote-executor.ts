import { execFile } from "node:child_process";
import {
  buildRemoteCleanupExportedCandidateScript,
  buildRemoteExportedCandidateScript
} from "./exported-candidate-remote-script.js";
import type { CleanupExportedCandidateToolInput, ExportReleaseCandidateToolInput } from "./schemas.js";
import type { RemoteTarget } from "./types.js";

export type RemoteExportInvocation = Readonly<{
  transport: "ssh" | "powershell";
  executable: string;
  args: readonly string[];
  script: string;
  stdin?: string;
}>;

export type RemoteExportProcessOutput = Readonly<{ exitCode: number; stdout: string; stderr: string }>;
export type RemoteExportExecutor = (invocation: RemoteExportInvocation) => Promise<RemoteExportProcessOutput>;

export type RemoteExportOutcome =
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "completed"; stdout: string }>
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "failed"; exitCode: number }>
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "uncertain" }>
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "configuration-failed"; code: string }>;

export async function executeRemoteExport(
  input: ExportReleaseCandidateToolInput & Readonly<{ executor?: RemoteExportExecutor }>
): Promise<RemoteExportOutcome> {
  if (input.target.kind !== "remote") return { transport: "ssh", outcome: "configuration-failed", code: "REMOTE_TARGET_REQUIRED" };
  const target = input.target;
  if (!target.dotaRoot) return { transport: target.transport, outcome: "configuration-failed", code: "REMOTE_DOTA_ROOT_REQUIRED" };
  return await executeBuiltScript(target, () => buildRemoteExportedCandidateScript({
    transport: target.transport,
    dotaRoot: target.dotaRoot!,
    addonName: input.addonName,
    exportRoot: input.exportRoot,
    destination: input.destination
  }), input.executor);
}

export async function executeRemoteExportCleanup(
  input: CleanupExportedCandidateToolInput & Readonly<{ executor?: RemoteExportExecutor }>
): Promise<RemoteExportOutcome> {
  if (input.target.kind !== "remote") return { transport: "ssh", outcome: "configuration-failed", code: "REMOTE_TARGET_REQUIRED" };
  return await executeBuiltScript(input.target, () => buildRemoteCleanupExportedCandidateScript({
    exportRoot: input.exportRoot,
    destination: input.destination,
    ownershipId: input.ownershipId,
    manifestVersion: input.manifestVersion,
    combinedSha256: input.combinedSha256,
    dryRun: input.dryRun !== false
  }), input.executor);
}

async function executeBuiltScript(
  target: RemoteTarget,
  build: () => string,
  executor: RemoteExportExecutor | undefined
): Promise<RemoteExportOutcome> {
  const transport = target.transport;
  if (!safeDestination(target.host) || (target.username !== undefined && !safeDestination(target.username))) {
    return { transport, outcome: "configuration-failed", code: "REMOTE_DESTINATION_INVALID" };
  }
  let script: string;
  try { script = build(); } catch (error) {
    return { transport, outcome: "configuration-failed", code: safeErrorCode(error) ?? "REMOTE_EXPORT_CONFIGURATION_INVALID" };
  }
  try {
    const output = await (executor ?? executeInvocation)(buildInvocation(target, script));
    if (output.exitCode !== 0 || output.stderr.trim().length > 0) return { transport, outcome: "failed", exitCode: output.exitCode };
    return { transport, outcome: "completed", stdout: output.stdout };
  } catch (error) {
    const exitCode = numericExitCode(error);
    return exitCode === undefined ? { transport, outcome: "uncertain" } : { transport, outcome: "failed", exitCode };
  }
}

function buildInvocation(target: RemoteTarget, script: string): RemoteExportInvocation {
  if (target.transport === "ssh") {
    const destination = target.username ? `${target.username}@${target.host}` : target.host;
    return Object.freeze({
      transport: "ssh",
      executable: "ssh",
      args: Object.freeze([destination, "powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "-"]),
      script,
      stdin: script
    });
  }
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const command = `$encoded = '${encoded}'; $source = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($encoded)); Invoke-Command -ComputerName '${target.host.replaceAll("'", "''")}' -ScriptBlock ([ScriptBlock]::Create($source))`;
  return Object.freeze({
    transport: "powershell",
    executable: "powershell.exe",
    args: Object.freeze(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]),
    script
  });
}

async function executeInvocation(invocation: RemoteExportInvocation): Promise<RemoteExportProcessOutput> {
  let child!: ReturnType<typeof execFile>;
  const processCompletion = new Promise<RemoteExportProcessOutput>((resolve, reject) => {
    child = execFile(invocation.executable, [...invocation.args], {
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8"
    }, (error, stdout, stderr) => error ? reject(error) : resolve({ exitCode: 0, stdout, stderr }));
  });
  const stdinCompletion = new Promise<void>((resolve, reject) => {
    if (invocation.stdin === undefined) { resolve(); return; }
    if (!child.stdin) { reject(new Error("REMOTE_STDIN_UNAVAILABLE")); return; }
    child.stdin.once("error", reject);
    child.stdin.end(invocation.stdin, "utf8", resolve);
  });
  const [output] = await Promise.all([processCompletion, stdinCompletion]);
  return output;
}

function safeDestination(value: string): boolean {
  return value.length > 0 && value.length <= 255 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function numericExitCode(error: unknown): number | undefined {
  if (error === null || typeof error !== "object") return undefined;
  try { const code = Reflect.get(error, "code"); return Number.isSafeInteger(code) ? code as number : undefined; } catch { return undefined; }
}

function safeErrorCode(error: unknown): string | undefined {
  return error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message) ? error.message : undefined;
}

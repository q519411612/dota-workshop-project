import { execFile } from "node:child_process";
import { buildRemoteReleaseCandidateScript } from "./release-candidate-remote-script.js";
import type { RemoteTarget } from "./types.js";

export type RemoteReleaseCandidateInvocation = Readonly<{
  transport: "ssh" | "powershell";
  executable: string;
  args: readonly string[];
  script: string;
  stdin?: string;
}>;

export type RemoteReleaseCandidateProcessOutput = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

export type RemoteReleaseCandidateRawOutcome =
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "completed"; exitCode: 0; stdout: string }>
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "failed"; exitCode: number }>
  | Readonly<{ transport: "ssh" | "powershell"; outcome: "uncertain" }>
  | Readonly<{
      transport: "ssh" | "powershell";
      outcome: "configuration-failed";
      code: "REMOTE_DOTA_ROOT_REQUIRED" | "REMOTE_DOTA_ROOT_INVALID" | "REMOTE_DESTINATION_INVALID" | "INVALID_ADDON_NAME";
    }>;

export type ExecuteRemoteReleaseCandidateScriptInput = Readonly<{
  target: RemoteTarget;
  addonName: string;
  executor?: (invocation: RemoteReleaseCandidateInvocation) => Promise<RemoteReleaseCandidateProcessOutput>;
}>;

export async function executeRemoteReleaseCandidateScript(
  input: ExecuteRemoteReleaseCandidateScriptInput
): Promise<RemoteReleaseCandidateRawOutcome> {
  const transport = input.target.transport;
  if (!input.target.dotaRoot) {
    return { transport, outcome: "configuration-failed", code: "REMOTE_DOTA_ROOT_REQUIRED" };
  }
  if (!isSafeDestinationPart(input.target.host) || (input.target.username !== undefined && !isSafeDestinationPart(input.target.username))) {
    return { transport, outcome: "configuration-failed", code: "REMOTE_DESTINATION_INVALID" };
  }

  let script: string;
  try {
    script = buildRemoteReleaseCandidateScript({ dotaRoot: input.target.dotaRoot, addonName: input.addonName });
  } catch (error) {
    const code = error instanceof Error && error.message === "INVALID_ADDON_NAME"
      ? "INVALID_ADDON_NAME"
      : "REMOTE_DOTA_ROOT_INVALID";
    return { transport, outcome: "configuration-failed", code };
  }

  const invocation = buildInvocation(input.target, script);
  try {
    const output = await (input.executor ?? executeRemoteReleaseCandidateInvocation)(invocation);
    if (output.exitCode !== 0 || output.stderr.trim().length > 0) {
      return { transport, outcome: "failed", exitCode: output.exitCode };
    }
    return { transport, outcome: "completed", exitCode: 0, stdout: output.stdout };
  } catch (error) {
    const exitCode = readExitCode(error);
    if (exitCode !== undefined) return { transport, outcome: "failed", exitCode };
    return { transport, outcome: "uncertain" };
  }
}

function buildInvocation(target: RemoteTarget, script: string): RemoteReleaseCandidateInvocation {
  if (target.transport === "ssh") {
    const destination = target.username ? `${target.username}@${target.host}` : target.host;
    return Object.freeze({
      transport: "ssh",
      executable: "ssh",
      args: Object.freeze([
        destination,
        "powershell.exe",
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "-"
      ]),
      script,
      stdin: script
    });
  }

  const encodedScript = Buffer.from(script, "utf16le").toString("base64");
  const command = [
    `$encoded = '${encodedScript}'`,
    "$source = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($encoded))",
    `Invoke-Command -ComputerName '${target.host.replace(/'/g, "''")}' -ScriptBlock ([ScriptBlock]::Create($source))`
  ].join("; ");
  return Object.freeze({
    transport: "powershell",
    executable: "powershell.exe",
    args: Object.freeze(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]),
    script
  });
}

export async function executeRemoteReleaseCandidateInvocation(
  invocation: RemoteReleaseCandidateInvocation
): Promise<RemoteReleaseCandidateProcessOutput> {
  let child!: ReturnType<typeof execFile>;
  const processCompletion = new Promise<RemoteReleaseCandidateProcessOutput>((resolve, reject) => {
    child = execFile(invocation.executable, [...invocation.args], {
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      encoding: "utf8"
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ exitCode: 0, stdout, stderr });
    });
  });
  const stdinCompletion = new Promise<void>((resolve, reject) => {
    if (!child.stdin) {
      reject(new Error("REMOTE_STDIN_UNAVAILABLE"));
      return;
    }
    child.stdin.once("error", reject);
    child.stdin.end(invocation.stdin ?? "", "utf8", resolve);
  });
  const [output] = await Promise.all([processCompletion, stdinCompletion]);
  return output;
}

function isSafeDestinationPart(value: string): boolean {
  return value.length > 0 && value.length <= 255 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function readExitCode(error: unknown): number | undefined {
  if (error === null || typeof error !== "object") return undefined;
  try {
    const code = Reflect.get(error, "code");
    return Number.isSafeInteger(code) ? code as number : undefined;
  } catch {
    return undefined;
  }
}

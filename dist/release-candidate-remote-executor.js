import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildRemoteReleaseCandidateScript } from "./release-candidate-remote-script.js";
const execFileAsync = promisify(execFile);
export async function executeRemoteReleaseCandidateScript(input) {
    const transport = input.target.transport;
    if (!input.target.dotaRoot) {
        return { transport, outcome: "configuration-failed", code: "REMOTE_DOTA_ROOT_REQUIRED" };
    }
    if (!isSafeDestinationPart(input.target.host) || (input.target.username !== undefined && !isSafeDestinationPart(input.target.username))) {
        return { transport, outcome: "configuration-failed", code: "REMOTE_DESTINATION_INVALID" };
    }
    let script;
    try {
        script = buildRemoteReleaseCandidateScript({ dotaRoot: input.target.dotaRoot, addonName: input.addonName });
    }
    catch (error) {
        const code = error instanceof Error && error.message === "INVALID_ADDON_NAME"
            ? "INVALID_ADDON_NAME"
            : "REMOTE_DOTA_ROOT_INVALID";
        return { transport, outcome: "configuration-failed", code };
    }
    const invocation = buildInvocation(input.target, script);
    try {
        const output = await (input.executor ?? executeInvocation)(invocation);
        if (output.exitCode !== 0 || output.stderr.trim().length > 0) {
            return { transport, outcome: "failed", exitCode: output.exitCode };
        }
        return { transport, outcome: "completed", exitCode: 0, stdout: output.stdout };
    }
    catch (error) {
        const exitCode = readExitCode(error);
        if (exitCode !== undefined)
            return { transport, outcome: "failed", exitCode };
        return { transport, outcome: "uncertain" };
    }
}
function buildInvocation(target, script) {
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
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
                "-EncodedCommand",
                encodedScript
            ]),
            script
        });
    }
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
async function executeInvocation(invocation) {
    const { stdout, stderr } = await execFileAsync(invocation.executable, [...invocation.args], {
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024
    });
    return { exitCode: 0, stdout, stderr };
}
function isSafeDestinationPart(value) {
    return value.length > 0 && value.length <= 255 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}
function readExitCode(error) {
    if (error === null || typeof error !== "object")
        return undefined;
    try {
        const code = Reflect.get(error, "code");
        return Number.isSafeInteger(code) ? code : undefined;
    }
    catch {
        return undefined;
    }
}

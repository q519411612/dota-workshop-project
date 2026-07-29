import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const POSIX_NO_REPLACE_SOURCE = String.raw`#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#if defined(__APPLE__)
#include <sys/stdio.h>
#elif defined(__linux__)
#include <fcntl.h>
#include <linux/fs.h>
#include <sys/syscall.h>
#include <unistd.h>
#endif

int main(int argc, char **argv) {
  if (argc != 3) return 64;
#if defined(__APPLE__)
  if (renamex_np(argv[1], argv[2], RENAME_EXCL) == 0) return 0;
#elif defined(__linux__)
  if (syscall(SYS_renameat2, AT_FDCWD, argv[1], AT_FDCWD, argv[2], RENAME_NOREPLACE) == 0) return 0;
#else
  return 78;
#endif
  if (errno == EEXIST || errno == ENOTEMPTY) return 17;
  return errno == 0 ? 1 : errno;
}
`;

export async function atomicMoveNoReplace(
  source: string,
  destination: string,
  platform: NodeJS.Platform = process.platform
): Promise<void> {
  if (platform === "win32") {
    await executeWindowsNoReplace(source, destination);
    return;
  }
  if (platform !== "darwin" && platform !== "linux") {
    throw new Error("ATOMIC_NO_REPLACE_UNAVAILABLE");
  }
  const root = await mkdtemp(join(tmpdir(), "dota-atomic-move-"));
  const sourcePath = join(root, "move.c");
  const executable = join(root, "move");
  try {
    await writeFile(sourcePath, POSIX_NO_REPLACE_SOURCE, { encoding: "utf8", flag: "wx" });
    const compilation = await execute("/usr/bin/cc", [sourcePath, "-o", executable]);
    if (compilation.exitCode !== 0 || compilation.stderr.length !== 0) {
      throw new Error("ATOMIC_NO_REPLACE_UNAVAILABLE");
    }
    const movement = await execute(executable, [source, destination]);
    if (movement.exitCode === 17) throw new Error("ATOMIC_NO_REPLACE_DESTINATION_EXISTS");
    if (movement.exitCode !== 0 || movement.stderr.length !== 0) throw new Error("ATOMIC_NO_REPLACE_FAILED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function executeWindowsNoReplace(source: string, destination: string): Promise<void> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -TypeDefinition @'",
    "using System; using System.ComponentModel; using System.Runtime.InteropServices;",
    "public static class DotaAtomicMove {",
    "  [DllImport(\"kernel32.dll\", CharSet = CharSet.Unicode, SetLastError = true)]",
    "  private static extern bool MoveFileExW(string existingName, string newName, uint flags);",
    "  public static void NoReplace(string source, string destination) { if (!MoveFileExW(source, destination, 0)) throw new Win32Exception(Marshal.GetLastWin32Error()); }",
    "}",
    "'@",
    `[DotaAtomicMove]::NoReplace(${encodedPowerShell(source)}, ${encodedPowerShell(destination)})`
  ].join("\n");
  const result = await execute("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64")
  ]);
  if (result.exitCode !== 0 || result.stderr.length !== 0) throw new Error("ATOMIC_NO_REPLACE_FAILED");
}

function encodedPowerShell(value: string): string {
  return `[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${Buffer.from(value, "utf16le").toString("base64")}'))`;
}

async function execute(command: string, args: readonly string[]): Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>> {
  return await new Promise((resolve) => {
    execFile(command, [...args], { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 }, (error, stdout, stderr) => {
      resolve({
        exitCode: error === null ? 0 : typeof error.code === "number" ? error.code : -1,
        stdout,
        stderr
      });
    });
  });
}

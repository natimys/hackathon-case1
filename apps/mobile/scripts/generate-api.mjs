import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(mobileDir, "..", "..");
const localPython = process.platform === "win32"
  ? resolve(repoRoot, ".venv", "Scripts", "python.exe")
  : resolve(repoRoot, ".venv", "bin", "python");
const python = process.env.PYTHON ?? (existsSync(localPython) ? localPython : process.platform === "win32" ? "python" : "python3");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" && command.endsWith(".cmd") });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(python, [resolve(mobileDir, "scripts", "export-openapi.py")], repoRoot);
run(process.execPath, [
  resolve(mobileDir, "node_modules", "openapi-typescript", "bin", "cli.js"),
  "openapi.json",
  "-o",
  "src/shared/api/schema.d.ts",
], mobileDir);

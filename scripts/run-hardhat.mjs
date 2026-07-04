import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const [major, minor] = process.versions.node.split(".").map(Number);
const needsShim = major === 22 && minor < 13;
const hardhatCli = "node_modules/hardhat/dist/src/cli.js";

const command = needsShim ? "npx" : process.execPath;
const commandArgs = needsShim
  ? ["-y", "node@22.13.1", hardhatCli, ...args]
  : [hardhatCli, ...args];

const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);

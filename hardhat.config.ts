import { execFileSync } from "node:child_process";
import path from "node:path";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "hardhat/config";

loadEnv();

function expandHome(value: string) {
  if (value === "~") return process.env.USERPROFILE || process.env.HOME || value;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(process.env.USERPROFILE || process.env.HOME || "", value.slice(2));
  }
  return value;
}

function loadTransactionPrivateKey(): `0x${string}` | undefined {
  const keystoreFile = process.env.MONSKILLS_KEYSTORE_FILE;
  if (keystoreFile) {
    const keystoreDir = expandHome(process.env.MONSKILLS_KEYSTORE_DIR || "~/.monskills/keystore");
    const output = execFileSync("cast", [
      "wallet",
      "decrypt-keystore",
      "--keystore-dir",
      keystoreDir,
      keystoreFile,
      "--unsafe-password",
      ""
    ], { encoding: "utf8" });
    const match = output.match(/0x[0-9a-fA-F]{64}/);
    if (!match) throw new Error("cast did not return a private key");
    return match[0] as `0x${string}`;
  }
  return process.env.PRIVATE_KEY as `0x${string}` | undefined;
}

const privateKey = loadTransactionPrivateKey();

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1"
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545"
    },
    monadTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      accounts: privateKey ? [privateKey] : []
    }
  }
});

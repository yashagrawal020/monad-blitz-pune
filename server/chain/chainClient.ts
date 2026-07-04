import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { FinalDecision, Proposal, VoteValue } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";

const treasuryDecisionRegistryAbi = [
  {
    type: "function",
    name: "recordDecision",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "decision",
        type: "tuple",
        components: [
          { name: "proposalId", type: "uint256" },
          { name: "proposer", type: "address" },
          { name: "researchAgentId", type: "uint256" },
          { name: "skepticAgentId", type: "uint256" },
          { name: "councilAgentId", type: "uint256" },
          { name: "proposalHash", type: "bytes32" },
          { name: "researchReportHash", type: "bytes32" },
          { name: "skepticReportHash", type: "bytes32" },
          { name: "finalDecisionHash", type: "bytes32" },
          { name: "researchVote", type: "uint8" },
          { name: "skepticVote", type: "uint8" },
          { name: "councilVote", type: "uint8" },
          { name: "decisionURI", type: "string" },
          { name: "createdAt", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "decisionId", type: "uint256" }]
  }
] as const;

export type RecordDecisionInput = {
  proposal: Proposal;
  finalDecision: FinalDecision;
  researchReportHash: `0x${string}`;
  skepticReportHash: `0x${string}`;
  researchVote: VoteValue;
  skepticVote: VoteValue;
};

export type ChainRecordReceipt = {
  mode: "monad" | "mock";
  txHash: `0x${string}`;
  decisionId: string;
  explorerUrl?: string;
  registryAddress?: `0x${string}`;
  gasLimit?: string;
};

const monadTestnet = defineChain({
  id: Number(process.env.MONAD_CHAIN_ID || 10143),
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"] }
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" }
  }
});

export async function recordDecisionOnChain(input: RecordDecisionInput): Promise<ChainRecordReceipt> {
  const deployment = loadDeployment();
  const privateKey = loadTransactionPrivateKey();
  const registryAddress = (process.env.TREASURY_DECISION_REGISTRY_ADDRESS || deployment?.treasuryDecisionRegistry) as `0x${string}` | undefined;

  if (!privateKey || !registryAddress) {
    const txHash = hashPayload({ mock: "decision.recorded_on_chain", input, at: Date.now() });
    return { mode: "mock", txHash, decisionId: proposalNumericId(input.proposal).toString() };
  }

  const account = privateKeyToAccount(privateKey);
  const transport = http(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz");
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport });
  const publicClient = createPublicClient({ chain: monadTestnet, transport });
  const proposalId = proposalNumericId(input.proposal);

  const contractArgs = [
    {
      proposalId,
      proposer: account.address,
      researchAgentId: 1n,
      skepticAgentId: 2n,
      councilAgentId: 3n,
      proposalHash: input.proposal.proposalHash,
      researchReportHash: input.researchReportHash,
      skepticReportHash: input.skepticReportHash,
      finalDecisionHash: input.finalDecision.finalDecisionHash,
      researchVote: input.researchVote,
      skepticVote: input.skepticVote,
      councilVote: input.finalDecision.vote ?? VOTE.abstain,
      decisionURI: `local://proposal/${input.proposal.id}`,
      createdAt: BigInt(Math.floor(Date.now() / 1000))
    }
  ] as const;

  const estimatedGas = await publicClient.estimateContractGas({
    account,
    address: registryAddress,
    abi: treasuryDecisionRegistryAbi,
    functionName: "recordDecision",
    args: contractArgs
  });
  const gas = estimatedGas + estimatedGas / 10n;

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: treasuryDecisionRegistryAbi,
    functionName: "recordDecision",
    args: contractArgs,
    gas
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return {
    mode: "monad",
    txHash,
    decisionId: proposalId.toString(),
    explorerUrl: `https://testnet.monadvision.com/tx/${txHash}`,
    registryAddress,
    gasLimit: gas.toString()
  };
}

function loadTransactionPrivateKey(): `0x${string}` | undefined {
  const keystoreFile = process.env.MONSKILLS_KEYSTORE_FILE;
  if (keystoreFile) {
    const keystoreDir = expandHome(process.env.MONSKILLS_KEYSTORE_DIR || "~/.monskills/keystore");
    try {
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
    } catch (error) {
      throw new Error(`Failed to decrypt MONSKILLS keystore ${keystoreFile}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return process.env.PRIVATE_KEY as `0x${string}` | undefined;
}

function expandHome(value: string) {
  if (value === "~") return process.env.USERPROFILE || process.env.HOME || value;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(process.env.USERPROFILE || process.env.HOME || "", value.slice(2));
  }
  return value;
}

function proposalNumericId(proposal: Proposal) {
  return BigInt(`0x${proposal.proposalHash.slice(2, 18)}`);
}

function loadDeployment(): { agentRegistry?: string; treasuryDecisionRegistry?: string } | undefined {
  const deploymentPath = path.resolve(process.cwd(), ".tmp", "deployment.json");
  if (!fs.existsSync(deploymentPath)) return undefined;
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

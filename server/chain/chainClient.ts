import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainRecordReceipt, FinalDecision, Proposal, VoteValue } from "../../shared/types";
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
    outputs: [{ name: "recordedProposalId", type: "uint256" }]
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

type Account = ReturnType<typeof privateKeyToAccount>;

type RecordDecisionOptions = {
  account?: Account;
  gasLimit?: bigint;
  estimateGas?: boolean;
  registryAddress?: `0x${string}`;
  mockSenderAddress?: `0x${string}`;
};

let cachedParallelAccounts: Account[] | undefined;

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

export async function recordDecisionOnChain(input: RecordDecisionInput, options: RecordDecisionOptions = {}): Promise<ChainRecordReceipt> {
  const deployment = loadDeployment();
  const privateKey = options.account ? undefined : loadTransactionPrivateKey();
  const registryAddress = options.registryAddress ?? (process.env.TREASURY_DECISION_REGISTRY_ADDRESS || deployment?.treasuryDecisionRegistry) as `0x${string}` | undefined;
  const account = options.account ?? (privateKey ? privateKeyToAccount(privateKey) : undefined);

  if (!account || !registryAddress) {
    return mockReceipt(input, options.mockSenderAddress);
  }

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

  const gas = options.gasLimit ?? await estimateRecordDecisionGas(publicClient, account, registryAddress, contractArgs);
  const started = Date.now();
  const submittedAt = new Date(started).toISOString();

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: treasuryDecisionRegistryAbi,
    functionName: "recordDecision",
    args: contractArgs,
    gas
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`recordDecision transaction reverted: ${txHash}`);
  }
  const finished = Date.now();
  return {
    mode: "monad",
    txHash,
    decisionId: proposalId.toString(),
    proposalId: proposalId.toString(),
    submittedAt,
    confirmedAt: new Date(finished).toISOString(),
    elapsedMs: finished - started,
    senderAddress: account.address,
    explorerUrl: `https://testnet.monadvision.com/tx/${txHash}`,
    registryAddress,
    gasLimit: gas.toString()
  };
}

export async function recordDecisionsInParallelOnChain(inputs: RecordDecisionInput[]): Promise<ChainRecordReceipt[]> {
  const deployment = loadDeployment();
  const registryAddress = (process.env.TREASURY_DECISION_REGISTRY_ADDRESS || deployment?.treasuryDecisionRegistry) as `0x${string}` | undefined;
  const accounts = loadParallelAccounts();

  if (!registryAddress || accounts.length < inputs.length) {
    return Promise.all(inputs.map((input, index) => Promise.resolve(mockReceipt(input, accounts[index]?.address))));
  }

  const gasLimit = BigInt(process.env.PARALLEL_RECORD_DECISION_GAS_LIMIT || "650000");
  return Promise.all(inputs.map((input, index) => recordDecisionOnChain(input, {
    account: accounts[index],
    estimateGas: false,
    gasLimit,
    registryAddress
  })));
}

async function estimateRecordDecisionGas(
  publicClient: ReturnType<typeof createPublicClient>,
  account: Account,
  registryAddress: `0x${string}`,
  contractArgs: readonly [{
    readonly proposalId: bigint;
    readonly proposer: `0x${string}`;
    readonly researchAgentId: bigint;
    readonly skepticAgentId: bigint;
    readonly councilAgentId: bigint;
    readonly proposalHash: `0x${string}`;
    readonly researchReportHash: `0x${string}`;
    readonly skepticReportHash: `0x${string}`;
    readonly finalDecisionHash: `0x${string}`;
    readonly researchVote: VoteValue;
    readonly skepticVote: VoteValue;
    readonly councilVote: VoteValue;
    readonly decisionURI: string;
    readonly createdAt: bigint;
  }]
) {
  const estimatedGas = await publicClient.estimateContractGas({
    account,
    address: registryAddress,
    abi: treasuryDecisionRegistryAbi,
    functionName: "recordDecision",
    args: contractArgs
  });
  return estimatedGas + estimatedGas / 10n;
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

function loadParallelAccounts() {
  if (cachedParallelAccounts) return cachedParallelAccounts;
  const privateKeys = (process.env.PARALLEL_PRIVATE_KEYS || "")
    .split(",")
    .map((privateKey) => privateKey.trim())
    .filter(Boolean);
  if (privateKeys.length) {
    cachedParallelAccounts = privateKeys.map((privateKey) => privateKeyToAccount(privateKey as `0x${string}`));
    return cachedParallelAccounts;
  }
  const files = (process.env.PARALLEL_MONSKILLS_KEYSTORE_FILES || "")
    .split(",")
    .map((file) => file.trim())
    .filter(Boolean);
  cachedParallelAccounts = files.map((file) => privateKeyToAccount(decryptKeystoreFile(file)));
  return cachedParallelAccounts;
}

function decryptKeystoreFile(keystoreFile: string): `0x${string}` {
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

function mockReceipt(input: RecordDecisionInput, senderAddress?: `0x${string}`): ChainRecordReceipt {
  const started = Date.now();
  const proposalId = proposalNumericId(input.proposal).toString();
  const txHash = hashPayload({ mock: "decision.recorded_on_chain", proposalId, at: started, finalDecisionHash: input.finalDecision.finalDecisionHash });
  return {
    mode: "mock",
    txHash,
    decisionId: proposalId,
    proposalId,
    submittedAt: new Date(started).toISOString(),
    confirmedAt: new Date(Date.now()).toISOString(),
    elapsedMs: Date.now() - started,
    senderAddress
  };
}

function loadDeployment(): { agentRegistry?: string; treasuryDecisionRegistry?: string } | undefined {
  const deploymentPath = path.resolve(process.cwd(), ".tmp", "deployment.json");
  if (!fs.existsSync(deploymentPath)) return undefined;
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

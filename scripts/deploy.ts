import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

const agents = [
  { name: "ResearchAgent", role: "research", capabilities: ["yield-analysis", "market-comparison"] },
  { name: "SkepticAgent", role: "risk", capabilities: ["risk-analysis", "adversarial-review"] },
  { name: "CouncilAgent", role: "council", capabilities: ["aggregation", "policy-evaluation"] }
];

const connection = await network.connect();
const { viem } = connection;

const agentRegistry = await viem.deployContract("AgentRegistry");
const treasuryDecisionRegistry = await viem.deployContract("TreasuryDecisionRegistry");

for (const agent of agents) {
  const capabilitiesHash = keccak256(toBytes(JSON.stringify(agent.capabilities)));
  const contextPolicyHash = keccak256(toBytes(JSON.stringify({ shares: ["summary", "score", "hash"], private: ["scratchpad", "raw_tools"] })));
  await agentRegistry.write.registerAgent([
    agent.name,
    agent.role,
    `local://agents/${agent.name}`,
    capabilitiesHash,
    contextPolicyHash
  ]);
}

const deployment = {
  network: process.env.HARDHAT_NETWORK || "hardhat",
  agentRegistry: agentRegistry.address,
  treasuryDecisionRegistry: treasuryDecisionRegistry.address,
  agents: agents.map((agent, index) => ({ id: index + 1, ...agent })),
  deployedAt: new Date().toISOString()
};

const outPath = path.resolve(process.cwd(), ".tmp", "deployment.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
console.log(JSON.stringify(deployment, null, 2));


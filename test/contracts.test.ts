import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, toBytes, zeroAddress } from "viem";

describe("Treasury council contracts", async () => {
  const connection = await network.connect();
  const { viem } = connection;

  it("registers and updates an agent", async () => {
    const registry = await viem.deployContract("AgentRegistry");
    const capabilitiesHash = keccak256(toBytes("research"));
    const contextPolicyHash = keccak256(toBytes("summary-only"));
    await registry.write.registerAgent(["ResearchAgent", "research", "local://agent", capabilitiesHash, contextPolicyHash]);
    const agent = await registry.read.getAgent([1n]);
    assert.equal(agent.name, "ResearchAgent");
    assert.equal(agent.role, "research");
    assert.notEqual(agent.owner, zeroAddress);
  });

  it("records decisions by proposal id and rejects duplicates", async () => {
    const decisions = await viem.deployContract("TreasuryDecisionRegistry");
    const hash = keccak256(toBytes("decision"));
    await decisions.write.recordDecision([{
      proposalId: 101n,
      proposer: zeroAddress,
      researchAgentId: 1n,
      skepticAgentId: 2n,
      councilAgentId: 3n,
      proposalHash: hash,
      researchReportHash: hash,
      skepticReportHash: hash,
      finalDecisionHash: hash,
      researchVote: 3,
      skepticVote: 2,
      councilVote: 3,
      decisionURI: "local://decision/1",
      createdAt: 1n
    }]);
    const stored = await decisions.read.getDecisionByProposal([101n]);
    assert.equal(stored.proposalId, 101n);
    assert.notEqual(stored.proposer, zeroAddress);
    assert.equal(await decisions.read.decisionExists([101n]), true);

    await assert.rejects(() => decisions.write.recordDecision([{
      proposalId: 101n,
      proposer: zeroAddress,
      researchAgentId: 1n,
      skepticAgentId: 2n,
      councilAgentId: 3n,
      proposalHash: hash,
      researchReportHash: hash,
      skepticReportHash: hash,
      finalDecisionHash: hash,
      researchVote: 3,
      skepticVote: 2,
      councilVote: 3,
      decisionURI: "local://decision/duplicate",
      createdAt: 1n
    }]));
  });

  it("records multiple proposal ids without an auto-increment id", async () => {
    const decisions = await viem.deployContract("TreasuryDecisionRegistry");
    const hash = keccak256(toBytes("decision"));
    for (const proposalId of [201n, 202n, 203n]) {
      await decisions.write.recordDecision([{
        proposalId,
        proposer: zeroAddress,
        researchAgentId: 1n,
        skepticAgentId: 2n,
        councilAgentId: 3n,
        proposalHash: hash,
        researchReportHash: hash,
        skepticReportHash: hash,
        finalDecisionHash: hash,
        researchVote: 3,
        skepticVote: 2,
        councilVote: 3,
        decisionURI: `local://decision/${proposalId}`,
        createdAt: 1n
      }]);
      const stored = await decisions.read.getDecisionByProposal([proposalId]);
      assert.equal(stored.proposalId, proposalId);
    }
  });

  it("rejects invalid votes", async () => {
    const decisions = await viem.deployContract("TreasuryDecisionRegistry");
    const hash = keccak256(toBytes("decision"));
    await assert.rejects(() => decisions.write.recordDecision([{
      proposalId: 2n,
      proposer: zeroAddress,
      researchAgentId: 1n,
      skepticAgentId: 2n,
      councilAgentId: 3n,
      proposalHash: hash,
      researchReportHash: hash,
      skepticReportHash: hash,
      finalDecisionHash: hash,
      researchVote: 4,
      skepticVote: 2,
      councilVote: 3,
      decisionURI: "local://decision/2",
      createdAt: 1n
    }]));
  });
});

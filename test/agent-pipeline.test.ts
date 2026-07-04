import { describe, expect, it } from "vitest";
import { canonicalJson, hashPayload } from "../shared/hash";
import { createProposal } from "../server/store/state";
import { runResearchAgent } from "../server/agents/researchAgent";
import { runSkepticAgent } from "../server/agents/skepticAgent";
import { runCouncilAgent } from "../server/agents/councilAgent";
import { runProposalPipeline } from "../server/orchestrator";

describe("canonical hashing", () => {
  it("is stable across object key order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });
});

describe("agent reports", () => {
  it("produces specialist reports and a council decision", () => {
    const proposal = createProposal({
      treasurySize: 100000,
      allocationPercent: 10,
      question: "Should this treasury allocate 10% to RiverLend, TurboLP, VaultSteady, or stay in reserve?",
      candidateProtocolIds: ["riverlend", "turbolp", "vaultsteady"]
    });
    const research = runResearchAgent({ proposal, priorEvents: [] });
    const skeptic = runSkepticAgent({ proposal, priorEvents: [] });
    const decision = runCouncilAgent({ proposal, researchReport: research, skepticReport: skeptic, priorEvents: [] });
    expect(research.payloadHash).toMatch(/^0x/);
    expect(skeptic.payloadHash).toMatch(/^0x/);
    expect(decision.finalDecisionHash).toMatch(/^0x/);
    expect(decision.researchReportHash).toBe(research.payloadHash);
    expect(decision.skepticReportHash).toBe(skeptic.payloadHash);
  });
});

describe("orchestrator pipeline", () => {
  it("runs agents in order and marks the proposal recorded on-chain using mock mode", async () => {
    const proposal = createProposal({
      treasurySize: 100000,
      allocationPercent: 10,
      question: "Should this treasury allocate 10% to RiverLend, TurboLP, VaultSteady, or stay in reserve?",
      candidateProtocolIds: ["riverlend", "turbolp", "vaultsteady"]
    });
    const result = await runProposalPipeline(proposal.id);
    expect(result.proposal.status).toBe("recorded_on_chain");
    expect(result.proposal.chainTxHash).toMatch(/^0x/);
    expect(result.events.map((event: { type: string }) => event.type)).toEqual([
      "proposal.created",
      "analysis.submitted",
      "vote.cast",
      "analysis.submitted",
      "vote.cast",
      "decision.finalized",
      "vote.cast",
      "decision.recorded_on_chain"
    ]);
  });
});


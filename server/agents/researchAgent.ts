import type { AgentReport, Proposal, RoomEvent } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";
import { compareAllocationOptions, getCandidateProtocols, getTreasuryState } from "../tools/defiTools";

export type AgentInput = {
  proposal: Proposal;
  priorEvents: RoomEvent[];
};

export function runResearchAgent(input: AgentInput): AgentReport {
  const treasury = getTreasuryState(input.proposal);
  const ranked = compareAllocationOptions(getCandidateProtocols(input.proposal));
  const best = ranked[0];
  if (!best) throw new Error("ResearchAgent found no candidate protocols");

  const payload = {
    agentName: "ResearchAgent" as const,
    role: "research" as const,
    recommendation: `Prefer ${best.protocol.name} for a capped allocation because it has the best yield-adjusted opportunity score.`,
    vote: VOTE.approve,
    confidence: best.yieldScore >= 6 ? 0.82 : 0.64,
    targetProtocolId: best.protocol.id,
    summary: `${best.protocol.name} offers ${best.protocol.apy}% APY with ${(best.protocol.liquidityScore * 100).toFixed(0)}% liquidity score for a ${treasury.balance.toLocaleString()} ${treasury.asset} treasury.`,
    scores: ranked.map(({ protocol, yieldScore, riskScore }) => ({
      label: protocol.name,
      score: yieldScore,
      rationale: `Yield score ${yieldScore}/10, risk score ${riskScore}/10, APY ${protocol.apy}%, TVL ${protocol.tvl.toLocaleString()}.`
    })),
    evidenceRefs: ["synthetic:defi-protocol-dataset", `treasury:${treasury.id}`, "tool:compareAllocationOptions"],
    assumptions: ["Synthetic protocol metrics are treated as ground truth for the demo.", "ResearchAgent optimizes upside before risk vetoes."]
  };
  return { ...payload, payloadHash: hashPayload(payload) };
}

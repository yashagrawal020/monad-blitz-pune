import type { AgentReport, FinalDecision, Proposal, RoomEvent } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";
import { evaluatePolicy, getProtocolDataset, loadTreasuryPolicy } from "../tools/defiTools";

export type CouncilInput = {
  proposal: Proposal;
  researchReport: AgentReport;
  skepticReport: AgentReport;
  priorEvents: RoomEvent[];
};

export function runCouncilAgent(input: CouncilInput): FinalDecision {
  if (!input.researchReport || !input.skepticReport) {
    throw new Error("CouncilAgent requires both research and skeptic reports");
  }
  const policy = loadTreasuryPolicy();
  const protocols = getProtocolDataset();
  const preferredProtocol = protocols.find((protocol) => protocol.id === input.skepticReport.targetProtocolId)
    ?? protocols.find((protocol) => protocol.id === input.researchReport.targetProtocolId);
  if (!preferredProtocol) throw new Error("CouncilAgent could not resolve selected protocol");

  const policyResult = evaluatePolicy(preferredProtocol, input.proposal.allocationPercent, policy);
  const allocationPercent = policyResult.allowed ? Math.min(input.proposal.allocationPercent, 5) : 0;
  const reservePercent = 100 - allocationPercent;
  const vote = allocationPercent > 0 ? VOTE.approve : VOTE.reject;

  const decisionBody = {
    agentName: "CouncilAgent" as const,
    recommendation: allocationPercent > 0
      ? `Allocate ${allocationPercent}% to ${preferredProtocol.name} and keep ${reservePercent}% in reserve.`
      : "Do not allocate treasury capital under current policy constraints.",
    vote,
    confidence: policyResult.allowed ? 0.84 : 0.76,
    selectedProtocolId: preferredProtocol.id,
    allocationPercent,
    reservePercent,
    summary: allocationPercent > 0
      ? `Research found yield upside and SkepticAgent accepted ${preferredProtocol.name} with constraints. The council caps allocation below the requested ${input.proposal.allocationPercent}% to preserve reserve safety.`
      : `Policy blocked the allocation: ${policyResult.violations.join("; ")}.`,
    researchReportHash: input.researchReport.payloadHash,
    skepticReportHash: input.skepticReport.payloadHash
  };

  return { ...decisionBody, finalDecisionHash: hashPayload(decisionBody) };
}

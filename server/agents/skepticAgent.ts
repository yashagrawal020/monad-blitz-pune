import type { AgentReport, Proposal, RoomEvent } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";
import { calculateRiskScore, checkPolicyViolations, generateFailureCases, getCandidateProtocols, loadTreasuryPolicy } from "../tools/defiTools";

export type AgentInput = {
  proposal: Proposal;
  priorEvents: RoomEvent[];
};

export function runSkepticAgent(input: AgentInput): AgentReport {
  const policy = loadTreasuryPolicy();
  const candidates = getCandidateProtocols(input.proposal);
  const scored = candidates
    .map((protocol) => ({ protocol, riskScore: calculateRiskScore(protocol), violations: checkPolicyViolations(protocol, policy) }))
    .sort((a, b) => a.riskScore - b.riskScore);
  const safest = scored[0];
  if (!safest) throw new Error("SkepticAgent found no candidate protocols");

  const allFailureCases = scored.flatMap(({ protocol }) => generateFailureCases(protocol).map((item) => `${protocol.name}: ${item}`));
  const vote = safest.violations.length === 0 ? VOTE.conditional : VOTE.reject;
  const payload = {
    agentName: "SkepticAgent" as const,
    role: "risk" as const,
    recommendation: safest.violations.length === 0
      ? `Allow ${safest.protocol.name} only with a reduced/capped allocation and explicit reserve retention.`
      : "Reject allocation until policy violations are resolved.",
    vote,
    confidence: safest.riskScore <= 4 ? 0.86 : 0.72,
    targetProtocolId: safest.protocol.id,
    summary: `${safest.protocol.name} is the lowest-risk candidate with risk score ${safest.riskScore}/10. ${safest.violations.length ? `Violations: ${safest.violations.join("; ")}.` : "No hard policy violations found."}`,
    scores: scored.map(({ protocol, riskScore, violations }) => ({
      label: protocol.name,
      score: riskScore,
      rationale: violations.length ? violations.join("; ") : "Within MVP risk thresholds."
    })),
    evidenceRefs: ["synthetic:defi-protocol-dataset", "tool:calculateRiskScore", "tool:checkPolicyViolations"],
    assumptions: ["Lower risk score is better.", "Prior exploit history is a hard objection in the MVP policy.", ...allFailureCases.slice(0, 3)]
  };
  return { ...payload, payloadHash: hashPayload(payload) };
}

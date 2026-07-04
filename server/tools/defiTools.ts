import { PROTOCOLS, DEFAULT_TREASURY, TREASURY_POLICY } from "../data/demoData";
import type { ProtocolMetrics, Proposal, TreasuryPolicy } from "../../shared/types";

export function getTreasuryState(proposal?: Proposal) {
  return { ...DEFAULT_TREASURY, balance: proposal?.treasurySize ?? DEFAULT_TREASURY.balance };
}

export function getProtocolDataset(): ProtocolMetrics[] {
  return PROTOCOLS;
}

export function loadTreasuryPolicy(): TreasuryPolicy {
  return TREASURY_POLICY;
}

export function getCandidateProtocols(proposal: Proposal): ProtocolMetrics[] {
  const ids = new Set(proposal.candidateProtocolIds);
  return PROTOCOLS.filter((protocol) => ids.has(protocol.id));
}

export function calculateYieldScore(protocol: ProtocolMetrics) {
  const apyScore = Math.min(protocol.apy / 4, 10);
  const liquidityScore = protocol.liquidityScore * 10;
  const tvlScore = Math.min(protocol.tvl / 5000000, 10);
  const lockupPenalty = Math.min(protocol.lockupDays / 3, 4);
  const score = clamp((apyScore * 0.45) + (liquidityScore * 0.3) + (tvlScore * 0.25) - lockupPenalty, 0, 10);
  return Number(score.toFixed(2));
}

export function calculateRiskScore(protocol: ProtocolMetrics) {
  const score = clamp(
    (protocol.adminKeyRisk * 3) +
      (protocol.oracleRisk * 2) +
      ((1 - protocol.liquidityScore) * 2) +
      (protocol.volatilityScore * 2) +
      (protocol.exploitHistory ? 2 : 0) +
      Math.min(protocol.lockupDays / 10, 1),
    0,
    10
  );
  return Number(score.toFixed(2));
}

export function checkPolicyViolations(protocol: ProtocolMetrics, policy: TreasuryPolicy) {
  const violations: string[] = [];
  const riskScore = calculateRiskScore(protocol);
  if (protocol.liquidityScore < policy.minLiquidityScore) violations.push(`liquidity ${protocol.liquidityScore.toFixed(2)} below minimum ${policy.minLiquidityScore.toFixed(2)}`);
  if (riskScore > policy.maxRiskScore) violations.push(`risk score ${riskScore.toFixed(2)} above maximum ${policy.maxRiskScore.toFixed(2)}`);
  if (protocol.exploitHistory) violations.push("prior exploit history requires rejection in MVP policy");
  return violations;
}

export function generateFailureCases(protocol: ProtocolMetrics) {
  const cases = [
    `Admin-key compromise could alter ${protocol.name} parameters before treasury exits.`,
    "Oracle distortion could misprice positions and hide losses.",
    "Liquidity contraction could make a 10% treasury exit slower than expected."
  ];
  if (protocol.exploitHistory) cases.unshift(`${protocol.name} has seeded exploit history in the demo dataset.`);
  if (protocol.lockupDays > 0) cases.push(`${protocol.lockupDays}-day lockup reduces emergency response ability.`);
  return cases;
}

export function compareAllocationOptions(protocols: ProtocolMetrics[]) {
  return protocols
    .map((protocol) => ({ protocol, yieldScore: calculateYieldScore(protocol), riskScore: calculateRiskScore(protocol) }))
    .sort((a, b) => (b.yieldScore - b.riskScore * 0.55) - (a.yieldScore - a.riskScore * 0.55));
}

export function evaluatePolicy(protocol: ProtocolMetrics, allocationPercent: number, policy: TreasuryPolicy) {
  const violations = checkPolicyViolations(protocol, policy);
  if (allocationPercent > policy.maxAllocationPercent) violations.push(`allocation ${allocationPercent}% above max ${policy.maxAllocationPercent}%`);
  return { allowed: violations.length === 0, violations };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

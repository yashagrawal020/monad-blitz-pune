import { z } from "zod";
import type { AgentReport, AgentToolTrace, Proposal, RoomEvent } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";
import { calculateRiskScore, checkPolicyViolations, generateFailureCases, getCandidateProtocols, loadTreasuryPolicy } from "../tools/defiTools";
import { isLlmConfigured, runAgentHarness } from "./harness";
import { skepticTools } from "./toolRegistry";

export type AgentInput = {
  proposal: Proposal;
  priorEvents: RoomEvent[];
  researchReport: AgentReport;
  onToolResult?: (trace: AgentToolTrace) => void;
};

const scoreSchema = z.object({
  label: z.string(),
  score: z.coerce.number(),
  rationale: z.string()
});

const reportSchema = z.object({
  recommendation: z.string(),
  vote: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  confidence: z.coerce.number().min(0).max(1),
  targetProtocolId: z.string(),
  summary: z.string(),
  scores: z.array(scoreSchema).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([])
});

export async function runSkepticAgent(input: AgentInput): Promise<AgentReport> {
  if (!isLlmConfigured()) return runSkepticAgentFallback(input);

  return runAgentHarness<AgentReport>({
    agentName: "SkepticAgent",
    systemPrompt: [
      "You are SkepticAgent, the adversarial risk specialist in a Monad treasury council.",
      "The orchestrator injects the ResearchAgent report directly into your context. Do not fetch it as a tool.",
      "Your job is to call risk/policy tools, challenge the upside case, and produce a structured risk report."
    ].join("\n"),
    task: "Produce the SkepticAgent downside/risk report for this treasury allocation proposal.",
    context: {
      proposal: input.proposal,
      researchReport: input.researchReport,
      priorPublicEvents: input.priorEvents.map(({ type, sender, payloadHash }) => ({ type, sender, payloadHash }))
    },
    outputContract: [
      "Return JSON with fields:",
      "{ recommendation: string, vote: 0|1|2|3, confidence: number 0..1, targetProtocolId: string, summary: string,",
      "scores: [{ label: string, score: number, rationale: string }], evidenceRefs: string[], assumptions: string[] }",
      "Vote encoding: 0=abstain, 1=reject, 2=conditional, 3=approve.",
      "As SkepticAgent, prefer vote=2 for acceptable-but-capped risk, vote=1 for hard policy violations, and vote=3 only when risk is clearly low."
    ].join(" "),
    tools: skepticTools(),
    toolContext: { proposal: input.proposal, researchReport: input.researchReport },
    onToolResult: input.onToolResult,
    parseFinal: (value, trace) => {
      const parsed = reportSchema.parse(value);
      const payload = {
        agentName: "SkepticAgent" as const,
        role: "risk" as const,
        ...parsed,
        toolTrace: trace
      };
      return { ...payload, payloadHash: hashPayload(payload) };
    }
  });
}

function runSkepticAgentFallback(input: AgentInput): AgentReport {
  const policy = loadTreasuryPolicy();
  const candidates = getCandidateProtocols(input.proposal);
  const scored = candidates
    .map((protocol) => ({ protocol, riskScore: calculateRiskScore(protocol), violations: checkPolicyViolations(protocol, policy) }))
    .sort((a, b) => a.riskScore - b.riskScore);
  const safest = scored[0];
  if (!safest) throw new Error("SkepticAgent found no candidate protocols");

  const allFailureCases = scored.flatMap(({ protocol }) => generateFailureCases(protocol).map((item) => `${protocol.name}: ${item}`));
  const vote = safest.violations.length === 0 ? VOTE.conditional : VOTE.reject;
  const toolTrace = [
    { toolName: "calculateRiskScore", args: { protocolId: safest.protocol.id }, resultSummary: String(safest.riskScore) },
    { toolName: "checkPolicyViolations", args: { protocolId: safest.protocol.id }, resultSummary: safest.violations.join("; ") || "none" }
  ];
  toolTrace.forEach((trace) => input.onToolResult?.(trace));

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
    assumptions: ["Lower risk score is better.", "Prior exploit history is a hard objection in the MVP policy.", ...allFailureCases.slice(0, 3)],
    toolTrace
  };
  return { ...payload, payloadHash: hashPayload(payload) };
}

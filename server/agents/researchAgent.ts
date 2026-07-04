import { z } from "zod";
import type { AgentReport, AgentToolTrace, Proposal, RoomEvent } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";
import { compareAllocationOptions, getCandidateProtocols, getTreasuryState } from "../tools/defiTools";
import { isLlmConfigured, runAgentHarness } from "./harness";
import { researchTools } from "./toolRegistry";

export type AgentInput = {
  proposal: Proposal;
  priorEvents: RoomEvent[];
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

export async function runResearchAgent(input: AgentInput): Promise<AgentReport> {
  if (!isLlmConfigured()) return runResearchAgentFallback(input);

  return runAgentHarness<AgentReport>({
    agentName: "ResearchAgent",
    systemPrompt: [
      "You are ResearchAgent, the upside and yield specialist in a Monad treasury council.",
      "Your job is to inspect treasury state and candidate protocols, call tools for calculations, and produce a structured upside report.",
      "Optimize for yield opportunity, liquidity, and clear evidence. Do not make the final treasury decision."
    ].join("\n"),
    task: "Produce the ResearchAgent yield/upside report for this treasury allocation proposal.",
    context: {
      proposal: input.proposal,
      priorPublicEvents: input.priorEvents.map(({ type, sender, payloadHash }) => ({ type, sender, payloadHash }))
    },
    outputContract: [
      "Return JSON with fields:",
      "{ recommendation: string, vote: 0|1|2|3, confidence: number 0..1, targetProtocolId: string, summary: string,",
      "scores: [{ label: string, score: number, rationale: string }], evidenceRefs: string[], assumptions: string[] }",
      "Vote encoding: 0=abstain, 1=reject, 2=conditional, 3=approve.",
      "As ResearchAgent, use vote=3 when a candidate has clear upside and vote=2 when upside exists but needs caps. Use vote=1 only if no candidate is worth further consideration."
    ].join(" "),
    tools: researchTools(),
    toolContext: { proposal: input.proposal },
    onToolResult: input.onToolResult,
    parseFinal: (value, trace) => {
      const parsed = reportSchema.parse(value);
      const payload = {
        agentName: "ResearchAgent" as const,
        role: "research" as const,
        ...parsed,
        toolTrace: trace
      };
      return { ...payload, payloadHash: hashPayload(payload) };
    }
  });
}

function runResearchAgentFallback(input: AgentInput): AgentReport {
  const treasury = getTreasuryState(input.proposal);
  const ranked = compareAllocationOptions(getCandidateProtocols(input.proposal));
  const best = ranked[0];
  if (!best) throw new Error("ResearchAgent found no candidate protocols");

  const toolTrace = [
    { toolName: "getTreasuryState", args: {}, resultSummary: `${treasury.balance} ${treasury.asset}` },
    { toolName: "compareAllocationOptions", args: {}, resultSummary: `top=${best.protocol.id}, score=${best.yieldScore}` }
  ];
  toolTrace.forEach((trace) => input.onToolResult?.(trace));

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
    assumptions: ["Synthetic protocol metrics are treated as ground truth for the demo.", "ResearchAgent optimizes upside before risk vetoes."],
    toolTrace
  };
  return { ...payload, payloadHash: hashPayload(payload) };
}

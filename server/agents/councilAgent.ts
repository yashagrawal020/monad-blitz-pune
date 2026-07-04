import { z } from "zod";
import type { AgentReport, AgentToolTrace, FinalDecision, Proposal, RoomEvent } from "../../shared/types";
import { VOTE } from "../../shared/types";
import { hashPayload } from "../../shared/hash";
import { evaluatePolicy, getProtocolDataset, loadTreasuryPolicy } from "../tools/defiTools";
import { isLlmConfigured, runAgentHarness } from "./harness";
import { councilTools } from "./toolRegistry";

export type CouncilInput = {
  proposal: Proposal;
  researchReport: AgentReport;
  skepticReport: AgentReport;
  priorEvents: RoomEvent[];
  onToolResult?: (trace: AgentToolTrace) => void;
};

const decisionSchema = z.object({
  recommendation: z.string(),
  vote: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  confidence: z.coerce.number().min(0).max(1),
  selectedProtocolId: z.string(),
  allocationPercent: z.coerce.number().min(0).max(100),
  reservePercent: z.coerce.number().min(0).max(100),
  summary: z.string()
});

export async function runCouncilAgent(input: CouncilInput): Promise<FinalDecision> {
  if (!input.researchReport || !input.skepticReport) {
    throw new Error("CouncilAgent requires both research and skeptic reports");
  }
  if (!isLlmConfigured()) return runCouncilAgentFallback(input);

  return runAgentHarness<FinalDecision>({
    agentName: "CouncilAgent",
    systemPrompt: [
      "You are CouncilAgent, the final decision aggregator in a Monad treasury council.",
      "The orchestrator injects both specialist reports directly into your context. Do not fetch prior reports as tools.",
      "Your job is to call policy/vote tools, reconcile upside and risk, then produce the final treasury recommendation.",
      "Keep the recommendation demo-safe: no autonomous transaction execution, only a decision commitment."
    ].join("\n"),
    task: "Produce the CouncilAgent final decision for this treasury allocation proposal.",
    context: {
      proposal: input.proposal,
      researchReport: input.researchReport,
      skepticReport: input.skepticReport,
      priorPublicEvents: input.priorEvents.map(({ type, sender, payloadHash }) => ({ type, sender, payloadHash }))
    },
    outputContract: [
      "Return JSON with fields:",
      "{ recommendation: string, vote: 0|1|2|3, confidence: number 0..1, selectedProtocolId: string,",
      "allocationPercent: number, reservePercent: number, summary: string }",
      "Vote encoding: 0=abstain, 1=reject, 2=conditional, 3=approve.",
      "As CouncilAgent, use vote=3 only when the final allocation is allowed under policy, vote=2 for a reduced/capped approval, and vote=1 when allocationPercent is 0."
    ].join(" "),
    tools: councilTools(),
    toolContext: {
      proposal: input.proposal,
      researchReport: input.researchReport,
      skepticReport: input.skepticReport
    },
    onToolResult: input.onToolResult,
    parseFinal: (value, trace) => {
      const parsed = decisionSchema.parse(value);
      const decisionBody = {
        agentName: "CouncilAgent" as const,
        ...parsed,
        researchReportHash: input.researchReport.payloadHash,
        skepticReportHash: input.skepticReport.payloadHash,
        toolTrace: trace
      };
      return { ...decisionBody, finalDecisionHash: hashPayload(decisionBody) };
    }
  });
}

function runCouncilAgentFallback(input: CouncilInput): FinalDecision {
  const policy = loadTreasuryPolicy();
  const protocols = getProtocolDataset();
  const preferredProtocol = protocols.find((protocol) => protocol.id === input.skepticReport.targetProtocolId)
    ?? protocols.find((protocol) => protocol.id === input.researchReport.targetProtocolId);
  if (!preferredProtocol) throw new Error("CouncilAgent could not resolve selected protocol");

  const policyResult = evaluatePolicy(preferredProtocol, input.proposal.allocationPercent, policy);
  const allocationPercent = policyResult.allowed ? Math.min(input.proposal.allocationPercent, 5) : 0;
  const reservePercent = 100 - allocationPercent;
  const vote = allocationPercent > 0 ? VOTE.approve : VOTE.reject;
  const toolTrace = [
    { toolName: "aggregateVotes", args: {}, resultSummary: `research=${input.researchReport.vote}, skeptic=${input.skepticReport.vote}` },
    { toolName: "evaluatePolicy", args: { protocolId: preferredProtocol.id, allocationPercent: input.proposal.allocationPercent }, resultSummary: policyResult.allowed ? "allowed" : policyResult.violations.join("; ") }
  ];
  toolTrace.forEach((trace) => input.onToolResult?.(trace));

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
    skepticReportHash: input.skepticReport.payloadHash,
    toolTrace
  };

  return { ...decisionBody, finalDecisionHash: hashPayload(decisionBody) };
}
